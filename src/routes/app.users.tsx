import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert, Trash2, Plus, Mail, RotateCcw, X, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  inviteUser,
  resendInvite,
  cancelInvite,
  updateUserRole,
  updateUserModules,
  deleteUser,
  listUsersAdmin,
} from "@/lib/users.functions";
import { createInvestorAccess } from "@/lib/temp-investors.functions";

export const Route = createFileRoute("/app/users")({
  component: UsersPage,
});

const ROLES = [
  { value: "admin", label: "Administrador", desc: "Acesso total + gerencia usuários (MFA obrigatório)" },
  { value: "moderador", label: "Moderador", desc: "Edita + aprova/revoga ações sensíveis (MFA obrigatório)" },
  { value: "editor", label: "Editor", desc: "Cria e edita registros nos módulos liberados" },
  { value: "viewer", label: "Visualizador", desc: "Somente leitura nos módulos liberados" },
] as const;

const MODULES = [
  { value: "sesmt", label: "SESMT" },
  { value: "estoque", label: "Estoque" },
  { value: "producao", label: "Produção" },
  { value: "manutencao", label: "Manutenção" },
  { value: "portaria", label: "Portaria" },
  { value: "usuarios", label: "Usuários" },
] as const;

function roleLabel(r: string) {
  return ROLES.find((x) => x.value === r)?.label ?? r;
}
function roleVariant(r: string): "default" | "destructive" | "secondary" | "outline" {
  if (r === "admin") return "destructive";
  if (r === "moderador") return "default";
  if (r === "editor") return "secondary";
  return "outline";
}

