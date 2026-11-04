import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, PieChart as PieIcon, Wallet } from "lucide-react";
import {
  Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type ApiCollection } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, StatusBadge } from "@/components/finance/ui";
import { fmtBRL, fmtDate, monthRange, toDateInput, type FinanceSummary, type Transaction } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const PIE_COLORS = [
  "oklch(0.52 0.18 27)", "oklch(0.75 0.16 75)", "oklch(0.55 0.15 145)", "oklch(0.55 0.14 250)",
  "oklch(0.6 0.15 320)", "oklch(0.65 0.1 200)", "oklch(0.5 0.05 60)", "oklch(0.7 0.12 110)", "oklch(0.45 0.12 20)",
];

const SERIES = [
  { key: "dia", label: "Gasto no dia", color: "var(--destructive)" },
  { key: "acumulado", label: "Acumulado no período", color: "var(--gold)" },
] as const;

function compactBRL(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${Math.round(value)}`;
}

function FlowTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
          <span className="font-medium tabular-nums">{fmtBRL(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 };

function parseDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

type Preset = { key: string; label: string; range: () => { from: string; to: string } };

const PRESETS: Preset[] = [
  { key: "month", label: "Mês atual", range: () => monthRange() },
  {
    key: "prev-month", label: "Mês anterior",
    range: () => monthRange(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)),
  },
  { key: "30d", label: "30 dias", range: () => ({ from: toDateInput(shiftDays(new Date(), -29)), to: toDateInput(new Date()) }) },
  {
    key: "year", label: "Ano",
    range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: `${new Date().getFullYear()}-12-31` }),
  },
];

function useSummary(from: string, to: string) {
  return useQuery({
    queryKey: ["finance-summary", from, to],
    queryFn: () => api.get<FinanceSummary>(`/finance/summary?${new URLSearchParams({ from, to })}`),
  });
}

function DashboardPage() {
  const initial = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  // Período anterior com a mesma duração, para mostrar a variação.
  const previous = useMemo(() => {
    const start = parseDate(from);
    const end = parseDate(to);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const prevTo = shiftDays(start, -1);
    return { from: toDateInput(shiftDays(prevTo, -(days - 1))), to: toDateInput(prevTo) };
  }, [from, to]);

  const { data, isLoading } = useSummary(from, to);
  const { data: prev } = useSummary(previous.from, previous.to);

  const { data: upcoming } = useQuery({
    queryKey: ["transactions", "dashboard-open", from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "expense", per_page: "100", from, to });
      const [pending, overdue] = await Promise.all([
        api.get<ApiCollection<Transaction>>(`/finance/transactions?${params}&status=pending`),
        api.get<ApiCollection<Transaction>>(`/finance/transactions?${params}&status=overdue`),
      ]);
      return [...overdue.data, ...pending.data].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6);
    },
  });

  const activePreset = PRESETS.find((p) => {
    const r = p.range();
    return r.from === from && r.to === to;
  })?.key;

  const chartData = useMemo(() => {
    let running = 0;
    return (data?.daily ?? []).map((d) => {
      running += d.saidas;
      return { dia: d.dia, gasto: d.saidas, acumulado: Math.round(running * 100) / 100 };
    });
  }, [data]);

  const [visible, setVisible] = useState({ dia: true, acumulado: true });

  const categories = (data?.byCategory ?? []).filter((c) => c.type === "expense");
  const categoryTotal = categories.reduce((sum, c) => sum + c.total, 0);
  const top = categories[0];
  const overdueCount = data?.payable.overdue ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Despesas pagas de ${fmtDate(from)} a ${fmtDate(to)} e o que ainda falta pagar.`}
        actions={
          <>
            <div className="inline-flex flex-wrap rounded-lg border bg-card p-1 gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.key} size="sm" variant={activePreset === p.key ? "default" : "ghost"}
                  onClick={() => { const r = p.range(); setFrom(r.from); setTo(r.to); }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="dash-from" className="text-xs text-muted-foreground">De</Label>
                <Input id="dash-from" type="date" className="h-9 w-36" value={from} max={to}
                  onChange={(e) => { if (!e.target.value) return; setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dash-to" className="text-xs text-muted-foreground">Até</Label>
                <Input id="dash-to" type="date" className="h-9 w-36" value={to} min={from}
                  onChange={(e) => { if (!e.target.value) return; setTo(e.target.value); if (e.target.value < from) setFrom(e.target.value); }} />
              </div>
            </div>
          </>
        }
      />

      {overdueCount > 0 && (
        <Link
          to="/contas"
          className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm hover:bg-destructive/10 transition-colors"
        >
          <AlertTriangle className="size-5 text-destructive shrink-0" />
          <span>
            Você tem <strong>{overdueCount}</strong> conta(s) atrasada(s) para pagar.
          </span>
          <span className="ml-auto text-destructive font-medium">Ver contas →</span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-0 bg-gradient-to-br from-primary to-[oklch(0.4_0.17_27)] text-primary-foreground shadow-lg">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-primary-foreground/85 text-sm">
              <Wallet className="size-4" /> Total pago no período
            </div>
            <p className="font-display text-4xl font-semibold tracking-tight tabular-nums">
              {isLoading ? "…" : fmtBRL(data?.expense ?? 0)}
            </p>
            <Delta current={data?.expense ?? 0} previous={prev?.expense} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Kpi
            label="Falta pagar" value={fmtBRL(data?.payable.total ?? 0)} icon={CalendarClock}
            tone="text-warning-foreground bg-warning/30" loading={isLoading}
            hint={`${data?.payable.count ?? 0} conta(s) em aberto`}
          />
          <Kpi
            label="Atrasadas" value={String(overdueCount)} icon={AlertTriangle}
            tone={overdueCount > 0 ? "text-destructive bg-destructive/10" : "text-muted-foreground bg-muted"} loading={isLoading}
            hint={overdueCount > 0 ? "Pague o quanto antes" : "Nenhuma conta atrasada"}
          />
          <Kpi
            label="Maior gasto pago" value={top ? top.category : "—"} icon={PieIcon}
            tone="text-secondary bg-secondary/10" loading={isLoading}
            hint={top ? `${fmtBRL(top.total)} (${Math.round((top.total / categoryTotal) * 100)}%)` : "Sem despesas pagas"}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap space-y-0">
            <CardTitle className="font-display text-lg">Gastos por dia</CardTitle>
            <div className="flex flex-wrap gap-2">
              {SERIES.map((serie) => (
                <button
                  key={serie.key}
                  type="button"
                  aria-pressed={visible[serie.key]}
                  onClick={() => setVisible((v) => ({ ...v, [serie.key]: !v[serie.key] }))}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    visible[serie.key] ? "bg-card text-foreground" : "bg-muted/50 text-muted-foreground line-through"
                  }`}
                >
                  <span className="size-2 rounded-full" style={{ background: serie.color }} />
                  {serie.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <EmptyState text="Nenhuma despesa paga neste período." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-gasto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={52} tickFormatter={compactBRL} />
                  <Tooltip content={<FlowTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
                  {visible.dia && (
                    <Area type="monotone" dataKey="gasto" name="Gasto no dia" stroke="var(--destructive)" strokeWidth={2.5}
                      fill="url(#grad-gasto)" dot={false} activeDot={{ r: 5 }} />
                  )}
                  {visible.acumulado && (
                    <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="var(--gold)" strokeWidth={2.5}
                      strokeDasharray="6 4" dot={false} activeDot={{ r: 5 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Despesas pagas por categoria</CardTitle></CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <EmptyState text="Sem despesas pagas no período." />
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={categories} dataKey="total" nameKey="category" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
                      {categories.map((c, i) => <Cell key={c.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-2 text-sm">
                  {categories.map((c, i) => (
                    <li key={c.category} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="flex-1 truncate">{c.category}</span>
                      <span className="text-muted-foreground text-xs">{Math.round((c.total / categoryTotal) * 100)}%</span>
                      <span className="font-medium tabular-nums">{fmtBRL(c.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-lg">Próximos vencimentos</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/contas">Ver todas</Link></Button>
        </CardHeader>
        <CardContent>
          {(upcoming?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="size-6 text-success" />
              Nenhuma conta em aberto no período selecionado.
            </div>
          ) : (
            <ul className="divide-y">
              {upcoming!.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.category} · vence {fmtDate(t.due_date)}</p>
                  </div>
                  <StatusBadge status={t.status} />
                  <span className="font-semibold tabular-nums">{fmtBRL(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Variação do gasto: gastar menos que no período anterior é bom (verde). */
function Delta({ current, previous }: { current: number; previous: number | undefined }) {
  const muted = "text-xs text-primary-foreground/75";
  if (previous === undefined) return <p className={muted}>&nbsp;</p>;
  if (previous === 0 && current === 0) return <p className={muted}>Sem despesas no período anterior</p>;
  const diff = current - previous;
  const pct = previous !== 0 ? Math.round((Math.abs(diff) / previous) * 100) : null;
  return (
    <p className="text-xs text-primary-foreground/90">
      {diff > 0 ? "▲" : diff < 0 ? "▼" : "•"} {pct !== null ? `${pct}%` : fmtBRL(Math.abs(diff))}{" "}
      <span className="text-primary-foreground/70">
        {diff > 0 ? "a mais" : diff < 0 ? "a menos" : "igual"} que o período anterior
      </span>
    </p>
  );
}

function Kpi({
  label, value, icon: Icon, tone, loading, hint,
}: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: string; loading?: boolean; hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-xl font-display font-semibold mt-1 truncate">{loading ? "…" : value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
          </div>
          <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${tone}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-10 text-center">{text}</p>;
}
