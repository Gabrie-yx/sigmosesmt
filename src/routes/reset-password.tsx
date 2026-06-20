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
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const applyInvite = useServerFn(applyMyPendingInvite);

  function isAal2Error(error: any) {
    const code = (error?.code || error?.name || "").toString().toLowerCase();
    const msg = (error?.message || error?.error_description || "").toString().toLowerCase();
    return code.includes("insufficient_aal") || msg.includes("aal2") || msg.includes("mfa");
  }

  useEffect(() => {
    // Supabase processa o token do hash automaticamente e cria sessão
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function finishPasswordUpdate() {
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) throw error;
    try { await applyInvite({}); } catch (err) { console.warn("applyInvite", err); }
    toast.success("Senha definida! Bem-vindo.");
    nav({ to: "/app" });
  }

  async function startMfaChallenge(): Promise<boolean> {
    const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
    if (fErr) throw fErr;
    const totp = factors?.totp?.find((f) => f.status === "verified");
    if (!totp) {
      toast.error("Sua conta tem MFA ativo mas nenhum autenticador verificado foi encontrado. Contate o administrador.");
      return false;
    }
    const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
    if (cErr) throw cErr;
    setMfaFactorId(totp.id);
    setMfaChallengeId(ch.id);
    setMfaNeeded(true);
    toast.info("Digite o código de 6 dígitos do seu app autenticador.");
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem");
    setBusy(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTotp = (factors?.totp ?? []).some((f) => f.status === "verified");
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (hasVerifiedTotp && aalData?.currentLevel !== "aal2") {
        await startMfaChallenge();
        return;
      }
      await finishPasswordUpdate();
    } catch (e: any) {
      if (isAal2Error(e)) {
        try {
          await startMfaChallenge();
        } catch (err: any) {
          toast.error(err.message || "Falha ao iniciar verificação MFA");
        }
      } else {
        toast.error(e.message);
      }
    } finally { setBusy(false); }
  }

  async function submitMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    if (!/^\d{6}$/.test(mfaCode)) return toast.error("Digite os 6 dígitos do código");
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      });
      if (error) throw error;
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel !== "aal2") {
        await supabase.auth.refreshSession();
      }
      await finishPasswordUpdate();
    } catch (e: any) {
      if (isAal2Error(e)) {
        toast.error("Ainda falta confirmar o MFA. Gere um novo código no autenticador e tente novamente.");
      } else {
        toast.error(e.message || "Código inválido");
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black px-4 py-10">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-red-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-3xl" />

      <Card className="relative w-full max-w-md border border-white/15 bg-white/10 text-white shadow-2xl shadow-red-900/30 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Definir senha</CardTitle>
          <CardDescription className="text-slate-300">
            {hasSession
              ? "Crie uma senha para acessar sua conta."
              : "Validando link..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession && !mfaNeeded ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-200">Nova senha</Label>
                <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} required className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-red-500/60" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Confirmar senha</Label>
                <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} minLength={8} required className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-red-500/60" />
              </div>
              <Button type="submit" className="w-full bg-red-600 text-white shadow-lg shadow-red-900/50 hover:bg-red-500" disabled={busy}>
                {busy ? "Salvando..." : "Definir senha e entrar"}
              </Button>
            </form>
          ) : hasSession && mfaNeeded ? (
            <form onSubmit={submitMfa} className="space-y-4">
              <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-slate-200">
                Sua conta tem verificação em duas etapas (MFA). Digite o código de 6 dígitos do seu app autenticador para concluir a troca de senha.
              </p>
              <div className="space-y-2">
                <Label className="text-slate-200">Código do autenticador</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="bg-white/10 border-white/20 font-mono text-lg tracking-widest text-white placeholder:text-slate-400 focus-visible:ring-red-500/60"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-red-600 text-white shadow-lg shadow-red-900/50 hover:bg-red-500" disabled={busy}>
                {busy ? "Verificando..." : "Verificar e salvar senha"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-slate-300">
              Se você chegou aqui sem clicar no link do convite, peça um novo convite ao administrador.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}