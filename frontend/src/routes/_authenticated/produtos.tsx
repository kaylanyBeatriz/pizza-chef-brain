import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: ProdutosPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  is_active: boolean;
};

type Recipe = { id: string; ingredient_id: string; quantity: number; ingredient?: { name: string; unit: string } };

function ProdutosPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("gerente");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [recipeFor, setRecipeFor] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: Partial<Product> & { id?: string }) => {
      if (p.id) {
        const { error } = await supabase.from("products").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(p as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Pizza salva");
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-2xl md:text-3xl">Pizzas & Receitas</h1>
          <p className="text-sm md:text-base text-muted-foreground">Cadastre o cardápio e a receita de cada pizza para a baixa automática.</p>
          {!canManage && <p className="mt-1 text-sm text-destructive">Seu perfil possui acesso somente para consulta.</p>}
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)} disabled={!canManage} title={!canManage ? "Acesso permitido apenas para administradores e gerentes" : undefined} className="w-full sm:w-auto">
              <Plus className="size-4 mr-2" /> Nova pizza
            </Button>
          </DialogTrigger>
          <ProductDialog
            editing={editing}
            onSubmit={(v) => upsert.mutate(editing ? { id: editing.id, ...v } : v)}
            saving={upsert.isPending}
          />
        </Dialog>
      </div>

      {/* Cards (mobile) */}
      <div className="grid gap-3 md:hidden">
        {isLoading && <p className="text-center text-muted-foreground py-8">Carregando…</p>}
        {!isLoading && (products?.length ?? 0) === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma pizza cadastrada.</p>
        )}
        {products?.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{p.category}</p>
                </div>
                <Badge className={p.is_active ? "bg-success text-success-foreground shrink-0" : "bg-muted text-muted-foreground shrink-0"}>
                  {p.is_active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-lg">{Number(p.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={!canManage} onClick={() => setRecipeFor(p)}>
                    <ChefHat className="size-4 mr-1" /> Receita
                  </Button>
                  <Button size="icon" variant="ghost" disabled={!canManage} onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={!canManage} onClick={() => { if (confirm(`Remover ${p.name}?`)) del.mutate(p.id); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela (desktop) */}
      <Card className="hidden md:block">
        <CardHeader><CardTitle className="font-display">Cardápio</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pizza</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>}
                {!isLoading && (products?.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma pizza cadastrada.</TableCell></TableRow>
                )}
                {products?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.category}</TableCell>
                    <TableCell>{Number(p.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>
                      <Badge className={p.is_active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                        {p.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" disabled={!canManage} onClick={() => setRecipeFor(p)}>
                        <ChefHat className="size-4 mr-1" /> Receita
                      </Button>
                      <Button size="icon" variant="ghost" disabled={!canManage} onClick={() => { setEditing(p); setOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={!canManage} onClick={() => { if (confirm(`Remover ${p.name}?`)) del.mutate(p.id); }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {recipeFor && <RecipeDialog product={recipeFor} onClose={() => setRecipeFor(null)} />}
    </div>
  );
}

function ProductDialog({ editing, onSubmit, saving }: { editing: Product | null; onSubmit: (v: any) => void; saving: boolean }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState(editing?.category ?? "Pizza");
  const [price, setPrice] = useState(String(editing?.price ?? "0"));
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Nova"} pizza</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), description: description.trim() || null, category, price: Number(price), is_active: isActive });
        }}
        className="space-y-4"
      >
        <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Descrição</Label><Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div className="space-y-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
        </div>
        <div className="flex items-center gap-2">
          <input id="active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4" />
          <Label htmlFor="active" className="font-normal cursor-pointer">Ativa no cardápio</Label>
        </div>
        <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function RecipeDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("gerente");
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");

  const { data: ingredients } = useQuery({
    queryKey: ["ingredients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("ingredients").select("id,name,unit").order("name");
      return data ?? [];
    },
  });

  const { data: recipe } = useQuery({
    queryKey: ["recipe", product.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_ingredients")
        .select("id, ingredient_id, quantity, ingredient:ingredients(name, unit)")
        .eq("product_id", product.id);
      return (data ?? []) as unknown as Recipe[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_ingredients").insert({
        product_id: product.id, ingredient_id: ingredientId, quantity: Number(qty),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipe", product.id] }); setIngredientId(""); setQty(""); toast.success("Ingrediente adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_ingredients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipe", product.id] }); },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Receita — {product.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">Quanto de cada ingrediente é consumido por unidade vendida.</p>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-auto">
          {(recipe?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum ingrediente na receita.</p>}
          {recipe?.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50">
              <div>
                <p className="text-sm font-medium">{r.ingredient?.name}</p>
                <p className="text-xs text-muted-foreground">{Number(r.quantity)} {r.ingredient?.unit}</p>
              </div>
              <Button size="icon" variant="ghost" disabled={!canManage} onClick={() => remove.mutate(r.id)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Adicionar ingrediente</p>
          <div className="grid grid-cols-[1fr_120px_auto] gap-2">
            <Select value={ingredientId} onValueChange={setIngredientId}>
              <SelectTrigger><SelectValue placeholder="Ingrediente" /></SelectTrigger>
              <SelectContent>
                {(ingredients ?? []).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" step="0.001" placeholder="Qtd." value={qty} onChange={(e) => setQty(e.target.value)} />
            <Button onClick={() => add.mutate()} disabled={!canManage || !ingredientId || !qty}>Adicionar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
