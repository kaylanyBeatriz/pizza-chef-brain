import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHODS, toDateInput, type Transaction } from "@/lib/finance";
import { categoryNames, useCategories } from "@/lib/categories";

export type TransactionPayload = {
  type: "expense";
  description: string;
  category: string;
  amount: number;
  payment_method: string | null;
  counterparty: string | null;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
};

const NONE = "none";

export function TransactionDialog({
  editing, onSubmit, saving,
}: {
  editing: Transaction | null;
  /** `repeatMonths` > 1 cria o mesmo lançamento nos meses seguintes (só em lançamento novo). */
  onSubmit: (payload: TransactionPayload, repeatMonths: number) => void;
  saving: boolean;
}) {
  const today = toDateInput(new Date());
  const { data: allCategories } = useCategories();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(NONE);
  const [counterparty, setCounterparty] = useState("");
  const [dueDate, setDueDate] = useState(today);
  const [paid, setPaid] = useState(false);
  const [paidAt, setPaidAt] = useState(today);
  const [repeat, setRepeat] = useState(false);
  const [repeatMonths, setRepeatMonths] = useState("12");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setDescription(editing?.description ?? "");
    setCategory(editing?.category ?? categoryNames(undefined)[0]);
    setAmount(editing ? String(editing.amount) : "");
    setMethod(editing?.payment_method ?? NONE);
    setCounterparty(editing?.counterparty ?? "");
    setDueDate(editing?.due_date ?? today);
    setPaid(!!editing?.paid_at);
    setPaidAt(editing?.paid_at ?? today);
    setRepeat(false);
    setRepeatMonths("12");
    setNotes(editing?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const categories = categoryNames(allCategories);
  const categoryOptions = categories.includes(category) || !category ? categories : [category, ...categories];

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display">{editing ? "Editar" : "Novo"} lançamento</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(
            {
              type: "expense",
              description: description.trim(),
              category,
              amount: Number(amount.replace(",", ".")),
              payment_method: method === NONE ? null : method,
              counterparty: counterparty.trim() || null,
              due_date: dueDate,
              paid_at: paid ? paidAt : null,
              notes: notes.trim() || null,
            },
            !editing && repeat ? Math.max(2, Math.min(60, Number(repeatMonths) || 12)) : 1,
          );
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={255} placeholder="Ex.: Conta de luz" />
          </div>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vencimento</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não informada</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Fornecedor (opcional)</Label>
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={255} />
          </div>

          <div className="col-span-2 flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <div>
              <Label htmlFor="tx-paid" className="cursor-pointer">Já pago</Label>
              <p className="text-xs text-muted-foreground">Deixe desligado para dar o check depois, em Contas a pagar.</p>
            </div>
            <Switch id="tx-paid" checked={paid} onCheckedChange={setPaid} />
          </div>
          {paid && (
            <div className="space-y-2 col-span-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
            </div>
          )}

          {!editing && (
            <>
              <div className="col-span-2 flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                <div>
                  <Label htmlFor="tx-repeat" className="cursor-pointer">Repetir todo mês</Label>
                  <p className="text-xs text-muted-foreground">Cria o mesmo lançamento nos meses seguintes (aluguel, luz, internet…).</p>
                </div>
                <Switch id="tx-repeat" checked={repeat} onCheckedChange={setRepeat} />
              </div>
              {repeat && (
                <div className="space-y-2 col-span-2">
                  <Label>Quantos meses no total (incluindo este)</Label>
                  <Input type="number" min={2} max={60} value={repeatMonths} onChange={(e) => setRepeatMonths(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">Só o primeiro entra como pago, se marcado acima; os demais ficam em aberto.</p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2 col-span-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
