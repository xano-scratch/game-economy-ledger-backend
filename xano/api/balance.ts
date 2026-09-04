import { query, s, c, ref, inp, col, expr, input, obj, withFilters, fl } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { wallets } from "../tables/wallets.js";
import { ledgerEntries } from "../tables/ledger-entries.js";

/**
 * For a player, each currency's cached balance alongside a balance recomputed
 * by summing that wallet's ledger entries. The two always match: this endpoint
 * is the reconstructable-from-the-ledger claim, made visible. The currencies
 * are the two the enum defines (coins, gems), so the response is a typed record
 * the frontend reads without any hand-written shape.
 */
export const balanceQuery = query({
  name: "balance",
  verb: "GET",
  apiGroup: economyGroup,
  input: { player_id: input.int({ required: true }) },
  stack: [
    // ── coins ──
    s.db.query({
      table: wallets,
      where: [expr(col("player_id"), "=", inp("player_id")), expr(col("currency"), "=", c.text("coins"))],
      returnType: "single",
      as: "coins_w",
    }),
    s.set_var("coins_ledger", c.int(0)),
    s.conditional({
      when: expr(ref("coins_w"), "!=", c.null()),
      then: [
        s.db.query({ table: ledgerEntries, where: expr(col("wallet_id"), "=", ref("coins_w.id")), output: ["amount"], as: "coins_entries" }),
        s.array.map({ source: ref("coins_entries"), transform: ref("$this.amount"), as: "coins_amounts" }),
        s.set_var("coins_ledger", ref("coins_amounts"), { asFilters: [fl.sum()] }),
      ],
    }),

    // ── gems ──
    s.db.query({
      table: wallets,
      where: [expr(col("player_id"), "=", inp("player_id")), expr(col("currency"), "=", c.text("gems"))],
      returnType: "single",
      as: "gems_w",
    }),
    s.set_var("gems_ledger", c.int(0)),
    s.conditional({
      when: expr(ref("gems_w"), "!=", c.null()),
      then: [
        s.db.query({ table: ledgerEntries, where: expr(col("wallet_id"), "=", ref("gems_w.id")), output: ["amount"], as: "gems_entries" }),
        s.array.map({ source: ref("gems_entries"), transform: ref("$this.amount"), as: "gems_amounts" }),
        s.set_var("gems_ledger", ref("gems_amounts"), { asFilters: [fl.sum()] }),
      ],
    }),
  ],
  response: {
    player_id: inp("player_id"),
    coins: obj({
      wallet_id: ref("coins_w.id", { safe: true }),
      cached_balance: ref("coins_w.balance", { safe: true }),
      ledger_balance: ref("coins_ledger"),
    }),
    gems: obj({
      wallet_id: ref("gems_w.id", { safe: true }),
      cached_balance: ref("gems_w.balance", { safe: true }),
      ledger_balance: ref("gems_ledger"),
    }),
  },
});
