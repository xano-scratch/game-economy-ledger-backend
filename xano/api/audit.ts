import { query, s, c, ref, inp, col, auth, expr, and, or, cmp, input } from "@xanots/sdk";
import { adminGroup } from "./groups.js";
import { authUsers } from "../tables/auth.js";
import { auditLog } from "../tables/audit-log.js";

/**
 * The governance trail: every allowed and rejected action with its reason_code
 * and rule_version. Role-gated (ops/admin). Optional filters by outcome and by
 * player narrow the list; an empty filter is dropped (shows all).
 */
export const auditQuery = query({
  name: "audit",
  verb: "GET",
  apiGroup: adminGroup,
  auth: authUsers,
  input: {
    outcome: input.text(),
    player_id: input.int(),
  },
  stack: [
    s.db.get({ table: authUsers, fieldValue: auth("id"), output: ["id", "role"], as: "me" }),
    s.precondition({
      expr: or(expr(ref("me.role"), "=", c.text("ops")), expr(ref("me.role"), "=", c.text("admin"))),
      error: c.text("Operator role required."),
      error_type: "accessdenied",
    }),
    s.db.query({
      table: auditLog,
      where: and(
        cmp(col("outcome"), "=", inp("outcome"), { ignoreEmpty: true }),
        cmp(col("target_player_id"), "=", inp("player_id"), { ignoreEmpty: true }),
      ),
      sort: [{ sortBy: "id", dir: "desc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
