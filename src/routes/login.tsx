import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import sigmoLogo from "@/assets/sigmo-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  function postLoginTarget(): string {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("redirect");
      if (q && q.startsWith("/") && !q.startsWith("//")) return q;
      const ss = sessionStorage.getItem("post_login_redirect");
      if (ss && ss.startsWith("/") && !ss.startsWith("//")) return ss;
    } catch {}
    return "/app";
  }
  function goPostLogin() {
    const to = postLoginTarget();
    try { sessionStorage.removeItem("post_login_redirect"); } catch {}
    if (to !== "/app") window.location.assign(to);
    else nav({ to: "/app" });
  }
  // Signup público desabilitado por motivos de segurança (LGPD / sistema interno).
  // Novos usuários só podem ser criados via convite por um admin (inviteUser).
  const mode: "signin" = "signin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Se o email existir, enviaremos um link para redefinir a senha.");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível enviar o email");
    } finally {
      setLoading(false);
    }
  }

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
      goPostLogin();
    } catch (e: any) {
      toast.error(e.message ?? "Código inválido");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goPostLogin();
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
      goPostLogin();
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black px-4 py-10">
      {/* Glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-red-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-3xl" />

      <Card className="relative w-full max-w-md border border-white/15 bg-white/10 text-white shadow-2xl shadow-red-900/30 backdrop-blur-xl">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="mx-auto relative h-36 w-36">
            <img src={sigmoLogo} alt="SIGMO" className="h-36 w-36 object-contain drop-shadow-[0_0_20px_rgba(239,68,68,0.35)]" />
          </div>
          <CardDescription className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
            Sistema Integrado de Gestão Modular
          </CardDescription>
          <CardTitle className="text-2xl font-black uppercase tracking-tight text-white">
            Entrar
          </CardTitle>
        </CardHeader>
        <CardContent className="text-white">
          {mfaChallengeId ? (
            <form onSubmit={verifyMfa} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-200">Código MFA (6 dígitos)</Label>
                <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="font-mono text-lg tracking-widest bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-red-500/60"
                  placeholder="000000" maxLength={6} autoFocus />
              </div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50" disabled={loading || mfaCode.length !== 6}>
                {loading ? "Verificando..." : "Confirmar"}
              </Button>
              <button type="button" onClick={() => { setMfaChallengeId(null); setMfaFactorId(null); setMfaCode(""); supabase.auth.signOut(); }}
                className="w-full text-sm text-slate-300 hover:text-white">
                Cancelar
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-red-500/60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Senha</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-red-500/60" />
            </div>
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50" disabled={loading}>
              {loading ? "Aguarde..." : "Entrar"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                className="text-xs font-semibold text-slate-300 hover:text-white hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="text-center text-xs text-slate-400">
              Sistema interno — novas contas são criadas por convite de um administrador.
            </div>
            <div className="border-t border-white/10 pt-3 text-center text-[11px] text-slate-400 space-x-3">
              <Link to="/termos" className="hover:text-white hover:underline">Termos de Uso</Link>
              <span>·</span>
              <Link to="/privacidade" className="hover:text-white hover:underline">Política de Privacidade</Link>
              <span>·</span>
              <Link to="/" className="hover:text-white hover:underline">Início</Link>
            </div>
          </form>
          )}
        </CardContent>
      </Card>
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !loading && setForgotOpen(false)}>
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg">Recuperar senha</CardTitle>
              <CardDescription>Informe seu email cadastrado. Enviaremos um link para você criar uma nova senha.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoFocus />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" disabled={loading} onClick={() => setForgotOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Enviando..." : "Enviar link"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}