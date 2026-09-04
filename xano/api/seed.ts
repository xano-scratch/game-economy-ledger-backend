import { query, s, c, ref, statements } from "@xanots/sdk";
import { economyGroup } from "./groups.js";
import { players } from "../tables/players.js";
import { wallets } from "../tables/wallets.js";
import { ledgerEntries } from "../tables/ledger-entries.js";
import { economyRules } from "../tables/economy-rules.js";
import { auditLog } from "../tables/audit-log.js";
import { authUsers } from "../tables/auth.js";

// A wallet plus its opening ledger entry, so a freshly seeded env already
// reconciles (cached balance == the one ledger entry) and has rows to show.
function seedWallet(playerRef: string, currency: "coins" | "gems", opening: number, key: string) {
  return statements(
    s.db.add({
      table: wallets,
      row: { player_id: ref(playerRef), currency, balance: opening },
      as: "w",
    }),
    s.db.add({
      table: ledgerEntries,
      row: {
        wallet_id: ref("w.id"),
        player_id: ref(playerRef),
        kind: "earn",
        amount: opening,
        source: "achievement",
        idempotency_key: key,
        rule_version: 1,
        balance_after: opening,
        ref_entry_id: 0,
      },
    }),
  );
}

/**
 * Reset the environment to a known demo state: an active rule set, three demo
 * operators, three players, and one wallet per currency with an opening entry.
 * The frontend calls this on first load (when empty) and from a Reset button,
 * so the ephemeral is always browsable. Demo credentials are intentionally
 * public.
 */
export const seedQuery = query({
  name: "seed",
  verb: "POST",
  apiGroup: economyGroup,
  stack: [
    // wipe everything and restart the id sequences.
    s.db.truncate({ table: auditLog, reset: true }),
    s.db.truncate({ table: ledgerEntries, reset: true }),
    s.db.truncate({ table: wallets, reset: true }),
    s.db.truncate({ table: players, reset: true }),
    s.db.truncate({ table: economyRules, reset: true }),
    s.db.truncate({ table: authUsers, reset: true }),

    // the one active rule set.
    s.db.add({
      table: economyRules,
      row: {
        version: 1,
        daily_grant_cap: 500,
        max_spend_per_txn: 250,
        allow_negative: false,
        active: true,
      },
    }),

    // demo operators (public demo password).
    s.db.add({ table: authUsers, row: { email: "admin@demo.game", password: "demo1234", role: "admin" } }),
    s.db.add({ table: authUsers, row: { email: "ops@demo.game", password: "demo1234", role: "ops" } }),
    s.db.add({ table: authUsers, row: { email: "player@demo.game", password: "demo1234", role: "player" } }),

    // players.
    s.db.add({ table: players, row: { handle: "Nova", status: "active", external_ref: "ext-nova" }, as: "p1" }),
    s.db.add({ table: players, row: { handle: "Rook", status: "active", external_ref: "ext-rook" }, as: "p2" }),
    s.db.add({ table: players, row: { handle: "Sable", status: "active", external_ref: "ext-sable" }, as: "p3" }),

    // wallets + opening entries.
    ...seedWallet("p1.id", "coins", 120, "seed-nova-coins"),
    ...seedWallet("p1.id", "gems", 30, "seed-nova-gems"),
    ...seedWallet("p2.id", "coins", 80, "seed-rook-coins"),
    ...seedWallet("p2.id", "gems", 10, "seed-rook-gems"),
    ...seedWallet("p3.id", "coins", 200, "seed-sable-coins"),
    ...seedWallet("p3.id", "gems", 45, "seed-sable-gems"),
  ],
  response: { ok: c.bool(true), players: c.int(3), wallets: c.int(6), rule_version: c.int(1) },
});
