// Painel SESMT/Admin da Portaria (desktop).
// Abas: KPIs · Visitantes · Saídas Funcionários · Auditoria · Cadastros.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Users, UserCheck, ShieldAlert, Building2, Clock, Search, LogOut, DoorOpen, Trash2, Loader2 } from "lucide-react";
import { formatCPFFromDigits } from "@/lib/validators/cpf";
import { useAuth } from "@/hooks/use-auth";
import { deletePortariaVisita } from "@/lib/portaria/foto-ocr.functions";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/portaria/controle")({
  component: ControleSesmtPage,
  head: () => ({
    meta: [
      { title: "Painel SESMT — Portaria · SIGMO" },
      { name: "description", content: "Painel de controle SESMT da portaria — visitas, saídas de funcionários, auditoria e cadastros." },
    ],
  }),
});

function ControleSesmtPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/app/portaria/controle-entrada" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600">
          <ArrowLeft className="h-3.5 w-3.5" /> Portaria
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-slate-900 text-white grid place-items-center shadow"><BarChart3 className="h-5 w-5" /></div>
        <div>
          <h1 className="heading-display text-3xl md:text-4xl text-slate-900">Painel de Controle — Portaria</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">SESMT · Visão administrativa</p>
        </div>
      </div>

      <KpisSection />

      <Tabs defaultValue="visitas" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="visitas"><Users className="h-3.5 w-3.5 mr-1" /> Visitantes</TabsTrigger>
          <TabsTrigger value="saidas"><UserCheck className="h-3.5 w-3.5 mr-1" /> Saídas Func.</TabsTrigger>
          <TabsTrigger value="auditoria"><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Auditoria</TabsTrigger>
          <TabsTrigger value="cadastros"><Building2 className="h-3.5 w-3.5 mr-1" /> Cadastros</TabsTrigger>
        </TabsList>
        <TabsContent value="visitas"><VisitasTab /></TabsContent>
        <TabsContent value="saidas"><SaidasFuncTab /></TabsContent>
        <TabsContent value="auditoria"><AuditoriaTab /></TabsContent>
        <TabsContent value="cadastros"><CadastrosTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function KpisSection() {
  const { data } = useQuery({
    queryKey: ["portaria-kpis-sesmt"],
    queryFn: async () => {
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      const iso = hoje.toISOString();
      const [dentro, entradasHoje, pendSaidaFunc, saidasFuncHoje] = await Promise.all([
        supabase.from("portaria_visitas").select("*", { count: "exact", head: true }).eq("status","DENTRO"),
        supabase.from("portaria_visitas").select("*", { count: "exact", head: true }).gte("entrada_at", iso),
        (async () => {
          const desde = new Date(); desde.setDate(desde.getDate() - 3);
          const { data: sd } = await supabase.from("employee_saidas_expediente")
            .select("id").gte("data", desde.toISOString().slice(0,10));
          const ids = (sd ?? []).map((s: any) => s.id);
          if (ids.length === 0) return { count: 0 };
          const { data: vd } = await supabase.from("portaria_saidas_funcionarios")
            .select("saida_expediente_id").in("saida_expediente_id", ids);
          const validadas = new Set((vd ?? []).map((v: any) => v.saida_expediente_id));
          return { count: ids.filter((i) => !validadas.has(i)).length };
        })(),
        supabase.from("portaria_saidas_funcionarios").select("*", { count: "exact", head: true }).gte("validada_at", iso),
      ]);
      return {
        dentro: dentro.count ?? 0,
        entradasHoje: entradasHoje.count ?? 0,
        saidasFuncPendentes: pendSaidaFunc.count,
        saidasFuncHoje: saidasFuncHoje.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
  const cards = [
    { label: "Dentro agora", value: data?.dentro ?? 0, icon: DoorOpen, color: "emerald" },
    { label: "Entradas hoje", value: data?.entradasHoje ?? 0, icon: Users, color: "slate" },
    { label: "Saídas func. hoje", value: data?.saidasFuncHoje ?? 0, icon: LogOut, color: "blue" },
    { label: "Saídas s/ validação", value: data?.saidasFuncPendentes ?? 0, icon: ShieldAlert, color: (data?.saidasFuncPendentes ?? 0) > 0 ? "red" : "slate" },
  ] as const;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((k) => (
        <div key={k.label} className={`rounded-2xl bg-white border-2 border-slate-200 p-4 shadow-sm`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{k.label}</p>
            <k.icon className={`h-4 w-4 text-${k.color}-500`} />
          </div>
          <p className={`font-black text-3xl mt-1 text-${k.color}-600`}>{k.value}</p>
        </div>
      ))}
    </div>
  );
}

function VisitasTab() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const deleteFn = useServerFn(deletePortariaVisita);
  const del = useMutation({
    mutationFn: (visitaId: string) => deleteFn({ data: { visitaId } }),
    onSuccess: () => {
      toast.success("Visita excluída");
      qc.invalidateQueries({ queryKey: ["portaria-visitas-admin"] });
      qc.invalidateQueries({ queryKey: ["portaria-kpis-sesmt"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir"),
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "DENTRO" | "SAIDA_VALIDADA" | "CANCELADA">("");
  const [inicio, setInicio] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10); });
  const [fim, setFim] = useState<string>(() => new Date().toISOString().slice(0,10));

  const { data, isLoading } = useQuery({
    queryKey: ["portaria-visitas-admin", inicio, fim, status],
    queryFn: async () => {
      let q = supabase.from("portaria_visitas")
        .select(`id,tipo,status,entrada_at,saida_at,motivo_visita,
          pessoa:pessoa_id(nome,cpf),
          veiculo:veiculo_id(placa,modelo),
          empresa:empresa_visitada_id(name)`)
        .gte("entrada_at", `${inicio}T00:00:00`)
        .lte("entrada_at", `${fim}T23:59:59`)
        .order("entrada_at", { ascending: false })
        .limit(500);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtradas = useMemo(() => {
    if (!q.trim()) return data ?? [];
    const n = q.trim().toLowerCase();
    return (data ?? []).filter((v: any) =>
      v.pessoa?.nome?.toLowerCase().includes(n) ||
      v.pessoa?.cpf?.includes(n) ||
      v.veiculo?.placa?.toLowerCase().includes(n) ||
      v.empresa?.name?.toLowerCase().includes(n)
    );
  }, [data, q]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">De</label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 mt-1" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Até</label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 mt-1" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="h-9 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">Todos</option>
            <option value="DENTRO">Dentro</option>
            <option value="SAIDA_VALIDADA">Saída validada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CPF, placa, empresa…" className="h-10 pl-10" />
      </div>
      <div className="rounded-2xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Pessoa</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Empresa</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Placa</th>
              <th className="text-left px-3 py-2">Entrada</th>
              <th className="text-left px-3 py-2">Saída</th>
              <th className="text-left px-3 py-2">Status</th>
              {isAdmin && <th className="text-right px-3 py-2 w-16">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={isAdmin ? 7 : 6} className="p-6 text-center text-slate-400">Carregando…</td></tr>}
            {!isLoading && filtradas.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} className="p-6 text-center text-slate-400">Nada por aqui</td></tr>}
            {filtradas.map((v: any) => (
              <tr key={v.id} className={v.status === "DENTRO" ? "bg-red-50/40" : ""}>
                <td className="px-3 py-2">
                  <p className="font-bold">{v.pessoa?.nome}</p>
                  <p className="text-[10px] text-slate-500">{v.pessoa?.cpf ? formatCPFFromDigits(v.pessoa.cpf) : ""} · {v.tipo}</p>
                </td>
                <td className="px-3 py-2 hidden md:table-cell">{v.empresa?.name ?? "—"}</td>
                <td className="px-3 py-2 hidden md:table-cell">{v.veiculo?.placa ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{new Date(v.entrada_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2 text-xs">{v.saida_at ? new Date(v.saida_at).toLocaleString("pt-BR") : <span className="text-red-600 font-black">— Pendente</span>}</td>
                <td className="px-3 py-2"><StatusBadge status={v.status} /></td>
                {isAdmin && (
                  <td className="px-3 py-2 text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" title="Excluir visita (admin)">
                          {del.isPending && del.variables === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir visita de teste?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Vai apagar a visita de <b>{v.pessoa?.nome}</b> ({new Date(v.entrada_at).toLocaleString("pt-BR")}) e seus acompanhantes. A pessoa e o veículo cadastrados <b>ficam</b> no cadastro. Ação irreversível.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(v.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DENTRO: "bg-emerald-100 text-emerald-800",
    SAIDA_VALIDADA: "bg-slate-100 text-slate-700",
    CANCELADA: "bg-red-100 text-red-700",
  };
  return <span className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 ${map[status] ?? "bg-slate-100"}`}>{status.replace("_"," ")}</span>;
}

function SaidasFuncTab() {
  const [inicio, setInicio] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10); });
  const [fim, setFim] = useState<string>(() => new Date().toISOString().slice(0,10));
  const { data, isLoading } = useQuery({
    queryKey: ["portaria-sesmt-saidas", inicio, fim],
    queryFn: async () => {
      const { data: saidas } = await supabase.from("employee_saidas_expediente")
        .select("id, data, horario_saida, com_retorno, tipo, motivo, employee_id, employees:employee_id(nome,cpf,matricula)")
        .gte("data", inicio).lte("data", fim)
        .order("data", { ascending: false }).order("horario_saida", { ascending: false });
      const ids = (saidas ?? []).map((s: any) => s.id);
      let vmap = new Map<string, any>();
      if (ids.length) {
        const { data: vs } = await supabase.from("portaria_saidas_funcionarios")
          .select("saida_expediente_id, validada_at, observacao_portaria").in("saida_expediente_id", ids);
        (vs ?? []).forEach((v: any) => vmap.set(v.saida_expediente_id, v));
      }
      return (saidas ?? []).map((s: any) => ({ ...s, validacao: vmap.get(s.id) ?? null }));
    },
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 max-w-md">
        <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
      </div>
      <div className="rounded-2xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Funcionário</th>
              <th className="text-left px-3 py-2">Autorização</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Validada portaria</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Carregando…</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Nada por aqui</td></tr>}
            {(data ?? []).map((s: any) => (
              <tr key={s.id} className={!s.validacao ? "bg-red-50/40" : ""}>
                <td className="px-3 py-2">
                  <p className="font-bold">{s.employees?.nome}</p>
                  <p className="text-[10px] text-slate-500">{s.employees?.cpf ? formatCPFFromDigits(s.employees.cpf) : ""} · Mat. {s.employees?.matricula ?? "—"}</p>
                </td>
                <td className="px-3 py-2 text-xs">{new Date(s.data + "T00:00:00").toLocaleDateString("pt-BR")} às {s.horario_saida?.slice(0,5)}</td>
                <td className="px-3 py-2 text-xs">{s.tipo} · {s.com_retorno ? "c/ retorno" : "s/ retorno"}</td>
                <td className="px-3 py-2 text-xs">{s.validacao ? new Date(s.validacao.validada_at).toLocaleString("pt-BR") : <span className="text-red-600 font-black">— Não validou</span>}</td>
                <td className="px-3 py-2">
                  {s.validacao
                    ? <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5">Validada</span>
                    : <span className="text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-800 rounded-full px-2 py-0.5">Pendente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditoriaTab() {
  const [inicio, setInicio] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0,10); });
  const { data, isLoading } = useQuery({
    queryKey: ["portaria-auditoria", inicio],
    queryFn: async () => {
      const { data, error } = await supabase.from("portaria_auditoria")
        .select("id, entidade, entidade_id, acao, snapshot_json, user_id, criado_em")
        .gte("criado_em", `${inicio}T00:00:00`)
        .order("criado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Desde</label>
        <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 mt-1" />
      </div>
      <div className="rounded-2xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Quando</th>
              <th className="text-left px-3 py-2">Entidade</th>
              <th className="text-left px-3 py-2">Ação</th>
              <th className="text-left px-3 py-2">Usuário</th>
              <th className="text-left px-3 py-2">Snapshot</th>
            </tr>
          </thead>
          <tbody className="divide-y font-mono text-[11px]">
            {isLoading && <tr><td colSpan={5} className="p-6 text-center text-slate-400 font-sans">Carregando…</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400 font-sans">Sem registros</td></tr>}
            {(data ?? []).map((r: any) => (
              <tr key={r.id}>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.criado_em).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">{r.entidade}</td>
                <td className="px-3 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5">{r.acao}</span></td>
                <td className="px-3 py-2 text-[10px]">{r.user_id?.slice(0,8) ?? "—"}</td>
                <td className="px-3 py-2 max-w-xs truncate" title={JSON.stringify(r.snapshot_json)}>{JSON.stringify(r.snapshot_json).slice(0, 120)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CadastrosTab() {
  return (
    <div className="rounded-2xl bg-white border-2 border-dashed border-slate-300 p-8 text-center">
      <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
      <p className="text-sm font-black uppercase tracking-widest text-slate-500">Cadastros de fornecedores recorrentes e bloqueios</p>
      <p className="text-xs text-slate-400 mt-1">Fase 2 — o schema já suporta, a UI vem em seguida.</p>
    </div>
  );
}