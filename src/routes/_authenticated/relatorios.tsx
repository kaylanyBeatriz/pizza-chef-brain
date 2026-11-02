import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Download, PieChart, Printer, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryChip, PageHeader, StatTile } from "@/components/finance/ui";
import { downloadCsv, fmtBRL, fmtDate, monthRange, type FinanceSummary } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const defaults = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const { data, isLoading } = useQuery({
    queryKey: ["finance-summary", from, to],
    queryFn: () => api.get<FinanceSummary>(`/finance/summary?${new URLSearchParams({ from, to })}`),
  });

  const rows = (data?.byCategory ?? []).filter((c) => c.type === "expense");
  const total = rows.reduce((sum, c) => sum + c.total, 0);
  const count = rows.reduce((sum, c) => sum + c.count, 0);

  function exportCsv() {
    if (!data) return;
    const n = (v: number) => v.toFixed(2).replace(".", ",");
    downloadCsv(`despesas-${from}-a-${to}.csv`, [
      ["Despesas pagas", `${fmtDate(from)} a ${fmtDate(to)}`],
      [],
      ["Categoria", "Lançamentos", "Total", "% do total"],
      ...rows.map((c) => [c.category, c.count, n(c.total), total ? `${Math.round((c.total / total) * 100)}%` : "0%"]),
      [],
      ["Total pago", count, n(total), ""],
      ["Ainda a pagar (em aberto)", data.payable.count, n(data.payable.total), ""],
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Quanto foi pago em cada categoria no período. Exporte em CSV ou salve como PDF."
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={exportCsv} disabled={!data}>
              <Download className="size-4 mr-2" /> CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!data}>
              <Printer className="size-4 mr-2" /> PDF / Imprimir
            </Button>
          </div>
        }
      />

      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end">
            <div className="space-y-2">
              <Label htmlFor="rel-from">Data inicial</Label>
              <Input id="rel-from" type="date" value={from} max={to}
                onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-to">Data final</Label>
              <Input id="rel-to" type="date" value={to} min={from}
                onChange={(e) => { setTo(e.target.value); if (e.target.value < from) setFrom(e.target.value); }} />
            </div>
            <Button variant="outline" onClick={() => { const r = monthRange(); setFrom(r.from); setTo(r.to); }}>Mês atual</Button>
          </div>
        </CardContent>
      </Card>

      <p className="hidden print:block text-sm">Período: {fmtDate(from)} a {fmtDate(to)}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total pago" value={fmtBRL(total)} icon={Wallet} tone="success" hint={`${count} lançamento(s)`} />
        <StatTile label="Ainda a pagar" value={fmtBRL(data?.payable.total ?? 0)} icon={Clock} tone="warning" hint={`${data?.payable.count ?? 0} conta(s) em aberto`} />
        <StatTile label="Maior categoria" value={rows[0]?.category ?? "—"} icon={PieChart} hint={rows[0] ? fmtBRL(rows[0].total) : undefined} />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Lançamentos</TableHead>
              <TableHead>Participação</TableHead>
              <TableHead className="text-right">Total pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">Sem despesas pagas no período.</TableCell></TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.category}>
                <TableCell><CategoryChip name={c.category} /></TableCell>
                <TableCell className="text-right text-muted-foreground">{c.count}</TableCell>
                <TableCell className="w-56">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${total ? (c.total / total) * 100 : 0}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs text-muted-foreground">{total ? Math.round((c.total / total) * 100) : 0}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmtBRL(c.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right">{count}</TableCell>
              <TableCell />
              <TableCell className="text-right font-semibold tabular-nums">{fmtBRL(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
    </div>
  );
}
