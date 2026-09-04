import { query, ref, auth, s } from "@xanots/sdk";
import { authGroup } from "./groups.js";
import { authUsers } from "../tables/auth.js";

/**
 * The current user and role. The frontend calls it after login to gate the
 * operator panel. `auth: authUsers` refuses any request without a valid token
 * before the stack runs.
 */
export const meQuery = query({
  name: "me",
  verb: "GET",
  apiGroup: authGroup,
  auth: authUsers,
  stack: [
    s.db.get({ table: authUsers, fieldValue: auth("id"), output: ["id", "email", "role"], as: "me" }),
  ],
  response: { id: ref("me.id"), email: ref("me.email"), role: ref("me.role") },
});
