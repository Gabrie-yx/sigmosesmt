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
import { ShieldCheck, ShieldAlert, Trash2, Plus, Mail, RotateCcw, X, Settings2, Ban, Play, History as HistoryIcon, KeyRound, LogOut, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  inviteUser,
  resendInvite,
  cancelInvite,
  updateUserRole,
  updateUserModules,
  updateUserMenus,
  suspendUser,
  unsuspendUser,
  deleteUser,
  listUsersAdmin,
  listUserAuditLogs,
} from "@/lib/users.functions";
import { createInvestorAccess } from "@/lib/temp-investors.functions";
import { MENU_CATALOG, MENU_BY_KEY, menusForModule } from "@/lib/menu-catalog";

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
  const updateMenusFn = useServerFn(updateUserMenus);
  const suspendFn = useServerFn(suspendUser);
  const unsuspendFn = useServerFn(unsuspendUser);
  const deleteUserFn = useServerFn(deleteUser);
  const listFn = useServerFn(listUsersAdmin);
  const listLogsFn = useServerFn(listUserAuditLogs);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [suspendMode, setSuspendMode] = useState<"indef" | "days">("indef");
  const [suspendDays, setSuspendDays] = useState<number>(30);
  const [investorOpen, setInvestorOpen] = useState(false);
  const [investorCreds, setInvestorCreds] = useState<{ email: string; password: string; expires_at: string; link: string } | null>(null);
  const [investorLoading, setInvestorLoading] = useState(false);
  const createInvestorFn = useServerFn(createInvestorAccess);

  // form state
  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRole, setFRole] = useState<string>("editor");
  const [fModules, setFModules] = useState<string[]>(["sesmt"]);
  const [fMenus, setFMenus] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/app" });
  }, [loading, isAdmin, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["users-admin"],
    enabled: isAdmin && mfaSatisfied,
    queryFn: () => listFn(),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["users-audit-logs"],
    enabled: isAdmin && mfaSatisfied,
    queryFn: () => listLogsFn({ data: { limit: 200 } }),
  });

  function toggleModule(setter: (m: string[]) => void, current: string[], m: string) {
    if (current.includes(m)) setter(current.filter((x) => x !== m));
    else setter([...current, m]);
  }

  function toggleMenu(key: string) {
    setFMenus((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  }

  function toggleAllMenusOfModule(mod: string, on: boolean) {
    const keys = menusForModule(mod as any).map((m) => m.key);
    setFMenus((prev) => {
      const set = new Set(prev);
      keys.forEach((k) => on ? set.add(k) : set.delete(k));
      return Array.from(set);
    });
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
      // Salva também os menus granulares (vazio = libera tudo dentro dos módulos)
      await updateMenusFn({ data: { user_id: editing.id, menus: fMenus } });
      toast.success("Usuário atualizado");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["users-admin"] });
      qc.invalidateQueries({ queryKey: ["users-audit-logs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmitting(false); }
  }

  async function handleSuspend() {
    if (!suspendTarget) return;
    setSubmitting(true);
    try {
      const hours = suspendMode === "indef" ? undefined : Math.max(1, suspendDays) * 24;
      await suspendFn({ data: { user_id: suspendTarget.id, hours } });
      toast.success(suspendMode === "indef" ? "Usuário suspenso (indefinido)" : `Usuário suspenso por ${suspendDays} dias`);
      setSuspendOpen(false);
      qc.invalidateQueries({ queryKey: ["users-admin"] });
      qc.invalidateQueries({ queryKey: ["users-audit-logs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmitting(false); }
  }

  const setRoleMut = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) =>
      updateRoleFn({ data: { user_id, role: role as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-admin"] });
      qc.invalidateQueries({ queryKey: ["users-audit-logs"] });
      toast.success("Papel atualizado");
    },
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

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="h-3.5 w-3.5 mr-1" /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
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
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-40">Papel</TableHead>
              <TableHead>Módulos liberados</TableHead>
              <TableHead className="w-24 text-center">MFA</TableHead>
              <TableHead className="w-40">Trocar papel</TableHead>
              <TableHead className="w-36 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>}
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
                    {u.suspended ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Suspenso
                        {u.banned_until && new Date(u.banned_until).getFullYear() < 3000 && (
                          <span className="ml-1">até {new Date(u.banned_until).toLocaleDateString("pt-BR")}</span>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-green-500 text-green-700">Ativo</Badge>
                    )}
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
                        {u.menus && u.menus.length > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            +{u.menus.length} menus
                          </Badge>
                        )}
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
                        setFMenus(u.menus ?? []);
                        setEditOpen(true);
                      }}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    {u.suspended ? (
                      <Button size="icon" variant="ghost" title="Reativar"
                        onClick={async () => {
                          try {
                            await unsuspendFn({ data: { user_id: u.id } });
                            toast.success("Usuário reativado");
                            qc.invalidateQueries({ queryKey: ["users-admin"] });
                            qc.invalidateQueries({ queryKey: ["users-audit-logs"] });
                          } catch (e: any) { toast.error(e.message); }
                        }}>
                        <Play className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" title="Suspender"
                        onClick={() => {
                          setSuspendTarget(u);
                          setSuspendMode("indef");
                          setSuspendDays(30);
                          setSuspendOpen(true);
                        }}>
                        <Ban className="h-3.5 w-3.5 text-amber-600" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Remover ${u.email}?`)) return;
                        try {
                          await deleteUserFn({ data: { user_id: u.id } });
                          toast.success("Usuário removido");
                          qc.invalidateQueries({ queryKey: ["users-admin"] });
                          qc.invalidateQueries({ queryKey: ["users-audit-logs"] });
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
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryView logs={logsData?.logs ?? []} loading={logsLoading} users={data?.users ?? []} />
        </TabsContent>
      </Tabs>

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
            {fRole !== "admin" && (
              <div>
                <Label>Menus específicos (granular)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Deixe tudo em branco em um módulo para liberar TODOS os menus daquele módulo. Marque itens específicos para restringir.
                </p>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {fModules.map((mod) => {
                    const menus = menusForModule(mod as any);
                    if (menus.length === 0) return null;
                    const allOn = menus.every((m) => fMenus.includes(m.key));
                    return (
                      <div key={mod} className="border rounded p-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {MODULES.find((x) => x.value === mod)?.label ?? mod}
                          </span>
                          <button type="button" className="text-[11px] underline text-blue-700"
                            onClick={() => toggleAllMenusOfModule(mod, !allOn)}>
                            {allOn ? "Limpar (libera todos)" : "Marcar todos"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {menus.map((m) => (
                            <label key={m.key} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-muted/40 cursor-pointer">
                              <Checkbox checked={fMenus.includes(m.key)} onCheckedChange={() => toggleMenu(m.key)} />
                              <span>{m.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Suspender */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Suspender usuário</DialogTitle>
            <DialogDescription>{suspendTarget?.email} ficará impedido de fazer login.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-muted/40">
              <input type="radio" name="suspmode" checked={suspendMode === "indef"} onChange={() => setSuspendMode("indef")} className="mt-1" />
              <div>
                <div className="text-sm font-medium">Indefinido</div>
                <div className="text-xs text-muted-foreground">Bloqueia até você reativar manualmente.</div>
              </div>
            </label>
            <label className="flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-muted/40">
              <input type="radio" name="suspmode" checked={suspendMode === "days"} onChange={() => setSuspendMode("days")} className="mt-1" />
              <div className="flex-1">
                <div className="text-sm font-medium">Por prazo determinado</div>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" min={1} max={3650} value={suspendDays}
                    disabled={suspendMode !== "days"}
                    onChange={(e) => setSuspendDays(parseInt(e.target.value || "0", 10) || 0)}
                    className="w-24" />
                  <span className="text-xs text-muted-foreground">dias</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {[7, 30, 90].map((d) => (
                    <Button key={d} type="button" size="sm" variant="outline"
                      disabled={suspendMode !== "days"}
                      onClick={() => setSuspendDays(d)}>{d}d</Button>
                  ))}
                </div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendOpen(false)}>Cancelar</Button>
            <Button onClick={handleSuspend} disabled={submitting || (suspendMode === "days" && suspendDays < 1)}>
              {submitting ? "Suspendendo..." : "Suspender"}
            </Button>
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

const ACTION_LABEL: Record<string, string> = {
  SUSPENDED: "suspendeu",
  UNSUSPENDED: "reativou",
  DELETED: "removeu",
  ROLE_CHANGED: "alterou papel de",
  MODULES_UPDATED: "atualizou módulos de",
  MENUS_UPDATED: "atualizou menus de",
  INSERT: "criou registro em",
  UPDATE: "atualizou registro em",
  DELETE: "apagou registro em",
};

function HistoryView({ logs, loading, users }: { logs: any[]; loading: boolean; users: any[] }) {
  const byId = new Map(users.map((u) => [u.id, u]));
  if (loading) return <div className="text-sm text-muted-foreground p-6">Carregando histórico...</div>;
  if (logs.length === 0) return <div className="text-sm text-muted-foreground p-6">Nenhum evento registrado ainda.</div>;
  return (
    <div className="rounded-md border bg-card divide-y">
      {logs.map((log) => {
        const target = byId.get(log.record_id);
        const actionLabel = ACTION_LABEL[log.action] ?? log.action.toLowerCase();
        const targetLabel = target ? (target.full_name || target.email) : (log.record_id?.slice(0, 8) ?? "—");
        const payload = log.new_data ?? log.old_data;
        return (
          <div key={log.id} className="px-4 py-3 text-sm flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div>
                <span className="font-medium">{log.user_email ?? "Sistema"}</span>{" "}
                <span className="text-muted-foreground">{actionLabel}</span>{" "}
                <span className="font-medium">{targetLabel}</span>
                {log.table_name && log.table_name !== "users_admin" && (
                  <span className="text-xs text-muted-foreground ml-1">({log.table_name})</span>
                )}
              </div>
              {payload && typeof payload === "object" && (
                <pre className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                  {JSON.stringify(payload, null, 0)}
                </pre>
              )}
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(log.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
        );
      })}
    </div>
  );
}