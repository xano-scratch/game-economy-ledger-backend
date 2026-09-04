import { table, f } from "@xanots/sdk";
import { players } from "./players.js";

/**
 * One wallet per player per currency. `balance` is the cached balance: it is
 * kept equal to the sum of this wallet's ledger entries by every mutation, so
 * the two always reconcile (the balance endpoint proves it).
 */
export const wallets = table({
  name: "wallets",
  schema: {
    player_id: f.tableRef(players, { required: true }),
    currency: f.enum(["coins", "gems"], { required: true }),
    // held as a whole count of the smallest unit (an int), never a decimal.
    balance: f.int({ required: true, default: 0 }),
  },
  index: [
    { type: "unique", fields: [{ name: "player_id" }, { name: "currency" }] },
  ],
});
