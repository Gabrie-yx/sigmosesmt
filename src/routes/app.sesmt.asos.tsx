import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Stethoscope, HeartPulse, ShieldAlert, CalendarClock, CheckCircle2, AlertTriangle,
  Building2, UserPlus, Hospital, Plus, MoreVertical, Pencil, Trash2, ArrowRight,
  ClipboardList, FileText, Loader2, ArrowLeft, Clock, Activity,
} from "lucide-react";
import { Sparkles, PlayCircle, LogIn, ClipboardCheck, Timer } from "lucide-react";
import { AsoRapidoDialog } from "@/components/aso/aso-rapido-dialog";
import { AnamneseDialog } from "@/components/aso/anamnese-dialog";

// Módulo central de ASO (NR-07 / PCMSO)
// Painel unificado: KPIs semafóricos + Convocações + Registrados + Coordenador PCMSO + Clínicas + Relatório Analítico
// Palette: slate/white + emerald (OK) / amber (alerta) / red (crítico) — mesmo dark do SIGMO

export const Route = createFileRoute("/app/sesmt/asos")({
  head: () => ({
    meta: [
      { title: "SIGMO — Painel de ASO (PCMSO / NR-07)" },
      { name: "description", content: "Painel unificado de ASO: vencimentos, convocações, coordenador PCMSO, clínicas credenciadas e relatório analítico anual." },
      { property: "og:title", content: "SIGMO — Painel de ASO" },
      { property: "og:description", content: "Gestão centralizada do PCMSO integrada ao SGI-SST." },
    ],
  }),
  component: AsoHubPage,
});

// ---------- Types ----------
type Coordenador = {
  id: string;
  company_id: string;
  nome: string;
  crm: string;
  crm_uf: string;
  especialidade: string | null;
  email: string | null;
  telefone: string | null;
  contrato_inicio: string | null;
  contrato_fim: string | null;
  ativo: boolean;
  observacoes: string | null;
};
type Clinica = {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  contato_responsavel: string | null;
  especialidades: string[];
  tipos_exame: string[];
  ativa: boolean;
  observacoes: string | null;
};

function AsoHubPage() {
  const [rapidoOpen, setRapidoOpen] = useState(false);
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <Header onAsoRapido={() => setRapidoOpen(true)} />
      <Tabs defaultValue="painel">
        <TabsList className="flex-wrap h-auto bg-slate-900/60 border border-white/10">
          <TabsTrigger value="painel"><Activity className="h-4 w-4 mr-1.5" /> Painel</TabsTrigger>
          <TabsTrigger value="atendimento"><Timer className="h-4 w-4 mr-1.5" /> Atendimento</TabsTrigger>
          <TabsTrigger value="registrados"><ClipboardList className="h-4 w-4 mr-1.5" /> Registrados</TabsTrigger>
          <TabsTrigger value="coordenador"><UserPlus className="h-4 w-4 mr-1.5" /> Coordenador PCMSO</TabsTrigger>
          <TabsTrigger value="clinicas"><Hospital className="h-4 w-4 mr-1.5" /> Clínicas</TabsTrigger>
          <TabsTrigger value="analitico"><FileText className="h-4 w-4 mr-1.5" /> Relatório Analítico</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="pt-4 space-y-4"><PainelTab /></TabsContent>
        <TabsContent value="atendimento" className="pt-4"><AtendimentoTab /></TabsContent>
        <TabsContent value="registrados" className="pt-4"><RegistradosTab /></TabsContent>
        <TabsContent value="coordenador" className="pt-4"><CoordenadorTab /></TabsContent>
        <TabsContent value="clinicas" className="pt-4"><ClinicasTab /></TabsContent>
        <TabsContent value="analitico" className="pt-4"><AnaliticoTab /></TabsContent>
      </Tabs>
      <AsoRapidoDialog open={rapidoOpen} onOpenChange={setRapidoOpen} />
    </div>
  );
}

