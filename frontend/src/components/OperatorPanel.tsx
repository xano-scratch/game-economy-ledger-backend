import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ApiError,
  grant,
  loadAudit,
  loadLedger,
  login,
  newKey,
  refund,
  setToken,
  type AuditEntry,
  type LedgerEntry,
  type Me,
  type Player,
  type Rules,
  type Wallet,
} from "@/lib/api";
import { fmt, KindBadge, num, OutcomeBadge, reasonLabel, RoleBadge } from "@/components/ui-bits";

type Currency = "coins" | "gems";

type Decision = { key: number; title: string; outcome: string; reason: string; note?: string };

const DEMO = [
  { email: "admin@demo.game", role: "admin" },
  { email: "ops@demo.game", role: "ops" },
  { email: "player@demo.game", role: "player" },
];

function LoginCard({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  const [email, setEmail] = useState("ops@demo.game");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [anon, setAnon] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await login({ email, password });
      onSignedIn({ id: r.id, email: r.email, role: r.role });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const tryAnon = async () => {
    setAnon(null);
    try {
      await loadAudit({ outcome: "" });
      setAnon("Unexpected: the audit log answered without a token.");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setAnon(`Refused with HTTP ${status}. The audit endpoint requires a valid token.`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operator sign in</CardTitle>
        <CardDescription>
          Grant, refund, and the audit log are gated at the API layer. Sign in as an operator, or watch an
          anonymous request get refused.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={busy}>
            Sign in
          </Button>
          {error ? <div className="text-sm text-red-400">{error}</div> : null}
        </form>

        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Demo accounts (password demo1234)</div>
          <div className="flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <Button
                key={d.email}
                size="sm"
                variant="outline"
                onClick={() => {
                  setEmail(d.email);
                  setPassword("demo1234");
                }}
              >
                {d.email} ({d.role})
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Signing in as <span className="font-mono">player</span> shows the API refusing an operator action
            with 403.
          </p>
        </div>

        <Separator />
        <div>
          <Button size="sm" variant="ghost" onClick={tryAnon} className="gap-1">
            <ShieldAlert className="size-4" /> Try the audit log without signing in
          </Button>
          {anon ? <div className="mt-1.5 text-sm text-muted-foreground">{anon}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function OperatorPanel({
  player,
  wallets,
  rules,
  me,
  setMe,
  version,
  onChanged,
}: {
  player: Player;
  wallets: Wallet[];
  rules: Rules;
  me: Me | null;
  setMe: (me: Me | null) => void;
  version: number;
  onChanged: () => void;
}) {
  const [currency, setCurrency] = useState<Currency>("coins");
  const [amount, setAmount] = useState(100);
  const [spends, setSpends] = useState<LedgerEntry[]>([]);
  const [refundId, setRefundId] = useState<string>("");
  const [auditRows, setAuditRows] = useState<AuditEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>("");
  const [auditNote, setAuditNote] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);

  const walletId = (cur: Currency): number => {
    const w = wallets.find((x) => x.player_id === player.id && x.currency === cur);
    return w ? num(w.id) : 0;
  };

  const record = (title: string, outcome: string, reason: string, note?: string) => {
    counter.current += 1;
    setDecisions((d) => [{ key: counter.current, title, outcome, reason, note }, ...d].slice(0, 8));
  };

  const loadAuditRows = useCallback(async () => {
    if (!me) return;
    setAuditNote(null);
    try {
      const rows = await loadAudit({ outcome: auditFilter });
      setAuditRows(rows);
    } catch (err) {
      setAuditRows([]);
      const status = err instanceof ApiError ? err.status : 0;
      setAuditNote(`Your role cannot read the audit log (HTTP ${status}).`);
    }
  }, [me, auditFilter]);

  // recent spends of the selected player, to refund.
  useEffect(() => {
    let live = true;
    loadLedger(player.id)
      .then((rows) => {
        if (!live) return;
        const s = rows.filter((r) => String(r.kind) === "spend");
        setSpends(s);
        setRefundId((prev) => prev || (s[0] ? String(num(s[0].id)) : ""));
      })
      .catch(() => live && setSpends([]));
    return () => {
      live = false;
    };
  }, [player.id, version]);

  useEffect(() => {
    void loadAuditRows();
  }, [loadAuditRows, version]);

  const runOp = async (
    title: string,
    call: () => Promise<{ outcome: unknown; reason_code: unknown }>,
    note?: string,
  ) => {
    setBusy(true);
    try {
      const r = await call();
      record(title, String(r.outcome), reasonLabel(String(r.reason_code)), note);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.message} (HTTP ${err.status})` : "Request failed";
      record(title, "rejected", msg, note);
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const doGrant = () =>
    runOp(`Grant ${amount} ${currency} to ${player.handle}`, () =>
      grant({ wallet_id: walletId(currency), amount, idempotency_key: newKey("grant") }),
    );

  const grantOverCap = () =>
    runOp(
      `Grant ${num(rules?.daily_grant_cap) + 100} ${currency} (over cap)`,
      () => grant({ wallet_id: walletId(currency), amount: num(rules?.daily_grant_cap) + 100, idempotency_key: newKey("grant") }),
      "expected: over_daily_cap",
    );

  const doRefund = (again: boolean) =>
    runOp(
      again ? `Refund entry #${refundId} again` : `Refund entry #${refundId}`,
      () => refund({ ref_entry_id: Number(refundId), idempotency_key: newKey("refund") }),
      again ? "expected: already_refunded" : undefined,
    );

  const logout = () => {
    setToken(null);
    setMe(null);
    setAuditRows([]);
    setDecisions([]);
  };

  if (!me) {
    return (
      <LoginCard onSignedIn={(m) => setMe(m)} />
    );
  }

  const isOperator = me.role === "ops" || me.role === "admin";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              Signed in as {String(me.email)} <RoleBadge role={String(me.role)} />
            </CardTitle>
            <CardDescription>
              {isOperator
                ? "Operator actions below are allowed for your role."
                : "Your role is player: the operator actions below are refused by the API with 403."}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="gap-1">
            <LogOut className="size-4" /> Sign out
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Grant currency</CardTitle>
            <CardDescription>
              Operator-only. Capped at {fmt(rules?.daily_grant_cap ?? 0)} per player per rolling 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="grant-currency">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger id="grant-currency" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coins">Coins</SelectItem>
                    <SelectItem value="gems">Gems</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="grant-amount">Amount</Label>
                <Input
                  id="grant-amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  className="w-28"
                />
              </div>
              <Button onClick={doGrant} disabled={busy}>
                Grant to {player.handle}
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={grantOverCap} disabled={busy || !rules}>
              Grant over the daily cap
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Refund a spend</CardTitle>
            <CardDescription>
              Operator-only. Reverses a spend by its entry id. A second refund of the same entry is refused.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="refund-entry">Spend to reverse ({player.handle})</Label>
                <Select value={refundId} onValueChange={setRefundId}>
                  <SelectTrigger id="refund-entry" className="w-56">
                    <SelectValue placeholder="No spends yet" />
                  </SelectTrigger>
                  <SelectContent>
                    {spends.map((s) => (
                      <SelectItem key={num(s.id)} value={String(num(s.id))}>
                        #{num(s.id)} · {fmt(s.amount)} · {String(s.source)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => doRefund(false)} disabled={busy || !refundId}>
                Refund
              </Button>
              <Button size="sm" variant="outline" onClick={() => doRefund(true)} disabled={busy || !refundId}>
                Refund again
              </Button>
            </div>
            {spends.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Spend some currency for {player.handle} on the Player console first, then refund it here.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {decisions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent operator decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {decisions.map((d) => (
                <li key={d.key} className="flex items-center justify-between gap-3 rounded-md border bg-card/60 p-3">
                  <div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {d.reason}
                      {d.note ? <span className="text-muted-foreground/60"> · {d.note}</span> : null}
                    </div>
                  </div>
                  <OutcomeBadge outcome={d.outcome} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Every allowed and rejected action, with its reason and rule version.</CardDescription>
          </div>
          <Select value={auditFilter || "all"} onValueChange={(v) => setAuditFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="allowed">Allowed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {auditNote ? (
            <div className="text-sm text-amber-400">{auditNote}</div>
          ) : auditRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No audit rows for this filter yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actor</TableHead>
                  <TableHead className="text-right">Player</TableHead>
                  <TableHead className="text-right">Rule v</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditRows.map((r) => (
                  <TableRow key={num(r.id)}>
                    <TableCell className="font-mono text-muted-foreground">{num(r.id)}</TableCell>
                    <TableCell>
                      <KindBadge kind={String(r.action)} />
                    </TableCell>
                    <TableCell>
                      <OutcomeBadge outcome={String(r.outcome)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{reasonLabel(String(r.reason_code))}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {num(r.actor_id) > 0 ? num(r.actor_id) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {num(r.target_player_id) > 0 ? num(r.target_player_id) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{num(r.rule_version)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
