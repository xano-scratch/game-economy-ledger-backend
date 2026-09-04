import { query, s, c, ref, inp, expr, input, obj } from "@xanots/sdk";
import { authGroup } from "./groups.js";
import { authUsers } from "../tables/auth.js";

/**
 * Verify credentials against the auth table and mint a token. The submitted
 * password is taken as text (not input.password) so it is not double-hashed,
 * and the read names `password` in output to pull the internal hash column.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: authGroup,
  input: {
    email: input.text({ required: true, methods: ["trim", "lower"] }),
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({
      table: authUsers,
      fieldName: "email",
      fieldValue: inp("email"),
      output: ["id", "email", "role", "password"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error: c.text("No account with that email."),
      error_type: "unauthorized",
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error: c.text("Invalid email or password."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({
      table: authUsers,
      id: ref("u.id"),
      extras: obj({ role: ref("u.role") }),
      as: "token",
    }),
  ],
  response: { token: ref("token"), id: ref("u.id"), email: ref("u.email"), role: ref("u.role") },
});
