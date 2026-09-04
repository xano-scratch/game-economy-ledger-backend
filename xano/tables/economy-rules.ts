import { table, f } from "@xanots/sdk";

/**
 * The versioned rule set. Exactly one row is `active`. A new version supersedes
 * the old rather than editing it, so a past decision stays explainable: every
 * ledger entry records the `rule_version` that authorized it.
 */
export const economyRules = table({
  name: "economy_rules",
  schema: {
    version: f.int({ required: true }),
    // max operator-granted currency per player in a rolling 24 hours.
    daily_grant_cap: f.int({ required: true }),
    max_spend_per_txn: f.int({ required: true }),
    allow_negative: f.bool({ required: true, default: false }),
    active: f.bool({ required: true, default: false }),
  },
  index: [{ type: "unique", fields: [{ name: "version" }] }],
});
