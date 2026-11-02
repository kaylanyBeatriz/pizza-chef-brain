import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarClock,
  FileBarChart,
  Users,
  LogOut,
  Menu,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/big-pizza-logo.png";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Despesas" },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight, group: "Despesas" },
  { to: "/contas", label: "Contas a pagar", icon: CalendarClock, group: "Despesas" },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart, group: "Despesas" },
  { to: "/usuarios", label: "Usuários", icon: Users, group: "Administração" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roles, signOut } = useAuth();
  const canAccessUsers = roles.includes("admin");
  const canAccessFinance = roles.includes("admin") || roles.includes("gerente");
  const visibleNav = nav.filter((item) => {
    if (item.to === "/usuarios") return canAccessUsers;
    return canAccessFinance;
  });
  const groups = Array.from(new Set(visibleNav.map((i) => i.group)));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const current = nav.find((n) => location.pathname.startsWith(n.to));
  const pageTitle = current?.label ?? "Dashboard";
  const email = user?.email ?? "";
  const initials = (email.split("@")[0] || "BP").slice(0, 2).toUpperCase();
  const roleLabel = roles.includes("admin") ? "Administrador" : roles.includes("gerente") ? "Gerente" : "Operador";

  // Fecha o drawer mobile ao trocar de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex bg-muted/40">
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "bg-primary text-primary-foreground flex flex-col transition-transform duration-300",
          "fixed inset-y-0 left-0 z-40 w-64 md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "md:shrink-0 md:transition-[width]",
          collapsed ? "md:w-0 md:overflow-hidden" : "md:w-64",
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <img src={logo} alt="Big Pizza" className="size-11 rounded-full object-cover ring-2 ring-gold/70" />
          <div className="leading-tight">
            <p className="font-display text-base font-semibold">Big Pizza</p>
            <p className="text-xs text-primary-foreground/70">Contas e despesas</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group} className="space-y-1">
              <p className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground/55">
                {group}
              </p>
              {visibleNav.filter((i) => i.group === group).map((item) => {
                const active = location.pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="intent"
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/15 text-white"
                        : "text-primary-foreground/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gold" aria-hidden />}
                    <Icon className={cn("size-[1.1rem] shrink-0", active ? "text-gold" : "")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="size-9 shrink-0 rounded-full bg-white/15 grid place-items-center text-sm font-semibold">
              {initials}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{email || "Usuário"}</p>
              <p className="text-xs text-primary-foreground/65">{roleLabel}</p>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
              title="Sair"
              aria-label="Sair"
              className="rounded-md p-2 text-primary-foreground/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 bg-background/90 backdrop-blur border-b flex items-center gap-3 px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-foreground/70 hover:bg-muted shrink-0"
            onClick={() => {
              if (window.matchMedia("(min-width: 768px)").matches) {
                setCollapsed((c) => !c);
              } else {
                setMobileOpen((o) => !o);
              }
            }}
            aria-label="Alternar menu"
          >
            <Menu className="size-5" />
          </Button>
          <h2 className="font-display text-base font-semibold truncate">{pageTitle}</h2>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
