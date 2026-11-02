import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download, Pencil, Plus, Receipt, Search, Tags, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api, type ApiCollection } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoriesDialog } from "@/components/finance/CategoriesDialog";
import { TransactionDialog, type TransactionPayload } from "@/components/finance/TransactionDialog";
import { CategoryChip, DateBadge, EmptyBlock, MonthNav, PageHeader, StatTile, StatusBadge } from "@/components/finance/ui";
import {
  STATUS_LABEL, addMonthsISO, downloadCsv, fmtBRL, fmtDate, monthRange, type Transaction,
} from "@/lib/finance";

const ALL = "all";

const STATUS_FILTERS = [
  { key: ALL, label: "Todos" },
  { key: "paid", label: "Pagos" },
  { key: "pending", label: "A vencer" },
  { key: "overdue", label: "Atrasados" },
];

/** Cadastro de lançamentos (despesas), pagos ou não. A baixa do que vence no mês é feita em Contas a pagar. */
export function LancamentosView() {
  const qc = useQueryClient();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [allTime, setAllTime] = useState(false);
  const { from, to } = useMemo(
    () => (allTime ? { from: "", to: "" } : monthRange(new Date(cursor.year, cursor.month, 1))),
    [allTime, cursor],
  );
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { data, isLoading, isFetching, isPlaceholderData } = useQuery({
    queryKey: ["transactions", "lancamentos", status, from, to, search],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "500", type: "expense" });
      if (status !== ALL) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (search.trim()) params.set("search", search.trim());
      return (await api.get<ApiCollection<Transaction>>(`/finance/transactions?${params}`)).data;
    },
  });
  const rows = data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  const save = useMutation({
    mutationFn: async ({ payload, repeatMonths }: { payload: TransactionPayload; repeatMonths: number }) => {
      if (editing) {
        await api.put(`/finance/transactions/${editing.id}`, payload);
        return;
      }
      // Repetição mensal: o primeiro mantém o "já pago"; os demais nascem em aberto.
      for (let i = 0; i < repeatMonths; i++) {
        await api.post("/finance/transactions", i === 0
          ? payload
          : { ...payload, due_date: addMonthsISO(payload.due_date, i), paid_at: null });
      }
    },
    onSuccess: (_d, vars) => {
      refresh();
      toast.success(vars.repeatMonths > 1 ? `${vars.repeatMonths} lançamentos criados` : "Lançamento salvo");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/transactions/${id}`),
    onSuccess: () => { refresh(); toast.success("Lançamento excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.amount, 0);
    const paid = rows.filter((r) => r.status === "paid").reduce((a, r) => a + r.amount, 0);
    return { total, paid, open: total - paid, count: rows.length, paidCount: rows.filter((r) => r.status === "paid").length };
  }, [rows]);

  function exportCsv() {
    downloadCsv("lancamentos.csv", [
      ["Descrição", "Categoria", "Valor", "Vencimento", "Pago em", "Situação", "Fornecedor"],
      ...rows.map((t) => [
        t.description, t.category,
        t.amount.toFixed(2).replace(".", ","), fmtDate(t.due_date), fmtDate(t.paid_at),
        STATUS_LABEL[t.status], t.counterparty ?? "",
      ]),
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lançamentos"
        description="Registre aqui as suas despesas. O que ainda não foi pago aparece em Contas a pagar, para você dar o check."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4 mr-2" /> CSV
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline"><Tags className="size-4 mr-2" /> Categorias</Button>
              </DialogTrigger>
              <CategoriesDialog />
            </Dialog>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(null)}><Plus className="size-4 mr-2" /> Novo lançamento</Button>
              </DialogTrigger>
              <TransactionDialog
                editing={editing} saving={save.isPending}
                onSubmit={(payload, repeatMonths) => save.mutate({ payload, repeatMonths })}
              />
            </Dialog>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total lançado" value={fmtBRL(totals.total)} icon={Wallet} hint={`${totals.count} lançamento(s)`} />
        <StatTile label="Já pago" value={fmtBRL(totals.paid)} icon={CheckCircle2} tone="success" hint={`${totals.paidCount} pago(s)`} />
        <StatTile
          label="Falta pagar" value={fmtBRL(totals.open)} icon={Clock}
          tone={totals.open > 0 ? "warning" : "neutral"} hint={`${totals.count - totals.paidCount} em aberto`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {allTime ? (
          <span className="inline-flex h-12 items-center rounded-xl border bg-card px-5 font-display font-semibold shadow-sm">Todo o período</span>
        ) : (
          <MonthNav year={cursor.year} month={cursor.month} onChange={setCursor} />
        )}
        <Button variant="ghost" size="sm" onClick={() => setAllTime((v) => !v)}>
          {allTime ? "Voltar para o mês" : "Ver todo o período"}
        </Button>

        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar descrição ou fornecedor" aria-label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-xl border bg-card p-1 shadow-sm" role="group" aria-label="Filtrar por situação">
        {STATUS_FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={status === f.key ? "default" : "ghost"} onClick={() => setStatus(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <Table className={isFetching && isPlaceholderData ? "opacity-50 transition-opacity" : "transition-opacity"}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Vence</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <DateBadge iso={t.due_date} tone={t.status === "paid" ? "muted" : t.status === "overdue" ? "danger" : "neutral"} />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{t.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <CategoryChip name={t.category} />
                    {t.counterparty && <span className="text-xs text-muted-foreground">{t.counterparty}</span>}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-base font-semibold tabular-nums">{fmtBRL(t.amount)}</TableCell>
                <TableCell>
                  <StatusBadge status={t.status} />
                  {t.paid_at && <p className="mt-1 text-xs text-muted-foreground">em {fmtDate(t.paid_at)}</p>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => { setEditing(t); setOpen(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" title="Excluir"
                    onClick={() => { if (confirm(`Excluir "${t.description}"?`)) remove.mutate(t.id); }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && rows.length === 0 && (
          <EmptyBlock
            icon={Receipt} title="Nenhum lançamento aqui"
            text="Não há despesas neste filtro. Use Novo lançamento para cadastrar uma."
          />
        )}
      </Card>
    </div>
  );
}
