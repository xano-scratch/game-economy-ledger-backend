import { useCallback, useEffect, useState } from "react";
import { Landmark, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LedgerView } from "@/components/LedgerView";
import { OperatorPanel } from "@/components/OperatorPanel";
import { PlayerConsole } from "@/components/PlayerConsole";
import { num } from "@/components/ui-bits";
import {
  fetchMe,
  getToken,
  loadPlayers,
  loadRules,
  runSeed,
  type Me,
  type Player,
  type Rules,
  type Wallet,
} from "@/lib/api";

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [rules, setRules] = useState<Rules>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadCore = useCallback(async () => {
    let p = await loadPlayers();
    if (p.players.length === 0) {
      await runSeed();
      p = await loadPlayers();
    }
    const r = await loadRules();
    setPlayers(p.players);
    setWallets(p.wallets);
    setRules(r);
    setSelectedId((cur) =>
      cur && p.players.some((pl) => num(pl.id) === cur) ? cur : p.players[0] ? num(p.players[0].id) : null,
    );
  }, []);

  const refresh = useCallback(async () => {
    await reloadCore();
    setVersion((v) => v + 1);
  }, [reloadCore]);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        await reloadCore();
        if (live && getToken()) {
          const m = await fetchMe().catch(() => null);
          if (live) setMe(m);
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [reloadCore]);

  const reset = async () => {
    setBusy(true);
    try {
      await runSeed();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const selectedPlayer = players.find((p) => num(p.id) === selectedId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <Landmark className="size-6 text-primary" /> Game Economy Ledger
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Every earn, spend, grant, and refund posts through one versioned rule layer into an
                append-only ledger, with API-layer RBAC. A wallet is always reconstructable from its
                entries, and a bad transaction is refused the same way everywhere.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset} disabled={busy} className="gap-1">
              <RotateCcw className="size-4" /> Reset demo
            </Button>
          </div>

          {rules ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="text-muted-foreground">Rule set v{num(rules.version)}</Badge>
              <Badge variant="outline" className="text-muted-foreground">
                max spend / txn: {num(rules.max_spend_per_txn).toLocaleString()}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                daily grant cap: {num(rules.daily_grant_cap).toLocaleString()}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                allow negative: {rules.allow_negative ? "yes" : "no"}
              </Badge>
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {loading || !selectedPlayer ? (
          <div className="text-sm text-muted-foreground">Loading the economy…</div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Player</span>
              <Select value={String(selectedId)} onValueChange={(v) => setSelectedId(Number(v))}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={num(p.id)} value={String(num(p.id))}>
                      {p.handle} · {String(p.status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="console">
              <TabsList>
                <TabsTrigger value="console">Player console</TabsTrigger>
                <TabsTrigger value="ledger">Ledger</TabsTrigger>
                <TabsTrigger value="operator">Operator panel</TabsTrigger>
              </TabsList>
              <TabsContent value="console" className="mt-4">
                <PlayerConsole
                  player={selectedPlayer}
                  wallets={wallets}
                  rules={rules}
                  version={version}
                  onChanged={refresh}
                />
              </TabsContent>
              <TabsContent value="ledger" className="mt-4">
                <LedgerView player={selectedPlayer} version={version} />
              </TabsContent>
              <TabsContent value="operator" className="mt-4">
                <OperatorPanel
                  player={selectedPlayer}
                  wallets={wallets}
                  rules={rules}
                  me={me}
                  setMe={setMe}
                  version={version}
                  onChanged={refresh}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
          A Xano proof artifact (Play 2, Backend Modernization). Authored in TypeScript with @xanots/sdk;
          the frontend derives every path and type from the backend defs. Internal scratch demo, not a
          production reference.
        </footer>
      </div>
    </div>
  );
}