function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin, mfaSatisfied, requiresMfa, loading } = useAuth();
  const navigate = useNavigate();

  const inviteFn = useServerFn(inviteUser);
  const resendFn = useServerFn(resendInvite);
  const cancelFn = useServerFn(cancelInvite);
  const updateRoleFn = useServerFn(updateUserRole);
  const updateModulesFn = useServerFn(updateUserModules);
  const deleteUserFn = useServerFn(deleteUser);
  const listFn = useServerFn(listUsersAdmin);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [investorOpen, setInvestorOpen] = useState(false);
  const [investorCreds, setInvestorCreds] = useState<{ email: string; password: string; expires_at: string; link: string } | null>(null);
  const [investorLoading, setInvestorLoading] = useState(false);
  const createInvestorFn = useServerFn(createInvestorAccess);

  // form state
  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRole, setFRole] = useState<string>("editor");
  const [fModules, setFModules] = useState<string[]>(["sesmt"]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/app" });
  }, [loading, isAdmin, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["users-admin"],
    enabled: isAdmin && mfaSatisfied,
    queryFn: () => listFn(),
  });

  function toggleModule(setter: (m: string[]) => void, current: string[], m: string) {
    if (current.includes(m)) setter(current.filter((x) => x !== m));
    else setter([...current, m]);
  }

  async function handleInvite() {
    if (!fName || !fEmail) return toast.error("Preencha nome e e-mail");
    setSubmitting(true);
    try {
      await inviteFn({
        data: {
          email: fEmail,
          full_name: fName,
          role: fRole as any,
          modules: fModules as any,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });
      toast.success("Convite enviado por e-mail");
      setInviteOpen(false);
      setFName(""); setFEmail(""); setFRole("editor"); setFModules(["sesmt"]);
      qc.invalidateQueries({ queryKey: ["users-admin"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao convidar");
    } finally { setSubmitting(false); }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateRoleFn({ data: { user_id: editing.id, role: fRole as any } });
      await updateModulesFn({ data: { user_id: editing.id, modules: fModules as any } });
      toast.success("Usuário atualizado");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["users-admin"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmitting(false); }
  }

  const setRoleMut = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) =>
      updateRoleFn({ data: { user_id, role: role as any } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users-admin"] }); toast.success("Papel atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return null;

  if (requiresMfa && !mfaSatisfied) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-center gap-2 font-bold text-amber-900 mb-2">
            <ShieldAlert className="h-5 w-5" /> MFA obrigatório
          </div>
          <p className="text-sm text-amber-900 mb-4">
            Como administrador, você precisa ativar a autenticação de dois fatores (MFA) para acessar o módulo de usuários e demais áreas sensíveis.
          </p>
          <Button onClick={() => navigate({ to: "/app/conta/seguranca" })}>
            <ShieldCheck className="h-4 w-4 mr-2" /> Configurar MFA
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Convide novos usuários, defina papéis e libere módulos específicos.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Convidar usuário
        </Button>
        <Button
          variant="secondary"
          className="ml-2"
          disabled={investorLoading}
          onClick={async () => {
            setInvestorLoading(true);
            try {
              const res = await createInvestorFn();
              setInvestorCreds({
                email: res.email,
                password: res.password,
                expires_at: res.expires_at,
                link: `${window.location.origin}/login`,
              });
              setInvestorOpen(true);
              toast.success("Acesso de investidor criado (válido por 48h)");
            } catch (e: any) {
              toast.error(e.message ?? "Falha ao gerar acesso");
            } finally { setInvestorLoading(false); }
          }}
        >
          {investorLoading ? "Gerando..." : "Gerar acesso de investidor (48h)"}
        </Button>
      </div>

      {/* Convites pendentes */}
      {data?.invites && data.invites.length > 0 && (
        <div className="mb-6 rounded-md border bg-blue-50/60 border-blue-200">
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-blue-200">
            Convites pendentes ({data.invites.length})
          </div>
          <div className="divide-y">
            {data.invites.map((inv: any) => (
              <div key={inv.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-blue-700" />
                <div className="flex-1">
                  <div className="font-medium">{inv.full_name}</div>
                  <div className="text-xs text-muted-foreground">{inv.email} · {roleLabel(inv.role)}</div>
                </div>
                <div className="flex gap-1">
                  {(inv.modules ?? []).map((m: string) => (
                    <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
                <Button size="sm" variant="ghost"
                  onClick={async () => {
                    try {
                      await resendFn({ data: { invite_id: inv.id, redirect_to: `${window.location.origin}/reset-password` } });
                      toast.success("Convite reenviado");
                    } catch (e: any) { toast.error(e.message); }
                  }}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={async () => {
                    if (!confirm("Cancelar este convite?")) return;
                    try {
                      await cancelFn({ data: { invite_id: inv.id } });
                      toast.success("Convite cancelado");
                      qc.invalidateQueries({ queryKey: ["users-admin"] });
                    } catch (e: any) { toast.error(e.message); }
                  }}>
                  <X className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Email</TableHead>
              <TableHead className="w-40">Papel</TableHead>
              <TableHead>Módulos liberados</TableHead>
              <TableHead className="w-24 text-center">MFA</TableHead>
              <TableHead className="w-40">Trocar papel</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>}
            {data?.users.map((u: any) => {
              const role = u.roles[0] ?? "viewer";
              const isAdminUser = role === "admin";
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    {u.roles.length === 0
                      ? <Badge variant="outline">sem papel</Badge>
                      : u.roles.map((r: string) => <Badge key={r} variant={roleVariant(r)}>{roleLabel(r)}</Badge>)}
                  </TableCell>
                  <TableCell>
                    {isAdminUser ? (
                      <Badge variant="destructive" className="text-[10px]">TODOS (admin)</Badge>
                    ) : u.modules.length === 0 ? (
                      <span className="text-xs text-muted-foreground">nenhum</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.modules.map((m: string) => (
                          <Badge key={m} variant="outline" className="text-[10px]">
                            {MODULES.find((x) => x.value === m)?.label ?? m}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {u.mfa_active
                      ? <ShieldCheck className="h-4 w-4 text-green-600 inline" />
                      : (role === "admin" || role === "moderador")
                        ? <ShieldAlert className="h-4 w-4 text-amber-600 inline" />
                        : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Select value={role} onValueChange={(v) => setRoleMut.mutate({ user_id: u.id, role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost"
                      onClick={() => {
                        setEditing(u);
                        setFRole(role);
                        setFModules(u.modules);
                        setEditOpen(true);
                      }}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Remover ${u.email}?`)) return;
                        try {
                          await deleteUserFn({ data: { user_id: u.id } });
                          toast.success("Usuário removido");
                          qc.invalidateQueries({ queryKey: ["users-admin"] });
                        } catch (e: any) { toast.error(e.message); }
                      }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal Convidar */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>Um e-mail será enviado com link para definir senha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo *</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
            </div>
            <div>
              <Label>Papel *</Label>
              <div className="space-y-2 mt-2">
                {ROLES.map((r) => (
                  <label key={r.value} className="flex items-start gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer">
                    <input type="radio" name="role" checked={fRole === r.value} onChange={() => setFRole(r.value)} className="mt-1" />
                    <div>
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Módulos liberados</Label>
              {fRole === "admin" ? (
                <p className="text-xs text-muted-foreground mt-1">Administradores acessam todos os módulos automaticamente.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {MODULES.map((m) => (
                    <label key={m.value} className="flex items-center gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer">
                      <Checkbox checked={fModules.includes(m.value)}
                        onCheckedChange={() => toggleModule(setFModules, fModules, m.value)} />
                      <span className="text-sm">{m.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={submitting}>{submitting ? "Enviando..." : "Enviar convite"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar permissões */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar permissões</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Papel</Label>
              <Select value={fRole} onValueChange={setFRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Módulos liberados</Label>
              {fRole === "admin" ? (
                <p className="text-xs text-muted-foreground mt-1">Administradores acessam todos os módulos automaticamente.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {MODULES.map((m) => (
                    <label key={m.value} className="flex items-center gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer">
                      <Checkbox checked={fModules.includes(m.value)}
                        onCheckedChange={() => toggleModule(setFModules, fModules, m.value)} />
                      <span className="text-sm">{m.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={investorOpen} onOpenChange={setInvestorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acesso de investidor gerado</DialogTitle>
            <DialogDescription>
              Somente leitura · expira em {investorCreds ? new Date(investorCreds.expires_at).toLocaleString("pt-BR") : "—"}
            </DialogDescription>
          </DialogHeader>
          {investorCreds && (
            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-xs">Link</Label>
                <Input readOnly value={investorCreds.link} onFocus={(e) => e.currentTarget.select()} />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input readOnly value={investorCreds.email} onFocus={(e) => e.currentTarget.select()} />
              </div>
              <div>
                <Label className="text-xs">Senha</Label>
                <Input readOnly value={investorCreds.password} onFocus={(e) => e.currentTarget.select()} />
              </div>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                Copie as credenciais agora — a senha não será exibida novamente. O acesso é revogado automaticamente após 48 horas.
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  const txt = `Acesso ao SIGMO (48h)\nLink: ${investorCreds.link}\nE-mail: ${investorCreds.email}\nSenha: ${investorCreds.password}`;
                  navigator.clipboard.writeText(txt);
                  toast.success("Credenciais copiadas");
                }}
              >
                Copiar tudo
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvestorOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}