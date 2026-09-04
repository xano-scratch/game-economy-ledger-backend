import { query, s, c, ref, inp, col, expr, and, input, obj, withFilters, fl } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { wallets } from "../tables/wallets.js";
import { ledgerEntries } from "../tables/ledger-entries.js";
import { economyRules } from "../tables/economy-rules.js";
import { auditLog } from "../tables/audit-log.js";

/**
 * Credit currency from a game source (an achievement or an in-app purchase).
 * Rules: amount must be positive (400), and the idempotency_key must be new (a
 * repeat is refused duplicate_txn and posts no ledger row). A public endpoint,
 * so the audit actor is 0 (the game client).
 */
export const earnQuery = query({
  name: "earn",
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

    // decide.
    s.db.has({ table: ledgerEntries, fieldName: "idempotency_key", fieldValue: inp("idempotency_key"), as: "dup" }),
    s.set_var("reason", c.text("ok")),
    s.conditional({
      when: and(expr(ref("reason"), "=", c.text("ok")), expr(ref("dup"), "=", c.bool(true))),
      then: [s.set_var("reason", c.text("duplicate_txn"))],
    }),

    // apply if allowed.
    s.set_var("outcome", c.text("rejected")),
    s.set_var("balance_after", ref("wallet.balance")),
    s.set_var("entry_id", c.int(0)),
    s.conditional({
      when: expr(ref("reason"), "=", c.text("ok")),
      then: [
        s.set_var("outcome", c.text("allowed")),
        s.set_var("balance_after", withFilters(ref("wallet.balance"), fl.add(inp("amount")))),
        s.db.add({
          table: ledgerEntries,
          row: {
            wallet_id: ref("wallet.id"),
            player_id: ref("wallet.player_id"),
            kind: "earn",
            amount: inp("amount"),
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
        action: "earn",
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
