import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, ShieldAlert, Trash2, Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import { createTempAdmin, cleanupExpiredTempAdmins, revokeTempAdmin } from "@/lib/temp-admins.functions";

export const Route = createFileRoute("/app/users")({
  component: UsersPage,
});

const ROLES = ["admin", "tst", "viewer"] as const;

function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const createFn = useServerFn(createTempAdmin);
  const cleanupFn = useServerFn(cleanupExpiredTempAdmins);
  const revokeFn = useServerFn(revokeTempAdmin);
  const [tempOpen, setTempOpen] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [tempPwd, setTempPwd] = useState("");
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate({ to: "/app" });
    }
  }, [loading, isAdmin, navigate]);

  // Tick + auto-cleanup
  useEffect(() => {
    if (!isAdmin) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    cleanupFn().then((r) => {
      if (r?.removed) qc.invalidateQueries({ queryKey: ["temp-admins"] });
    }).catch(() => {});
    const cleanup = setInterval(() => {
      cleanupFn().then((r) => {
        if (r?.removed) qc.invalidateQueries({ queryKey: ["temp-admins"] });
      }).catch(() => {});
    }, 60_000);
    return () => { clearInterval(tick); clearInterval(cleanup); };
  }, [isAdmin, cleanupFn, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      }));
    },
  });

  const { data: tempAdmins = [] } = useQuery({
    queryKey: ["temp-admins"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("temp_admins").select("*").order("expires_at", { ascending: true })).data ?? [],
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users-with-roles"] }); toast.success("Papel atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  function genPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
    let p = "";
    for (let i = 0; i < 14; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
  }

  async function handleCreateTemp() {
    if (!tempEmail || !tempPwd) return toast.error("Preencha e-mail e senha");
    setCreating(true);
    try {
      await createFn({ data: { email: tempEmail, password: tempPwd } });
      toast.success("Admin temporário criado (1h)");
      setTempOpen(false);
      setTempEmail(""); setTempPwd("");
      qc.invalidateQueries({ queryKey: ["temp-admins"] });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar");
    } finally {
      setCreating(false);
    }
  }

  function fmtRemain(expiresAt: string) {
    const ms = new Date(expiresAt).getTime() - now;
    if (ms <= 0) return "expirado";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (loading || !isAdmin) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Usuários</h1>
      <p className="text-muted-foreground mb-6">Gestão de papéis (admin · tst · viewer)</p>

      {/* Admin temporário */}
      <div className="rounded-md border bg-amber-50 border-amber-200 p-4 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <ShieldAlert className="h-4 w-4" /> Admins Temporários (1h)
            </div>
            <p className="text-xs text-amber-800 mt-1">Conta admin descartável: após 1h o usuário é excluído automaticamente.</p>
          </div>
          <Button size="sm" onClick={() => { setTempPwd(genPassword()); setTempOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Criar admin temporário
          </Button>
        </div>
        <div className="bg-white rounded border divide-y">
          {tempAdmins.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground text-center">Nenhum admin temporário ativo</div>
          )}
          {tempAdmins.map((t: any) => {
            const expired = new Date(t.expires_at).getTime() <= now;
            return (
              <div key={t.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <Badge variant={expired ? "outline" : "secondary"}>{expired ? "expirado" : "ativo"}</Badge>
                <div className="flex-1 truncate">{t.email}</div>
                <div className="flex items-center gap-1 text-xs text-amber-900 font-mono">
                  <Clock className="h-3 w-3" />{fmtRemain(t.expires_at)}
                </div>
                <Button size="icon" variant="ghost"
                  onClick={async () => {
                    if (!confirm("Revogar este admin temporário agora?")) return;
                    try {
                      await revokeFn({ data: { id: t.id } });
                      toast.success("Admin removido");
                      qc.invalidateQueries({ queryKey: ["temp-admins"] });
                      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
                    } catch (e: any) { toast.error(e.message); }
                  }}>
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Papéis atuais</TableHead>
              <TableHead className="w-48">Definir papel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name ?? u.id.slice(0, 8)}</TableCell>
                <TableCell className="space-x-1">
                  {u.roles.length === 0 && <Badge variant="outline">sem papel</Badge>}
                  {u.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                </TableCell>
                <TableCell>
                  <Select onValueChange={(v) => setRole.mutate({ userId: u.id, role: v })}>
                    <SelectTrigger><SelectValue placeholder="Trocar papel" /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={tempOpen} onOpenChange={setTempOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar admin temporário (1 hora)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={tempEmail} onChange={(e) => setTempEmail(e.target.value)} placeholder="admin.temp@empresa.com" />
            </div>
            <div>
              <Label>Senha *</Label>
              <div className="flex gap-2">
                <Input value={tempPwd} onChange={(e) => setTempPwd(e.target.value)} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => setTempPwd(genPassword())}>Gerar</Button>
                <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(tempPwd); toast.success("Senha copiada"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Anote a senha agora — ela não será exibida novamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTempOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTemp} disabled={creating}>{creating ? "Criando..." : "Criar (1h)"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}