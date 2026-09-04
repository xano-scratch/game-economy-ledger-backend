import { workspace } from "@xanots/sdk";

import { players } from "./tables/players.js";
import { authUsers } from "./tables/auth.js";
import { wallets } from "./tables/wallets.js";
import { economyRules } from "./tables/economy-rules.js";
import { ledgerEntries } from "./tables/ledger-entries.js";
import { auditLog } from "./tables/audit-log.js";

import { economyGroup, authGroup, adminGroup } from "./api/groups.js";

import { seedQuery } from "./api/seed.js";
import { loginQuery } from "./api/login.js";
import { meQuery } from "./api/me.js";
import { rulesQuery } from "./api/rules.js";
import { playersQuery } from "./api/players.js";
import { balanceQuery } from "./api/balance.js";
import { ledgerQuery } from "./api/ledger.js";
import { earnQuery } from "./api/earn.js";
import { spendQuery } from "./api/spend.js";
import { grantQuery } from "./api/grant.js";
import { refundQuery } from "./api/refund.js";
import { auditQuery } from "./api/audit.js";

/**
 * Game Economy Ledger Backend.
 *
 * A governed virtual-currency backend. Every earn, spend, grant, and refund
 * posts through one versioned rule layer (balance sufficiency, daily grant
 * caps, a duplicate-spend guard) into an append-only ledger, with API-layer
 * RBAC, so a wallet is always reconstructable from its entries and a bad
 * transaction is refused the same way everywhere.
 */
export default workspace("game-economy-ledger-backend")
  .registerTables([players, authUsers, wallets, economyRules, ledgerEntries, auditLog])
  .registerApiGroups([economyGroup, authGroup, adminGroup])
  .registerQueries([
    seedQuery,
    loginQuery,
    meQuery,
    rulesQuery,
    playersQuery,
    balanceQuery,
    ledgerQuery,
    earnQuery,
    spendQuery,
    grantQuery,
    refundQuery,
    auditQuery,
  ]);
