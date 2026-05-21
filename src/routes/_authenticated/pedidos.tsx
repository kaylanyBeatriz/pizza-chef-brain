import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, Trash2, Check, X, Clock, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
});

type OrderStatus = "pendente" | "preparando" | "concluido" | "cancelado";
type Order = {
  id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string | null;
  total: number;
  notes: string | null;
  created_at: string;
  order_items: { id: string; quantity: number; unit_price: number; product: { name: string } }[];
};

const statusStyle: Record<OrderStatus, string> = {
  pendente: "bg-warning text-warning-foreground",
  preparando: "bg-secondary text-secondary-foreground",
  concluido: "bg-success text-success-foreground",
  cancelado: "bg-muted text-muted-foreground",
};
const statusLabel: Record<OrderStatus, string> = {
  pendente: "Pendente", preparando: "Preparando", concluido: "Concluído", cancelado: "Cancelado",
};

function PedidosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, quantity, unit_price, product:products(name))")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success(vars.status === "concluido" ? "Pedido concluído — estoque baixado" : "Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, Order[]> = { pendente: [], preparando: [], concluido: [], cancelado: [] };
    (orders ?? []).forEach((o) => g[o.status].push(o));
    return g;
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Pedidos</h1>
          <p className="text-muted-foreground">Ao concluir um pedido, o estoque é baixado automaticamente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" /> Novo pedido</Button>
          </DialogTrigger>
          <NewOrderDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatusColumn title="Pendentes" icon={<Clock className="size-4" />} orders={grouped.pendente} onAdvance={(o) => updateStatus.mutate({ id: o.id, status: "preparando" })} onCancel={(o) => updateStatus.mutate({ id: o.id, status: "cancelado" })} actionLabel="Iniciar preparo" />
        <StatusColumn title="Preparando" icon={<ChefHat className="size-4" />} orders={grouped.preparando} onAdvance={(o) => updateStatus.mutate({ id: o.id, status: "concluido" })} onCancel={(o) => updateStatus.mutate({ id: o.id, status: "cancelado" })} actionLabel="Concluir" />
        <StatusColumn title="Concluídos hoje" icon={<Check className="size-4" />} orders={grouped.concluido.slice(0, 20)} />
      </div>

      {isLoading && <p className="text-center text-muted-foreground">Carregando…</p>}
    </div>
  );
}

function StatusColumn({
  title, icon, orders, onAdvance, onCancel, actionLabel,
}: {
  title: string; icon: React.ReactNode; orders: Order[];
  onAdvance?: (o: Order) => void; onCancel?: (o: Order) => void; actionLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          {icon} {title}
          <Badge variant="secondary" className="ml-auto">{orders.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[60vh] overflow-auto">
        {orders.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Vazio</p>}
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">#{o.order_number}</p>
              <Badge className={statusStyle[o.status]}>{statusLabel[o.status]}</Badge>
            </div>
            {o.customer_name && <p className="text-xs text-muted-foreground">{o.customer_name}</p>}
            <ul className="text-sm space-y-0.5">
              {o.order_items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.quantity}× {it.product?.name}</span>
                  <span className="text-muted-foreground">{(it.quantity * Number(it.unit_price)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="font-display font-semibold">{Number(o.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
            {(onAdvance || onCancel) && (
              <div className="flex gap-2 pt-1">
                {onAdvance && <Button size="sm" className="flex-1" onClick={() => onAdvance(o)}>{actionLabel}</Button>}
                {onCancel && <Button size="sm" variant="ghost" onClick={() => onCancel(o)}><X className="size-4" /></Button>}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type Line = { product_id: string; quantity: number };

function NewOrderDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: 1 }]);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,price").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const productMap = useMemo(() => new Map((products ?? []).map((p: any) => [p.id, p])), [products]);
  const total = lines.reduce((s, l) => {
    const p = productMap.get(l.product_id) as any;
    return s + (p ? Number(p.price) * l.quantity : 0);
  }, 0);

  const create = useMutation({
    mutationFn: async () => {
      const valid = lines.filter((l) => l.product_id && l.quantity > 0);
      if (valid.length === 0) throw new Error("Adicione ao menos uma pizza");

      const { data: order, error: e1 } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName.trim() || null,
          notes: notes.trim() || null,
          total,
          status: "pendente" as const,
          created_by: user?.id,
        })
        .select()
        .single();
      if (e1) throw e1;

      const items = valid.map((l) => {
        const p = productMap.get(l.product_id) as any;
        return { order_id: order.id, product_id: l.product_id, quantity: l.quantity, unit_price: Number(p.price) };
      });
      const { error: e2 } = await supabase.from("order_items").insert(items);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pedido criado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle className="font-display">Novo pedido</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Cliente (opcional)</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>

        <div className="space-y-2">
          <Label>Itens</Label>
          <div className="space-y-2 max-h-72 overflow-auto">
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_auto] gap-2">
                <Select value={l.product_id} onValueChange={(v) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, product_id: v } : x))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a pizza" /></SelectTrigger>
                  <SelectContent>
                    {(products ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {Number(p.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" min={1} value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))} />
                <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { product_id: "", quantity: 1 }])}>
            <Plus className="size-4 mr-1" /> Adicionar item
          </Button>
        </div>

        <div className="space-y-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-xl font-semibold">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Criando…" : "Criar pedido"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
