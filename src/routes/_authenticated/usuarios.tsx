import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Check, Loader2, Shield, Trash2, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, type ApiCollection, type CurrentUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/usuarios")({
  ssr: false,
  beforeLoad: async () => {
    let account: CurrentUser;
    try {
      account = await api.get<CurrentUser>("/me");
    } catch {
      throw redirect({ to: "/login" });
    }

    if (account.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: UsersPage,
});

type Role = "admin" | "gerente" | "operador";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

async function fetchUsers(): Promise<ManagedUser[]> {
  const response = await api.get<ApiCollection<ManagedUser>>("/users");
  return response.data;
}

function UsersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState<ManagedUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const stats = useMemo(() => {
    const total = users?.length ?? 0;
    const active = users?.filter((u) => u.active).length ?? 0;
    const inactive = total - active;
    const admins = users?.filter((u) => u.role === "admin" && u.active).length ?? 0;
    return { total, active, inactive, admins };
  }, [users]);

  const updateUser = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Pick<ManagedUser, "role" | "active">> }) => {
      setBusyId(id);
      return api.patch<{ data: ManagedUser }>("/users/" + id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["consumo"] });
      toast.success("Usuário atualizado.");
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Não foi possível atualizar o usuário.";
      toast.error(message);
    },
    onSettled: () => setBusyId(null),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      setBusyId(id);
      await api.delete("/users/" + id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["consumo"] });
      toast.success("Usuário excluído.");
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Não foi possível excluir o usuário.";
      toast.error(message);
    },
    onSettled: () => setBusyId(null),
  });

  const currentUserId = user?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Usuários</h1>
          <p className="text-muted-foreground text-sm">Gerencie permissões e status de acesso dos usuários cadastrados.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total" value={stats.total} icon={<Users className="size-4" />} />
        <MetricCard label="Ativos" value={stats.active} icon={<Check className="size-4" />} />
        <MetricCard label="Inativos" value={stats.inactive} icon={<UserX className="size-4" />} />
        <MetricCard label="Admins ativos" value={stats.admins} icon={<Shield className="size-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Lista de usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : (users?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <AlertCircle className="size-5" />
              Nenhum usuário encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users!.map((item) => {
                  const isSelf = currentUserId === item.id;
                  const busy = busyId === item.id;
                  return (
                    <TableRow key={item.id} className={!item.active ? "opacity-60" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.role === "admin" && <Badge variant="secondary" className="bg-primary/10 text-primary">Admin</Badge>}
                          {isSelf && <Badge variant="outline">Você</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell className="w-56">
                        <Select
                          value={item.role}
                          onValueChange={(value) => updateUser.mutate({ id: item.id, payload: { role: value as Role } })}
                          disabled={busy || isSelf}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operador">Operador</SelectItem>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.active ? "secondary" : "destructive"} className={item.active ? "bg-success text-success-foreground" : ""}>
                          {item.active ? "Ativo" : "Desativado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={item.active ? "outline" : "secondary"}
                            disabled={busy || isSelf}
                            onClick={() => updateUser.mutate({ id: item.id, payload: { active: !item.active } })}
                            title={isSelf ? "Você não pode alterar seu próprio acesso" : undefined}
                          >
                            {busy ? <Loader2 className="size-4 animate-spin" /> : item.active ? <UserX className="size-4" /> : <Check className="size-4" />}
                            <span className="ml-2">{item.active ? "Desativar" : "Ativar"}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={busy || isSelf}
                            onClick={() => setConfirmDelete(item)}
                            title={isSelf ? "Você não pode excluir seu próprio usuário" : undefined}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o usuário do cadastro do sistema. O acesso ao app deixará de funcionar para este usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteUser.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-2xl mt-1">{value}</p>
          </div>
          <div className="size-10 rounded-lg grid place-items-center bg-primary/10 text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