function Header({ onAsoRapido }: { onAsoRapido: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <Link to="/app/hoje" className="text-slate-400 hover:text-white inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Hoje
        </Link>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30 grid place-items-center shrink-0">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-white leading-tight">Painel de ASO — PCMSO / NR-07</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Centro operacional dos exames ocupacionais: vencimentos, convocações, coordenador responsável, clínicas credenciadas e relatório anual (NR-07 item 7.6.1).
            </p>
          </div>
        </div>
        <Button onClick={onAsoRapido} className="shrink-0 bg-emerald-600 hover:bg-emerald-500 gap-1.5">
          <Sparkles className="h-4 w-4" /> ASO Rápido
        </Button>
      </div>
    </div>
  );
}

// ---------- Painel (KPIs semafóricos + agenda) ----------
function PainelTab() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["asos-kpis"],
    queryFn: async () => {
      const today = new Date();
      const in30 = new Date(today.getTime() + 30 * 86400000);
      const in60 = new Date(today.getTime() + 60 * 86400000);
      const isoToday = today.toISOString().slice(0, 10);
      const iso30 = in30.toISOString().slice(0, 10);
      const iso60 = in60.toISOString().slice(0, 10);

      const [ativos, vencidos, venc30, venc3160, pendentes, coord] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "ATIVO"),
        supabase.from("employee_exams").select("employee_id", { count: "exact", head: true })
          .lt("data_vencimento", isoToday),
        supabase.from("employee_exams").select("employee_id", { count: "exact", head: true })
          .gte("data_vencimento", isoToday).lte("data_vencimento", iso30),
        supabase.from("employee_exams").select("employee_id", { count: "exact", head: true })
          .gt("data_vencimento", iso30).lte("data_vencimento", iso60),
        supabase.from("convocacoes_exames").select("id", { count: "exact", head: true })
          .eq("status", "PENDENTE"),
        supabase.from("pcmso_coordenadores").select("id", { count: "exact", head: true })
          .eq("ativo", true),
      ]);

      return {
        ativos: ativos.count ?? 0,
        vencidos: vencidos.count ?? 0,
        venc30: venc30.count ?? 0,
        venc3160: venc3160.count ?? 0,
        pendentes: pendentes.count ?? 0,
        coord: coord.count ?? 0,
      };
    },
  });

  const { data: agendaHoje } = useQuery({
    queryKey: ["asos-agenda-hoje"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("convocacoes_exames")
        .select("id, data_limite, tipos_exame, status, employees(id, nome, matricula)")
        .eq("status", "PENDENTE")
        .lte("data_limite", hoje)
        .order("data_limite", { ascending: true })
        .limit(15);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Ativos" value={kpis?.ativos} icon={HeartPulse} tone="slate" loading={isLoading} />
        <Kpi label="ASO vencido" value={kpis?.vencidos} icon={ShieldAlert} tone="red" loading={isLoading} />
        <Kpi label="Vence em 30d" value={kpis?.venc30} icon={CalendarClock} tone="amber" loading={isLoading} />
        <Kpi label="Vence 31–60d" value={kpis?.venc3160} icon={Clock} tone="amber-soft" loading={isLoading} />
        <Kpi label="Convoc. pendentes" value={kpis?.pendentes} icon={AlertTriangle} tone="amber" loading={isLoading} />
        <Kpi
          label="Coord. PCMSO"
          value={kpis?.coord}
          icon={UserPlus}
          tone={(kpis?.coord ?? 0) > 0 ? "emerald" : "red"}
          loading={isLoading}
          hint={(kpis?.coord ?? 0) > 0 ? "Ativo" : "Não cadastrado"}
        />
      </div>

      <Card className="p-4 bg-slate-900/40 border-white/10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-300" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Convocações no prazo ou vencidas</h2>
          </div>
          <Link to="/app/sesmt/convocacoes-aso">
            <Button size="sm" variant="outline" className="border-white/15 gap-1.5">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        {(agendaHoje?.length ?? 0) === 0 ? (
          <div className="text-sm text-emerald-300/80 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Nenhuma convocação vencida ou no prazo hoje.
          </div>
        ) : (
          <div className="grid gap-2">
            {agendaHoje?.map((r: any) => {
              const limite = r.data_limite ? new Date(r.data_limite) : null;
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const vencida = limite ? limite < today : false;
              return (
                <div key={r.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{r.employees?.nome ?? "—"}</div>
                    <div className="text-[11px] text-slate-400">
                      {(r.tipos_exame ?? []).join(", ") || "ASO"} • prazo {limite?.toLocaleDateString("pt-BR") ?? "—"}
                    </div>
                  </div>
                  {vencida ? (
                    <Badge className="bg-red-500/15 text-red-200 ring-1 ring-red-400/30 gap-1">
                      <AlertTriangle className="h-3 w-3" /> Vencida
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30">Hoje</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <QuickCard
          title="Convocar exames"
          desc="Abrir convocação e gerar guia de encaminhamento (breve: com QR)."
          to="/app/sesmt/convocacoes-aso"
          icon={ClipboardList}
        />
        <QuickCard
          title="Registrar ASO"
          desc="Vá ao perfil do colaborador → aba Saúde para anexar."
          to="/app/employees"
          icon={FileText}
        />
      </div>
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, tone, hint, loading,
}: {
  label: string; value: number | undefined; icon: any; tone: "slate" | "red" | "amber" | "amber-soft" | "emerald";
  hint?: string; loading?: boolean;
}) {
  const styles: Record<string, string> = {
    slate: "bg-slate-800/60 ring-slate-500/20 text-slate-200",
    red: "bg-red-500/10 ring-red-400/30 text-red-200",
    amber: "bg-amber-500/10 ring-amber-400/30 text-amber-200",
    "amber-soft": "bg-amber-500/[0.06] ring-amber-400/20 text-amber-100/90",
    emerald: "bg-emerald-500/10 ring-emerald-400/30 text-emerald-200",
  };
  return (
    <div className={`rounded-xl border border-white/10 ring-1 p-3 ${styles[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="text-2xl font-semibold text-white mt-1">
        {loading ? <Loader2 className="h-5 w-5 animate-spin opacity-70" /> : (value ?? 0)}
      </div>
      {hint && <div className="text-[10px] opacity-70 mt-0.5">{hint}</div>}
    </div>
  );
}

function QuickCard({ title, desc, to, icon: Icon }: { title: string; desc: string; to: string; icon: any }) {
  return (
    <Link to={to as any} className="block">
      <Card className="p-4 bg-slate-900/40 border-white/10 hover:border-emerald-400/30 transition group">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30 grid place-items-center">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="text-xs text-slate-400">{desc}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-300 transition" />
        </div>
      </Card>
    </Link>
  );
}

// ---------- Registrados ----------
function RegistradosTab() {
  const [busca, setBusca] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["asos-registrados"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_exams")
        .select("id, tipo_exame, natureza, aptidao, data_realizacao, data_vencimento, anexo_path, employees!inner(id, nome, matricula, status)")
        .order("data_realizacao", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return data ?? [];
    return (data ?? []).filter((r: any) =>
      (r.employees?.nome ?? "").toLowerCase().includes(t) ||
      (r.employees?.matricula ?? "").toLowerCase().includes(t)
    );
  }, [data, busca]);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Buscar por nome ou matrícula..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm bg-slate-900/60 border-white/10"
        />
      </div>
      {isLoading && <div className="text-sm text-slate-400">Carregando...</div>}
      <div className="grid gap-2">
        {filtrados.map((r: any) => {
          const venc = new Date(r.data_vencimento);
          const dias = Math.ceil((venc.getTime() - today.getTime()) / 86400000);
          const tone = dias < 0 ? "red" : dias <= 30 ? "amber" : "emerald";
          const toneClasses: Record<string, string> = {
            red: "border-red-400/30 bg-red-500/[0.04]",
            amber: "border-amber-400/30 bg-amber-500/[0.04]",
            emerald: "border-emerald-400/20 bg-emerald-500/[0.03]",
          };
          return (
            <div key={r.id} className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${toneClasses[tone]}`}>
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{r.employees?.nome ?? "—"}</div>
                <div className="text-[11px] text-slate-400">
                  {r.tipo_exame} • {r.natureza} • realizado {new Date(r.data_realizacao).toLocaleDateString("pt-BR")} • vence {venc.toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={
                  r.aptidao === "APTO" ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30" :
                  r.aptidao === "INAPTO" ? "bg-red-500/15 text-red-200 ring-1 ring-red-400/30" :
                  "bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/30"
                }>{r.aptidao}</Badge>
                <Badge variant="outline" className="text-xs border-white/15">
                  {dias < 0 ? `${Math.abs(dias)}d atrás` : `${dias}d`}
                </Badge>
                {r.employees?.id && (
                  <Link to="/app/employees/$id" params={{ id: r.employees.id }} search={{ tab: "saude" } as any}>
                    <Button size="sm" variant="outline" className="border-white/15">Abrir</Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {!isLoading && filtrados.length === 0 && (
          <div className="text-sm text-slate-400 py-8 text-center">Nenhum ASO encontrado.</div>
        )}
      </div>
    </div>
  );
}

// ---------- Atendimento (fila do dia) ----------
type Atend = {
  id: string;
  employee_id: string;
  status: string;
  natureza: string;
  prioridade: string;
  data_agendada: string;
  hora_agendada: string | null;
  chegou_em: string | null;
  chamado_em: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  observacoes: string | null;
  employees?: { id: string; nome: string; matricula: string | null } | null;
};

function AtendimentoTab() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [anamneseFor, setAnamneseFor] = useState<{ employeeId: string; atendimentoId: string; natureza: string } | null>(null);

  const { data: atendimentos, isLoading } = useQuery({
    queryKey: ["atendimentos-hoje"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("atendimentos_medicos" as any)
        .select("*, employees(id, nome, matricula)")
        .eq("data_agendada", hoje)
        .order("hora_agendada", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      return (data ?? []) as unknown as Atend[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: string; extra?: Record<string, any> }) => {
      const payload: any = { status, ...extra };
      const { error } = await supabase.from("atendimentos_medicos" as any).update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atendimentos-hoje"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atendimentos_medicos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atendimento removido"); qc.invalidateQueries({ queryKey: ["atendimentos-hoje"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const buckets = useMemo(() => {
    const acc: Record<string, Atend[]> = { AGENDADO: [], CHEGOU: [], EM_ATENDIMENTO: [], CONCLUIDO: [] };
    (atendimentos ?? []).forEach((a) => {
      const k = acc[a.status] ? a.status : "AGENDADO";
      acc[k].push(a);
    });
    return acc;
  }, [atendimentos]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Fila de atendimento — hoje</h2>
          <p className="text-[11px] text-slate-400">Registro em tempo real dos exames em curso na clínica. NR-07 item 7.5.1.</p>
        </div>
        <Button onClick={() => setNovoOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-500 gap-1.5">
          <Plus className="h-4 w-4" /> Novo atendimento
        </Button>
      </div>

      {isLoading && <div className="text-sm text-slate-400">Carregando…</div>}

      <div className="grid md:grid-cols-4 gap-3">
        <Coluna titulo="Agendado" tone="slate" count={buckets.AGENDADO.length}>
          {buckets.AGENDADO.map((a) => (
            <AtendCard key={a.id} a={a}
              onNext={() => updateStatus.mutate({ id: a.id, status: "CHEGOU", extra: { chegou_em: new Date().toISOString() } })}
              nextLabel="Chegou" nextIcon={LogIn}
              onDelete={() => excluir.mutate(a.id)}
            />
          ))}
          {buckets.AGENDADO.length === 0 && <Vazio texto="Sem agendados." />}
        </Coluna>
        <Coluna titulo="Aguardando" tone="amber" count={buckets.CHEGOU.length}>
          {buckets.CHEGOU.map((a) => (
            <AtendCard key={a.id} a={a}
              onNext={() => updateStatus.mutate({ id: a.id, status: "EM_ATENDIMENTO", extra: { iniciado_em: new Date().toISOString() } })}
              nextLabel="Iniciar" nextIcon={PlayCircle}
              extraAction={{ label: "Anamnese", icon: ClipboardCheck, onClick: () => setAnamneseFor({ employeeId: a.employee_id, atendimentoId: a.id, natureza: a.natureza }) }}
              onDelete={() => excluir.mutate(a.id)}
            />
          ))}
          {buckets.CHEGOU.length === 0 && <Vazio texto="Ninguém aguardando." />}
        </Coluna>
        <Coluna titulo="Em atendimento" tone="emerald" count={buckets.EM_ATENDIMENTO.length}>
          {buckets.EM_ATENDIMENTO.map((a) => (
            <AtendCard key={a.id} a={a}
              onNext={() => updateStatus.mutate({ id: a.id, status: "CONCLUIDO", extra: { concluido_em: new Date().toISOString() } })}
              nextLabel="Concluir" nextIcon={CheckCircle2}
              extraAction={{ label: "Anamnese", icon: ClipboardCheck, onClick: () => setAnamneseFor({ employeeId: a.employee_id, atendimentoId: a.id, natureza: a.natureza }) }}
              onDelete={() => excluir.mutate(a.id)}
            />
          ))}
          {buckets.EM_ATENDIMENTO.length === 0 && <Vazio texto="Ninguém em atendimento." />}
        </Coluna>
        <Coluna titulo="Concluído" tone="slate" count={buckets.CONCLUIDO.length}>
          {buckets.CONCLUIDO.map((a) => (
            <AtendCard key={a.id} a={a} concluded onDelete={() => excluir.mutate(a.id)}
              extraAction={{ label: "Ver anamnese", icon: ClipboardCheck, onClick: () => setAnamneseFor({ employeeId: a.employee_id, atendimentoId: a.id, natureza: a.natureza }) }}
            />
          ))}
          {buckets.CONCLUIDO.length === 0 && <Vazio texto="Sem conclusões hoje." />}
        </Coluna>
      </div>

      <NovoAtendimentoDialog open={novoOpen} onOpenChange={setNovoOpen} />
      {anamneseFor && (
        <AnamneseDialog
          open={!!anamneseFor}
          onOpenChange={(v) => !v && setAnamneseFor(null)}
          employeeId={anamneseFor.employeeId}
          atendimentoId={anamneseFor.atendimentoId}
          natureza={anamneseFor.natureza}
        />
      )}
    </div>
  );
}

function Coluna({ titulo, tone, count, children }: { titulo: string; tone: "slate" | "amber" | "emerald"; count: number; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-800/50 ring-slate-500/20 text-slate-200",
    amber: "bg-amber-500/10 ring-amber-400/30 text-amber-200",
    emerald: "bg-emerald-500/10 ring-emerald-400/30 text-emerald-200",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 space-y-2 min-h-[240px]">
      <div className={`rounded-md ring-1 px-2 py-1 flex items-center justify-between ${tones[tone]}`}>
        <span className="text-[11px] uppercase tracking-wider font-semibold">{titulo}</span>
        <span className="text-xs font-mono">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="text-[11px] text-slate-500 italic py-3 text-center">{texto}</div>;
}

function AtendCard({
  a, onNext, nextLabel, nextIcon: NextIcon, extraAction, onDelete, concluded,
}: {
  a: Atend;
  onNext?: () => void;
  nextLabel?: string;
  nextIcon?: any;
  extraAction?: { label: string; icon: any; onClick: () => void };
  onDelete?: () => void;
  concluded?: boolean;
}) {
  const dur = a.iniciado_em && a.concluido_em
    ? Math.round((new Date(a.concluido_em).getTime() - new Date(a.iniciado_em).getTime()) / 60000)
    : a.iniciado_em ? Math.round((Date.now() - new Date(a.iniciado_em).getTime()) / 60000) : null;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-white font-medium truncate">{a.employees?.nome ?? "—"}</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className="border-white/15 text-slate-300 h-4 px-1 text-[9px]">{a.natureza}</Badge>
            {a.prioridade !== "NORMAL" && (
              <Badge className="bg-red-500/15 text-red-200 ring-1 ring-red-400/30 h-4 px-1 text-[9px]">{a.prioridade}</Badge>
            )}
            {a.hora_agendada && <span>· {a.hora_agendada.slice(0, 5)}</span>}
            {dur !== null && <span>· {dur} min</span>}
          </div>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="text-slate-500 hover:text-red-300 text-xs">×</button>
        )}
      </div>
      {a.observacoes && <div className="text-[10px] text-slate-400 line-clamp-2">{a.observacoes}</div>}
      <div className="flex gap-1 pt-1">
        {extraAction && (
          <Button size="sm" variant="outline" onClick={extraAction.onClick} className="h-6 text-[10px] border-white/15 gap-1 flex-1">
            <extraAction.icon className="h-3 w-3" /> {extraAction.label}
          </Button>
        )}
        {onNext && NextIcon && !concluded && (
          <Button size="sm" onClick={onNext} className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-500 gap-1 flex-1">
            <NextIcon className="h-3 w-3" /> {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function NovoAtendimentoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [empId, setEmpId] = useState<string>("");
  const [natureza, setNatureza] = useState("PERIODICO");
  const [prioridade, setPrioridade] = useState("NORMAL");
  const [hora, setHora] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: emps } = useQuery({
    queryKey: ["emps-novo-atendimento", busca],
    enabled: open && busca.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nome, matricula")
        .eq("status", "ATIVO")
        .ilike("nome", `%${busca}%`)
        .limit(15);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) {
      setBusca(""); setEmpId(""); setNatureza("PERIODICO");
      setPrioridade("NORMAL"); setHora(""); setObs("");
    }
  }, [open]);

  const salvar = async () => {
    if (!empId) { toast.error("Selecione o colaborador"); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("atendimentos_medicos" as any).insert({
        employee_id: empId,
        natureza,
        prioridade,
        hora_agendada: hora || null,
        observacoes: obs || null,
        status: "AGENDADO",
        data_agendada: new Date().toISOString().slice(0, 10),
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Atendimento adicionado à fila");
      qc.invalidateQueries({ queryKey: ["atendimentos-hoje"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const empSel = (emps ?? []).find((e: any) => e.id === empId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-950 border-white/10 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-white">Novo atendimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-slate-400">Colaborador</Label>
            <Input placeholder="Buscar por nome…" value={busca} onChange={(e) => { setBusca(e.target.value); setEmpId(""); }}
              className="bg-slate-900/50 border-white/10" />
            {empSel && <div className="text-xs text-emerald-300 mt-1">Selecionado: {empSel.nome}</div>}
            {!empSel && busca.length >= 2 && (
              <div className="mt-1 max-h-40 overflow-auto rounded-md border border-white/10 bg-slate-900/60">
                {(emps ?? []).map((e: any) => (
                  <button key={e.id} type="button" onClick={() => setEmpId(e.id)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/5">
                    {e.nome} {e.matricula && <span className="text-slate-500">· {e.matricula}</span>}
                  </button>
                ))}
                {(emps ?? []).length === 0 && <div className="text-xs text-slate-500 p-2">Nenhum encontrado.</div>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-slate-400">Natureza</Label>
              <Select value={natureza} onValueChange={setNatureza}>
                <SelectTrigger className="bg-slate-900/50 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-950 border-white/10">
                  <SelectItem value="ADMISSIONAL">Admissional</SelectItem>
                  <SelectItem value="PERIODICO">Periódico</SelectItem>
                  <SelectItem value="RETORNO">Retorno</SelectItem>
                  <SelectItem value="MUDANCA">Mudança</SelectItem>
                  <SelectItem value="DEMISSIONAL">Demissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="bg-slate-900/50 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-950 border-white/10">
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="bg-slate-900/50 border-white/10" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} className="bg-slate-900/50 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/15">Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Coordenador PCMSO ----------
function CoordenadorTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coordenador | null>(null);

  const { data: companies } = useQuery({
    queryKey: ["asos-companies"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: coords, isLoading } = useQuery({
    queryKey: ["pcmso-coordenadores"],
    queryFn: async () => {
      const { data } = await supabase.from("pcmso_coordenadores").select("*").order("ativo", { ascending: false }).order("nome");
      return (data ?? []) as Coordenador[];
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pcmso_coordenadores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coordenador removido");
      qc.invalidateQueries({ queryKey: ["pcmso-coordenadores"] });
      qc.invalidateQueries({ queryKey: ["asos-kpis"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const companyName = (id: string) => companies?.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          NR-07 item 7.3.2 — um médico coordenador responsável pelo PCMSO por empresa.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo coordenador
        </Button>
      </div>
      {isLoading && <div className="text-sm text-slate-400">Carregando...</div>}
      <div className="grid gap-2">
        {coords?.map((c) => (
          <div key={c.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">{c.nome}</span>
                <Badge variant="outline" className="text-[10px] border-white/15">CRM {c.crm}/{c.crm_uf}</Badge>
                {c.ativo ? (
                  <Badge className="bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30">Ativo</Badge>
                ) : (
                  <Badge className="bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/30">Inativo</Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                <Building2 className="inline h-3 w-3 mr-1" /> {companyName(c.company_id)}
                {c.especialidade && ` • ${c.especialidade}`}
                {c.telefone && ` • ${c.telefone}`}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditing(c); setOpen(true); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { if (confirm("Remover este coordenador?")) delMut.mutate(c.id); }} className="text-red-300">
                  <Trash2 className="h-4 w-4 mr-2" /> Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {!isLoading && (coords?.length ?? 0) === 0 && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/[0.04] p-4 text-sm text-red-200">
            Nenhum coordenador PCMSO cadastrado. A NR-07 exige um médico responsável.
          </div>
        )}
      </div>

      <CoordenadorDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        companies={companies ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["pcmso-coordenadores"] })}
      />
    </div>
  );
}

function CoordenadorDialog({
  open, onOpenChange, editing, companies, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: Coordenador | null;
  companies: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Coordenador>>(editing ?? { ativo: true });
  const isEdit = !!editing?.id;

  // reset when opened
  useMemo(() => { setForm(editing ?? { ativo: true }); }, [editing, open]);

  const save = async () => {
    if (!form.company_id || !form.nome || !form.crm || !form.crm_uf) {
      toast.error("Preencha empresa, nome, CRM e UF");
      return;
    }
    const payload = {
      company_id: form.company_id,
      nome: form.nome,
      crm: form.crm,
      crm_uf: form.crm_uf,
      especialidade: form.especialidade ?? null,
      email: form.email ?? null,
      telefone: form.telefone ?? null,
      contrato_inicio: form.contrato_inicio ?? null,
      contrato_fim: form.contrato_fim ?? null,
      ativo: form.ativo ?? true,
      observacoes: form.observacoes ?? null,
    };
    const { error } = isEdit
      ? await supabase.from("pcmso_coordenadores").update(payload).eq("id", editing!.id)
      : await supabase.from("pcmso_coordenadores").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Atualizado" : "Coordenador cadastrado");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar coordenador PCMSO" : "Novo coordenador PCMSO"}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Empresa *</Label>
            <Select value={form.company_id ?? ""} onValueChange={(v) => setForm({ ...form, company_id: v })}>
              <SelectTrigger className="bg-slate-800 border-white/10"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Nome do médico *</Label>
            <Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>CRM *</Label>
            <Input value={form.crm ?? ""} onChange={(e) => setForm({ ...form, crm: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>UF *</Label>
            <Input value={form.crm_uf ?? ""} onChange={(e) => setForm({ ...form, crm_uf: e.target.value.toUpperCase().slice(0, 2) })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>Especialidade</Label>
            <Input value={form.especialidade ?? ""} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} placeholder="Medicina do Trabalho" className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={form.ativo ?? true} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>
          <div>
            <Label>Início do contrato</Label>
            <Input type="date" value={form.contrato_inicio ?? ""} onChange={(e) => setForm({ ...form, contrato_inicio: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>Fim do contrato</Label>
            <Input type="date" value={form.contrato_fim ?? ""} onChange={(e) => setForm({ ...form, contrato_fim: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/15">Cancelar</Button>
          <Button onClick={save} className="gap-1.5">{isEdit ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Clínicas ----------
function ClinicasTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Clinica | null>(null);

  const { data: clinicas, isLoading } = useQuery({
    queryKey: ["clinicas-ocupacionais"],
    queryFn: async () => {
      const { data } = await supabase.from("clinicas_ocupacionais").select("*").order("ativa", { ascending: false }).order("nome");
      return (data ?? []) as Clinica[];
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinicas_ocupacionais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clínica removida");
      qc.invalidateQueries({ queryKey: ["clinicas-ocupacionais"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Clínicas credenciadas para exames ocupacionais e complementares.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova clínica
        </Button>
      </div>
      {isLoading && <div className="text-sm text-slate-400">Carregando...</div>}
      <div className="grid gap-2">
        {clinicas?.map((c) => (
          <div key={c.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Hospital className="h-4 w-4 text-emerald-300 shrink-0" />
                <span className="text-sm font-medium text-white truncate">{c.nome}</span>
                {c.ativa ? (
                  <Badge className="bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30">Ativa</Badge>
                ) : (
                  <Badge className="bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/30">Inativa</Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {[c.cidade, c.uf].filter(Boolean).join("/") || "—"}
                {c.telefone && ` • ${c.telefone}`}
                {c.tipos_exame?.length ? ` • ${c.tipos_exame.slice(0, 3).join(", ")}` : ""}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditing(c); setOpen(true); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { if (confirm("Remover esta clínica?")) delMut.mutate(c.id); }} className="text-red-300">
                  <Trash2 className="h-4 w-4 mr-2" /> Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {!isLoading && (clinicas?.length ?? 0) === 0 && (
          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
            Nenhuma clínica cadastrada ainda.
          </div>
        )}
      </div>

      <ClinicaDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["clinicas-ocupacionais"] })}
      />
    </div>
  );
}

function ClinicaDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: Clinica | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Clinica>>(editing ?? { ativa: true, tipos_exame: [], especialidades: [] });
  const isEdit = !!editing?.id;

  useMemo(() => {
    setForm(editing ?? { ativa: true, tipos_exame: [], especialidades: [] });
  }, [editing, open]);

  const save = async () => {
    if (!form.nome) { toast.error("Informe o nome da clínica"); return; }
    const payload = {
      nome: form.nome,
      cnpj: form.cnpj ?? null,
      endereco: form.endereco ?? null,
      cidade: form.cidade ?? null,
      uf: form.uf ?? null,
      telefone: form.telefone ?? null,
      email: form.email ?? null,
      contato_responsavel: form.contato_responsavel ?? null,
      especialidades: form.especialidades ?? [],
      tipos_exame: form.tipos_exame ?? [],
      ativa: form.ativa ?? true,
      observacoes: form.observacoes ?? null,
    };
    const { error } = isEdit
      ? await supabase.from("clinicas_ocupacionais").update(payload).eq("id", editing!.id)
      : await supabase.from("clinicas_ocupacionais").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Atualizado" : "Clínica cadastrada");
    onSaved();
    onOpenChange(false);
  };

  const parseList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar clínica" : "Nova clínica ocupacional"}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>Contato responsável</Label>
            <Input value={form.contato_responsavel ?? ""} onChange={(e) => setForm({ ...form, contato_responsavel: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div className="md:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.endereco ?? ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.cidade ?? ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={form.uf ?? ""} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
          <div className="md:col-span-2">
            <Label>Tipos de exame (separados por vírgula)</Label>
            <Input
              value={(form.tipos_exame ?? []).join(", ")}
              onChange={(e) => setForm({ ...form, tipos_exame: parseList(e.target.value) })}
              placeholder="Clínico, Audiometria, Espirometria, Acuidade Visual..."
              className="bg-slate-800 border-white/10"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Especialidades (separadas por vírgula)</Label>
            <Input
              value={(form.especialidades ?? []).join(", ")}
              onChange={(e) => setForm({ ...form, especialidades: parseList(e.target.value) })}
              placeholder="Medicina do Trabalho, Otorrino, Oftalmologia..."
              className="bg-slate-800 border-white/10"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.ativa ?? true} onCheckedChange={(v) => setForm({ ...form, ativa: v })} />
            <Label>Ativa</Label>
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="bg-slate-800 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/15">Cancelar</Button>
          <Button onClick={save} className="gap-1.5">{isEdit ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Relatório Analítico (placeholder Fase 2) ----------
function AnaliticoTab() {
  return (
    <Card className="p-6 bg-slate-900/40 border-white/10">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30 grid place-items-center shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-semibold">Relatório Analítico do PCMSO (NR-07 item 7.6.1)</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Documento anual obrigatório, assinado pelo coordenador PCMSO, com estatísticas de exames, aptidões, agravos, encaminhamentos e propostas para o próximo ciclo.
          </p>
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-3 text-xs text-amber-100/80">
            Fase 2 — gerador do relatório será entregue após o cadastro do coordenador PCMSO e do mapeamento de exames por GHE.
          </div>
        </div>
      </div>
    </Card>
  );
}