import { query, s, ref, inp, col, expr, input } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { ledgerEntries } from "../tables/ledger-entries.js";

/** A player's append-only ledger entries, newest first. Feeds the ledger view. */
export const ledgerQuery = query({
  name: "ledger",
  verb: "GET",
  apiGroup: economyGroup,
  input: { player_id: input.int({ required: true }) },
  stack: [
    s.db.query({
      table: ledgerEntries,
      where: expr(col("player_id"), "=", inp("player_id")),
      sort: [{ sortBy: "id", dir: "desc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
