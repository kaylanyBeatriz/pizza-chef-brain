import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, CheckCircle2, Undo2, AlertTriangle, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Big Pizza" },
      { name: "description", content: "Contas a pagar da Big Pizza: dívidas, pagas e em atraso." },
      { property: "og:title", content: "Financeiro — Big Pizza" },
      { property: "og:description", content: "Controle de dívidas e pagamentos da pizzaria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceiroPage,
});

type Bill = {
  id: string;
  description: string;
  creditor: string;
  category: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paidAt: string | null;
};

type Status = "paid" | "overdue" | "today" | "open";
const CATEGORIES = ["Fornecedor", "Aluguel", "Energia/Água/Gás", "Salários", "Impostos", "Empréstimo", "Manutenção", "Outros"];
const KEY = "bigpizza.bills";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const fmtDate = (d: string) => d.split("-").reverse().join("/");

export function billStatus(b: Pick<Bill, "dueDate" | "paidAt">, today = todayStr()): Status {
  if (b.paidAt) return "paid";
  if (b.dueDate < today) return "overdue";
  if (b.dueDate === today) return "today";
  return "open";
}

const STATUS_UI: Record<Status, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "bg-success text-success-foreground" },
  overdue: { label: "Em atraso", cls: "bg-destructive text-destructive-foreground" },
  today: { label: "Vence hoje", cls: "bg-warning text-warning-foreground" },
  open: { label: "A vencer", cls: "bg-secondary text-secondary-foreground" },
};

const empty = { description: "", creditor: "", category: "Fornecedor", amount: "", dueDate: todayStr() };

function FinanceiroPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  useEffect(() => {
    try { setBills(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(bills)); }, [bills, loaded]);

  const totals = useMemo(() => {
    const t = { open: 0, overdue: 0, paid: 0, overdueCount: 0 };
    for (const b of bills) {
      const s = billStatus(b);
      if (s === "paid") t.paid += b.amount;
      else if (s === "overdue") { t.overdue += b.amount; t.overdueCount++; }
      else t.open += b.amount;
    }
    return t;
  }, [bills]);

  const list = useMemo(
    () => bills
      .filter((b) => filter === "all" || billStatus(b) === filter || (filter === "open" && billStatus(b) === "today"))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [bills, filter],
  );

  function save() {
    const amount = Number(String(form.amount).replace(",", "."));
    if (!form.description.trim()) return setError("Informe a descrição.");
    if (!amount || amount <= 0) return setError("Informe um valor maior que zero.");
    if (!form.dueDate) return setError("Informe o vencimento.");
    setBills((p) => [...p, { id: crypto.randomUUID(), description: form.description.trim(), creditor: form.creditor.trim(), category: form.category, amount, dueDate: form.dueDate, paidAt: null }]);
    setOpen(false); setForm(empty); setError("");
    toast.success("Conta lançada.");
  }

  const togglePaid = (id: string) =>
    setBills((p) => p.map((b) => (b.id === id ? { ...b, paidAt: b.paidAt ? null : todayStr() } : b)));
  const remove = (id: string) => { if (confirm("Excluir este lançamento?")) setBills((p) => p.filter((b) => b.id !== id)); };

  const kpis = [
    { label: "A pagar", value: totals.open, icon: Clock, cls: "text-foreground" },
    { label: `Em atraso (${totals.overdueCount})`, value: totals.overdue, icon: AlertTriangle, cls: "text-destructive" },
    { label: "Pago", value: totals.paid, icon: CheckCircle2, cls: "text-success" },
    { label: "Total em dívidas", value: totals.open + totals.overdue, icon: Wallet, cls: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Contas a pagar: dívidas, pagamentos e atrasos.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full"><Plus /> Nova conta</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><k.icon className="h-4 w-4" />{k.label}</div>
            <div className={`mt-1 text-xl font-bold ${k.cls}`}>{brl(k.value)}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {([["all", "Todas"], ["open", "A vencer"], ["overdue", "Em atraso"], ["paid", "Pagas"]] as const).map(([v, l]) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} className="rounded-full" onClick={() => setFilter(v)}>{l}</Button>
        ))}
      </div>

      <Card><CardContent className="p-0">
        {list.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma conta lançada aqui.</p>
        ) : (
          <ul className="divide-y">
            {list.map((b) => {
              const s = STATUS_UI[billStatus(b)];
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{b.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.category}{b.creditor && ` · ${b.creditor}`} · vence {fmtDate(b.dueDate)}{b.paidAt && ` · pago em ${fmtDate(b.paidAt)}`}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                  <div className="w-28 text-right font-semibold">{brl(b.amount)}</div>
                  <Button size="sm" variant={b.paidAt ? "outline" : "default"} onClick={() => togglePaid(b.id)}>
                    {b.paidAt ? <><Undo2 /> Desfazer</> : <><CheckCircle2 /> Pagar</>}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(b.id)} aria-label="Excluir"><Trash2 /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova conta a pagar</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Descrição *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Queijo mussarela" /></div>
            <div><Label>Credor / Fornecedor</Label><Input value={form.creditor} onChange={(e) => setForm({ ...form, creditor: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$) *</Label><Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" /></div>
            </div>
            <div><Label>Vencimento *</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Lançar conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
