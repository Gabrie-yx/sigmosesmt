import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Upload, FileText, Loader2, AlertTriangle, CheckCircle2, User, Paperclip, X } from "lucide-react";
import { ocrFolhaDePonto, type OcrFolha, type OcrDia } from "@/lib/ponto-ocr.functions";

export const Route = createFileRoute("/app/administrativo/gestao-ponto/$cicloId")({
  component: CicloDetalhePage,
});

type Ciclo = {
  id: string;
  competencia: string;
  status: string;
  pdf_original_url: string | null;
  pdf_original_nome: string | null;
  total_paginas: number | null;
  total_funcionarios: number | null;
};

type Folha = {
  id: string;
  ciclo_id: string;
  pagina_pdf: number | null;
  matricula: string | null;
  nome: string | null;
  cargo: string | null;
  local_trabalho: string | null;
  status: string;
  employee_id: string | null;
  totais_json: any;
};

type Dia = {
  id: string;
  folha_id: string;
  data: string;
  marcacoes: string[] | null;
  status_sistema: string | null;
  motivo_flag: string | null;
  precisa_tratativa: boolean;
  dia_semana: string | null;
  raw_json: any;
};

function CicloDetalhePage() {
  const { cicloId } = Route.useParams();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [tratarDia, setTratarDia] = useState<Dia | null>(null);
  const runOcr = useServerFn(ocrFolhaDePonto);

  const { data: ciclo } = useQuery({
    queryKey: ["ponto_ciclo", cicloId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ponto_ciclos" as any).select("*").eq("id", cicloId).maybeSingle();
      if (error) throw error;
      return data as unknown as Ciclo | null;
    },
  });

  const { data: folhas = [] } = useQuery({
    queryKey: ["ponto_folhas", cicloId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ponto_folhas" as any).select("*").eq("ciclo_id", cicloId).order("pagina_pdf");
      if (error) throw error;
      return (data ?? []) as unknown as Folha[];
    },
  });

  const { data: dias = [] } = useQuery({
    queryKey: ["ponto_dias", cicloId],
    enabled: folhas.length > 0,
    queryFn: async () => {
      const ids = folhas.map(f => f.id);
      const { data, error } = await supabase.from("ponto_dias" as any).select("*").in("folha_id", ids).eq("precisa_tratativa", true).order("data");
      if (error) throw error;
      return (data ?? []) as unknown as Dia[];
    },
  });

  async function handleUpload(file: File) {
    if (!ciclo) return;
    setUploading(true);
    try {
      // 1) sobe pro storage
      const path = `${cicloId}/original-${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("ponto-pdfs").upload(path, file, { upsert: false });
      if (up.error) throw up.error;

      // 2) OCR no server (Gemini via Lovable AI Gateway — aceita PDF escaneado)
      toast.info("Lendo o PDF com IA… pode levar 20-40s");
      const res = await runOcr({ data: { pdfPath: path } });
      if (res.error) throw new Error(res.error);
      const parsed = res.folhas;
      if (!parsed.length) throw new Error("Nada extraído do PDF.");

      // 3) limpa folhas anteriores desse ciclo e insere as novas
      await limparCiclo(cicloId);
      await supabase.from("ponto_ciclos" as any).update({
        pdf_original_url: path,
        pdf_original_nome: file.name,
        total_paginas: parsed.length,
        total_funcionarios: parsed.filter(p => p.matricula || p.nome).length,
        status: "em_tratamento",
      }).eq("id", cicloId);

      // 4) insere folhas + dias (só os que precisam tratativa)
      await insertParsed(cicloId, parsed);

      toast.success(`PDF processado: ${parsed.length} funcionário(s)`);
      qc.invalidateQueries({ queryKey: ["ponto_ciclo", cicloId] });
      qc.invalidateQueries({ queryKey: ["ponto_folhas", cicloId] });
      qc.invalidateQueries({ queryKey: ["ponto_dias", cicloId] });
      qc.invalidateQueries({ queryKey: ["ponto_ciclos"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload/parser");
    } finally {
      setUploading(false);
    }
  }

  const totalTratativas = dias.length;
  const conformesEstim = folhas.length * 30 - totalTratativas;

  // agrupa dias por folha (funcionário)
  const agrupado = useMemo(() => {
    const map = new Map<string, { folha: Folha; dias: Dia[] }>();
    for (const d of dias) {
      const f = folhas.find(x => x.id === d.folha_id);
      if (!f) continue;
      if (!map.has(f.id)) map.set(f.id, { folha: f, dias: [] });
      map.get(f.id)!.dias.push(d);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.folha.nome ?? "").localeCompare(b.folha.nome ?? "")
    );
  }, [dias, folhas]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/administrativo/gestao-ponto"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Ciclo · {ciclo?.competencia ?? "…"}</h1>
          <p className="text-sm text-muted-foreground">Upload da folha do mês, tratativas e aprovação.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> PDF do mês</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ciclo?.pdf_original_url ? (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{ciclo.pdf_original_nome}</span>
              <Badge variant="outline">{ciclo.total_paginas ?? 0} páginas</Badge>
              <Badge variant="outline">{ciclo.total_funcionarios ?? 0} funcionários</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum PDF enviado ainda.</p>
          )}
          <label className="inline-flex">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }}
              disabled={uploading}
            />
            <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {ciclo?.pdf_original_url ? "Substituir PDF" : "Enviar PDF"}
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Folhas processadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{folhas.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Dias com tratativa pendente</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{totalTratativas}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Em conformidade (estimado)</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Math.max(conformesEstim, 0)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendências por funcionário</CardTitle>
          <p className="text-xs text-muted-foreground">
            Só aparece o que precisa de tratativa: <b>FALTA</b>, <b>ATRASO</b>, <b>HE não autorizada</b>, marcação incompleta ou compensação. Dias em conformidade ficam ocultos.
          </p>
        </CardHeader>
        <CardContent>
          {agrupado.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {folhas.length === 0 ? "Envie o PDF pra iniciar." : "Nada pendente. Tudo em conformidade 🎯"}
            </div>
          ) : (
            <div className="space-y-4">
              {agrupado.map(({ folha, dias: fdias }) => (
                <div key={folha.id} className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{folha.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {folha.matricula && <span>Matrícula: <b>{folha.matricula}</b></span>}
                          {folha.cargo && <span>Cargo: <b>{folha.cargo}</b></span>}
                          {folha.local_trabalho && <span>Local: <b>{folha.local_trabalho}</b></span>}
                          {folha.pagina_pdf && <span>Página {folha.pagina_pdf}</span>}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10">
                      {fdias.length} pendência{fdias.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {fdias.map(d => (
                        <tr key={d.id} className="border-t hover:bg-muted/20">
                          <td className="py-2 pl-4 pr-2 font-mono whitespace-nowrap">
                            {formatDate(d.data)}
                            {d.dia_semana && <span className="text-muted-foreground ml-2">{d.dia_semana}</span>}
                          </td>
                          <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">
                            {(d.marcacoes ?? []).join("  ") || "sem marcação"}
                          </td>
                          <td className="py-2 pr-2">
                            <Badge variant="outline" className={motivoClasse(d.motivo_flag)}>
                              {motivoLabel(d.motivo_flag)}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-right">
                            <Button size="sm" onClick={() => setTratarDia(d)}>Tratar</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {tratarDia && (
        <TratativaDialog
          dia={tratarDia}
          folha={folhas.find(f => f.id === tratarDia.folha_id) ?? null}
          onClose={() => setTratarDia(null)}
          onSaved={() => {
            setTratarDia(null);
            qc.invalidateQueries({ queryKey: ["ponto_dias", cicloId] });
          }}
        />
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function motivoLabel(m: string | null): string {
  switch (m) {
    case "FALTA": return "Falta";
    case "ATRASO": return "Atraso";
    case "HE_A_VALIDAR": return "HE a validar";
    case "AD_NOTURNO_A_VALIDAR": return "Ad. Noturno";
    case "MARCACOES_INCOMPLETAS": return "Marcações incompletas";
    case "SEM_MARCACAO": return "Sem marcação";
    case "REVISAR": return "Revisar";
    default: return m ?? "Revisar";
  }
}
function motivoClasse(m: string | null): string {
  switch (m) {
    case "FALTA": return "border-red-500/40 text-red-300 bg-red-500/10";
    case "ATRASO": return "border-orange-500/40 text-orange-300 bg-orange-500/10";
    case "HE_A_VALIDAR":
    case "AD_NOTURNO_A_VALIDAR": return "border-blue-500/40 text-blue-300 bg-blue-500/10";
    default: return "border-amber-500/40 text-amber-300 bg-amber-500/10";
  }
}

async function limparCiclo(cicloId: string) {
  const { data: fs } = await supabase.from("ponto_folhas" as any).select("id").eq("ciclo_id", cicloId);
  const ids = (fs ?? []).map((f: any) => f.id);
  if (ids.length > 0) {
    await supabase.from("ponto_dias" as any).delete().in("folha_id", ids);
    await supabase.from("ponto_folhas" as any).delete().in("id", ids);
  }
}

function anoDoPeriodo(p: OcrFolha): { ini?: string; fim?: string } {
  const parse = (s?: string) => {
    if (!s) return undefined;
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
  };
  return { ini: parse(p.periodo_inicio), fim: parse(p.periodo_fim) };
}

function diaParaIso(diaDdMm: string, periodoIni?: string, periodoFim?: string): string | null {
  const m = diaDdMm.match(/(\d{2})\/(\d{2})/);
  if (!m) return null;
  const [_, dd, mm] = m;
  // Usa o ano do período que contém o mês; assume período dentro do mesmo ano ou virada.
  const iniY = periodoIni?.slice(0, 4);
  const fimY = periodoFim?.slice(0, 4);
  const iniM = periodoIni?.slice(5, 7);
  const ano = iniY && iniM === mm ? iniY : (fimY ?? iniY ?? String(new Date().getFullYear()));
  return `${ano}-${mm}-${dd}`;
}

function hhmmToMin(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/(\d{1,3}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Regras de conformidade sobre o dado do OCR:
//  - DSR/FOLGA/FERIADO/COMPENSAÇÃO sem marcação → OK
//  - 4 marcações + Trab preenchido + sem HE/faltas/atraso → OK
// Qualquer outra coisa → tratativa (motivo detalhado).
function classificarDia(d: OcrDia): { conforme: boolean; motivo: string } {
  const obs = (d.observacao ?? "").toUpperCase();
  const marcs = d.marcacoes ?? [];
  const trab = hhmmToMin(d.trab);
  const he50 = hhmmToMin(d.h50) ?? 0;
  const he55 = hhmmToMin(d.h55) ?? 0;
  const he60 = hhmmToMin(d.h60) ?? 0;
  const he80 = hhmmToMin(d.h80) ?? 0;
  const he100 = hhmmToMin(d.h100) ?? 0;
  const he110 = hhmmToMin(d.h110) ?? 0;
  const noturno = hhmmToMin(d.noturno) ?? 0;
  const faltas = hhmmToMin(d.faltas) ?? 0;
  const atraso = hhmmToMin(d.atraso) ?? 0;
  const heTotal = he50 + he55 + he60 + he80 + he100 + he110;

  if (marcs.length === 0 && /DSR|FOLGA|FERIADO|COMPENSA/.test(obs)) return { conforme: true, motivo: "" };

  if (faltas > 0) return { conforme: false, motivo: "FALTA" };
  if (atraso > 0) return { conforme: false, motivo: "ATRASO" };
  if (heTotal > 0) return { conforme: false, motivo: "HE_A_VALIDAR" };
  if (noturno > 0) return { conforme: false, motivo: "AD_NOTURNO_A_VALIDAR" };
  if (marcs.length > 0 && marcs.length < 4) return { conforme: false, motivo: "MARCACOES_INCOMPLETAS" };
  if (marcs.length === 0) return { conforme: false, motivo: "SEM_MARCACAO" };
  if (marcs.length >= 4 && trab != null && trab > 0) return { conforme: true, motivo: "" };
  return { conforme: false, motivo: "REVISAR" };
}

async function insertParsed(cicloId: string, parsed: OcrFolha[]) {
  for (const p of parsed) {
    if (!p.matricula && !p.nome) continue;
    const { ini, fim } = anoDoPeriodo(p);
    const totais = p.totais ?? {};
    const { data: folha, error } = await supabase.from("ponto_folhas" as any).insert({
      ciclo_id: cicloId,
      matricula: p.matricula ?? null,
      nome: p.nome ?? null,
      cargo: p.cargo ?? null,
      local_trabalho: p.localizacao ?? null,
      pagina_pdf: p.pagina,
      status: "pendente",
      total_trabalhado_min: hhmmToMin(totais.trabalho),
      total_faltas_min: hhmmToMin(totais.faltas),
      total_he_50_min: hhmmToMin(totais.extras_50),
      total_he_100_min: hhmmToMin(totais.extras_100),
      total_atrasos_min: hhmmToMin(totais.atrasos),
      totais_json: totais as any,
    }).select("id").single();
    if (error) throw error;

    const diasParaInserir = p.dias.map(d => {
      const iso = diaParaIso(d.data, ini, fim);
      const cls = classificarDia(d);
      return iso
        ? {
            folha_id: (folha as any).id,
            data: iso,
            dia_semana: d.dia_semana ?? null,
            escala_codigo: d.hor ?? null,
            marcacoes: d.marcacoes ?? [],
            motivo_flag: cls.motivo || null,
            precisa_tratativa: !cls.conforme,
            status_sistema: cls.conforme ? "conforme" : "pendente",
            minutos_trabalhados: hhmmToMin(d.trab),
            minutos_he_50: hhmmToMin(d.h50),
            minutos_he_100: hhmmToMin(d.h100),
            minutos_atraso: hhmmToMin(d.atraso),
            raw_json: d as any,
          }
        : null;
    }).filter(Boolean);

    // Insere TODOS os dias (conformes ficam registrados como histórico com precisa_tratativa=false),
    // pra fechamento completo do mês.
    if (diasParaInserir.length > 0) {
      const { error: e2 } = await supabase.from("ponto_dias" as any).insert(diasParaInserir as any);
      if (e2) throw e2;
    }
  }
}

function TratativaDialog({ dia, folha, onClose, onSaved }: { dia: Dia; folha: Folha | null; onClose: () => void; onSaved: () => void }) {
  const tipoSugerido = sugerirTipo(dia.motivo_flag);
  const [tipo, setTipo] = useState<string>(tipoSugerido);
  const [descricao, setDescricao] = useState("");
  const [cid, setCid] = useState("");
  const [dataInicio, setDataInicio] = useState(dia.data);
  const [dataFim, setDataFim] = useState(dia.data);
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const tipos = useMemo(() => [
    "ATESTADO", "FALTA_JUSTIFICADA", "FALTA_INJUSTIFICADA", "HE_AUTORIZADA",
    "AJUSTE_MARCACAO", "FOLGA_COMPENSADA", "OUTRO",
  ], []);

  const anexoObrigatorio = tipo === "ATESTADO" || tipo === "FALTA_JUSTIFICADA";

  async function salvar() {
    if (descricao.trim().length < 5) { toast.error("Descreva a tratativa (≥ 5 caracteres)."); return; }
    if (anexoObrigatorio && !anexoFile) { toast.error("Anexe o comprovante (atestado/documento)."); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      let anexo_url: string | null = null;
      let anexo_nome: string | null = null;
      if (anexoFile) {
        const path = `atestados/${dia.folha_id}/${dia.id}-${Date.now()}-${anexoFile.name}`;
        const up = await supabase.storage.from("ponto-pdfs").upload(path, anexoFile, { upsert: false });
        if (up.error) throw up.error;
        anexo_url = path;
        anexo_nome = anexoFile.name;
      }
      const { error } = await supabase.from("ponto_tratativas" as any).insert({
        dia_id: dia.id,
        folha_id: dia.folha_id,
        tipo,
        descricao,
        cid: cid || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        autorizado_por: autorizadoPor || null,
        anexo_url,
        anexo_nome,
        criado_por: userRes.user?.id,
      } as any);
      if (error) throw error;
      await supabase.from("ponto_dias" as any).update({
        precisa_tratativa: false,
        status_sistema: "tratado",
      }).eq("id", dia.id);
      toast.success("Tratativa registrada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tratar dia · {formatDate(dia.data)}{dia.dia_semana ? ` (${dia.dia_semana})` : ""}</DialogTitle>
          <DialogDescription>
            Preencha só a tratativa — os dados do funcionário e do dia vieram do PDF.
          </DialogDescription>
        </DialogHeader>

        {/* Cabeçalho do funcionário (vindo do PDF) */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="font-medium">{folha?.nome ?? "—"}</span>
            {folha?.matricula && <Badge variant="outline" className="font-mono">{folha.matricula}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground grid grid-cols-2 gap-y-1">
            {folha?.cargo && <div>Cargo: <b className="text-foreground">{folha.cargo}</b></div>}
            {folha?.local_trabalho && <div>Local: <b className="text-foreground">{folha.local_trabalho}</b></div>}
            <div>Motivo detectado: <Badge variant="outline" className={motivoClasse(dia.motivo_flag)}>{motivoLabel(dia.motivo_flag)}</Badge></div>
            <div className="col-span-2">Marcações: <span className="font-mono text-foreground">{(dia.marcacoes ?? []).join("  ") || "sem marcação"}</span></div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
              {tipos.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Início</label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Fim</label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
          </div>
          {tipo === "ATESTADO" && (
            <div><label className="text-xs text-muted-foreground">CID</label><Input value={cid} onChange={e => setCid(e.target.value)} placeholder="Ex.: J06.9" /></div>
          )}
          <div><label className="text-xs text-muted-foreground">Autorizado por</label><Input value={autorizadoPor} onChange={e => setAutorizadoPor(e.target.value)} placeholder="Nome do líder/gestor" /></div>
          <div><label className="text-xs text-muted-foreground">Descrição *</label><Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} placeholder="O que aconteceu / providência tomada" /></div>

          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Anexo (atestado/comprovante) {anexoObrigatorio && <span className="text-red-400">*</span>}
            </label>
            {anexoFile ? (
              <div className="flex items-center justify-between gap-2 mt-1 rounded-md border px-2 py-1.5 text-sm bg-muted/20">
                <span className="truncate">{anexoFile.name}</span>
                <Button size="sm" variant="ghost" onClick={() => setAnexoFile(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <label className="inline-flex mt-1">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setAnexoFile(f); e.currentTarget.value = ""; }}
                />
                <span className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
                  <Upload className="h-4 w-4" /> Selecionar arquivo (PDF ou foto)
                </span>
              </label>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {anexoObrigatorio
                ? "Obrigatório: envie o atestado/comprovante que justifica a tratativa."
                : "Opcional — anexe se houver documento de suporte."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar tratativa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sugerirTipo(motivo: string | null): string {
  switch (motivo) {
    case "FALTA": return "ATESTADO";
    case "ATRASO": return "ATESTADO";
    case "HE_A_VALIDAR": return "HE_AUTORIZADA";
    case "MARCACOES_INCOMPLETAS":
    case "SEM_MARCACAO": return "AJUSTE_MARCACAO";
    default: return "OUTRO";
  }
}