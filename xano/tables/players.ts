import { table, f } from "@xanots/sdk";

/**
 * A game account. Every wallet and every ledger entry belongs to one player.
 * `id` + `created_at` are auto-injected.
 */
export const players = table({
  name: "players",
  schema: {
    handle: f.text({ required: true }),
    status: f.enum(["active", "banned"], { required: true, default: "active" }),
    // the studio's own id for this account.
    external_ref: f.text({ required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "external_ref" }] }],
});
