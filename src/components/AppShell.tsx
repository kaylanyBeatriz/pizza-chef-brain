import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Carrot,
  Flame,
  ShoppingCart,
  Pizza,
  LogOut,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/big-pizza-logo.png";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/estoque", label: "Ingredientes", icon: Carrot },
  { to: "/consumo", label: "Consumo", icon: Flame },
  { to: "/produtos", label: "Pizzas & Receitas", icon: Pizza },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roles, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const current = nav.find((n) => location.pathname.startsWith(n.to));
  const pageTitle = current?.label ?? "Dashboard";

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          "shrink-0 bg-primary text-primary-foreground flex flex-col transition-[width] duration-300",
          collapsed ? "w-0 overflow-hidden" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="px-6 pt-8 pb-6 flex items-center justify-center">
          <div className="size-32 rounded-full bg-primary-foreground/5 ring-4 ring-gold/70 shadow-[0_8px_30px_rgba(0,0,0,0.35)] overflow-hidden grid place-items-center">
            <img src={logo} alt="Big Pizza" className="size-full object-cover" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-5 pt-4 space-y-2">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-full text-[0.95rem] font-medium transition-all",
                  active
                    ? "bg-primary-foreground/95 text-primary shadow-md"
                    : "text-primary-foreground/90 hover:bg-primary-foreground/10"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Divider + Sair */}
        <div className="px-6 pb-6 pt-4">
          <div className="h-px bg-primary-foreground/30 mb-4" />
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
            className="flex items-center gap-3 text-primary-foreground/90 hover:text-primary-foreground transition-colors text-sm font-medium px-2"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 shrink-0 bg-accent border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-primary/10"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Alternar menu"
            >
              <Menu className="size-5" />
            </Button>
            <h1 className="font-display text-lg tracking-tight">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-foreground/30">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">
                {roles[0] ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1) : "Admin"}
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.email ? "Pizzaria Big Pizza" : "Pizzaria Big Pizza"}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-8 max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
