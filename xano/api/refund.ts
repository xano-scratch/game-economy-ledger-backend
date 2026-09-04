import { query, s, c, ref, inp, col, auth, expr, and, or, input, obj, withFilters, fl } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { authUsers } from "../tables/auth.js";
import { wallets } from "../tables/wallets.js";
import { ledgerEntries } from "../tables/ledger-entries.js";
import { economyRules } from "../tables/economy-rules.js";
import { auditLog } from "../tables/audit-log.js";

/**
 * Reverse a prior spend by ref_entry_id. Role-gated (ops/admin). Rules: the
 * referenced entry must exist and be a spend (else not_a_spend), and it must
 * not already have a refund pointing at it (else already_refunded, so a second
 * refund of the same spend is idempotent). The refund re-credits the wallet
 * with a new positive entry; the original spend is never touched.
 */
export const refundQuery = query({
  name: "refund",
  verb: "POST",
  apiGroup: economyGroup,
  auth: authUsers,
  input: {
    ref_entry_id: input.int({ required: true }),
    idempotency_key: input.text({ required: true }),
  },
  stack: [
    // RBAC: operators only.
    s.db.get({ table: authUsers, fieldValue: auth("id"), output: ["id", "role"], as: "me" }),
    s.precondition({
      expr: or(expr(ref("me.role"), "=", c.text("ops")), expr(ref("me.role"), "=", c.text("admin"))),
      error: c.text("Operator role required."),
      error_type: "accessdenied",
    }),
    s.db.query({ table: economyRules, where: expr(col("active"), "=", c.bool(true)), returnType: "single", as: "rules" }),
    s.precondition({
      expr: expr(ref("rules", { safe: true }), "!=", c.null()),
      error: c.text("No active economy rules."),
      error_type: "standard",
    }),

    // the entry being reversed (null for an unknown id — no 500).
    s.db.get({ table: ledgerEntries, fieldValue: inp("ref_entry_id"), as: "orig" }),
    s.db.query({
      table: ledgerEntries,
      where: [expr(col("kind"), "=", c.text("refund")), expr(col("ref_entry_id"), "=", inp("ref_entry_id"))],
      returnType: "exists",
      as: "already",
    }),
    s.db.has({ table: ledgerEntries, fieldName: "idempotency_key", fieldValue: inp("idempotency_key"), as: "dup" }),

    // decide (first failing rule wins).
    s.set_var("reason", c.text("ok")),
    s.conditional({
      when: and(
        expr(ref("reason"), "=", c.text("ok")),
        or(expr(ref("orig"), "=", c.null()), expr(ref("orig.kind", { safe: true }), "!=", c.text("spend"))),
      ),
      then: [s.set_var("reason", c.text("not_a_spend"))],
    }),
    s.conditional({
      when: and(expr(ref("reason"), "=", c.text("ok")), expr(ref("already"), "=", c.bool(true))),
      then: [s.set_var("reason", c.text("already_refunded"))],
    }),
    s.conditional({
      when: and(expr(ref("reason"), "=", c.text("ok")), expr(ref("dup"), "=", c.bool(true))),
      then: [s.set_var("reason", c.text("duplicate_txn"))],
    }),

    // the audited player, safe when orig is null.
    s.set_var("target_pid", c.int(0)),
    s.conditional({
      when: expr(ref("orig"), "!=", c.null()),
      then: [s.set_var("target_pid", ref("orig.player_id"))],
    }),

    // apply if allowed. Inside this branch orig is a real spend, so its fields
    // read without a null-safe guard.
    s.set_var("outcome", c.text("rejected")),
    s.set_var("balance_after", c.int(0)),
    s.set_var("refunded_amount", c.int(0)),
    s.set_var("entry_id", c.int(0)),
    s.conditional({
      when: expr(ref("reason"), "=", c.text("ok")),
      then: [
        s.set_var("outcome", c.text("allowed")),
        // orig.amount is negative (a debit); the refund re-credits its magnitude.
        s.set_var("refunded_amount", withFilters(ref("orig.amount"), fl.mul(c.int(-1)))),
        s.db.get({ table: wallets, fieldValue: ref("orig.wallet_id"), as: "wallet" }),
        s.set_var("balance_after", withFilters(ref("wallet.balance"), fl.add(ref("refunded_amount")))),
        s.db.add({
          table: ledgerEntries,
          row: {
            wallet_id: ref("orig.wallet_id"),
            player_id: ref("orig.player_id"),
            kind: "refund",
            amount: ref("refunded_amount"),
            source: "refund",
            idempotency_key: inp("idempotency_key"),
            rule_version: ref("rules.version"),
            balance_after: ref("balance_after"),
            ref_entry_id: ref("orig.id"),
          },
          as: "entry",
        }),
        s.set_var("entry_id", ref("entry.id")),
        s.db.edit({ table: wallets, fieldValue: ref("orig.wallet_id"), row: { balance: ref("balance_after") } }),
      ],
    }),

    // always audit.
    s.db.add({
      table: auditLog,
      row: {
        actor_id: auth("id"),
        action: "refund",
        target_player_id: ref("target_pid"),
        outcome: ref("outcome"),
        reason_code: ref("reason"),
        rule_version: ref("rules.version"),
        detail: obj({ ref_entry_id: inp("ref_entry_id"), refunded_amount: ref("refunded_amount") }),
      },
    }),
  ],
  response: {
    outcome: ref("outcome"),
    reason_code: ref("reason"),
    balance_after: ref("balance_after"),
    refunded_amount: ref("refunded_amount"),
    entry_id: ref("entry_id"),
  },
});
