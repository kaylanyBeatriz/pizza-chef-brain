import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, Trash2, Check, X, Clock, ChefHat, AlertCircle, ArrowLeft, Eye, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
});

type OrderStatus = "pendente" | "preparando" | "concluido" | "cancelado";
type OrderItem = { id: string; quantity: number; unit_price: number; product: { name: string } | null };
type Order = {
  id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string | null;
  total: number;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  stock_deducted: boolean;
  order_items: OrderItem[];
};

const BRL = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const time = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

const statusStyle: Record<OrderStatus, string> = {
  pendente: "bg-warning text-warning-foreground",
  preparando: "bg-secondary text-secondary-foreground",
  concluido: "bg-success text-success-foreground",
  cancelado: "bg-muted text-muted-foreground",
};
const statusLabel: Record<OrderStatus, string> = {
  pendente: "Pendente", preparando: "Preparando", concluido: "Concluído", cancelado: "Cancelado",
};

const LATE_PENDING_MIN = 10;
const LATE_PREPARING_MIN = 25;

function minutesBetween(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}
function minutesSince(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}
const isToday = (iso: string) => {
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

function PedidosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<Order | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, quantity, unit_price, product:products(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      setPendingId(id);
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSettled: () => setPendingId(null),
    onSuccess: (status) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      const msg: Record<OrderStatus, string> = {
        pendente: "Pedido voltou para pendente",
        preparando: "Preparo iniciado",
        concluido: "Pedido concluído — estoque baixado",
        cancelado: "Pedido cancelado",
      };
      toast.success(msg[status]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const todayOrders = useMemo(() => (orders ?? []).filter((o) => isToday(o.created_at)), [orders]);
  const grouped = useMemo(() => {
    const g: Record<OrderStatus, Order[]> = { pendente: [], preparando: [], concluido: [], cancelado: [] };
    (orders ?? []).forEach((o) => {
      if (o.status === "concluido" && !isToday(o.created_at)) return;
      g[o.status].push(o);
    });
    return g;
  }, [orders]);

  const summary = useMemo(() => {
    const concluidosHoje = todayOrders.filter((o) => o.status === "concluido");
    const emAndamento = (orders ?? []).filter((o) => o.status === "pendente" || o.status === "preparando");
    const faturamento = concluidosHoje.reduce((s, o) => s + Number(o.total), 0);
    return {
      total: todayOrders.length,
      emAndamento: emAndamento.length,
      concluidos: concluidosHoje.length,
      faturamento,
    };
  }, [orders, todayOrders]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Pedidos</h1>
          <p className="text-muted-foreground text-sm">Acompanhe os pedidos do dia em tempo real.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" /> Novo pedido</Button>
          </DialogTrigger>
          <NewOrderDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <OrderSummary {...summary} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <OrderColumn
          title="Pendentes"
          icon={<Clock className="size-4" />}
          empty="Nenhum pedido pendente no momento."
          orders={grouped.pendente}
        >
          {(o) => (
            <OrderCard order={o} pending={pendingId === o.id}
              onDetails={() => setDetail(o)}
              actions={
                <StatusActionButtons
                  order={o}
                  pending={pendingId === o.id}
                  onAdvance={() => updateStatus.mutate({ id: o.id, status: "preparando" })}
                  onCancel={() => updateStatus.mutate({ id: o.id, status: "cancelado" })}
                />
              }
            />
          )}
        </OrderColumn>

        <OrderColumn
          title="Preparando"
          icon={<ChefHat className="size-4" />}
          empty="Nenhum pedido em preparo."
          orders={grouped.preparando}
        >
          {(o) => (
            <OrderCard order={o} pending={pendingId === o.id}
              onDetails={() => setDetail(o)}
              actions={
                <StatusActionButtons
                  order={o}
                  pending={pendingId === o.id}
                  onAdvance={() => setConfirmComplete(o)}
                  onBack={() => updateStatus.mutate({ id: o.id, status: "pendente" })}
                  onCancel={() => updateStatus.mutate({ id: o.id, status: "cancelado" })}
                />
              }
            />
          )}
        </OrderColumn>

        <OrderColumn
          title="Concluídos hoje"
          icon={<Check className="size-4" />}
          empty="Nenhum pedido concluído hoje."
          orders={grouped.concluido}
        >
          {(o) => (
            <OrderCard order={o} pending={false}
              onDetails={() => setDetail(o)}
              actions={
                <Button size="sm" variant="outline" className="w-full" onClick={() => setDetail(o)}>
                  <Eye className="size-4 mr-1" /> Ver detalhes
                </Button>
              }
            />
          )}
        </OrderColumn>
      </div>

      {isLoading && <p className="text-center text-muted-foreground">Carregando…</p>}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        {detail && <OrderDetailsDialog order={detail} />}
      </Dialog>

      <AlertDialog open={!!confirmComplete} onOpenChange={(v) => !v && setConfirmComplete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja concluir este pedido? Após a conclusão, o estoque dos ingredientes será atualizado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmComplete) updateStatus.mutate({ id: confirmComplete.id, status: "concluido" });
                setConfirmComplete(null);
              }}
            >
              Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------- Components ---------------- */

function OrderSummary({ total, emAndamento, concluidos, faturamento }: { total: number; emAndamento: number; concluidos: number; faturamento: number }) {
  const items = [
    { label: "Pedidos hoje", value: total, icon: <Receipt className="size-4" /> },
    { label: "Em andamento", value: emAndamento, icon: <ChefHat className="size-4" /> },
    { label: "Concluídos", value: concluidos, icon: <Check className="size-4" /> },
    { label: "Faturamento hoje", value: BRL(faturamento), icon: <Receipt className="size-4" /> },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">{it.icon}{it.label}</div>
            <div className="font-display text-2xl mt-1">{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrderColumn({
  title, icon, orders, empty, children,
}: {
  title: string; icon: React.ReactNode; orders: Order[]; empty: string;
  children: (o: Order) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          {icon} {title}
          <Badge variant="secondary" className="ml-auto">{orders.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[65vh] overflow-auto">
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>
        ) : (
          orders.map((o) => <div key={o.id}>{children(o)}</div>)
        )}
      </CardContent>
    </Card>
  );
}

function OrderCard({ order, pending, actions, onDetails }: { order: Order; pending: boolean; actions: React.ReactNode; onDetails: () => void }) {
  const late =
    (order.status === "pendente" && (minutesSince(order.created_at) ?? 0) >= LATE_PENDING_MIN) ||
    (order.status === "preparando" && (minutesSince(order.started_at) ?? 0) >= LATE_PREPARING_MIN);

  const prepMin = order.status === "preparando"
    ? minutesSince(order.started_at)
    : minutesBetween(order.started_at, order.completed_at);
  const totalMin = order.status === "concluido"
    ? minutesBetween(order.created_at, order.completed_at)
    : minutesSince(order.created_at);

  return (
    <div className={`rounded-lg border bg-card p-3 space-y-2 ${late ? "border-destructive/60 ring-1 ring-destructive/30" : ""} ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onDetails} className="font-medium hover:underline">#{order.order_number}</button>
        <div className="flex items-center gap-1">
          {late && <Badge variant="destructive" className="gap-1"><AlertCircle className="size-3" />Atrasado</Badge>}
          <Badge className={statusStyle[order.status]}>{statusLabel[order.status]}</Badge>
        </div>
      </div>

      {order.customer_name && <p className="text-xs text-muted-foreground">Cliente: {order.customer_name}</p>}

      <ul className="text-sm space-y-0.5">
        {order.order_items.map((it) => (
          <li key={it.id} className="flex justify-between gap-2">
            <span className="truncate">{it.quantity}× {it.product?.name ?? "—"}</span>
            <span className="text-muted-foreground shrink-0">{BRL(it.quantity * Number(it.unit_price))}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground pt-2 border-t">
        <span>Criado às {time(order.created_at)}</span>
        {order.started_at && <span>Preparo às {time(order.started_at)}</span>}
        {order.completed_at && <span>Concluído às {time(order.completed_at)}</span>}
        {prepMin != null && order.status !== "pendente" && <span>Preparo: {prepMin} min</span>}
        {totalMin != null && <span>Tempo total: {totalMin} min</span>}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="font-display font-semibold">{BRL(order.total)}</span>
      </div>

      <div className="pt-1">{actions}</div>
    </div>
  );
}

function StatusActionButtons({
  order, pending, onAdvance, onBack, onCancel,
}: {
  order: Order; pending: boolean;
  onAdvance?: () => void; onBack?: () => void; onCancel?: () => void;
}) {
  const advanceLabel = order.status === "pendente" ? "Iniciar preparo" : "Concluir pedido";
  const disabled = pending || (order.status === "concluido");
  return (
    <div className="flex gap-2">
      {onAdvance && (
        <Button size="sm" className="flex-1" disabled={disabled} onClick={onAdvance}>
          {pending ? "Aguarde…" : advanceLabel}
        </Button>
      )}
      {onBack && (
        <Button size="sm" variant="outline" disabled={pending} onClick={onBack} title="Voltar para pendente">
          <ArrowLeft className="size-4" />
        </Button>
      )}
      {onCancel && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel} title="Cancelar">
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

function OrderDetailsDialog({ order }: { order: Order }) {
  const prepMin = minutesBetween(order.started_at, order.completed_at) ?? (order.status === "preparando" ? minutesSince(order.started_at) : null);
  const totalMin = order.status === "concluido"
    ? minutesBetween(order.created_at, order.completed_at)
    : minutesSince(order.created_at);
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display">Pedido #{order.order_number}</DialogTitle>
        <DialogDescription>{order.customer_name ? `Cliente: ${order.customer_name}` : "Sem cliente informado"}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Itens</p>
          <ul className="text-sm space-y-1">
            {order.order_items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>{it.quantity}× {it.product?.name ?? "—"} <span className="text-muted-foreground">({BRL(Number(it.unit_price))} cada)</span></span>
                <span className="font-medium">{BRL(it.quantity * Number(it.unit_price))}</span>
              </li>
            ))}
          </ul>
        </div>
        {order.notes && (
          <div>
            <p className="text-xs text-muted-foreground">Observações</p>
            <p className="text-sm">{order.notes}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm bg-muted rounded-lg p-3">
          <div><p className="text-xs text-muted-foreground">Criado às</p>{time(order.created_at)}</div>
          <div><p className="text-xs text-muted-foreground">Preparo às</p>{time(order.started_at)}</div>
          <div><p className="text-xs text-muted-foreground">Concluído às</p>{time(order.completed_at)}</div>
          <div><p className="text-xs text-muted-foreground">Cancelado às</p>{time(order.cancelled_at)}</div>
          <div><p className="text-xs text-muted-foreground">Tempo de preparo</p>{prepMin != null ? `${prepMin} min` : "—"}</div>
          <div><p className="text-xs text-muted-foreground">Tempo total</p>{totalMin != null ? `${totalMin} min` : "—"}</div>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <Badge className={statusStyle[order.status]}>{statusLabel[order.status]}</Badge>
          <span className="font-display text-xl font-semibold">{BRL(order.total)}</span>
        </div>
      </div>
    </DialogContent>
  );
}

/* ---------------- New order ---------------- */

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
      return (data ?? []) as { id: string; name: string; price: number }[];
    },
  });

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const validLines = lines.filter((l) => {
    const p = productMap.get(l.product_id);
    return p && Number(p.price) > 0 && l.quantity > 0;
  });
  const total = validLines.reduce((s, l) => s + Number(productMap.get(l.product_id)!.price) * l.quantity, 0);

  const validation = (() => {
    if (!lines.some((l) => l.product_id)) return "Selecione uma pizza para continuar.";
    if (lines.some((l) => l.product_id && l.quantity < 1)) return "A quantidade deve ser maior que zero.";
    if (lines.some((l) => {
      const p = productMap.get(l.product_id);
      return l.product_id && (!p || Number(p.price) <= 0);
    })) return "Essa pizza não possui preço cadastrado.";
    if (validLines.length === 0) return "Adicione pelo menos um item ao pedido.";
    return null;
  })();

  const create = useMutation({
    mutationFn: async () => {
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

      const items = validLines.map((l) => {
        const p = productMap.get(l.product_id)!;
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
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="font-display">Novo pedido</DialogTitle>
        <DialogDescription>Monte o pedido selecionando as pizzas e suas quantidades.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Cliente (opcional)</Label>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente" />
        </div>

        <div className="space-y-2">
          <Label>Itens</Label>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {lines.map((l, idx) => (
              <OrderItemRow
                key={idx}
                line={l}
                products={products ?? []}
                canRemove={lines.length > 1}
                onChange={(next) => setLines((ls) => ls.map((x, i) => (i === idx ? next : x)))}
                onRemove={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
              />
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { product_id: "", quantity: 1 }])}>
            <Plus className="size-4 mr-1" /> Adicionar item
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex: sem cebola, ponto da massa, entrega..." />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
          <span className="text-sm text-muted-foreground">Total do pedido</span>
          <span className="font-display text-2xl font-semibold">{BRL(total)}</span>
        </div>

        {validation && (
          <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="size-4" /> {validation}</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={create.isPending}>Cancelar</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending || !!validation}>
          {create.isPending ? "Criando…" : "Criar pedido"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function OrderItemRow({
  line, products, canRemove, onChange, onRemove,
}: {
  line: Line;
  products: { id: string; name: string; price: number }[];
  canRemove: boolean;
  onChange: (next: Line) => void;
  onRemove: () => void;
}) {
  const product = products.find((p) => p.id === line.product_id);
  const unit = product ? Number(product.price) : 0;
  const subtotal = unit * (line.quantity || 0);
  const noPrice = !!product && unit <= 0;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="grid grid-cols-[1fr_90px_auto] gap-2 items-start">
        <Select value={line.product_id} onValueChange={(v) => onChange({ ...line, product_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione a pizza" /></SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {BRL(Number(p.price))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          value={line.quantity}
          onChange={(e) => onChange({ ...line, quantity: Math.max(1, Number(e.target.value) || 1) })}
        />
        <Button size="icon" variant="ghost" onClick={onRemove} disabled={!canRemove} title="Remover item">
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {product ? <>Preço unitário: <span className="font-medium text-foreground">{BRL(unit)}</span></> : "Nenhuma pizza selecionada"}
        </span>
        <span>
          Subtotal: <span className="font-display font-semibold text-foreground">{BRL(subtotal)}</span>
        </span>
      </div>
      {noPrice && <p className="text-xs text-destructive">Essa pizza não possui preço cadastrado.</p>}
    </div>
  );
}
