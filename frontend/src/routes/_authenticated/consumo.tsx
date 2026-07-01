import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/consumo")({
  component: ConsumoPage,
});

type ConsumptionReport = {
  topConsumo: Array<{ name: string; unit: string; qty: number; stock: number; min: number }>;
  peakHours: Array<{ hora: string; pedidos: number }>;
  forecast: Array<{ name: string; unit: string; stock: number; avgDay: number; diasRest: number }>;
};

async function fetchConsumo(): Promise<ConsumptionReport> {
  return api.get<ConsumptionReport>("/reports/consumption");
}

function ConsumoPage() {
  const { data, isLoading } = useQuery({ queryKey: ["consumo"], queryFn: fetchConsumo });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Consumo</h1>
        <p className="text-muted-foreground">
          Análise inteligente: ingredientes mais usados, horários de pico e previsão de reposição.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Flame className="size-5 text-primary" />
            Top ingredientes consumidos (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : data?.topConsumo.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sem dados de consumo no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.topConsumo ?? []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={110} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number, _n, p: any) => `${v.toFixed(2)} ${p.payload.unit}`}
                />
                <Bar dataKey="qty" fill="var(--secondary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Clock className="size-5 text-secondary" />
              Horários de pico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.peakHours.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Sem pedidos no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.peakHours ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hora" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="pedidos" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              Previsão de reposição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.forecast.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                Estoque saudável — nada acabando em breve.
              </p>
            ) : (
              data!.forecast.map((f) => {
                const critical = f.diasRest <= 3;
                return (
                  <div key={f.name} className="flex items-center justify-between text-sm border-b border-border/60 pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.stock.toFixed(2)} {f.unit} • consumo {f.avgDay.toFixed(2)} {f.unit}/dia
                      </p>
                    </div>
                    <Badge variant={critical ? "destructive" : "secondary"} className={critical ? "" : "bg-warning text-warning-foreground"}>
                      ~{Math.max(0, Math.floor(f.diasRest))} dias
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
