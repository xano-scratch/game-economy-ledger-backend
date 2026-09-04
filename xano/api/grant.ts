import { query, s, c, ref, inp, col, auth, expr, and, or, input, obj, withFilters, fl } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { authUsers } from "../tables/auth.js";
import { wallets } from "../tables/wallets.js";
import { ledgerEntries } from "../tables/ledger-entries.js";
import { economyRules } from "../tables/economy-rules.js";
import { auditLog } from "../tables/audit-log.js";

/**
 * An operator grants currency to a player. Role-gated: `auth:` refuses an
 * anonymous request (401), and the role check refuses a player token (403).
 * Rule: today's granted total for that player, plus this amount, must not
 * exceed daily_grant_cap (a rolling 24h window), else over_daily_cap.
 */
export const grantQuery = query({
  name: "grant",
  verb: "POST",
  apiGroup: economyGroup,
  auth: authUsers,
  input: {
    wallet_id: input.int({ required: true }),
    amount: input.int({ required: true }),
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

    // rolling-24h grant tally for this player. The cutoff is computed in the
    // request (epochms_add_ms has no SQL form), then compared in the query.
    s.set_var("cutoff", withFilters(c.now(), fl.epochms_add_ms(c.int(-86400000)))),
    s.db.query({
      table: ledgerEntries,
      where: [
        expr(col("player_id"), "=", ref("wallet.player_id")),
        expr(col("kind"), "=", c.text("grant")),
        expr(col("created_at"), ">=", ref("cutoff")),
      ],
      output: ["amount"],
      as: "recent_grants",
    }),
    s.array.map({ source: ref("recent_grants"), transform: ref("$this.amount"), as: "grant_amounts" }),
    s.set_var("granted_today", ref("grant_amounts"), { asFilters: [fl.sum()] }),
    s.set_var("projected", withFilters(ref("granted_today"), fl.add(inp("amount")))),

    // decide.
    s.db.has({ table: ledgerEntries, fieldName: "idempotency_key", fieldValue: inp("idempotency_key"), as: "dup" }),
    s.set_var("reason", c.text("ok")),
    s.conditional({
      when: and(expr(ref("reason"), "=", c.text("ok")), expr(ref("dup"), "=", c.bool(true))),
      then: [s.set_var("reason", c.text("duplicate_txn"))],
    }),
    s.conditional({
      when: and(expr(ref("reason"), "=", c.text("ok")), expr(ref("projected"), ">", ref("rules.daily_grant_cap"))),
      then: [s.set_var("reason", c.text("over_daily_cap"))],
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
            kind: "grant",
            amount: inp("amount"),
            source: "operator",
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

    // always audit (with the operator as actor).
    s.db.add({
      table: auditLog,
      row: {
        actor_id: auth("id"),
        action: "grant",
        target_player_id: ref("wallet.player_id"),
        outcome: ref("outcome"),
        reason_code: ref("reason"),
        rule_version: ref("rules.version"),
        detail: obj({ wallet_id: ref("wallet.id"), amount: inp("amount"), granted_today: ref("granted_today") }),
      },
    }),
  ],
  response: {
    outcome: ref("outcome"),
    reason_code: ref("reason"),
    balance_after: ref("balance_after"),
    entry_id: ref("entry_id"),
    granted_today: ref("granted_today"),
  },
});
