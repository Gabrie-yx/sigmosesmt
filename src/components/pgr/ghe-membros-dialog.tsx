import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, UserMinus, Search, X, Briefcase, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

type Emp = { id: string; nome: string; foto_url: string | null; role_id: string | null };
type Member = { employee_id: string; origem: "CARGO" | "OVERRIDE"; nome: string; foto_url: string | null; role_name: string | null };

export function GheMembrosDialog({
  open, onOpenChange, gheId, gheLabel,
}: { open: boolean; onOpenChange: (v: boolean) => void; gheId: string; gheLabel: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("membros");
  const [busca, setBusca] = useState("");
  const [novoEmp, setNovoEmp] = useState("");
  const [motivo, setMotivo] = useState("");
  const [novoCargo, setNovoCargo] = useState("");

  // Membros efetivos deste GHE (via view)
  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ["ghe_membros", gheId],
    enabled: open && !!gheId,
    queryFn: async () => {
      // 1) Buscar membros da view (sem embed — view não tem FK declarada).
      const { data: rows, error } = await sb
        .from("pgr_ghe_membros_efetivos")
        .select("employee_id, origem")
        .eq("ghe_id", gheId);
      if (error) throw error;
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.employee_id))).filter(Boolean);
      if (ids.length === 0) return [];
      // 2) Buscar funcionários + cargo em uma query separada.
      const { data: emps, error: e2 } = await sb
        .from("employees")
        .select("id, nome, foto_url, role_id, roles:role_id(name)")
        .in("id", ids);
      if (e2) throw e2;
      const empMap = new Map<string, any>((emps ?? []).map((e: any) => [e.id, e]));
      return (rows ?? [])
        .map((r: any) => {
          const e = empMap.get(r.employee_id);
          return {
            employee_id: r.employee_id,
            origem: r.origem,
            nome: e?.nome ?? "—",
            foto_url: e?.foto_url ?? null,
            role_name: e?.roles?.name ?? null,
          } as Member;
        })
        .sort((a: Member, b: Member) => a.nome.localeCompare(b.nome));
    },
  });

  // Cargos vinculados a este GHE (por roles.ghe_id)
  const { data: cargos = [] } = useQuery({
    queryKey: ["ghe_cargos", gheId],
    enabled: open && !!gheId,
    queryFn: async () => {
      const { data } = await sb.from("roles").select("id, name").eq("ghe_id", gheId).eq("ativo", true).order("name");
      return data ?? [];
    },
  });

  // Cargos ativos disponíveis para vincular (sem GHE ou em outro GHE)
  const { data: cargosDisponiveis = [] } = useQuery<{ id: string; name: string; ghe_id: string | null }[]>({
    queryKey: ["roles_disponiveis_ghe", gheId],
    enabled: open && tab === "cargos",
    queryFn: async () => {
      const { data } = await sb
        .from("roles")
        .select("id, name, ghe_id")
        .eq("ativo", true)
        .neq("ghe_id", gheId)
        .order("name");
      return data ?? [];
    },
  });

  const invalidateCargos = () => {
    qc.invalidateQueries({ queryKey: ["ghe_cargos", gheId] });
    qc.invalidateQueries({ queryKey: ["roles_disponiveis_ghe", gheId] });
    qc.invalidateQueries({ queryKey: ["ghe_membros", gheId] });
    qc.invalidateQueries({ queryKey: ["pgr_ghe_membros_all"] });
    qc.invalidateQueries({ queryKey: ["pgr_ghes"] });
  };

  const vincularCargo = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await sb.from("roles").update({ ghe_id: gheId }).eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateCargos(); setNovoCargo(""); toast.success("Cargo vinculado ao GHE"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const desvincularCargo = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await sb.from("roles").update({ ghe_id: null }).eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateCargos(); toast.success("Cargo desvinculado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Todos os funcionários ativos pra autocomplete de override
  const { data: allEmps = [] } = useQuery<Emp[]>({
    queryKey: ["employees_lite_ativos"],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb.from("employees").select("id, nome, foto_url, role_id").eq("status", "ATIVO").order("nome");
      return data ?? [];
    },
  });

  // Overrides existentes deste GHE
  const { data: overrides = [] } = useQuery({
    queryKey: ["ghe_overrides", gheId],
    enabled: open && !!gheId,
    queryFn: async () => {
      const { data } = await sb
        .from("pgr_ghe_membros_override")
        .select("id, employee_id, acao, motivo, created_at, employees:employee_id(nome)")
        .eq("ghe_id", gheId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const addOverride = useMutation({
    mutationFn: async ({ employee_id, acao }: { employee_id: string; acao: "INCLUIR" | "EXCLUIR" }) => {
      const { data: u } = await sb.auth.getUser();
      const { error } = await sb.from("pgr_ghe_membros_override").insert({
        employee_id, ghe_id: gheId, acao, motivo: motivo || null, created_by: u?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ghe_membros", gheId] });
      qc.invalidateQueries({ queryKey: ["ghe_overrides", gheId] });
      qc.invalidateQueries({ queryKey: ["pgr_ghe_membros_all"] });
      setNovoEmp(""); setMotivo("");
      toast.success("Override aplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeOverride = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("pgr_ghe_membros_override").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ghe_membros", gheId] });
      qc.invalidateQueries({ queryKey: ["ghe_overrides", gheId] });
      qc.invalidateQueries({ queryKey: ["pgr_ghe_membros_all"] });
      toast.success("Override removido");
    },
  });

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return members;
    return members.filter((m) => m.nome.toLowerCase().includes(b) || (m.role_name ?? "").toLowerCase().includes(b));
  }, [members, busca]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-rose-700" />
            Membros do {gheLabel}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="membros">Membros ({members.length})</TabsTrigger>
            <TabsTrigger value="cargos">Cargos ({cargos.length})</TabsTrigger>
            <TabsTrigger value="overrides">Exceções ({overrides.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="membros" className="flex-1 overflow-y-auto mt-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar por nome ou cargo…" className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            {isLoading ? (
              <p className="text-center text-slate-500 py-6">Carregando…</p>
            ) : filtrados.length === 0 ? (
              <p className="text-center text-slate-500 py-6 text-sm">
                {members.length === 0 ? "Nenhum membro vinculado ainda. Vincule cargos a este GHE ou adicione uma exceção." : "Nenhum resultado."}
              </p>
            ) : (
              <div className="space-y-1.5">
                {filtrados.map((m) => (
                  <div key={m.employee_id} className="flex items-center gap-3 p-2 border rounded-md hover:bg-slate-50">
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden text-xs font-bold text-slate-600 shrink-0">
                      {m.foto_url ? <img src={m.foto_url} alt={m.nome} className="h-full w-full object-cover" /> : m.nome.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.nome}</p>
                      {m.role_name && <p className="text-xs text-slate-500 truncate">{m.role_name}</p>}
                    </div>
                    <Badge variant={m.origem === "CARGO" ? "outline" : "secondary"} className="text-[10px]">
                      {m.origem === "CARGO" ? "por cargo" : "exceção"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cargos" className="flex-1 overflow-y-auto mt-3">
            <p className="text-xs text-slate-500 mb-2">
              Estes cargos têm <strong>{gheLabel}</strong> como GHE padrão. Todo funcionário ativo nesses cargos entra automaticamente.
            </p>

            <Card className="p-3 space-y-2 bg-emerald-50/40 border-emerald-200 mb-3">
              <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" /> Vincular novo cargo
              </p>
              <div className="flex gap-2">
                <Select value={novoCargo} onValueChange={setNovoCargo}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione um cargo…" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {cargosDisponiveis.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-slate-400 text-center">Nenhum cargo disponível.</div>
                    ) : cargosDisponiveis.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.ghe_id ? " (já em outro GHE)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1 shrink-0"
                  disabled={!novoCargo || vincularCargo.isPending}
                  onClick={() => vincularCargo.mutate(novoCargo)}
                >
                  <Link2 className="h-3.5 w-3.5" /> Vincular
                </Button>
              </div>
              <p className="text-[10px] text-emerald-800/70">
                Vincular um cargo que já está em outro GHE vai movê-lo para cá.
              </p>
            </Card>

            {cargos.length === 0 ? (
              <Card className="p-6 text-center text-sm text-slate-500">
                <Briefcase className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Nenhum cargo vinculado ainda.
              </Card>
            ) : (
              <div className="space-y-1">
                {cargos.map((c: { id: string; name: string }) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 border rounded text-sm group">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 truncate">{c.name}</span>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      disabled={desvincularCargo.isPending}
                      onClick={() => {
                        if (confirm(`Desvincular "${c.name}" deste GHE?`)) desvincularCargo.mutate(c.id);
                      }}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="overrides" className="flex-1 overflow-y-auto mt-3 space-y-3">
            <Card className="p-3 space-y-2 bg-amber-50/40 border-amber-200">
              <p className="text-xs font-semibold text-amber-900">Adicionar exceção manual</p>
              <Select value={novoEmp} onValueChange={setNovoEmp}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione um funcionário…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {allEmps.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Motivo (opcional, ex: alocado temporariamente)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="bg-white" />
              <div className="flex gap-2">
                <Button
                  size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1"
                  disabled={!novoEmp || addOverride.isPending}
                  onClick={() => addOverride.mutate({ employee_id: novoEmp, acao: "INCLUIR" })}
                >
                  <UserPlus className="h-3.5 w-3.5" />Incluir neste GHE
                </Button>
                <Button
                  size="sm" variant="outline" className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-50 gap-1"
                  disabled={!novoEmp || addOverride.isPending}
                  onClick={() => addOverride.mutate({ employee_id: novoEmp, acao: "EXCLUIR" })}
                >
                  <UserMinus className="h-3.5 w-3.5" />Excluir deste GHE
                </Button>
              </div>
            </Card>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1.5">Exceções ativas</p>
              {overrides.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma exceção cadastrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {overrides.map((o: { id: string; acao: string; motivo: string | null; employees: { nome: string } | null }) => (
                    <div key={o.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                      <Badge variant={o.acao === "INCLUIR" ? "default" : "destructive"} className="text-[10px]">
                        {o.acao === "INCLUIR" ? "+ INCLUI" : "− EXCLUI"}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{o.employees?.nome ?? "—"}</p>
                        {o.motivo && <p className="text-xs text-slate-500 truncate">{o.motivo}</p>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeOverride.mutate(o.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}