import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { api, type CurrentUser } from "@/lib/api";

export type AppRole = "admin" | "gerente" | "operador";

interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const rolesUserId = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // Só busca o perfil quando o usuário muda (não a cada refresh de token / foco da aba).
        if (rolesUserId.current !== s.user.id) {
          rolesUserId.current = s.user.id;
          // Defer DB call to avoid deadlocks
          setTimeout(() => loadRoles(), 0);
        }
      } else {
        rolesUserId.current = null;
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user && rolesUserId.current !== data.session.user.id) {
        rolesUserId.current = data.session.user.id;
        loadRoles();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadRoles() {
    try {
      const account = await api.get<CurrentUser>("/me");
      setRoles([account.role as AppRole]);
    } catch {
      setRoles([]);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        loading,
        signOut: async () => { await supabase.auth.signOut(); },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
