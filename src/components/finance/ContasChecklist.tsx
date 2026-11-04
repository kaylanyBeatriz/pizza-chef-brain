import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, CheckCircle2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api, type ApiCollection } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CategoryChip, DateBadge, EmptyBlock, MonthNav, StatTile, StatusBadge } from "@/components/finance/ui";
import { fmtBRL, fmtDate, monthRange, toDateInput, type Transaction } from "@/lib/finance";

type View = "open" | "paid" | "all";

const VIEWS: Array<{ key: View; label: string }> = [
  { key: "open", label: "Em aberto" },
  { key: "paid", label: "Pagas" },
  { key: "all", label: "Todas" },
];

function daysFromToday(iso: string) {
  const today = new Date(toDateInput(new Date()) + "T00:00:00");
  const due = new Date(iso + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function dueLabel(t: Transaction) {
  if (t.status === "paid") return `Paga em ${fmtDate(t.paid_at)}`;
  const d = daysFromToday(t.due_date);
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence amanhã";
  if (d > 1) return `Vence em ${d} dias`;
  return `Atrasada há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`;
}

/** Controle mensal: as contas que vencem no mês escolhido, com check para dar baixa. */
export function ContasChecklist() {
  const qc = useQueryClient();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [view, setView] = useState<View>("open");
  const [search, setSearch] = useState("");

  const range = useMemo(() => monthRange(new Date(cursor.year, cursor.month, 1)), [cursor]);
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  const { data, isLoading, isFetching, isPlaceholderData } = useQuery({
    queryKey: ["transactions", "contas", range.from, range.to],
    queryFn: async () =>
      (await api.get<ApiCollection<Transaction>>(
        `/finance/transactions?type=expense&from=${range.from}&to=${range.to}&per_page=500`,
      )).data,
  });

  // Atrasadas de meses anteriores continuam aparecendo no topo até serem pagas.
  const { data: overdueAll } = useQuery({
    queryKey: ["transactions", "contas-overdue"],
    queryFn: async () =>
      (await api.get<ApiCollection<Transaction>>("/finance/transactions?type=expense&status=overdue&per_page=500")).data,
  });

  const month = data ?? [];
  const carried = useMemo(
    () => (overdueAll ?? []).filter((t) => t.due_date < range.from).sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [overdueAll, range.from],
  );

  const toggle = useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) =>
      api.patch(`/finance/transactions/${id}/${paid ? "unpay" : "pay"}`, {}),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success(vars.paid ? "Baixa desfeita" : "Conta marcada como paga");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const sum = (list: Transaction[]) => list.reduce((a, t) => a + t.amount, 0);
    const paid = month.filter((t) => t.status === "paid");
    const open = month.filter((t) => t.status !== "paid");
    const overdue = month.filter((t) => t.status === "overdue");
    return { total: sum(month), paid, open, overdue, paidSum: sum(paid), openSum: sum(open), overdueSum: sum(overdue) };
  }, [month]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = month.filter((t) => {
      if (view === "open" && t.status === "paid") return false;
      if (view === "paid" && t.status !== "paid") return false;
      return !term || t.description.toLowerCase().includes(term) || (t.counterparty ?? "").toLowerCase().includes(term);
    });
    return filtered.sort((a, b) =>
      view === "paid" ? (b.paid_at ?? "").localeCompare(a.paid_at ?? "") : a.due_date.localeCompare(b.due_date));
  }, [month, view, search]);

  const carriedRows = view === "paid" ? [] : carried.filter((t) => !search.trim() || t.description.toLowerCase().includes(search.trim().toLowerCase()));
  const progress = stats.total === 0 ? 0 : Math.round((stats.paidSum / stats.total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav year={cursor.year} month={cursor.month} onChange={setCursor} />
        {!isCurrentMonth && (
          <Button variant="outline" size="sm" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}>
            Ir para o mês atual
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total do mês" value={fmtBRL(stats.total)} icon={Wallet} hint={`${month.length} conta(s)`} />
        <StatTile
          label="Já pago" value={fmtBRL(stats.paidSum)} icon={CheckCircle2} tone="success"
          hint={`${stats.paid.length} de ${month.length} conta(s) · ${progress}%`}
        />
        <StatTile
          label="Falta pagar" value={fmtBRL(stats.openSum)}
          icon={stats.overdue.length > 0 ? AlertTriangle : CalendarCheck}
          tone={stats.overdue.length > 0 ? "danger" : "warning"}
          hint={stats.overdue.length > 0 ? `${stats.overdue.length} atrasada(s) · ${fmtBRL(stats.overdueSum)}` : `${stats.open.length} conta(s) em aberto`}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progresso do mês</span>
          <span className="font-medium text-foreground">{progress}% pago</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-success/80 to-success transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="inline-flex rounded-lg border bg-muted/40 p-1 gap-1">
            {VIEWS.map((v) => (
              <Button key={v.key} size="sm" variant={view === v.key ? "default" : "ghost"} onClick={() => setView(v.key)}>
                {v.label}
              </Button>
            ))}
          </div>
          <Input className="h-9 w-full sm:w-72" placeholder="Buscar conta…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <CardContent className={`p-0 transition-opacity ${isFetching && isPlaceholderData ? "opacity-50" : ""}`}>
          {carriedRows.length > 0 && (
            <>
              <p className="bg-destructive/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                Atrasadas de meses anteriores ({carriedRows.length})
              </p>
              <ul className="divide-y border-b">
                {carriedRows.map((t) => (
                  <BillRow key={t.id} t={t} pending={toggle.isPending} onToggle={() => toggle.mutate({ id: t.id, paid: false })} />
                ))}
              </ul>
            </>
          )}

          {isLoading && <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && rows.length === 0 && (
            view === "open"
              ? <EmptyBlock icon={CheckCircle2} title="Tudo pago neste mês!" text="Nenhuma conta em aberto. Cadastre novas despesas em Lançamentos." />
              : <EmptyBlock icon={CalendarCheck} title="Nada por aqui" text="Não há contas nesta visão para o mês escolhido." />
          )}
          <ul className="divide-y">
            {rows.map((t) => (
              <BillRow key={t.id} t={t} pending={toggle.isPending} onToggle={() => toggle.mutate({ id: t.id, paid: t.status === "paid" })} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Precisa cadastrar ou alterar uma conta? Faça em{" "}
        <Link to="/lancamentos" className="font-medium text-primary hover:underline">Lançamentos</Link>.
      </p>
    </div>
  );
}

function BillRow({ t, pending, onToggle }: { t: Transaction; pending: boolean; onToggle: () => void }) {
  const paid = t.status === "paid";
  const overdue = t.status === "overdue";
  return (
    <li
      className={`flex items-center gap-4 border-l-4 px-4 py-3.5 transition-colors hover:bg-accent/40 ${
        overdue ? "border-l-destructive bg-destructive/[0.03]" : paid ? "border-l-transparent bg-muted/30" : "border-l-transparent"
      }`}
    >
      <Checkbox
        checked={paid}
        title={paid ? "Desmarcar conta como paga" : "Marcar como pago"}
        disabled={pending}
        onCheckedChange={onToggle}
        aria-label={`${paid ? "Desfazer baixa de" : "Dar baixa em"} ${t.description}`}
        className="size-6 rounded-md"
      />
      <DateBadge iso={t.due_date} tone={paid ? "muted" : overdue ? "danger" : "neutral"} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className={`truncate font-medium ${paid ? "text-muted-foreground line-through" : ""}`}>{t.description}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CategoryChip name={t.category} />
          {t.counterparty && <span className="truncate text-xs text-muted-foreground">{t.counterparty}</span>}
        </div>
      </div>
      <div className="hidden text-right text-xs sm:block">
        <StatusBadge status={t.status} />
        <p className="mt-1 text-muted-foreground">{dueLabel(t)}</p>
      </div>
      <p className={`w-28 text-right text-base font-semibold tabular-nums ${paid ? "text-muted-foreground" : ""}`}>{fmtBRL(t.amount)}</p>
    </li>
  );
}
