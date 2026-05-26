import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { User, KeyRound, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPassword, setSPassword] = useState("");

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

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: sEmail,
      password: sPassword,
      options: { emailRedirectTo: window.location.origin, data: { full_name: sName } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada! Confirme seu email para entrar.");
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setLoading(false); toast.error("Falha no login com Google"); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen w-full flex items-stretch bg-primary relative overflow-hidden">
      {/* Pizza background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${pizzaBg})` }}
        aria-hidden
      />
      {/* Red gradient overlay — solid at top, fades into pizza at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, oklch(0.52 0.18 27) 0%, oklch(0.52 0.18 27) 45%, oklch(0.52 0.18 27 / 0.75) 60%, oklch(0.25 0.1 27 / 0.35) 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md text-center text-primary-foreground">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src={logo}
              alt="Big Pizza"
              width={180}
              height={180}
              className="size-40 sm:size-44 drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            />
          </div>

          {/* Headings */}
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-gold">
            SISTEMA DE CONTROLE
          </h1>
          <p className="mt-1 text-base sm:text-lg font-medium text-primary-foreground/95">
            Consumo e Financeiro
          </p>

          <h2 className="font-display text-3xl sm:text-4xl mt-6 text-gold">Bem-vindo!</h2>
          <p className="mt-1 text-sm text-primary-foreground/85">
            Faça login para acessar o sistema
          </p>

          <Tabs defaultValue="login" className="mt-6">
            <TabsList className="grid grid-cols-2 w-full bg-black/20 border border-white/15">
              <TabsTrigger value="login" className="data-[state=active]:bg-gold data-[state=active]:text-gold-foreground text-primary-foreground">
                Entrar
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-gold data-[state=active]:text-gold-foreground text-primary-foreground">
                Criar conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5">
              <form onSubmit={handleLogin} className="space-y-4 text-left">
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

                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full text-xs text-primary-foreground/80 hover:text-gold transition-colors pt-1"
                >
                  ou entrar com Google
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleSignup} className="space-y-4 text-left">
                <Field
                  icon={<User className="size-4" />}
                  label="Nome completo"
                  type="text"
                  placeholder="Seu nome"
                  value={sName}
                  onChange={setSName}
                />
                <Field
                  icon={<User className="size-4" />}
                  label="Email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={sEmail}
                  onChange={setSEmail}
                />
                <Field
                  icon={<KeyRound className="size-4" />}
                  label="Senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={sPassword}
                  onChange={setSPassword}
                  minLength={6}
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 rounded-full bg-[oklch(0.46_0.18_27)] hover:bg-[oklch(0.42_0.18_27)] text-primary-foreground text-base font-semibold shadow-lg shadow-black/30 border border-white/10"
                >
                  Criar conta
                </Button>
                <p className="text-[11px] text-primary-foreground/70 text-center">
                  O primeiro usuário será admin automaticamente.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-xs">
            <Link to="/" className="text-primary-foreground/70 hover:text-gold">← Voltar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon, label, type, placeholder, value, onChange, minLength,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-primary-foreground/90 pl-1">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <Input
          type={type}
          required
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 pl-11 rounded-full bg-background/95 text-foreground placeholder:text-muted-foreground border-0 shadow-inner focus-visible:ring-2 focus-visible:ring-gold"
        />
      </div>
    </div>
  );
}
