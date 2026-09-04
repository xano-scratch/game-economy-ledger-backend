import { table, f } from "@xanots/sdk";
import { wallets } from "./wallets.js";
import { players } from "./players.js";

/**
 * The append-only ledger. Rows are only ever inserted, never updated or
 * deleted. `amount` is signed (credits positive, debits negative) and
 * `balance_after` snapshots the wallet balance right after this entry, so a
 * wallet is always reconstructable by summing its entries.
 */
export const ledgerEntries = table({
  name: "ledger_entries",
  schema: {
    wallet_id: f.tableRef(wallets, { required: true }),
    player_id: f.tableRef(players, { required: true }),
    kind: f.enum(["earn", "spend", "grant", "refund"], { required: true }),
    // signed: earn/grant/refund are positive, spend is negative.
    amount: f.int({ required: true }),
    source: f.text({ required: true }),
    // the duplicate-transaction guard: one entry per key.
    idempotency_key: f.text({ required: true }),
    rule_version: f.int({ required: true }),
    balance_after: f.int({ required: true }),
    // a refund points at the spend it reverses; 0 (the sentinel) for everything
    // else. Self-referencing FK, so the bare-name form is required here.
    ref_entry_id: f.tableRef("ledger_entries", { type: "int", required: true, default: 0 }),
  },
  index: [
    { type: "unique", fields: [{ name: "idempotency_key" }] },
    { type: "btree", fields: [{ name: "wallet_id" }] },
    { type: "btree", fields: [{ name: "player_id" }] },
  ],
});
