import type { ComponentType, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MONTH_NAMES, STATUS_CLASS, STATUS_LABEL, type TransactionStatus } from "@/lib/finance";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "success" | "danger" | "warning";

const TONES: Record<Tone, { bubble: string; value: string; bar: string }> = {
  neutral: { bubble: "bg-primary/10 text-primary", value: "text-foreground", bar: "bg-primary/70" },
  success: { bubble: "bg-success/10 text-success", value: "text-success", bar: "bg-success" },
  danger: { bubble: "bg-destructive/10 text-destructive", value: "text-destructive", bar: "bg-destructive" },
  warning: { bubble: "bg-warning/30 text-warning-foreground", value: "text-foreground", bar: "bg-warning" },
};

/** Cartão de indicador: ícone em destaque, valor grande e uma linha de apoio. */
export function StatTile({
  label, value, hint, icon: Icon, tone = "neutral",
}: { label: string; value: string; hint?: string; icon?: ComponentType<{ className?: string }>; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <Card className="relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} aria-hidden />
      <CardContent className="flex items-start justify-between gap-3 py-4 pl-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`mt-1 truncate text-2xl font-display font-semibold tabular-nums ${t.value}`}>{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${t.bubble}`}>
            <Icon className="size-5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: TransactionStatus }) {
  return <Badge className={`${STATUS_CLASS[status]} font-medium`}>{STATUS_LABEL[status]}</Badge>;
}

/** Cor estável por categoria (mesmo nome = mesma cor em todas as telas). */
function hueOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function CategoryChip({ name }: { name: string }) {
  const hue = hueOf(name);
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `oklch(0.95 0.04 ${hue})`, color: `oklch(0.38 0.1 ${hue})` }}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Selo de data estilo calendário: dia grande e mês abreviado. */
export function DateBadge({ iso, tone = "neutral" }: { iso: string; tone?: Tone | "muted" }) {
  const [, month, day] = iso.split("-").map(Number);
  const cls =
    tone === "danger" ? "bg-destructive/10 text-destructive"
    : tone === "success" ? "bg-success/10 text-success"
    : tone === "muted" ? "bg-muted text-muted-foreground"
    : "bg-primary/10 text-primary";
  return (
    <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${cls}`}>
      <span className="text-lg font-semibold tabular-nums">{String(day).padStart(2, "0")}</span>
      <span className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
        {MONTH_NAMES[month - 1].slice(0, 3)}
      </span>
    </span>
  );
}

/** Navegação de mês: ‹ Outubro 2026 ›. */
export function MonthNav({
  year, month, onChange,
}: { year: number; month: number; onChange: (next: { year: number; month: number }) => void }) {
  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onChange({ year: d.getFullYear(), month: d.getMonth() });
  };
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1 shadow-sm">
      <Button size="icon" variant="ghost" aria-label="Mês anterior" onClick={() => shift(-1)}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-40 text-center font-display font-semibold">{MONTH_NAMES[month]} {year}</span>
      <Button size="icon" variant="ghost" aria-label="Próximo mês" onClick={() => shift(1)}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

export function EmptyBlock({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
