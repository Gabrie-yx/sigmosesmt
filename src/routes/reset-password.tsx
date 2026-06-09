import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { applyMyPendingInvite } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const applyInvite = useServerFn(applyMyPendingInvite);

  useEffect(() => {
    // Supabase processa o token do hash automaticamente e cria sessão
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      // Rede de segurança: garante role + módulos do convite, mesmo se a
      // trigger apply_pending_invite não tiver aplicado por timing/expiração.
      try { await applyInvite({}); } catch (err) { console.warn("applyInvite", err); }
      toast.success("Senha definida! Bem-vindo.");
      nav({ to: "/app" });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Definir senha</CardTitle>
          <CardDescription>
            {hasSession
              ? "Crie uma senha para acessar sua conta."
              : "Validando link..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} required />
              </div>
              <div className="space-y-2">
                <Label>Confirmar senha</Label>
                <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} minLength={8} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Salvando..." : "Definir senha e entrar"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Se você chegou aqui sem clicar no link do convite, peça um novo convite ao administrador.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}