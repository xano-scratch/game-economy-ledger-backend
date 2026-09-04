import { table, f } from "@xanots/sdk";

/**
 * The native auth table. Drives API-layer RBAC: a login mints a token, and the
 * grant / refund / audit endpoints name this table as `auth:` and check `role`.
 * This is Xano's auth story: middleware + role checks at the API layer, never
 * row-level security.
 */
export const authUsers = table({
  name: "auth",
  auth: true,
  schema: {
    email: f.email({ required: true }),
    // f.password hashes on write and is read-internal (see the login stack).
    password: f.password({ required: true }),
    role: f.enum(["player", "ops", "admin"], { required: true, default: "player" }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});
