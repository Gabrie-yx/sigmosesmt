import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Stethoscope, Search, HeartPulse, FileText, Syringe, ClipboardCheck,
  CalendarClock, User2, ArrowLeft, AlertTriangle, CheckCircle2, Printer,
  Activity, Loader2,
} from "lucide-react";

// Módulo Medicina Ocupacional
// Histórico clínico consolidado por colaborador (ASO + Anamnese + Atestados + Atendimentos + Vacinas)
// NR-07 (PCMSO) — prontuário ocupacional individual mínimo 20 anos após desligamento.

export const Route = createFileRoute("/app/sesmt/medicina-ocupacional")({
  head: () => ({
    meta: [
      { title: "SIGMO — Medicina Ocupacional (Prontuário)" },
      { name: "description", content: "Histórico clínico consolidado por colaborador: ASOs, anamneses, atestados, atendimentos e vacinas. NR-07 / PCMSO." },
      { property: "og:title", content: "SIGMO — Medicina Ocupacional" },
      { property: "og:description", content: "Prontuário ocupacional unificado por colaborador (NR-07)." },
    ],
  }),
  component: MedicinaOcupacionalPage,
});

type EmployeeLite = {
  id: string; nome: string; cpf: string | null; matricula: string | null;
  status: string | null; admissao: string | null; foto_url: string | null;
  role_id: string | null;
};

