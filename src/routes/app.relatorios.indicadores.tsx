import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { FileBarChart2, Loader2, Sparkles, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type jsPDF from "jspdf";
import {
  gerarRelatorioIndicadoresPDF,
  hojeExtenso,
  type IndicadorReport,
  type SerieMensal,
  type BarraSimples,
  type FatiaDonut,
} from "@/lib/relatorio-indicadores-pdf";

export const Route = createFileRoute("/app/relatorios/indicadores")({
  component: RelatorioIndicadoresPage,
});

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_ABR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const dayMs = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const brDate = (s: string) => new Date(s + "T00:00").toLocaleDateString("pt-BR");

type Periodicidade = "MENSAL" | "TRIMESTRAL";

function periodoRange(tipo: Periodicidade, ano: number, idx: number) {
  // idx = mês (0-11) ou trimestre (0-3)
  const inicio = tipo === "MENSAL" ? new Date(ano, idx, 1) : new Date(ano, idx * 3, 1);
  const fimExcl = tipo === "MENSAL" ? new Date(ano, idx + 1, 1) : new Date(ano, idx * 3 + 3, 1);
  const fim = new Date(fimExcl.getTime() - dayMs);
  return {
    inicio: iso(inicio),
    fimExcl: iso(fimExcl),
    fim: iso(fim),
    label: tipo === "MENSAL" ? `${MESES[idx]} / ${ano}` : `${idx + 1}º Trimestre / ${ano}`,
    intervalo: `${brDate(iso(inicio))} a ${brDate(iso(fim))}`,
  };
}

function periodicidadeMeses(p: string): number {
  const v = String(p || "").toUpperCase();
  if (v.includes("ANUAL")) return 12;
  if (v.includes("BIENAL")) return 24;
  if (v.includes("TRIENAL")) return 36;
  if (v.includes("SEMESTRAL")) return 6;
  if (v.includes("INICIAL") || v.includes("UNICA") || v.includes("ÚNICA")) return 9999;
  const n = parseInt(v, 10);
  return isNaN(n) ? 12 : n;
}

function RelatorioIndicadoresPage() {
  const hoje = new Date();
  const [tipo, setTipo] = useState<Periodicidade>("MENSAL");
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState(String(hoje.getMonth()));
  const [trimestre, setTrimestre] = useState(String(Math.floor(hoje.getMonth() / 3)));
  const [empresaId, setEmpresaId] = useState("ALL");
  const [conclusao, setConclusao] = useState("");
  const [respNome, setRespNome] = useState("");
  const [respCargo, setRespCargo] = useState("Técnico de Segurança do Trabalho");
  const [respRegistro, setRespRegistro] = useState("");
  const [gestorNome, setGestorNome] = useState("");
  const [gestorCargo, setGestorCargo] = useState("Gestão / Direção");
  const [sesmtSig, setSesmtSig] = useState<string | null>(null);
  const [engSig, setEngSig] = useState<string | null>(null);
  const [sigTarget, setSigTarget] = useState<null | "sesmt" | "eng">(null);
  const [preview, setPreview] = useState<{ doc: jsPDF; fileName: string } | null>(null);

  /* assinaturas salvas do usuário (galeria) — permite escolher antes de gerar */
  const { data: minhasAssinaturas } = useQuery({
    queryKey: ["rel-ind-signatures"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_signatures")
        .select("id,label,signature_data,is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const range = useMemo(
    () => periodoRange(tipo, Number(ano), tipo === "MENSAL" ? Number(mes) : Number(trimestre)),
    [tipo, ano, mes, trimestre],
  );

  const { data: companies } = useQuery({
    queryKey: ["rel-ind-companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["rel-indicadores", range.inicio, range.fimExcl, empresaId],
    queryFn: async () => {
      const since12m = iso(new Date(new Date(range.fimExcl).getTime() - 366 * dayMs));
      const [emps, acidentes, dds, exames, extintores, inspecoes, acoes, courses, entries, settings] = await Promise.all([
        supabase.from("employees").select("id,nome,status,company_id"),
        supabase.from("acidentes_trabalho").select("id,company_id,tipo,data_acidente,dias_perdidos").gte("data_acidente", since12m).lt("data_acidente", range.fimExcl),
        supabase.from("dds").select("id,data,company_id,participantes_presentes,participantes_esperados,aderencia").gte("data", since12m).lt("data", range.fimExcl),
        supabase.from("employee_exams").select("employee_id,data_vencimento,data_realizacao"),
        supabase.from("extintores").select("id,status"),
        supabase.from("extintor_inspecoes").select("extintor_id,data_inspecao,conforme").gte("data_inspecao", range.inicio).lt("data_inspecao", range.fimExcl),
        supabase.from("plano_acoes").select("id,status,quando,data_conclusao,created_at"),
        supabase.from("training_matrix_courses").select("id,codigo,nome,categoria,periodicidade,ativo").eq("ativo", true),
        supabase.from("training_matrix_entries").select("course_id,employee_id,data_realizacao"),
        supabase.from("company_settings").select("meta_dds_semana,meta_inspecoes_pct,meta_treinamentos_pct,meta_aso_pct,meta_acidentes_taxa_max_pct").limit(1).maybeSingle(),
      ]);
      return {
        employees: emps.data ?? [],
        acidentes: acidentes.data ?? [],
        dds: dds.data ?? [],
        exames: exames.data ?? [],
        extintores: extintores.data ?? [],
        inspecoes: inspecoes.data ?? [],
        acoes: acoes.data ?? [],
        courses: courses.data ?? [],
        entries: entries.data ?? [],
        settings: settings.data ?? null,
      };
    },
  });

  const calc = useMemo(() => {
    if (!data) return null;
    const s: any = data.settings ?? {};
    const metas = {
      treino: Number(s.meta_treinamentos_pct ?? 90),
      aso: Number(s.meta_aso_pct ?? 95),
      insp: Number(s.meta_inspecoes_pct ?? 90),
      ddsSemana: Number(s.meta_dds_semana ?? 3),
    };
    const byCompany = <T extends { company_id?: string | null }>(arr: T[]) =>
      empresaId === "ALL" ? arr : arr.filter((x) => x.company_id === empresaId);

    const emps = (data.employees as any[]).filter(
      (e) => e.status === "ATIVO" && (empresaId === "ALL" || e.company_id === empresaId),
    );
    const empIds = new Set(emps.map((e) => e.id));

    /* 01 · Acidentes registráveis no período */
    const acidPeriodo = byCompany(data.acidentes as any[]).filter(
      (a) => a.data_acidente >= range.inicio && a.data_acidente < range.fimExcl,
    );
    const diasPerdidos = acidPeriodo.reduce((t, a) => t + Number(a.dias_perdidos ?? 0), 0);

    /* série 12 meses de acidentes */
    const fimD = new Date(range.fimExcl);
    const serieAcidentes: SerieMensal[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(fimD.getFullYear(), fimD.getMonth() - 1 - i, 1);
      const n = new Date(fimD.getFullYear(), fimD.getMonth() - i, 1);
      const qtd = byCompany(data.acidentes as any[]).filter(
        (a) => a.data_acidente >= iso(d) && a.data_acidente < iso(n),
      ).length;
      serieAcidentes.push({ mes: `${MESES_ABR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, valor: qtd });
    }

    /* 02 · Treinamentos NR válidos */
    const nrCourses = (data.courses as any[]).filter((c) =>
      `${c.categoria ?? ""} ${c.codigo ?? ""}`.toUpperCase().includes("NR"),
    );
    const limite = new Date(range.fim + "T23:59").getTime();
    let treinValidos = 0, treinPrevistos = 0;
    const treinamentosNR: BarraSimples[] = [];
    nrCourses.forEach((c) => {
      const meses = periodicidadeMeses(c.periodicidade);
      const validos = new Set<string>();
      const previstos = new Set<string>();
      (data.entries as any[]).filter((e) => e.course_id === c.id && empIds.has(e.employee_id)).forEach((e) => {
        previstos.add(e.employee_id);
        if (!e.data_realizacao) return;
        const dr = new Date(e.data_realizacao + "T00:00").getTime();
        const val = meses >= 9999 ? Infinity : dr + meses * 30 * dayMs;
        if (val >= limite) validos.add(e.employee_id);
      });
      if (previstos.size === 0) return;
      treinValidos += validos.size;
      treinPrevistos += previstos.size;
      treinamentosNR.push({
        nome: c.codigo || c.nome,
        valor: Math.round((validos.size / previstos.size) * 100),
      });
    });
    treinamentosNR.sort((a, b) => a.valor - b.valor);
    const treinPct = treinPrevistos > 0 ? Math.round((treinValidos / treinPrevistos) * 100) : 0;

    /* 03 · ASO em dia */
    const ultimoExame = new Map<string, string>();
    (data.exames as any[]).forEach((e) => {
      if (!empIds.has(e.employee_id)) return;
      const cur = ultimoExame.get(e.employee_id);
      if (!cur || e.data_vencimento > cur) ultimoExame.set(e.employee_id, e.data_vencimento);
    });
    let asoEmDia = 0, asoVencendo = 0, asoVencido = 0;
    const refFim = range.fim;
    const ref30 = iso(new Date(new Date(range.fim).getTime() + 30 * dayMs));
    emps.forEach((e) => {
      const venc = ultimoExame.get(e.id);
      if (!venc) { asoVencido += 1; return; }
      if (venc < refFim) asoVencido += 1;
      else if (venc <= ref30) asoVencendo += 1;
      else asoEmDia += 1;
    });
    const asoBase = Math.max(1, emps.length);
    const asoPct = Math.round(((asoEmDia + asoVencendo) / asoBase) * 100);
    const asoDonutFull: FatiaDonut[] = [
      { nome: "Em dia", valor: asoEmDia, cor: [16, 185, 129] },
      { nome: "Vence 30d", valor: asoVencendo, cor: [217, 119, 6] },
      { nome: "Vencidos", valor: asoVencido, cor: [220, 38, 38] },
    ];
    const asoDonut = asoDonutFull.filter((f) => f.valor > 0);

    /* 04 · DDS realizado x planejado */
    const semanas = Math.max(1, Math.round((new Date(range.fimExcl).getTime() - new Date(range.inicio).getTime()) / (7 * dayMs)));
    const ddsPeriodo = byCompany(data.dds as any[]).filter((d) => d.data >= range.inicio && d.data < range.fimExcl);
    const ddsPlanejado = semanas * metas.ddsSemana;
    const ddsPct = Math.min(100, Math.round((ddsPeriodo.length / Math.max(1, ddsPlanejado)) * 100));
    const serieDds: SerieMensal[] = [];
    const serieDdsPlan: SerieMensal[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(fimD.getFullYear(), fimD.getMonth() - 1 - i, 1);
      const n = new Date(fimD.getFullYear(), fimD.getMonth() - i, 1);
      const qtd = byCompany(data.dds as any[]).filter((x) => x.data >= iso(d) && x.data < iso(n)).length;
      const label = `${MESES_ABR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      serieDds.push({ mes: label, valor: qtd });
      serieDdsPlan.push({ mes: label, valor: Math.round(metas.ddsSemana * 4.3) });
    }

    /* 05 · Extintores inspecionados no período */
    const extAtivos = (data.extintores as any[]).filter((e) => e.status === "ATIVO");
    const inspecionados = new Set((data.inspecoes as any[]).map((i) => i.extintor_id));
    const extPct = extAtivos.length > 0
      ? Math.round((extAtivos.filter((e) => inspecionados.has(e.id)).length / extAtivos.length) * 100)
      : 0;
    const naoConformes = (data.inspecoes as any[]).filter((i) => i.conforme === false).length;

    /* 06 · Plano de ações no prazo */
    const fimTime = new Date(range.fim + "T23:59").getTime();
    let noPrazo = 0, atrasadas = 0, abertasOk = 0;
    (data.acoes as any[]).forEach((a) => {
      const concluido = String(a.status ?? "").startsWith("CONCLU") || !!a.data_conclusao;
      const prev = a.quando ? new Date(a.quando + "T00:00").getTime() : null;
      if (concluido) {
        const dc = a.data_conclusao ? new Date(a.data_conclusao + "T00:00").getTime() : fimTime;
        if (!prev || dc <= prev) noPrazo += 1; else atrasadas += 1;
      } else if (prev && prev < fimTime) atrasadas += 1;
      else abertasOk += 1;
    });
    const acoesTotal = noPrazo + atrasadas + abertasOk;
    const acoesPct = acoesTotal > 0 ? Math.round((noPrazo / acoesTotal) * 100) : 0;

    const indicadores: IndicadorReport[] = [
      {
        codigo: "01", nome: "Zero Acidentes", tipo: "QTD", unidade: "acid.",
        valor: acidPeriodo.length, meta: 0, menorMelhor: true,
        descricao: "Total de acidentes de trabalho registráveis ocorridos no período.",
        detalhe: `${acidPeriodo.length} acidente(s) · ${diasPerdidos} dia(s) perdido(s)`,
        analise: acidPeriodo.length === 0
          ? "Nenhum acidente registrável no período. Manter as barreiras de controle, o programa de DDS e as inspeções planejadas."
          : `Registrados ${acidPeriodo.length} acidente(s), totalizando ${diasPerdidos} dia(s) perdido(s). Todas as ocorrências devem possuir investigação (RIA), análise de causa raiz e plano de ação com verificação de eficácia.`,
      },
      {
        codigo: "02", nome: "Treinamentos NR", tipo: "PCT",
        valor: treinPct, meta: metas.treino,
        descricao: "Percentual de colaboradores com treinamentos normativos válidos frente à matriz aplicável.",
        detalhe: `${treinValidos} de ${treinPrevistos} exigências atendidas`,
      },
      {
        codigo: "03", nome: "ASO / PCMSO", tipo: "PCT",
        valor: asoPct, meta: metas.aso,
        descricao: "Percentual de colaboradores ativos com exame ocupacional dentro da validade.",
        detalhe: `${asoEmDia + asoVencendo} de ${emps.length} em dia · ${asoVencido} vencido(s)`,
      },
      {
        codigo: "04", nome: "DDS realizado", tipo: "PCT",
        valor: ddsPct, meta: 90,
        descricao: "Aderência do Diálogo Diário de Segurança ao planejamento do período.",
        detalhe: `${ddsPeriodo.length} de ${ddsPlanejado} previstos`,
      },
      {
        codigo: "05", nome: "Extintores NR-23", tipo: "PCT",
        valor: extPct, meta: metas.insp,
        descricao: "Percentual de extintores ativos inspecionados no período.",
        detalhe: `${extAtivos.filter((e) => inspecionados.has(e.id)).length} de ${extAtivos.length} · ${naoConformes} NC`,
      },
      {
        codigo: "06", nome: "Plano de ações", tipo: "PCT",
        valor: acoesPct, meta: 85,
        descricao: "Percentual de ações do plano 5W2H concluídas dentro do prazo pactuado.",
        detalhe: `${noPrazo} no prazo · ${atrasadas} atrasada(s) · ${acoesTotal} total`,
      },
    ];

    return { indicadores, serieAcidentes, serieDds, serieDdsPlan, treinamentosNR, asoDonut, totalEmp: emps.length };
  }, [data, empresaId, range]);

  const gerar = (over?: { sesmt?: string | null; eng?: string | null }) => {
    if (!calc) return;
    const doc = gerarRelatorioIndicadoresPDF({
      periodicidade: tipo,
      periodoLabel: range.label,
      intervaloLabel: range.intervalo,
      empresaLabel: empresaId === "ALL"
        ? "Todas as empresas"
        : (companies ?? []).find((c: any) => c.id === empresaId)?.name ?? "—",
      totalColaboradores: calc.totalEmp,
      indicadores: calc.indicadores,
      serieAcidentes: calc.serieAcidentes,
      serieDds: calc.serieDds,
      serieDdsPlanejado: calc.serieDdsPlan,
      treinamentosNR: calc.treinamentosNR,
      asoDonut: calc.asoDonut,
      conclusao: conclusao.trim() || undefined,
      responsavelNome: respNome,
      responsavelCargo: respCargo,
      responsavelRegistro: respRegistro,
      assinaturaDataUrl: over?.sesmt !== undefined ? over.sesmt : sesmtSig,
      gestorNome,
      gestorCargo,
      assinaturaGestorDataUrl: over?.eng !== undefined ? over.eng : engSig,
      dataExtenso: hojeExtenso(),
    });
    setPreview({
      doc,
      fileName: `Relatorio-Indicadores-${tipo === "MENSAL" ? "Mensal" : "Trimestral"}-${range.label.replace(/[^\w]+/g, "-")}.pdf`,
    });
  };

  const sugerirConclusao = () => {
    if (!calc) return;
    const fora = calc.indicadores.filter((i) => (i.menorMelhor ? i.valor > i.meta : i.valor < i.meta));
    const ok = calc.indicadores.length - fora.length;
    const txt = fora.length === 0
      ? `Todos os ${calc.indicadores.length} indicadores monitorados atingiram as metas estabelecidas no período. Recomenda-se a manutenção dos controles operacionais vigentes e a continuidade do monitoramento mensal.`
      : `Dos ${calc.indicadores.length} indicadores monitorados, ${ok} atingiram a meta e ${fora.length} ficaram abaixo do desempenho esperado: ${fora.map((f) => `${f.codigo} — ${f.nome}`).join("; ")}. ` +
        `Para os indicadores em desvio, devem ser abertas tratativas de não conformidade com análise de causa, plano de ação 5W2H e verificação de eficácia, conforme item 10.2 da ISO 45001 e item 1.5.5 da NR-01.`;
    setConclusao(txt);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart2 className="h-5 w-5 text-rose-500" />
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Relatório de Indicadores SST</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gera o relatório formal (mensal ou trimestral) com cabeçalho institucional, gráficos e assinaturas — ISO 45001 item 9.1 · NR-01 item 1.5.7.
          </p>
        </div>

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Periodicidade</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Periodicidade)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MENSAL">Mensal</SelectItem>
                <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === "MENSAL" ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Trimestre</Label>
              <Select value={trimestre} onValueChange={setTrimestre}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((t) => <SelectItem key={t} value={String(t)}>{t + 1}º Trimestre</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Ano</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3].map((i) => {
                  const a = hoje.getFullYear() - i;
                  return <SelectItem key={a} value={String(a)}>{a}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as empresas</SelectItem>
                {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="mb-1.5">{range.intervalo}</Badge>
        </Card>

        {isLoading || !calc ? (
          <Card className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Apurando indicadores do período…
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {calc.indicadores.map((i) => {
              const atingiu = i.menorMelhor ? i.valor <= i.meta : i.valor >= i.meta;
              return (
                <Card key={i.codigo} className="p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{i.codigo} · {i.nome}</div>
                  <div className={`text-2xl font-black tabular-nums mt-1 ${atingiu ? "text-emerald-600" : "text-rose-600"}`}>
                    {i.tipo === "PCT" ? `${i.valor}%` : i.valor}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{i.detalhe}</div>
                  <div className="text-[10px] mt-1 font-semibold">
                    Meta {i.menorMelhor ? "≤" : "≥"} {i.meta}{i.tipo === "PCT" ? "%" : ""}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="p-4 flex flex-col gap-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Responsável técnico (SESMT)</Label>
              <Input value={respNome} onChange={(e) => setRespNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Cargo</Label>
              <Input value={respCargo} onChange={(e) => setRespCargo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Registro / CREA / MTE</Label>
              <Input value={respRegistro} onChange={(e) => setRespRegistro(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Gestor / Direção</Label>
              <Input value={gestorNome} onChange={(e) => setGestorNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Cargo do gestor</Label>
              <Input value={gestorCargo} onChange={(e) => setGestorCargo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Conclusão e encaminhamentos</Label>
              <Button size="sm" variant="ghost" onClick={sugerirConclusao} disabled={!calc}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Sugerir texto
              </Button>
            </div>
            <Textarea rows={4} value={conclusao} onChange={(e) => setConclusao(e.target.value)}
              placeholder="Análise crítica final, encaminhamentos e responsáveis…" />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => { try { gerar(); } catch (e: any) { toast.error(e?.message ?? "Erro ao gerar"); } }} disabled={!calc}>
              <FileBarChart2 className="h-4 w-4 mr-2" /> Gerar relatório
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            As assinaturas são aplicadas na tela de visualização — use a galeria de assinaturas nos slots “Responsável SESMT” e “Gestão”.
          </p>
        </Card>
      </div>

      <PDFPreviewDialog
        open={!!preview}
        onClose={() => setPreview(null)}
        doc={preview?.doc ?? null}
        fileName={preview?.fileName ?? "relatorio-indicadores.pdf"}
        title={`Relatório ${tipo === "MENSAL" ? "Mensal" : "Trimestral"} de Indicadores · ${range.label}`}
        signable
        useSignatureGallery
        signatureLabels={{ sesmt: "Responsável SESMT", eng: "Gestão / Direção" }}
        sesmtSig={sesmtSig}
        engSig={engSig}
        onChangeSesmtSig={(v) => { setSesmtSig(v); gerar({ sesmt: v }); }}
        onChangeEngSig={(v) => { setEngSig(v); gerar({ eng: v }); }}
      />
    </div>
  );
}