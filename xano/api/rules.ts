import { query, s, c, ref, col, expr } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { economyRules } from "../tables/economy-rules.js";

/** The active rule set (the one row with active = true). */
export const rulesQuery = query({
  name: "rules",
  verb: "GET",
  apiGroup: economyGroup,
  stack: [
    s.db.query({
      table: economyRules,
      where: expr(col("active"), "=", c.bool(true)),
      returnType: "single",
      as: "rules",
    }),
  ],
  response: ref("rules"),
});
