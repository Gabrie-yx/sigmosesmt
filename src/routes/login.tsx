import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import sigmoLogo from "@/assets/sigmo-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  // Signup público desabilitado por motivos de segurança (LGPD / sistema interno).
  // Novos usuários só podem ser criados via convite por um admin (inviteUser).
  const mode: "signin" = "signin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
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
          <div className="mx-auto relative h-36 w-36">
            <img src={sigmoLogo} alt="SIGMO" className="h-36 w-36 object-contain" />
          </div>
          <CardDescription className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Sistema Integrado de Gestão Modular
          </CardDescription>
          <CardTitle className="text-2xl font-black uppercase tracking-tight text-slate-900">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </CardTitle>
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
            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  Li e aceito os{" "}
                  <Link to="/termos" target="_blank" className="font-semibold text-red-600 hover:underline">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" target="_blank" className="font-semibold text-red-600 hover:underline">
                    Política de Privacidade
                  </Link>{" "}
                  (LGPD).
                </span>
              </label>
            )}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "Não tem conta? Criar" : "Já tem conta? Entrar"}
            </button>
            <div className="border-t border-slate-200 pt-3 text-center text-[11px] text-muted-foreground space-x-3">
              <Link to="/termos" className="hover:text-slate-900 hover:underline">Termos de Uso</Link>
              <span>·</span>
              <Link to="/privacidade" className="hover:text-slate-900 hover:underline">Política de Privacidade</Link>
              <span>·</span>
              <Link to="/" className="hover:text-slate-900 hover:underline">Início</Link>
            </div>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}