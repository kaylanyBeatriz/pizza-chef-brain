import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/consumo")({
  component: ConsumoPage,
});

async function fetchConsumo() {
  const now = new Date();
  const start = new Date(now.getTime() - 29 * 86400000);
  start.setHours(0, 0, 0, 0);

  const [itemsRes, ordersRes, ingRes] = await Promise.all([
    supabase
      .from("order_items")
      .select("quantity, product:products(name,recipe:product_ingredients(ingredient_id,quantity)), order:orders!inner(created_at,status)")
      .gte("order.created_at", start.toISOString())
      .neq("order.status", "cancelado"),
    supabase
      .from("orders")
      .select("created_at")
      .gte("created_at", start.toISOString())
      .neq("status", "cancelado"),
    supabase.from("ingredients").select("id,name,unit,stock_quantity,min_stock"),
  ]);

  // consumption per ingredient (qty * recipe qty)
  const consumption = new Map<string, number>();
  (itemsRes.data ?? []).forEach((row: any) => {
    const recipes = row.product?.recipe ?? [];
    recipes.forEach((r: any) => {
      const total = Number(r.quantity) * Number(row.quantity);
      consumption.set(r.ingredient_id, (consumption.get(r.ingredient_id) ?? 0) + total);
    });
  });

  const ingredients = ingRes.data ?? [];
  const topConsumo = ingredients
    .map((i) => ({
      name: i.name,
      unit: i.unit,
      qty: consumption.get(i.id) ?? 0,
      stock: Number(i.stock_quantity),
      min: Number(i.min_stock),
    }))
    .filter((i) => i.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  // peak hours
  const byHour = new Array(24).fill(0);
  (ordersRes.data ?? []).forEach((o) => {
    const h = new Date(o.created_at).getHours();
    byHour[h]++;
  });
  const peakHours = byHour
    .map((count, hour) => ({ hora: `${String(hour).padStart(2, "0")}h`, pedidos: count }))
    .filter((h) => h.pedidos > 0);

  // forecast — items running out (avg daily consumption -> days remaining)
  const days = 30;
  const forecast = ingredients
    .map((i) => {
      const used = consumption.get(i.id) ?? 0;
      const avgDay = used / days;
      const diasRest = avgDay > 0 ? Number(i.stock_quantity) / avgDay : Infinity;
      return {
        name: i.name,
        unit: i.unit,
        stock: Number(i.stock_quantity),
        avgDay,
        diasRest,
      };
    })
    .filter((i) => i.avgDay > 0 && i.diasRest < 14)
    .sort((a, b) => a.diasRest - b.diasRest)
    .slice(0, 6);

  return { topConsumo, peakHours, forecast };
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
