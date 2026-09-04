import { query, ref, s } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { players } from "../tables/players.js";
import { wallets } from "../tables/wallets.js";

/**
 * Every player and every wallet, for the player picker and balance rows. Both
 * arrays are returned fully typed; the frontend joins wallets to players by
 * player_id.
 */
export const playersQuery = query({
  name: "players",
  verb: "GET",
  apiGroup: economyGroup,
  stack: [
    s.db.query({ table: players, sort: [{ sortBy: "id", dir: "asc" }], as: "players" }),
    s.db.query({ table: wallets, sort: [{ sortBy: "id", dir: "asc" }], as: "wallets" }),
  ],
  response: { players: ref("players"), wallets: ref("wallets") },
});
