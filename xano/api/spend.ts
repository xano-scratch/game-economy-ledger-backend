import { query, s, c, ref, inp, col, expr, and, input, obj, withFilters, fl } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { wallets } from "../tables/wallets.js";
import { ledgerEntries } from "../tables/ledger-entries.js";
import { economyRules } from "../tables/economy-rules.js";
import { auditLog } from "../tables/audit-log.js";

/**
 * Debit currency for a purchase. Checked in order: a repeat key is refused
 * duplicate_txn; an amount over max_spend_per_txn is over_txn_limit; a balance
 * that cannot cover it (unless allow_negative) is insufficient_balance. A
 * rejection writes an audit row and posts no ledger entry.
 */
export const spendQuery = query({
  name: "spend",
  verb: "POST",
  apiGroup: economyGroup,
  input: {
    wallet_id: input.int({ required: true }),
    amount: input.int({ required: true }),
    source: input.text({ required: true }),
    idempotency_key: input.text({ required: true }),
  },
  stack: [
    s.precondition({
      expr: expr(inp("amount"), ">", c.int(0)),
      error: c.text("Amount must be a positive integer."),
      error_type: "inputerror",
    }),
    s.db.get({ table: wallets, fieldValue: inp("wallet_id"), as: "wallet" }),
    s.precondition({
      expr: expr(ref("wallet", { safe: true }), "!=", c.null()),
      error: c.text("Wallet not found."),
      error_type: "notfound",
    }),
    s.db.query({ table: economyRules, where: expr(col("active"), "=", c.bool(true)), returnType: "single", as: "rules" }),
    s.precondition({
      expr: expr(ref("rules", { safe: true }), "!=", c.null()),
      error: c.text("No active economy rules."),
      error_type: "standard",
    }),

    // decide (first failing rule wins).
    s.db.has({ table: ledgerEntries, fieldName: "idempotency_key", fieldValue: inp("idempotency_key"), as: "dup" }),
    s.set_var("reason", c.text("ok")),
    s.conditional({
      when: and(expr(ref("reason"), "=", c.text("ok")), expr(ref("dup"), "=", c.bool(true))),
      then: [s.set_var("reason", c.text("duplicate_txn"))],
    }),
    s.conditional({
      when: and(expr(ref("reason"), "=", c.text("ok")), expr(inp("amount"), ">", ref("rules.max_spend_per_txn"))),
      then: [s.set_var("reason", c.text("over_txn_limit"))],
    }),
    s.conditional({
      when: and(
        expr(ref("reason"), "=", c.text("ok")),
        expr(ref("rules.allow_negative"), "=", c.bool(false)),
        expr(ref("wallet.balance"), "<", inp("amount")),
      ),
      then: [s.set_var("reason", c.text("insufficient_balance"))],
    }),

    // apply if allowed.
    s.set_var("outcome", c.text("rejected")),
    s.set_var("balance_after", ref("wallet.balance")),
    s.set_var("entry_id", c.int(0)),
    s.conditional({
      when: expr(ref("reason"), "=", c.text("ok")),
      then: [
        s.set_var("outcome", c.text("allowed")),
        // stored signed: a spend is a debit (negative). balance_after = balance - amount.
        s.set_var("signed_amount", withFilters(inp("amount"), fl.mul(c.int(-1)))),
        s.set_var("balance_after", withFilters(ref("wallet.balance"), fl.sub(inp("amount")))),
        s.db.add({
          table: ledgerEntries,
          row: {
            wallet_id: ref("wallet.id"),
            player_id: ref("wallet.player_id"),
            kind: "spend",
            amount: ref("signed_amount"),
            source: inp("source"),
            idempotency_key: inp("idempotency_key"),
            rule_version: ref("rules.version"),
            balance_after: ref("balance_after"),
            ref_entry_id: 0,
          },
          as: "entry",
        }),
        s.set_var("entry_id", ref("entry.id")),
        s.db.edit({ table: wallets, fieldValue: ref("wallet.id"), row: { balance: ref("balance_after") } }),
      ],
    }),

    // always audit.
    s.db.add({
      table: auditLog,
      row: {
        actor_id: 0,
        action: "spend",
        target_player_id: ref("wallet.player_id"),
        outcome: ref("outcome"),
        reason_code: ref("reason"),
        rule_version: ref("rules.version"),
        detail: obj({ wallet_id: ref("wallet.id"), amount: inp("amount"), source: inp("source") }),
      },
    }),
  ],
  response: {
    outcome: ref("outcome"),
    reason_code: ref("reason"),
    balance_after: ref("balance_after"),
    entry_id: ref("entry_id"),
  },
});
