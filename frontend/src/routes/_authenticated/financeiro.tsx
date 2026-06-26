import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function fetchFinance() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const thirtyDays = new Date(now.getTime() - 29 * 86400000);
  thirtyDays.setHours(0, 0, 0, 0);

  const [monthRes, prevRes, dailyRes, ingRes] = await Promise.all([
    supabase.from("orders").select("total,created_at").gte("created_at", monthStart).neq("status", "cancelado"),
    supabase.from("orders").select("total").gte("created_at", prevMonthStart).lt("created_at", monthStart).neq("status", "cancelado"),
    supabase.from("orders").select("total,created_at").gte("created_at", thirtyDays.toISOString()).neq("status", "cancelado"),
    supabase.from("ingredients").select("stock_quantity,cost_per_unit"),
  ]);

  const revenueMonth = (monthRes.data ?? []).reduce((s, o) => s + Number(o.total), 0);
  const revenuePrev = (prevRes.data ?? []).reduce((s, o) => s + Number(o.total), 0);
  const ticket = (monthRes.data?.length ?? 0) > 0 ? revenueMonth / monthRes.data!.length : 0;
  const estoqueAtivo = (ingRes.data ?? []).reduce(
    (s, i) => s + Number(i.stock_quantity) * Number(i.cost_per_unit),
    0
  );

  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  (dailyRes.data ?? []).forEach((o) => {
    const k = o.created_at.slice(0, 10);
    if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + Number(o.total));
  });

  return {
    revenueMonth,
    revenuePrev,
    ticket,
    estoqueAtivo,
    daily: Array.from(byDay.entries()).map(([k, v]) => ({
      dia: new Date(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      receita: v,
    })),
  };
}

function FinanceiroPage() {
  const { data, isLoading } = useQuery({ queryKey: ["financeiro"], queryFn: fetchFinance });
  const diff = (data?.revenueMonth ?? 0) - (data?.revenuePrev ?? 0);
  const pct = (data?.revenuePrev ?? 0) > 0 ? (diff / data!.revenuePrev) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Financeiro</h1>
        <p className="text-muted-foreground">Acompanhe receita, ticket médio e estoque ativo.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Receita do mês" value={fmt(data?.revenueMonth ?? 0)} icon={DollarSign} accent="primary" loading={isLoading} />
        <Kpi label="Mês anterior" value={fmt(data?.revenuePrev ?? 0)} icon={Receipt} accent="muted" loading={isLoading} />
        <Kpi
          label="Variação"
          value={`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
          icon={pct >= 0 ? TrendingUp : TrendingDown}
          accent={pct >= 0 ? "success" : "destructive"}
          loading={isLoading}
        />
        <Kpi label="Ticket médio" value={fmt(data?.ticket ?? 0)} icon={Receipt} accent="gold" loading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Receita — últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data?.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                formatter={(v: number) => fmt(v)}
              />
              <Line type="monotone" dataKey="receita" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Estoque ativo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-display font-semibold">{fmt(data?.estoqueAtivo ?? 0)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Valor total imobilizado em ingredientes em estoque.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, accent, loading,
}: {
  label: string;
  value: string;
  icon: any;
  accent: "primary" | "secondary" | "gold" | "success" | "destructive" | "muted";
  loading?: boolean;
}) {
  const bg =
    accent === "primary" ? "bg-primary/10 text-primary"
    : accent === "secondary" ? "bg-secondary/10 text-secondary"
    : accent === "gold" ? "bg-gold/20 text-gold-foreground"
    : accent === "success" ? "bg-success/15 text-success"
    : accent === "destructive" ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-display font-semibold mt-1">{loading ? "…" : value}</p>
          </div>
          <div className={`size-10 rounded-lg grid place-items-center ${bg}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
