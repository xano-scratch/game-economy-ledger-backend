import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

// The reason codes the rule layer returns, in plain words.
export const REASON_LABEL: Record<string, string> = {
  ok: "Allowed",
  insufficient_balance: "Insufficient balance",
  duplicate_txn: "Duplicate transaction",
  over_daily_cap: "Over daily grant cap",
  over_txn_limit: "Over per-transaction limit",
  already_refunded: "Already refunded",
  not_a_spend: "Not a spend",
};

export const reasonLabel = (code: string): string => REASON_LABEL[code] ?? code;

// Coerce a possibly-null / unknown numeric field to a number for display.
export const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));

export const fmt = (v: unknown): string => num(v).toLocaleString("en-US");

export const signed = (v: unknown): string => {
  const n = num(v);
  return n > 0 ? `+${fmt(n)}` : fmt(n);
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  return outcome === "allowed" ? (
    <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
      <CheckCircle2 className="size-3.5" /> Allowed
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-red-500/40 bg-red-500/10 text-red-400">
      <XCircle className="size-3.5" /> Rejected
    </Badge>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  const credit = kind === "earn" || kind === "grant" || kind === "refund";
  return (
    <Badge
      variant="outline"
      className={
        credit
          ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
          : "border-amber-500/40 bg-amber-500/5 text-amber-400"
      }
    >
      {kind}
    </Badge>
  );
}

export function ReconcileBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
      <ShieldCheck className="size-3.5" /> Reconciled
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-red-500/40 bg-red-500/10 text-red-400">
      <XCircle className="size-3.5" /> Mismatch
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-300">
      {role}
    </Badge>
  );
}
