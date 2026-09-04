// The one contract: every path, request body, and response shape below is
// derived from the xano query defs. Change a def and this file (and the UI that
// uses it) follows. Nothing here hand-types a URL or a request body.
//
// Types are imported type-only (they erase to nothing); the lean query defs are
// imported for their getPath()/verb/toSearchParams at runtime.
import type { InferInput, InferResponse } from "@xanots/sdk";

import { seedQuery } from "../../../xano/api/seed.js";
import { loginQuery } from "../../../xano/api/login.js";
import { meQuery } from "../../../xano/api/me.js";
import { rulesQuery } from "../../../xano/api/rules.js";
import { playersQuery } from "../../../xano/api/players.js";
import { balanceQuery } from "../../../xano/api/balance.js";
import { ledgerQuery } from "../../../xano/api/ledger.js";
import { earnQuery } from "../../../xano/api/earn.js";
import { spendQuery } from "../../../xano/api/spend.js";
import { grantQuery } from "../../../xano/api/grant.js";
import { refundQuery } from "../../../xano/api/refund.js";
import { auditQuery } from "../../../xano/api/audit.js";

/**
 * The deployed backend's base URL. Injected as `window.XANO_HOST` by
 * `xanots deploy --static`, or read from `VITE_XANO_HOST` in dev.
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// ── response / request types (all inferred from the defs) ────────────────────
export type Rules = InferResponse<typeof rulesQuery>;
export type PlayersResponse = InferResponse<typeof playersQuery>;
export type Player = PlayersResponse["players"][number];
export type Wallet = PlayersResponse["wallets"][number];
export type BalanceResponse = InferResponse<typeof balanceQuery>;
export type LedgerEntry = InferResponse<typeof ledgerQuery>[number];
export type Me = InferResponse<typeof meQuery>;
export type SeedResponse = InferResponse<typeof seedQuery>;
export type LoginResponse = InferResponse<typeof loginQuery>;
export type MutationResult = InferResponse<typeof earnQuery>;
export type GrantResult = InferResponse<typeof grantQuery>;
export type RefundResult = InferResponse<typeof refundQuery>;
export type AuditEntry = InferResponse<typeof auditQuery>[number];

export type LoginInput = InferInput<typeof loginQuery>;
export type EarnInput = InferInput<typeof earnQuery>;
export type SpendInput = InferInput<typeof spendQuery>;
export type GrantInput = InferInput<typeof grantQuery>;
export type RefundInput = InferInput<typeof refundQuery>;
export type AuditInput = InferInput<typeof auditQuery>;

// ── auth token store ─────────────────────────────────────────────────────────
const TOKEN_KEY = "gelb.token";
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null): void => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

/** A unique idempotency key for one transaction (retries share their key). */
export const newKey = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

// ── transport ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fail(res: Response): Promise<never> {
  let message = res.statusText || `Request failed (${res.status})`;
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "message" in data) {
      const m = (data as { message?: unknown }).message;
      if (typeof m === "string" && m.length > 0) message = m;
    }
  } catch {
    // non-JSON error body; keep the status text.
  }
  throw new ApiError(res.status, message);
}

async function getJson<T>(url: string, opts: { auth?: boolean } = {}): Promise<T> {
  const res = await fetch(url, { headers: opts.auth ? authHeaders() : {} });
  if (!res.ok) return fail(res);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.auth ? authHeaders() : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) return fail(res);
  return res.json() as Promise<T>;
}

const withQuery = (path: string, params: URLSearchParams): string => {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

// ── endpoints ─────────────────────────────────────────────────────────────────
export const loadRules = (): Promise<Rules> => getJson(XANO_HOST + rulesQuery.getPath());

export const loadPlayers = (): Promise<PlayersResponse> => getJson(XANO_HOST + playersQuery.getPath());

export const loadBalance = (playerId: number): Promise<BalanceResponse> =>
  getJson(XANO_HOST + withQuery(balanceQuery.getPath(), balanceQuery.toSearchParams({ player_id: playerId })));

export const loadLedger = (playerId: number): Promise<LedgerEntry[]> =>
  getJson(XANO_HOST + withQuery(ledgerQuery.getPath(), ledgerQuery.toSearchParams({ player_id: playerId })));

export const runSeed = (): Promise<SeedResponse> => postJson(XANO_HOST + seedQuery.getPath(), {});

export async function login(body: LoginInput): Promise<LoginResponse> {
  const data = await postJson<LoginResponse>(XANO_HOST + loginQuery.getPath(), body);
  setToken(data.token);
  return data;
}

export const fetchMe = (): Promise<Me> => getJson(XANO_HOST + meQuery.getPath(), { auth: true });

export const earn = (body: EarnInput): Promise<MutationResult> =>
  postJson(XANO_HOST + earnQuery.getPath(), body);

export const spend = (body: SpendInput): Promise<MutationResult> =>
  postJson(XANO_HOST + spendQuery.getPath(), body);

export const grant = (body: GrantInput): Promise<GrantResult> =>
  postJson(XANO_HOST + grantQuery.getPath(), body, { auth: true });

export const refund = (body: RefundInput): Promise<RefundResult> =>
  postJson(XANO_HOST + refundQuery.getPath(), body, { auth: true });

export const loadAudit = (filters: AuditInput): Promise<AuditEntry[]> =>
  getJson(XANO_HOST + withQuery(auditQuery.getPath(), auditQuery.toSearchParams(filters)), { auth: true });
