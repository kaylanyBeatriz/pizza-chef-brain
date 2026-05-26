import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { User, KeyRound, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import logo from "@/assets/big-pizza-logo.png";
import pizzaBg from "@/assets/pizza-bg.jpg";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciais inválidas" : error.message);
      return;
    }
    toast.success("Bem-vindo!");
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
            "linear-gradient(to bottom, oklch(0.52 0.18 27) 0%, oklch(0.52 0.18 27) 42%, oklch(0.52 0.18 27 / 0.78) 58%, oklch(0.25 0.1 27 / 0.35) 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md text-center text-primary-foreground">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gold/30 blur-2xl scale-110" aria-hidden />
              <img
                src={logo}
                alt="Big Pizza"
                width={200}
                height={200}
                className="relative size-44 sm:size-52 rounded-full object-cover ring-4 ring-gold/80 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
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
            Consumo &amp; Financeiro
          </p>

          <h2 className="font-display italic text-4xl sm:text-5xl mt-8 text-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            Bem-vindo!
          </h2>
          <p className="mt-2 text-sm text-primary-foreground/85">
            Faça login para acessar o sistema
          </p>


          <form onSubmit={handleLogin} className="space-y-4 text-left mt-6">
            <Field
              icon={<User className="size-4" />}
              label="Usuário"
              type="email"
              placeholder="Digite seu usuário"
              value={email}
              onChange={setEmail}
            />
            <Field
              icon={<KeyRound className="size-4" />}
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={setPassword}
            />

            <div className="flex items-center justify-between text-xs text-primary-foreground/90">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(!!v)}
                  className="border-white/60 data-[state=checked]:bg-gold data-[state=checked]:border-gold data-[state=checked]:text-gold-foreground"
                />
                Lembrar-me
              </label>
              <button type="button" className="hover:text-gold transition-colors">
                Esqueci minha senha
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 rounded-full bg-[oklch(0.46_0.18_27)] hover:bg-[oklch(0.42_0.18_27)] text-primary-foreground text-base font-semibold shadow-lg shadow-black/30 border border-white/10"
            >
              <LogIn className="size-5 mr-2" />
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon, label, type, placeholder, value, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-primary-foreground/90 pl-1">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <Input
          type={type}
          required
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 pl-11 rounded-full bg-background/95 text-foreground placeholder:text-muted-foreground border-0 shadow-inner focus-visible:ring-2 focus-visible:ring-gold"
        />
      </div>
    </div>
  );
}
