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
import { Sparkles } from "lucide-react";
import { AsoRapidoDialog } from "@/components/aso/aso-rapido-dialog";

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
          <TabsTrigger value="registrados"><ClipboardList className="h-4 w-4 mr-1.5" /> Registrados</TabsTrigger>
          <TabsTrigger value="coordenador"><UserPlus className="h-4 w-4 mr-1.5" /> Coordenador PCMSO</TabsTrigger>
          <TabsTrigger value="clinicas"><Hospital className="h-4 w-4 mr-1.5" /> Clínicas</TabsTrigger>
          <TabsTrigger value="analitico"><FileText className="h-4 w-4 mr-1.5" /> Relatório Analítico</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="pt-4 space-y-4"><PainelTab /></TabsContent>
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