import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { api, type CurrentUser } from "@/lib/api";

// Validação completa (rede) feita uma vez por sessão; nas trocas de aba usamos só a sessão local.
let validatedToken: string | null = null;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      validatedToken = null;
      throw redirect({ to: "/login" });
    }

    if (validatedToken === session.access_token) return;

    try {
      await api.get<CurrentUser>("/me");
      validatedToken = session.access_token;
    } catch {
      validatedToken = null;
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
