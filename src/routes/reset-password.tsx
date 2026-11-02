import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/big-pizza-logo.png";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    setLoading(false);
    toast.success("Senha atualizada! Faça login com a nova senha.");
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-primary p-4">
      <div className="w-full max-w-md text-center text-primary-foreground">
        <img src={logo} alt="Big Pizza" width={140} height={140} className="mx-auto size-32 rounded-full object-contain mb-4" />
        <h1 className="font-display italic text-4xl text-gold">Nova senha</h1>
        <p className="mt-2 text-sm text-primary-foreground/85">
          {ready ? "Defina sua nova senha de acesso." : "Abra esta página pelo link enviado ao seu email."}
        </p>

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4 text-left mt-6">
            {[
              { label: "Nova senha", value: password, set: setPassword },
              { label: "Confirmar senha", value: confirm, set: setConfirm },
            ].map((f) => (
              <div key={f.label} className="space-y-1.5">
                <label className="text-xs font-medium text-primary-foreground/90 pl-1">{f.label}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <KeyRound className="size-4" />
                  </span>
                  <Input
                    type="password"
                    required
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className="h-11 pl-11 rounded-full bg-background/95 text-foreground border-0 shadow-inner focus-visible:ring-2 focus-visible:ring-gold"
                  />
                </div>
              </div>
            ))}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-[oklch(0.46_0.18_27)] hover:bg-[oklch(0.42_0.18_27)] text-primary-foreground text-base font-semibold"
            >
              {loading ? "Aguarde..." : "Salvar nova senha"}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate({ to: "/login" })}
          className="mt-6 text-xs text-gold hover:underline"
        >
          Voltar ao login
        </button>
      </div>
    </div>
  );
}
