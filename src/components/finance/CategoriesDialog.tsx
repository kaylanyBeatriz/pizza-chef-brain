import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCategories, type Category } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CategoriesDialog() {
  const qc = useQueryClient();
  const { data, isLoading } = useCategories();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const items = data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  const create = useMutation({
    mutationFn: () => api.post("/finance/categories", { type: "expense", name: newName.trim() }),
    onSuccess: () => { refresh(); setNewName(""); toast.success("Categoria criada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: (c: Category) => api.put(`/finance/categories/${c.id}`, { name: editName.trim() }),
    onSuccess: () => { refresh(); setEditingId(null); toast.success("Categoria renomeada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (c: Category) => api.delete(`/finance/categories/${c.id}`),
    onSuccess: () => { refresh(); toast.success("Categoria excluída"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display">Categorias</DialogTitle>
        <DialogDescription>
          Crie, renomeie ou exclua. Renomear atualiza também os lançamentos já feitos.
        </DialogDescription>
      </DialogHeader>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) create.mutate(); }}>
        <Input placeholder="Nova categoria" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" disabled={create.isPending || !newName.trim()}>
          <Plus className="size-4 mr-1" /> Criar
        </Button>
      </form>

      <ul className="divide-y rounded-md border">
        {isLoading && <li className="p-3 text-sm text-muted-foreground">Carregando…</li>}
        {!isLoading && items.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhuma categoria.</li>}
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-2 p-2 pl-3">
            {editingId === c.id ? (
              <>
                <Input
                  autoFocus value={editName} maxLength={80} className="h-8"
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editName.trim()) rename.mutate(c);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Button size="icon" variant="ghost" title="Salvar" disabled={rename.isPending || !editName.trim()} onClick={() => rename.mutate(c)}>
                  <Check className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Cancelar" onClick={() => setEditingId(null)}>
                  <X className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">
                  {c.name}
                  {c.usage > 0 && <span className="ml-2 text-xs text-muted-foreground">{c.usage} lançamento(s)</span>}
                </span>
                <Button size="icon" variant="ghost" title="Renomear" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon" variant="ghost" title={c.usage > 0 ? "Em uso: não pode excluir" : "Excluir"}
                  disabled={c.usage > 0 || remove.isPending}
                  onClick={() => { if (confirm(`Excluir a categoria "${c.name}"?`)) remove.mutate(c); }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </DialogContent>
  );
}
