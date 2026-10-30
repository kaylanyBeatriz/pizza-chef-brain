import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, DollarSign, Pizza, ShoppingBag, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface Stats {
  ordersToday: number;
  revenueToday: number;
  ordersPeriod: number;
  revenuePeriod: number;
  lowStock: Array<{ id: string; name: string; current_stock: number; minimum_stock: number; unit: string }>;
  topPizzas: Array<{ name: string; quantidade: number }>;
  daily: Array<{ dia: string; vendas: number }>;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultRange() {
  const today = new Date();
  return {
    from: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatDateInput(today),
  };
}

async function fetchStats(from: string, to: string): Promise<Stats> {
  const params = new URLSearchParams({ from, to });
  return api.get<Stats>(`/dashboard?${params.toString()}`);
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DashboardPage() {
  const defaults = useMemo(() => getDefaultRange(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => fetchStats(from, to),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da pizzaria em tempo real.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Filtro de datas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end">
            <div className="space-y-2">
              <Label htmlFor="dashboard-from">Data inicial</Label>
              <Input
                id="dashboard-from"
                type="date"
                value={from}
                max={to}
                onChange={(event) => {
                  const next = event.target.value;
                  setFrom(next);
                  if (next > to) setTo(next);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboard-to">Data final</Label>
              <Input
                id="dashboard-to"
                type="date"
                value={to}
                min={from}
                onChange={(event) => {
                  const next = event.target.value;
                  setTo(next);
                  if (next < from) setFrom(next);
                }}
              />
            </div>
            <div className="flex gap-2 md:justify-end">
              <Button type="button" variant="outline" onClick={() => {
                const range = getDefaultRange();
                setFrom(range.from);
                setTo(range.to);
              }}>
                Mês atual
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            O período afeta as receitas, os pedidos concluídos e os gráficos. Os indicadores de hoje e o estoque baixo permanecem fixos.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Vendas hoje" value={fmt(data?.revenueToday ?? 0)} icon={DollarSign} accent="primary" loading={isLoading || isFetching} />
        <KpiCard label="Pedidos hoje" value={String(data?.ordersToday ?? 0)} icon={ShoppingBag} accent="secondary" loading={isLoading || isFetching} />
        <KpiCard label="Vendas no período" value={fmt(data?.revenuePeriod ?? 0)} icon={TrendingUp} accent="gold" loading={isLoading || isFetching} />
        <KpiCard label="Pedidos no período" value={String(data?.ordersPeriod ?? 0)} icon={Pizza} accent="secondary" loading={isLoading || isFetching} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Vendas por dia no período</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.daily?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período selecionado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data?.daily ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                    formatter={(v: number) => fmt(v)}
                  />
                  <Line type="monotone" dataKey="vendas" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: "var(--primary)" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              Estoque baixo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.lowStock?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Tudo em ordem 🍕</p>
            ) : (
              data!.lowStock.map((i) => {
                const critical = i.current_stock <= i.minimum_stock * 0.5;
                return (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Number(i.current_stock).toFixed(2)} {i.unit} (mín. {Number(i.minimum_stock).toFixed(2)})
                      </p>
                    </div>
                    <Badge variant={critical ? "destructive" : "secondary"} className={critical ? "" : "bg-warning text-warning-foreground"}>
                      {critical ? "crítico" : "baixo"}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Top pizzas no período</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.topPizzas?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem vendas registradas no período selecionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.topPizzas ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="quantidade" fill="var(--secondary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, accent, loading,
}: {
  label: string; value: string; icon: any; accent: "primary" | "secondary" | "gold"; loading?: boolean;
}) {
  const bg = accent === "primary" ? "bg-primary/10 text-primary"
    : accent === "secondary" ? "bg-secondary/10 text-secondary"
    : "bg-gold/20 text-gold-foreground";
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
