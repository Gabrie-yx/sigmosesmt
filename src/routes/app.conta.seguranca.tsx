import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, Trash2, KeyRound, LogOut, PenTool, Image as ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/conta/seguranca")({
  component: SecurityPage,
});

function SecurityPage() {
  const navigate = useNavigate();
  const { user, requiresMfa, mfaActive, aal, loading } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<any[]>([]);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signature, setSignature] = useState<string | null>(() => localStorage.getItem("sigmo:last-user-signature"));

  useEffect(() => { refreshFactors(); }, []);

  const onSignatureUpload = async (file: File | null) => {
    if (!file) return;
    if (file.type !== "image/png") return toast.error("A assinatura deve estar no formato PNG");
    if (file.size > 2 * 1024 * 1024) return toast.error("Arquivo muito grande (máx. 2MB)");

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSignature(base64);
      localStorage.setItem("sigmo:last-user-signature", base64);
      toast.success("Assinatura salva com sucesso!");
    };
    reader.readAsDataURL(file);
  };

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) return toast.error("Senha deve ter ao menos 8 caracteres");
    if (newPwd !== confirmPwd) return toast.error("As senhas não coincidem");
    setPwdBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPwd(""); setConfirmPwd("");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao alterar senha");
    } finally { setPwdBusy(false); }
  }

  async function signOutAll() {
    if (!confirm("Isso vai desconectar TODAS as sessões (inclusive esta). Continuar?")) return;
    setSignOutBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.success("Todas as sessões foram encerradas");
      navigate({ to: "/login" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao encerrar sessões");
      setSignOutBusy(false);
    }
  }

  async function refreshFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors([...(data?.totp ?? [])]);
  }

  async function startEnroll() {
    setBusy(true);
    try {
      // Limpa fatores não verificados antigos
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of [...(list?.totp ?? []), ...(list?.phone ?? [])]) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `SIGMO ${new Date().toLocaleDateString("pt-BR")}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  async function verifyEnroll() {
    if (!factorId) return;
    setBusy(true);
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId, challengeId: ch.id, code,
      });
      if (vErr) throw vErr;
      toast.success("MFA ativado com sucesso!");
      setFactorId(null); setQr(null); setSecret(null); setCode("");
      await refreshFactors();
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  async function unenrollFactor(id: string) {
    if (!confirm("Remover este fator MFA? Isso reduzirá a segurança da sua conta.")) return;
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast.success("MFA removido");
      await refreshFactors();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-1">Segurança da conta</h1>
      <p className="text-muted-foreground text-sm mb-6">{user?.email}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {mfaActive
                  ? <ShieldCheck className="h-5 w-5 text-green-600" />
                  : <ShieldAlert className="h-5 w-5 text-amber-600" />}
                <CardTitle>Autenticação em dois fatores (MFA)</CardTitle>
              </div>
              <CardDescription>
                Use um app autenticador como Google Authenticator, Authy ou 1Password.
                {requiresMfa && !mfaActive && (
                  <span className="block mt-2 text-amber-700 font-medium">
                    Seu papel exige MFA — ative para acessar áreas sensíveis.
                  </span>
                )}
                {mfaActive && aal !== "aal2" && (
                  <span className="block mt-2 text-amber-700 font-medium">
                    MFA ativo, mas a sessão atual não está verificada (aal1). Faça logout e entre novamente fornecendo o código.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {factors.length > 0 && (
                <div className="space-y-2">
                  {factors.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded border bg-muted/30">
                      <div>
                        <div className="text-sm font-medium">{f.friendly_name ?? "TOTP"}</div>
                        <div className="text-xs text-muted-foreground">
                          Status: <Badge status={f.status} />
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => unenrollFactor(f.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {!qr && (
                <Button onClick={startEnroll} disabled={busy}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {factors.some((f) => f.status === "verified") ? "Adicionar outro fator" : "Ativar MFA"}
                </Button>
              )}

              {qr && (
                <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                  <p className="text-sm">1. Escaneie o QR code com seu app autenticador:</p>
                  <img src={qr} alt="QR Code MFA" className="bg-white p-2 rounded" />
                  <p className="text-xs text-muted-foreground">
                    Ou digite manualmente: <code className="font-mono bg-background px-1">{secret}</code>
                  </p>
                  <div>
                    <Label>2. Digite o código de 6 dígitos:</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="font-mono text-lg tracking-widest" placeholder="000000" maxLength={6} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={verifyEnroll} disabled={busy || code.length !== 6}>Verificar e ativar</Button>
                    <Button variant="ghost" onClick={() => { setFactorId(null); setQr(null); setSecret(null); }}>Cancelar</Button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <Button variant="outline" onClick={() => navigate({ to: "/app" })}>Voltar</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-emerald-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PenTool className="h-5 w-5 text-emerald-600" />
                <CardTitle>Minha Assinatura</CardTitle>
              </div>
              <CardDescription>
                Faça o upload da sua assinatura (PNG transparente) para preenchimento automático.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6 items-center text-center">
                <div className="h-32 w-64 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50 relative overflow-hidden group">
                  {signature ? (
                    <>
                      <img src={signature} alt="Assinatura" className="h-full w-full object-contain p-2" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Check className="h-8 w-8 text-white" />
                      </div>
                    </>
                  ) : (
                    <ImageIcon className="h-10 w-10 text-slate-300" />
                  )}
                </div>
                <div className="space-y-3 w-full">
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <div className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full">
                        <PenTool className="h-4 w-4 mr-2" />
                        {signature ? "Trocar Assinatura" : "Enviar Assinatura"}
                      </div>
                      <input
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={(e) => onSignatureUpload(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {signature && (
                      <Button
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 w-full"
                        onClick={() => {
                          if (confirm("Remover sua assinatura salva?")) {
                            setSignature(null);
                            localStorage.removeItem("sigmo:last-user-signature");
                            toast.info("Assinatura removida");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover Assinatura
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Recomendado: fundo transparente, formato PNG, máx 2MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-slate-700" />
              <CardTitle>Alterar senha</CardTitle>
            </div>
            <CardDescription>
              Defina uma nova senha (mínimo 8 caracteres). Você continuará logado nesta sessão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="new-pwd">Nova senha</Label>
                <Input id="new-pwd" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} minLength={8} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-pwd">Confirme a nova senha</Label>
                <Input id="confirm-pwd" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} minLength={8} required />
              </div>
              <Button type="submit" disabled={pwdBusy}>
                {pwdBusy ? "Salvando..." : "Alterar senha"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-red-600" />
              <CardTitle>Encerrar todas as sessões</CardTitle>
            </div>
            <CardDescription>
              Desconecta sua conta de TODOS os dispositivos e navegadores (inclusive este).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={signOutAll} disabled={signOutBusy}>
              <LogOut className="h-4 w-4 mr-2" />
              {signOutBusy ? "Encerrando..." : "Sair de todos os dispositivos"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const cls = status === "verified" ? "text-green-700 bg-green-100" : "text-amber-700 bg-amber-100";
  return <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${cls}`}>{status}</span>;
}
