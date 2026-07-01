import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, type ApiCollection } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/estoque")({
  component: EstoquePage,
});

type Ingredient = {
  id: string;
  name: string;
  unit: "kg" | "g" | "L" | "ml" | "un";
  current_stock: number;
  minimum_stock: number;
  unit_cost: number;
  supplier: string | null;
};

function statusOf(i: Ingredient) {
  if (i.current_stock <= i.minimum_stock * 0.5) return { label: "Crítico", cls: "bg-destructive text-destructive-foreground" };
  if (i.current_stock <= i.minimum_stock) return { label: "Baixo", cls: "bg-warning text-warning-foreground" };
  return { label: "OK", cls: "bg-success text-success-foreground" };
}

function EstoquePage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("gerente");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const response = await api.get<ApiCollection<Ingredient>>("/ingredients?per_page=200");
      return response.data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (i: Partial<Ingredient> & { id?: string }) => {
      const { id, ...payload } = i;
      if (id) {
        await api.put(`/ingredients/${id}`, payload);
      } else {
        await api.post("/ingredients", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ingrediente salvo");
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ingredients/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const lowCount = (data ?? []).filter((i) => i.current_stock <= i.minimum_stock).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Estoque de Ingredientes</h1>
          <p className="text-muted-foreground">Controle de quantidade, alertas e fornecedor.</p>
          {!canManage && <p className="mt-1 text-sm text-destructive">Seu perfil possui acesso somente para consulta.</p>}
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)} disabled={!canManage} title={!canManage ? "Acesso permitido apenas para administradores e gerentes" : undefined}>
              <Plus className="size-4 mr-2" /> Novo ingrediente
            </Button>
          </DialogTrigger>
          <IngredientDialog
            editing={editing}
            onSubmit={(values) => upsert.mutate(editing ? { id: editing.id, ...values } : values)}
            saving={upsert.isPending}
          />
        </Dialog>
      </div>

      {lowCount > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <AlertTriangle className="size-5 text-warning shrink-0" />
            <p className="text-sm">
              <strong>{lowCount}</strong> {lowCount === 1 ? "ingrediente" : "ingredientes"} abaixo do mínimo. Considere repor o estoque.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="font-display">Todos os ingredientes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Mín.</TableHead>
                <TableHead>Custo/un</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>}
              {!isLoading && (data?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum ingrediente cadastrado.</TableCell></TableRow>
              )}
              {data?.map((i) => {
                const s = statusOf(i);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{Number(i.current_stock).toFixed(2)} {i.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{Number(i.minimum_stock).toFixed(2)}</TableCell>
                    <TableCell>{Number(i.unit_cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell className="text-muted-foreground">{i.supplier ?? "—"}</TableCell>
                    <TableCell><Badge className={s.cls}>{s.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" disabled={!canManage} onClick={() => { setEditing(i); setOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={!canManage} onClick={() => { if (confirm(`Remover ${i.name}?`)) del.mutate(i.id); }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function IngredientDialog({
  editing, onSubmit, saving,
}: { editing: Ingredient | null; onSubmit: (v: any) => void; saving: boolean }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [unit, setUnit] = useState<Ingredient["unit"]>(editing?.unit ?? "kg");
  const [stock, setStock] = useState(String(editing?.current_stock ?? "0"));
  const [min, setMin] = useState(String(editing?.minimum_stock ?? "0"));
  const [cost, setCost] = useState(String(editing?.unit_cost ?? "0"));
  const [supplier, setSupplier] = useState(editing?.supplier ?? "");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display">{editing ? "Editar" : "Novo"} ingrediente</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: name.trim(),
            unit,
            current_stock: Number(stock),
            minimum_stock: Number(min),
            unit_cost: Number(cost),
            supplier: supplier.trim() || null,
          });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="g">g</SelectItem>
                <SelectItem value="L">L</SelectItem>
                <SelectItem value="ml">ml</SelectItem>
                <SelectItem value="un">un</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Custo por unidade (R$)</Label>
            <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Quantidade em estoque</Label>
            <Input type="number" step="0.01" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Estoque mínimo</Label>
            <Input type="number" step="0.01" value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Fornecedor (opcional)</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