function fmt(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("pt-BR");
}
function fmtDT(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString("pt-BR");
}
function aptidaoTone(a?: string | null) {
  const v = (a ?? "").toUpperCase();
  if (v.includes("INAPTO")) return "bg-red-500/15 text-red-300 border-red-500/40";
  if (v.includes("RESTRIC")) return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  if (v.includes("APTO")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  return "bg-slate-500/15 text-slate-300 border-slate-500/40";
}

function MedicinaOcupacionalPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Lista de colaboradores (ativos por padrão)
  const employeesQ = useQuery({
    queryKey: ["med-ocup", "employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, cpf, matricula, status, admissao, foto_url, role_id")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as EmployeeLite[];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = employeesQ.data ?? [];
    if (!t) return list;
    return list.filter(e =>
      (e.nome ?? "").toLowerCase().includes(t) ||
      (e.cpf ?? "").includes(t) ||
      (e.matricula ?? "").toLowerCase().includes(t)
    );
  }, [employeesQ.data, search]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-[1600px] px-4 py-4 flex items-center gap-3">
          <Link to="/app/sesmt/asos" className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-sm">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="h-6 w-px bg-slate-700" />
          <Stethoscope className="h-5 w-5 text-emerald-400" />
          <div>
            <h1 className="text-lg font-semibold">Medicina Ocupacional</h1>
            <p className="text-xs text-slate-400">Prontuário consolidado por colaborador — NR-07 / PCMSO</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-4 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Lista de colaboradores */}
        <Card className="bg-slate-900/60 border-slate-800 p-3 h-fit lg:sticky lg:top-4">
          <div className="relative mb-3">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, CPF ou matrícula…"
              className="pl-8 bg-slate-950 border-slate-800"
            />
          </div>
          <div className="text-xs text-slate-500 mb-2">
            {employeesQ.isLoading ? "Carregando…" : `${filtered.length} colaborador(es)`}
          </div>
          <ScrollArea className="h-[65vh]">
            <div className="space-y-1 pr-2">
              {filtered.map((e) => {
                const active = e.id === selectedId;
                const inativo = (e.status ?? "").toUpperCase() !== "ATIVO";
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full text-left rounded-md px-2 py-2 border transition ${
                      active
                        ? "bg-emerald-500/10 border-emerald-500/40"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        {e.foto_url
                          ? <img src={e.foto_url} alt="" className="h-full w-full object-cover" />
                          : <User2 className="h-4 w-4 text-slate-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{e.nome}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {e.matricula ?? "s/ matr."} • {e.cpf ?? "—"}
                        </div>
                      </div>
                      {inativo && (
                        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                          {e.status ?? "—"}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
              {!employeesQ.isLoading && filtered.length === 0 && (
                <div className="text-xs text-slate-500 py-6 text-center">Nenhum colaborador encontrado.</div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Prontuário */}
        <div>
          {!selectedId ? (
            <EmptyState />
          ) : (
            <Prontuario employeeId={selectedId} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="bg-slate-900/40 border-slate-800 border-dashed p-12 text-center">
      <HeartPulse className="h-10 w-10 text-slate-600 mx-auto mb-3" />
      <h2 className="text-slate-200 font-medium mb-1">Selecione um colaborador</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        O prontuário consolida ASOs, anamneses, atestados, atendimentos ambulatoriais
        e vacinação, atendendo ao item 7.5.15 da NR-07 (guarda de prontuário por 20 anos).
      </p>
    </Card>
  );
}

function Prontuario({ employeeId }: { employeeId: string }) {
  // Fetch tudo em paralelo
  const empQ = useQuery({
    queryKey: ["med-ocup", "emp", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, cpf, matricula, status, admissao, foto_url, sexo, data_nascimento, tipo_sanguineo, telefone, email")
        .eq("id", employeeId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const asosQ = useQuery({
    queryKey: ["med-ocup", "asos", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_exams")
        .select("id, natureza, tipo_exame, aptidao, data_realizacao, data_vencimento, observacoes, anexo_path")
        .eq("employee_id", employeeId)
        .order("data_realizacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const atestadosQ = useQuery({
    queryKey: ["med-ocup", "atest", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_atestados")
        .select("id, cid, tipo, status, data_inicio, data_retorno, dias_afastamento, medico_nome, medico_crm, observacao, arquivo_path")
        .eq("employee_id", employeeId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const anamnesesQ = useQuery({
    queryKey: ["med-ocup", "anam", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anamneses_ocupacionais")
        .select("id, data_anamnese, natureza, aptidao, queixa_principal, hipoteses_diagnosticas, conduta, restricoes, medico_nome, medico_crm, finalizada, exame_fisico")
        .eq("employee_id", employeeId)
        .order("data_anamnese", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const atendQ = useQuery({
    queryKey: ["med-ocup", "atend", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos_medicos")
        .select("id, data_agendada, hora_agendada, natureza, status, prioridade, observacoes, concluido_em, iniciado_em")
        .eq("employee_id", employeeId)
        .order("data_agendada", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const vacQ = useQuery({
    queryKey: ["med-ocup", "vac", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_vaccinations")
        .select("id, tipo_vacina, data_aplicacao, data_proxima_dose, dose, fabricante, lote, observacoes")
        .eq("employee_id", employeeId)
        .order("data_aplicacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading = empQ.isLoading || asosQ.isLoading || atestadosQ.isLoading || anamnesesQ.isLoading || atendQ.isLoading || vacQ.isLoading;

  // KPIs
  const kpi = useMemo(() => {
    const asos = asosQ.data ?? [];
    const atest = atestadosQ.data ?? [];
    const now = new Date();
    const last12 = new Date(now); last12.setMonth(last12.getMonth() - 12);
    const atest12 = atest.filter((a: any) => new Date(a.data_inicio) >= last12);
    const dias12 = atest12.reduce((s: number, a: any) => s + (a.dias_afastamento ?? 0), 0);
    const ultimoAso = asos[0] as any;
    const asoStatus = (() => {
      if (!ultimoAso) return { label: "Sem ASO", tone: "red" as const };
      const venc = new Date(ultimoAso.data_vencimento);
      const diff = (venc.getTime() - now.getTime()) / 86400000;
      if (diff < 0) return { label: "ASO Vencido", tone: "red" as const };
      if (diff < 30) return { label: `Vence em ${Math.ceil(diff)}d`, tone: "amber" as const };
      return { label: `Válido até ${fmt(ultimoAso.data_vencimento)}`, tone: "emerald" as const };
    })();
    return {
      totalAsos: asos.length,
      ultimaAptidao: ultimoAso?.aptidao ?? "—",
      asoStatus,
      totalAtestados: atest.length,
      atest12: atest12.length,
      dias12,
      totalAnam: (anamnesesQ.data ?? []).length,
      totalAtend: (atendQ.data ?? []).length,
      totalVac: (vacQ.data ?? []).length,
    };
  }, [asosQ.data, atestadosQ.data, anamnesesQ.data, atendQ.data, vacQ.data]);

  // Timeline unificada
  type Ev = { ts: string; kind: string; title: string; badge?: string; tone: string; detail?: string };
  const timeline: Ev[] = useMemo(() => {
    const evs: Ev[] = [];
    (asosQ.data ?? []).forEach((a: any) => evs.push({
      ts: a.data_realizacao, kind: "ASO",
      title: `ASO ${a.natureza} — ${a.tipo_exame}`,
      badge: a.aptidao, tone: "emerald",
      detail: `Vence em ${fmt(a.data_vencimento)}${a.observacoes ? ` • ${a.observacoes}` : ""}`,
    }));
    (anamnesesQ.data ?? []).forEach((a: any) => evs.push({
      ts: a.data_anamnese, kind: "Anamnese",
      title: `Anamnese ${a.natureza}${a.finalizada ? "" : " (rascunho)"}`,
      badge: a.aptidao ?? undefined, tone: "cyan",
      detail: a.queixa_principal || a.hipoteses_diagnosticas || "—",
    }));
    (atestadosQ.data ?? []).forEach((a: any) => evs.push({
      ts: a.data_inicio, kind: "Atestado",
      title: `Atestado ${a.tipo} — ${a.dias_afastamento}d${a.cid ? ` (CID ${a.cid})` : ""}`,
      badge: a.status, tone: "amber",
      detail: `Retorno: ${fmt(a.data_retorno)}${a.medico_nome ? ` • Dr(a). ${a.medico_nome}` : ""}`,
    }));
    (atendQ.data ?? []).forEach((a: any) => evs.push({
      ts: a.data_agendada, kind: "Atendimento",
      title: `Atendimento ${a.natureza}`,
      badge: a.status, tone: "violet",
      detail: a.observacoes ?? "—",
    }));
    (vacQ.data ?? []).forEach((v: any) => evs.push({
      ts: v.data_aplicacao, kind: "Vacina",
      title: `${v.tipo_vacina}${v.dose ? ` — ${v.dose}` : ""}`,
      badge: v.fabricante ?? undefined, tone: "sky",
      detail: `Próxima dose: ${fmt(v.data_proxima_dose)}${v.lote ? ` • Lote ${v.lote}` : ""}`,
    }));
    return evs.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [asosQ.data, anamnesesQ.data, atestadosQ.data, atendQ.data, vacQ.data]);

  const emp = empQ.data;
  if (loading) {
    return (
      <Card className="bg-slate-900/60 border-slate-800 p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mx-auto" />
        <p className="text-slate-400 text-sm mt-2">Carregando prontuário…</p>
      </Card>
    );
  }
  if (!emp) return <Card className="bg-slate-900/60 border-slate-800 p-6 text-slate-400">Colaborador não encontrado.</Card>;

  const idade = emp.data_nascimento
    ? Math.floor((Date.now() - new Date(emp.data_nascimento).getTime()) / (365.25 * 86400000))
    : null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho colaborador */}
      <Card className="bg-slate-900/60 border-slate-800 p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
            {emp.foto_url
              ? <img src={emp.foto_url} alt="" className="h-full w-full object-cover" />
              : <User2 className="h-8 w-8 text-slate-500" />}
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold">{emp.nome}</h2>
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                {emp.status ?? "—"}
              </Badge>
            </div>
            <div className="text-sm text-slate-400 mt-1 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
              <div><span className="text-slate-500">CPF:</span> {emp.cpf ?? "—"}</div>
              <div><span className="text-slate-500">Matrícula:</span> {emp.matricula ?? "—"}</div>
              <div><span className="text-slate-500">Admissão:</span> {fmt(emp.admissao)}</div>
              <div><span className="text-slate-500">Sexo:</span> {emp.sexo ?? "—"}</div>
              <div><span className="text-slate-500">Nascimento:</span> {fmt(emp.data_nascimento)}{idade != null ? ` (${idade}a)` : ""}</div>
              <div><span className="text-slate-500">Tipo sang.:</span> {emp.tipo_sanguineo ?? "—"}</div>
              <div><span className="text-slate-500">Telefone:</span> {emp.telefone ?? "—"}</div>
              <div className="truncate"><span className="text-slate-500">E-mail:</span> {emp.email ?? "—"}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="border-slate-700">
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={<Stethoscope className="h-4 w-4" />}
          label="Último ASO"
          value={kpi.ultimaAptidao}
          hint={kpi.asoStatus.label}
          tone={kpi.asoStatus.tone}
        />
        <Kpi
          icon={<FileText className="h-4 w-4" />}
          label="Atestados (12m)"
          value={String(kpi.atest12)}
          hint={`${kpi.dias12} dia(s) afastado`}
          tone={kpi.dias12 > 15 ? "amber" : "slate"}
        />
        <Kpi
          icon={<ClipboardCheck className="h-4 w-4" />}
          label="Anamneses"
          value={String(kpi.totalAnam)}
          hint={`${kpi.totalAtend} atendimento(s)`}
          tone="slate"
        />
        <Kpi
          icon={<Syringe className="h-4 w-4" />}
          label="Vacinas"
          value={String(kpi.totalVac)}
          hint={`${kpi.totalAsos} ASO(s) no total`}
          tone="slate"
        />
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="timeline"><Activity className="h-4 w-4 mr-1" /> Linha do Tempo</TabsTrigger>
          <TabsTrigger value="asos"><Stethoscope className="h-4 w-4 mr-1" /> ASOs</TabsTrigger>
          <TabsTrigger value="anam"><ClipboardCheck className="h-4 w-4 mr-1" /> Anamneses</TabsTrigger>
          <TabsTrigger value="atest"><FileText className="h-4 w-4 mr-1" /> Atestados</TabsTrigger>
          <TabsTrigger value="atend"><CalendarClock className="h-4 w-4 mr-1" /> Atendimentos</TabsTrigger>
          <TabsTrigger value="vac"><Syringe className="h-4 w-4 mr-1" /> Vacinas</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-3">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            {timeline.length === 0 ? (
              <EmptyRow msg="Sem registros clínicos para este colaborador." />
            ) : (
              <ol className="relative border-l border-slate-800 ml-2 space-y-4">
                {timeline.map((e, i) => (
                  <li key={i} className="ml-4">
                    <span className={`absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-slate-950 ${
                      e.tone === "emerald" ? "bg-emerald-500" :
                      e.tone === "amber" ? "bg-amber-500" :
                      e.tone === "cyan" ? "bg-cyan-500" :
                      e.tone === "violet" ? "bg-violet-500" : "bg-sky-500"
                    }`} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">{fmt(e.ts)}</span>
                      <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">{e.kind}</Badge>
                      {e.badge && <Badge variant="outline" className={`text-[10px] ${aptidaoTone(e.badge)}`}>{e.badge}</Badge>}
                    </div>
                    <div className="text-sm text-slate-200 mt-1">{e.title}</div>
                    {e.detail && <div className="text-xs text-slate-400 mt-0.5">{e.detail}</div>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="asos" className="mt-3">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            {(asosQ.data ?? []).length === 0 ? <EmptyRow msg="Nenhum ASO registrado." /> : (
              <div className="space-y-2">
                {(asosQ.data ?? []).map((a: any) => (
                  <div key={a.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-slate-700 text-slate-300">{a.natureza}</Badge>
                      <span className="text-sm font-medium">{a.tipo_exame}</span>
                      <Badge variant="outline" className={aptidaoTone(a.aptidao)}>{a.aptidao}</Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Realizado: {fmt(a.data_realizacao)} • Vence: {fmt(a.data_vencimento)}
                    </div>
                    {a.observacoes && <div className="text-xs text-slate-300 mt-1">{a.observacoes}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="anam" className="mt-3">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            {(anamnesesQ.data ?? []).length === 0 ? <EmptyRow msg="Nenhuma anamnese registrada." /> : (
              <div className="space-y-2">
                {(anamnesesQ.data ?? []).map((a: any) => {
                  const ef = (a.exame_fisico ?? {}) as any;
                  const imc = ef.peso && ef.altura ? (ef.peso / (ef.altura * ef.altura)).toFixed(1) : null;
                  return (
                    <div key={a.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500">{fmt(a.data_anamnese)}</span>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">{a.natureza}</Badge>
                        {a.aptidao && <Badge variant="outline" className={aptidaoTone(a.aptidao)}>{a.aptidao}</Badge>}
                        {!a.finalizada && <Badge variant="outline" className="border-amber-500/40 text-amber-300">Rascunho</Badge>}
                      </div>
                      {a.queixa_principal && <div className="text-sm text-slate-200 mt-1"><b className="text-slate-400">QP:</b> {a.queixa_principal}</div>}
                      {a.hipoteses_diagnosticas && <div className="text-xs text-slate-300 mt-1"><b className="text-slate-500">HD:</b> {a.hipoteses_diagnosticas}</div>}
                      {a.conduta && <div className="text-xs text-slate-300 mt-1"><b className="text-slate-500">Conduta:</b> {a.conduta}</div>}
                      {a.restricoes && <div className="text-xs text-amber-300 mt-1"><b>Restrições:</b> {a.restricoes}</div>}
                      <div className="text-[11px] text-slate-500 mt-2 flex gap-3 flex-wrap">
                        {ef.pa_sistolica && <span>PA {ef.pa_sistolica}/{ef.pa_diastolica}</span>}
                        {ef.fc && <span>FC {ef.fc}</span>}
                        {imc && <span>IMC {imc}</span>}
                        {a.medico_nome && <span>Dr(a). {a.medico_nome}{a.medico_crm ? ` — CRM ${a.medico_crm}` : ""}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="atest" className="mt-3">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            {(atestadosQ.data ?? []).length === 0 ? <EmptyRow msg="Nenhum atestado registrado." /> : (
              <div className="space-y-2">
                {(atestadosQ.data ?? []).map((a: any) => (
                  <div key={a.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">{fmt(a.data_inicio)}</span>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">{a.tipo}</Badge>
                      <span className="text-sm font-medium">{a.dias_afastamento} dia(s)</span>
                      {a.cid && <Badge variant="outline" className="border-slate-700 text-slate-300">CID {a.cid}</Badge>}
                      <Badge variant="outline" className={
                        a.status === "HOMOLOGADO" ? "border-emerald-500/40 text-emerald-300" :
                        a.status === "RECUSADO" ? "border-red-500/40 text-red-300" :
                        "border-amber-500/40 text-amber-300"
                      }>{a.status}</Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Retorno: {fmt(a.data_retorno)}
                      {a.medico_nome ? ` • Dr(a). ${a.medico_nome}${a.medico_crm ? ` (CRM ${a.medico_crm})` : ""}` : ""}
                    </div>
                    {a.observacao && <div className="text-xs text-slate-300 mt-1">{a.observacao}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="atend" className="mt-3">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            {(atendQ.data ?? []).length === 0 ? <EmptyRow msg="Nenhum atendimento ambulatorial registrado." /> : (
              <div className="space-y-2">
                {(atendQ.data ?? []).map((a: any) => (
                  <div key={a.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">{fmt(a.data_agendada)} {a.hora_agendada ?? ""}</span>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">{a.natureza}</Badge>
                      <Badge variant="outline" className={
                        a.status === "CONCLUIDO" ? "border-emerald-500/40 text-emerald-300" :
                        a.status === "EM_ATENDIMENTO" ? "border-cyan-500/40 text-cyan-300" :
                        "border-slate-700 text-slate-300"
                      }>{a.status}</Badge>
                      {a.prioridade === "URGENTE" && <Badge variant="outline" className="border-red-500/40 text-red-300">URGENTE</Badge>}
                    </div>
                    {a.observacoes && <div className="text-xs text-slate-300 mt-1">{a.observacoes}</div>}
                    {a.concluido_em && <div className="text-[11px] text-slate-500 mt-1">Concluído em {fmtDT(a.concluido_em)}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="vac" className="mt-3">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            {(vacQ.data ?? []).length === 0 ? <EmptyRow msg="Nenhuma vacina registrada." /> : (
              <div className="space-y-2">
                {(vacQ.data ?? []).map((v: any) => (
                  <div key={v.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">{fmt(v.data_aplicacao)}</span>
                      <span className="text-sm font-medium">{v.tipo_vacina}</span>
                      {v.dose && <Badge variant="outline" className="border-slate-700 text-slate-300">{v.dose}</Badge>}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Próxima dose: {fmt(v.data_proxima_dose)}
                      {v.fabricante ? ` • ${v.fabricante}` : ""}{v.lote ? ` • Lote ${v.lote}` : ""}
                    </div>
                    {v.observacoes && <div className="text-xs text-slate-300 mt-1">{v.observacoes}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-slate-500 text-center pt-2">
        NR-07, item 7.5.15 — Prontuário clínico individual mantido por no mínimo 20 anos após o desligamento.
      </p>
    </div>
  );
}

function Kpi({
  icon, label, value, hint, tone,
}: { icon: React.ReactNode; label: string; value: string; hint: string; tone: "emerald" | "amber" | "red" | "slate" }) {
  const toneMap = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    red: "border-red-500/30 bg-red-500/5",
    slate: "border-slate-800 bg-slate-900/60",
  } as const;
  const iconTone = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
    slate: "text-slate-400",
  } as const;
  return (
    <Card className={`p-3 ${toneMap[tone]}`}>
      <div className={`flex items-center gap-2 text-xs ${iconTone[tone]}`}>
        {icon} <span>{label}</span>
      </div>
      <div className="text-lg font-semibold text-slate-100 mt-1 truncate">{value}</div>
      <div className="text-[11px] text-slate-400">{hint}</div>
    </Card>
  );
}

function EmptyRow({ msg }: { msg: string }) {
  return (
    <div className="text-center py-6 text-sm text-slate-500 flex items-center justify-center gap-2">
      <AlertTriangle className="h-4 w-4" /> {msg}
    </div>
  );
}