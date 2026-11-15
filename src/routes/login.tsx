import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { enableGuestAccess } from "@/lib/guest";
import logo from "@/assets/big-pizza-logo.png";
import pizzaBg from "@/assets/pizza-bg.jpg";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  function handleAccess() {
    enableGuestAccess();
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen w-full flex items-stretch bg-primary relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${pizzaBg})` }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, oklch(0.286 0.071 137.5) 0%, oklch(0.286 0.071 137.5) 42%, oklch(0.286 0.071 137.5 / 0.78) 58%, oklch(0.18 0.05 137.5 / 0.35) 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md text-center text-primary-foreground">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full bg-gold/30 blur-2xl scale-110"
                aria-hidden
              />
              <img
                src={logo}
                alt="Big Pizza"
                width={200}
                height={200}
                className="relative size-44 sm:size-52 rounded-full object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
              />
            </div>
          </div>

          <h1
            className="text-3xl sm:text-4xl font-normal tracking-[0.18em] text-gold"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            SISTEMA DE CONTROLE
          </h1>
          <p className="mt-1 text-base sm:text-lg font-medium text-primary-foreground tracking-wide">
            Despesas &amp; Contas a pagar
          </p>

          <h2 className="font-display italic text-4xl sm:text-5xl mt-8 text-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            Bem-vindo!
          </h2>

          <Button
            type="button"
            onClick={handleAccess}
            className="w-full h-12 mt-8 rounded-full bg-[oklch(0.38_0.08_137.5)] hover:bg-[oklch(0.34_0.08_137.5)] text-primary-foreground text-base font-semibold shadow-lg shadow-black/30 border border-white/10"
          >
            <LogIn className="size-5 mr-2" />
            Acessar o site
          </Button>
        </div>
      </div>
    </div>
  );
}
