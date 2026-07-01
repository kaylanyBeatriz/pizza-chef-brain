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

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
});

type OrderStatus = "pending" | "preparing" | "completed" | "cancelled";
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
  pending: "bg-warning text-warning-foreground",
  preparing: "bg-secondary text-secondary-foreground",
  completed: "bg-success text-success-foreground",
  cancelled: "bg-muted text-muted-foreground",
};
const statusLabel: Record<OrderStatus, string> = {
  pending: "Pendente", preparing: "Preparando", completed: "Concluído", cancelled: "Cancelado",
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
        .select("*, order_items(id, quantity, unit_price, product:pizzas(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((order) => ({
        ...order,
        id: String(order.id),
        order_number: Number(order.id),
        total: Number(order.total_amount),
        started_at: order.status === "preparing" ? order.updated_at : null,
        order_items: (order.order_items ?? []).map((item) => ({
          ...item,
          id: String(item.id),
        })),
      })) as unknown as Order[];
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
        pending: "Pedido voltou para pendente",
        preparing: "Preparo iniciado",
        completed: "Pedido concluído — estoque baixado",
        cancelled: "Pedido cancelado",
      };
      toast.success(msg[status]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const todayOrders = useMemo(() => (orders ?? []).filter((o) => isToday(o.created_at)), [orders]);
  const grouped = useMemo(() => {
    const g: Record<OrderStatus, Order[]> = { pending: [], preparing: [], completed: [], cancelled: [] };
    (orders ?? []).forEach((o) => {
      if (o.status === "completed" && !isToday(o.created_at)) return;
      g[o.status].push(o);
    });
    return g;
  }, [orders]);

  const summary = useMemo(() => {
    const concluidosHoje = todayOrders.filter((o) => o.status === "completed");
    const emAndamento = (orders ?? []).filter((o) => o.status === "pending" || o.status === "preparing");
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
          orders={grouped.pending}
        >
          {(o) => (
            <OrderCard order={o} pending={pendingId === o.id}
              onDetails={() => setDetail(o)}
              actions={
                <StatusActionButtons
                  order={o}
                  pending={pendingId === o.id}
                  onAdvance={() => updateStatus.mutate({ id: o.id, status: "preparing" })}
                  onCancel={() => updateStatus.mutate({ id: o.id, status: "cancelled" })}
                />
              }
            />
          )}
        </OrderColumn>

        <OrderColumn
          title="Preparando"
          icon={<ChefHat className="size-4" />}
          empty="Nenhum pedido em preparo."
          orders={grouped.preparing}
        >
          {(o) => (
            <OrderCard order={o} pending={pendingId === o.id}
              onDetails={() => setDetail(o)}
              actions={
                <StatusActionButtons
                  order={o}
                  pending={pendingId === o.id}
                  onAdvance={() => setConfirmComplete(o)}
                  onBack={() => updateStatus.mutate({ id: o.id, status: "pending" })}
                  onCancel={() => updateStatus.mutate({ id: o.id, status: "cancelled" })}
                />
              }
            />
          )}
        </OrderColumn>

        <OrderColumn
          title="Concluídos hoje"
          icon={<Check className="size-4" />}
          empty="Nenhum pedido concluído hoje."
          orders={grouped.completed}
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
                if (confirmComplete) updateStatus.mutate({ id: confirmComplete.id, status: "completed" });
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
    (order.status === "pending" && (minutesSince(order.created_at) ?? 0) >= LATE_PENDING_MIN) ||
    (order.status === "preparing" && (minutesSince(order.started_at) ?? 0) >= LATE_PREPARING_MIN);

  const prepMin = order.status === "preparing"
    ? minutesSince(order.started_at)
    : minutesBetween(order.started_at, order.completed_at);
  const totalMin = order.status === "completed"
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
        {prepMin != null && order.status !== "pending" && <span>Preparo: {prepMin} min</span>}
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
  const advanceLabel = order.status === "pending" ? "Iniciar preparo" : "Concluir pedido";
  const disabled = pending || (order.status === "completed");
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
  const prepMin = minutesBetween(order.started_at, order.completed_at) ?? (order.status === "preparing" ? minutesSince(order.started_at) : null);
  const totalMin = order.status === "completed"
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

type Line = { pizza_id: string; quantity: number };
type OrderType = "pickup" | "delivery" | "dine_in";

const orderTypeLabel: Record<OrderType, string> = {
  pickup: "Retirada",
  delivery: "Entrega",
  dine_in: "Consumo no local",
};

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function parseMoney(v: string): number {
  if (!v) return 0;
  const cleaned = v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function MoneyInput({
  value, onChange, disabled, invalid, id,
}: { value: number; onChange: (n: number) => void; disabled?: boolean; invalid?: boolean; id?: string }) {
  const [text, setText] = useState(value ? value.toFixed(2).replace(".", ",") : "");
  return (
    <div className={`relative ${disabled ? "opacity-60" : ""}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        placeholder="0,00"
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMoney(e.target.value));
        }}
        onBlur={() => {
          const n = parseMoney(text);
          setText(n ? n.toFixed(2).replace(".", ",") : "");
          onChange(n);
        }}
        className={`pl-9 text-right ${invalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
      />
    </div>
  );
}

function FormErrorMessage({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="size-3" /> {children}
    </p>
  );
}

function NewOrderDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ pizza_id: "", quantity: 1 }]);
  const [touched, setTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("pizzas").select("id,name,price").eq("is_active", true).order("name");
      return (data ?? []) as { id: string; name: string; price: number }[];
    },
  });

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const validLines = lines.filter((l) => {
    const p = productMap.get(l.pizza_id);
    return p && Number(p.price) > 0 && l.quantity > 0;
  });
  const subtotalAmount = validLines.reduce((s, l) => s + Number(productMap.get(l.pizza_id)!.price) * l.quantity, 0);
  const effectiveDeliveryFee = orderType === "delivery" ? Math.max(0, Number(deliveryFee) || 0) : 0;
  const totalAmount = subtotalAmount + effectiveDeliveryFee;

  const errors = useMemo(() => {
    const e: { items?: string; address?: string; fee?: string } = {};
    if (!lines.some((l) => l.pizza_id)) e.items = "Adicione pelo menos uma pizza ao pedido.";
    else if (validLines.length === 0) e.items = "Selecione uma pizza válida e quantidade maior que zero.";
    if (orderType === "delivery" && !deliveryAddress.trim()) e.address = "Informe o endereço de entrega.";
    if (orderType === "delivery" && deliveryFee < 0) e.fee = "A taxa de entrega não pode ser negativa.";
    return e;
  }, [lines, validLines.length, orderType, deliveryAddress, deliveryFee]);

  const hasErrors = Object.keys(errors).length > 0;
  const isDirty =
    customerName.trim() !== "" || customerPhone.trim() !== "" || deliveryAddress.trim() !== "" ||
    notes.trim() !== "" || deliveryFee > 0 || lines.some((l) => l.pizza_id);

  const handleClose = () => {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  const create = useMutation({
    mutationFn: async () => {
      const metaLines = [
        `Tipo: ${orderTypeLabel[orderType]} (${orderType})`,
        customerPhone.trim() && `Telefone: ${customerPhone.trim()}`,
        orderType === "delivery" && deliveryAddress.trim() && `Endereço: ${deliveryAddress.trim()}`,
        orderType === "delivery" && `Taxa de entrega: ${BRL(effectiveDeliveryFee)}`,
        `Subtotal: ${BRL(subtotalAmount)}`,
      ].filter(Boolean).join("\n");
      const fullNotes = [metaLines, notes.trim()].filter(Boolean).join("\n\n");

      const { data: order, error: e1 } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName.trim() || null,
          notes: fullNotes || null,
          total_amount: totalAmount,
          status: "pending" as const,
        })
        .select()
        .single();
      if (e1) throw e1;

      const items = validLines.map((l) => {
        const p = productMap.get(l.pizza_id)!;
        return {
          order_id: order.id,
          pizza_id: l.pizza_id,
          pizza_name: p.name,
          quantity: l.quantity,
          unit_price: Number(p.price),
          total_price: Number(p.price) * l.quantity,
        };
      });
      const { error: e2 } = await supabase.from("order_items").insert(items);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pedido criado com sucesso");
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível criar o pedido."),
  });

  const handleSubmit = () => {
    setTouched(true);
    if (hasErrors) {
      toast.error("Revise os campos destacados antes de continuar.");
      return;
    }
    create.mutate();
  };

  return (
    <>
      <DialogContent
        className="max-w-xl p-0 gap-0 flex flex-col max-h-[90vh] sm:max-h-[85vh]"
        onInteractOutside={(e) => { if (isDirty) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isDirty) { e.preventDefault(); setConfirmDiscard(true); } }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="font-display text-xl">Novo pedido</DialogTitle>
          <DialogDescription>Monte o pedido com cliente, tipo de atendimento e itens.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="customer">Cliente</Label>
              <Input id="customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo do pedido</Label>
            <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup">Retirada</SelectItem>
                <SelectItem value="delivery">Entrega</SelectItem>
                <SelectItem value="dine_in">Consumo no local</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orderType === "delivery" && (
            <div className="space-y-2">
              <Label htmlFor="address">Endereço de entrega</Label>
              <Textarea
                id="address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={2}
                placeholder="Rua, número, bairro, complemento..."
                className={touched && errors.address ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched && <FormErrorMessage>{errors.address}</FormErrorMessage>}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens</Label>
              <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { pizza_id: "", quantity: 1 }])}>
                <Plus className="size-4 mr-1" /> Adicionar item
              </Button>
            </div>
            <div className="space-y-2">
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
            {touched && <FormErrorMessage>{errors.items}</FormErrorMessage>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: sem cebola, ponto da massa, entrega sem contato..."
            />
          </div>

          <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal dos itens</span>
              <span className="font-medium">{BRL(subtotalAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-3">
              <Label htmlFor="fee" className="text-muted-foreground font-normal">Taxa de entrega</Label>
              {orderType === "delivery" ? (
                <div className="w-36">
                  <MoneyInput
                    id="fee"
                    value={deliveryFee}
                    onChange={setDeliveryFee}
                    invalid={touched && !!errors.fee}
                  />
                </div>
              ) : (
                <span className="font-medium">{BRL(0)}</span>
              )}
            </div>
            {touched && <FormErrorMessage>{errors.fee}</FormErrorMessage>}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">Total do pedido</span>
              <span className="font-display text-2xl font-bold text-primary">{BRL(totalAmount)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background sm:justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={create.isPending}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending || (touched && hasErrors)}
            className="min-w-32"
          >
            {create.isPending ? "Criando…" : "Criar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              As informações preenchidas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmDiscard(false); onClose(); }}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const product = products.find((p) => p.id === line.pizza_id);
  const unit = product ? Number(product.price) : 0;
  const subtotal = unit * (line.quantity || 0);
  const noPrice = !!product && unit <= 0;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px_auto] gap-2 items-start">
        <Select value={line.pizza_id} onValueChange={(v) => onChange({ ...line, pizza_id: v })}>
          <SelectTrigger className={noPrice ? "border-destructive" : ""}>
            <SelectValue placeholder="Selecione a pizza" />
          </SelectTrigger>
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
          aria-label="Quantidade"
        />
        <Button size="icon" variant="ghost" onClick={onRemove} disabled={!canRemove} title="Remover item">
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
        <span>
          {product ? <>Preço unitário: <span className="font-medium text-foreground">{BRL(unit)}</span></> : "Nenhuma pizza selecionada"}
        </span>
        <span>
          Subtotal: <span className="font-display font-semibold text-foreground">{BRL(subtotal)}</span>
        </span>
      </div>
      {noPrice && <FormErrorMessage>Essa pizza não possui preço cadastrado.</FormErrorMessage>}
      {product && line.quantity < 1 && <FormErrorMessage>A quantidade deve ser maior que zero.</FormErrorMessage>}
    </div>
  );
}
