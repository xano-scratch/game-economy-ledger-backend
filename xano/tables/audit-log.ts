import { table, f } from "@xanots/sdk";
import { players } from "./players.js";
import { authUsers } from "./auth.js";

/**
 * The governance trail. Every earn, spend, grant, and refund writes one row
 * here, allowed or rejected, with the reason_code and the rule_version in
 * force. This is what the operator audit screen reads.
 */
export const auditLog = table({
  name: "audit_log",
  schema: {
    // the authenticated operator for grant/refund; 0 for an anonymous game call.
    actor_id: f.tableRef(authUsers, { required: true, default: 0 }),
    action: f.text({ required: true }),
    target_player_id: f.tableRef(players, { required: true, default: 0 }),
    outcome: f.enum(["allowed", "rejected"], { required: true }),
    // insufficient_balance | duplicate_txn | over_daily_cap | over_txn_limit |
    // already_refunded | not_a_spend | ok
    reason_code: f.text({ required: true }),
    rule_version: f.int({ required: true }),
    detail: f.json(),
  },
  index: [
    { type: "btree", fields: [{ name: "outcome" }] },
    { type: "btree", fields: [{ name: "target_player_id" }] },
  ],
});
