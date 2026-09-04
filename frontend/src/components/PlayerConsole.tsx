import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Gem, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ApiError,
  earn,
  loadBalance,
  newKey,
  spend,
  type BalanceResponse,
  type Player,
  type Rules,
  type Wallet,
} from "@/lib/api";
import { fmt, num, OutcomeBadge, ReconcileBadge, reasonLabel } from "@/components/ui-bits";

type Currency = "coins" | "gems";

type Decision = {
  key: number;
  title: string;
  outcome: string;
  reason: string;
  note?: string;
};

function WalletCard({
  currency,
  cached,
  ledger,
}: {
  currency: Currency;
  cached: number;
  ledger: number;
}) {
  const Icon = currency === "coins" ? Coins : Gem;
  const reconciled = cached === ledger;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium capitalize">
          <Icon className="size-4 text-muted-foreground" /> {currency}
        </div>
        <ReconcileBadge ok={reconciled} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Cached balance</div>
          <div className="mt-1 font-mono text-2xl tabular-nums">{fmt(cached)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Summed from ledger</div>
          <div className="mt-1 font-mono text-2xl tabular-nums">{fmt(ledger)}</div>
        </div>
      </div>
    </div>
  );
}

export function PlayerConsole({
  player,
  wallets,
  rules,
  version,
  onChanged,
}: {
  player: Player;
  wallets: Wallet[];
  rules: Rules;
  version: number;
  onChanged: () => void;
}) {
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [currency, setCurrency] = useState<Currency>("coins");
  const [amount, setAmount] = useState(50);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);

  const walletId = useCallback(
    (cur: Currency): number => {
      const w = wallets.find((x) => x.player_id === player.id && x.currency === cur);
      return w ? num(w.id) : 0;
    },
    [wallets, player.id],
  );

  useEffect(() => {
    let live = true;
    loadBalance(player.id)
      .then((b) => live && setBalance(b))
      .catch(() => live && setBalance(null));
    return () => {
      live = false;
    };
  }, [player.id, version]);

  const record = (title: string, outcome: string, reason: string, note?: string) => {
    counter.current += 1;
    setDecisions((d) => [{ key: counter.current, title, outcome, reason, note }, ...d].slice(0, 8));
  };

  const runOne = async (
    title: string,
    call: () => Promise<{ outcome: unknown; reason_code: unknown }>,
    note?: string,
  ) => {
    try {
      const r = await call();
      record(title, String(r.outcome), reasonLabel(String(r.reason_code)), note);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Request failed";
      record(title, "rejected", msg, note);
    }
  };

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const doEarn = () =>
    withBusy(() =>
      runOne(`Earn ${amount} ${currency}`, () =>
        earn({ wallet_id: walletId(currency), amount, source: "achievement", idempotency_key: newKey("earn") }),
      ),
    );

  const doSpend = () =>
    withBusy(() =>
      runOne(`Spend ${amount} ${currency}`, () =>
        spend({ wallet_id: walletId(currency), amount, source: "store", idempotency_key: newKey("spend") }),
      ),
    );

  const overspend = () =>
    withBusy(() => {
      const cached = num(balance ? balance[currency].cached_balance : 0);
      const amt = balance ? cached + 50 : 99999;
      return runOne(
        `Spend ${amt.toLocaleString()} ${currency} (over balance)`,
        () => spend({ wallet_id: walletId(currency), amount: amt, source: "store", idempotency_key: newKey("spend") }),
        "spends more than the balance",
      );
    });

  const overLimit = () =>
    withBusy(() =>
      runOne(
        `Spend over limit (${num(rules?.max_spend_per_txn) + 1})`,
        () =>
          spend({
            wallet_id: walletId(currency),
            amount: num(rules?.max_spend_per_txn) + 1,
            source: "store",
            idempotency_key: newKey("spend"),
          }),
        "expected: over_txn_limit",
      ),
    );

  const duplicateSpend = () =>
    withBusy(async () => {
      const key = newKey("spend");
      await runOne(`Spend 10 ${currency} (key reused)`, () =>
        spend({ wallet_id: walletId(currency), amount: 10, source: "store", idempotency_key: key }),
      );
      await runOne(
        `Repeat same key`,
        () => spend({ wallet_id: walletId(currency), amount: 10, source: "store", idempotency_key: key }),
        "expected: duplicate_txn",
      );
    });

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Wallets for {player.handle}</CardTitle>
          <CardDescription>
            Each wallet's cached balance sits next to the balance summed from its append-only ledger. They
            always reconcile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {balance ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <WalletCard currency="coins" cached={num(balance.coins.cached_balance)} ledger={num(balance.coins.ledger_balance)} />
              <WalletCard currency="gems" cached={num(balance.gems.cached_balance)} ledger={num(balance.gems.ledger_balance)} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Loading balances…</div>
          )}

          <Separator />

          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger id="currency" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coins">Coins</SelectItem>
                  <SelectItem value="gems">Gems</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                className="w-28"
              />
            </div>
            <Button onClick={doEarn} disabled={busy} className="gap-1">
              <Plus className="size-4" /> Earn
            </Button>
            <Button onClick={doSpend} disabled={busy} variant="secondary" className="gap-1">
              <Minus className="size-4" /> Spend
            </Button>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Try a governed refusal
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={overspend} disabled={busy}>
                Overspend
              </Button>
              <Button size="sm" variant="outline" onClick={overLimit} disabled={busy || !rules}>
                Over per-txn limit
              </Button>
              <Button size="sm" variant="outline" onClick={duplicateSpend} disabled={busy}>
                Duplicate spend
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent decisions</CardTitle>
          <CardDescription>Every earn and spend, allowed or refused with its named reason.</CardDescription>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No actions yet. Earn or spend, or trigger a refusal, to see the rule layer decide.
            </div>
          ) : (
            <ul className="space-y-2">
              {decisions.map((d) => (
                <li key={d.key} className="rounded-md border bg-card/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{d.title}</span>
                    <OutcomeBadge outcome={d.outcome} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{d.reason}</div>
                  {d.note ? <div className="mt-0.5 text-xs text-muted-foreground/70">{d.note}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
