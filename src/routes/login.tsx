import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import dmnLogo from "@/assets/dmn-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId, challengeId: mfaChallengeId, code: mfaCode,
      });
      if (error) throw error;
      toast.success("Bem-vindo!");
      nav({ to: "/app" });
    } catch (e: any) {
      toast.error(e.message ?? "Código inválido");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/app" });
    });
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        // Tenta atribuir admin se for o primeiro usuário (RLS permite via policy bootstrap)
        try {
          const { data: signed } = await supabase.auth.signInWithPassword({ email, password });
          if (signed.user) {
            await supabase.from("user_roles").insert({ user_id: signed.user.id, role: "admin" });
          }
        } catch {
          /* ignora — confirmação de email pode estar ativa */
        }
        toast.success("Conta criada! Se a confirmação de email estiver ativa, verifique sua caixa de entrada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            throw new Error("Email não confirmado. Desative a confirmação de email no Supabase ou confirme pelo link enviado.");
          }
          if (error.message.toLowerCase().includes("invalid login")) {
            throw new Error("Email ou senha incorretos.");
          }
          throw error;
        }
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
          if (totp) {
            setMfaFactorId(totp.id);
            const { data: ch } = await supabase.auth.mfa.challenge({ factorId: totp.id });
            setMfaChallengeId(ch?.id ?? null);
            setLoading(false);
            return;
          }
        }
        toast.success("Bem-vindo!");
      }
      nav({ to: "/app" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-red-50 px-4 py-10">
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-b from-[#a01818] to-[#7f1212] shadow-lg ring-1 ring-red-900/20">
            <img src={dmnLogo} alt="Estaleiro DMN" className="h-14 w-auto object-contain drop-shadow" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tight text-slate-900">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </CardTitle>
          <CardDescription className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Acesso ao Sistema de Gestão · Estaleiro DMN
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mfaChallengeId ? (
            <form onSubmit={verifyMfa} className="space-y-4">
              <div className="space-y-2">
                <Label>Código MFA (6 dígitos)</Label>
                <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="font-mono text-lg tracking-widest" placeholder="000000" maxLength={6} autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                {loading ? "Verificando..." : "Confirmar"}
              </Button>
              <button type="button" onClick={() => { setMfaChallengeId(null); setMfaFactorId(null); setMfaCode(""); supabase.auth.signOut(); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "Não tem conta? Criar" : "Já tem conta? Entrar"}
            </button>
            <div className="text-center text-xs text-muted-foreground">
              <Link to="/">← Voltar</Link>
            </div>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}