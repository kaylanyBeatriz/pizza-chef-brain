import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type CurrentUser } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/financeiro")({
  beforeLoad: async () => {
    try {
      const account = await api.get<CurrentUser>("/me");
      if (account.role !== "admin" && account.role !== "gerente") {
        throw redirect({ to: "/dashboard" });
      }
    } catch (error) {
      if (error instanceof Response) throw error;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: FinanceiroPage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type FinanceReport = {
  revenueMonth: number;
  revenuePrev: number;
  ticket: number;
  estoqueAtivo: number;
  daily: Array<{ dia: string; receita: number }>;
};

async function fetchFinance(): Promise<FinanceReport> {
  return api.get<FinanceReport>("/reports/finance");
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
