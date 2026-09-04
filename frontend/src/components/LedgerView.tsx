import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadLedger, type LedgerEntry, type Player } from "@/lib/api";
import { fmt, KindBadge, num, signed } from "@/components/ui-bits";

const when = (epochms: unknown): string => {
  const n = num(epochms);
  if (!n) return "";
  return new Date(n).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export function LedgerView({ player, version }: { player: Player; version: number }) {
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadLedger(player.id)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [player.id, version]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger for {player.handle}</CardTitle>
        <CardDescription>
          Append-only entries, newest first. Rows are only ever inserted; each records the rule version
          that authorized it and the balance right after.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading ledger…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No entries for this player yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
                <TableHead className="text-right">Rule v</TableHead>
                <TableHead className="text-right">Reverses</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const credit = num(r.amount) >= 0;
                return (
                  <TableRow key={num(r.id)}>
                    <TableCell className="font-mono text-muted-foreground">{num(r.id)}</TableCell>
                    <TableCell>
                      <KindBadge kind={String(r.kind)} />
                    </TableCell>
                    <TableCell className={`text-right font-mono tabular-nums ${credit ? "text-emerald-400" : "text-amber-400"}`}>
                      {signed(r.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{String(r.source)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(r.balance_after)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{num(r.rule_version)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {num(r.ref_entry_id) > 0 ? `#${num(r.ref_entry_id)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{when(r.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
