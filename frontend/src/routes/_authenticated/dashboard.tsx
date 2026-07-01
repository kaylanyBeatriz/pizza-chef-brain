import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pizza, DollarSign, ShoppingBag, AlertTriangle, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface Stats {
  ordersToday: number;
  revenueToday: number;
  ordersMonth: number;
  revenueMonth: number;
  lowStock: Array<{ id: string; name: string; current_stock: number; minimum_stock: number; unit: string }>;
  topPizzas: Array<{ name: string; quantidade: number }>;
  monthly: Array<{ mes: string; vendas: number }>;
}

async function fetchStats(): Promise<Stats> {
  return api.get<Stats>("/dashboard");
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchStats });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da pizzaria em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Vendas hoje" value={fmt(data?.revenueToday ?? 0)} icon={DollarSign} accent="primary" loading={isLoading} />
        <KpiCard label="Pedidos hoje" value={String(data?.ordersToday ?? 0)} icon={ShoppingBag} accent="secondary" loading={isLoading} />
        <KpiCard label="Receita do mês" value={fmt(data?.revenueMonth ?? 0)} icon={TrendingUp} accent="gold" loading={isLoading} />
        <KpiCard label="Pedidos do mês" value={String(data?.ordersMonth ?? 0)} icon={Pizza} accent="secondary" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Vendas — últimos 12 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data?.monthly ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Line type="monotone" dataKey="vendas" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: "var(--primary)" }} />
              </LineChart>
            </ResponsiveContainer>
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
          <CardTitle className="font-display">Top pizzas do mês</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.topPizzas?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem vendas registradas no mês.</p>
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
