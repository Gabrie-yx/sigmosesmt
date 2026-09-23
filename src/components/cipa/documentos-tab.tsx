import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarDays, FileText, Printer, Save, Trash2, Upload, CheckCircle2, CircleDashed } from "lucide-react";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { CipaEmployeePicker, useCipaEmployees } from "@/components/cipa/employee-picker";
import { calcularCalendario, diaSemana, uteisAntes, type EtapaKey } from "@/lib/cipa-calendario-eleitoral";
import { addDays, type EleicaoDados } from "@/lib/cipa-eleicao";
import { cargaCapacitacao } from "@/lib/cipa-dimensionamento";
import { DOCS_LISTA, fmtBR, pdfCalendarioReunioes, type DocsCfg, type DocsCtx } from "@/lib/cipa-docs-pdf";

type Props = {
  gestao: {
    id: string; gestao: string; data_inicio: string; data_fim: string; grau_risco: number | null; num_empregados: number | null;
    efetivos_empregados: number | null; suplentes_empregados: number | null; efetivos_empregador: number | null; suplentes_empregador: number | null;
    eleicao?: unknown;
  };
};

const BUCKET = "training-docs";

export function DocumentosTab({ gestao }: Props) {
  const qc = useQueryClient();
  const eleicao = ((gestao.eleicao as any) ?? {}) as EleicaoDados & { docs?: DocsCfg };
  const [cfg, setCfg] = useState<DocsCfg>(() => eleicao.docs ?? {});
  useEffect(() => { setCfg(((gestao.eleicao as any)?.docs as DocsCfg) ?? {}); }, [gestao.id, gestao.eleicao]);
  const set = <K extends keyof DocsCfg>(k: K, v: DocsCfg[K]) => setCfg((p) => ({ ...p, [k]: v }));

  const { data: funcs } = useCipaEmployees();
  const { data: membros } = useQuery({
    queryKey: ["cipa", "membros-docs", gestao.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cipa_membros")
        .select("representacao, papel, ordem_suplencia, status, employees(nome, matricula, setor)")
        .eq("gestao_id", gestao.id).neq("status", "DESLIGADO");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const posse = cfg.posse || gestao.data_inicio;
  const cal = useMemo(() => calcularCalendario(posse, (cfg.overrides ?? {}) as any), [posse, cfg.overrides]);
  const byId = useMemo(() => new Map((funcs ?? []).map((f) => [f.id, f])), [funcs]);

  const salvar = useMutation({
    mutationFn: async (novo: DocsCfg) => {
      const { data: atual, error: e1 } = await supabase.from("cipa_gestoes").select("eleicao").eq("id", gestao.id).single();
      if (e1) throw e1;
      const merged = { ...((atual?.eleicao as any) ?? {}), docs: novo };
      const { error } = await supabase.from("cipa_gestoes").update({ eleicao: merged }).eq("id", gestao.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados dos documentos salvos"); qc.invalidateQueries({ queryKey: ["cipa", "gestoes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Documento em pré-visualização
  const [pdf, setPdf] = useState<{ doc: jsPDF; titulo: string } | null>(null);

  async function montarCtx(): Promise<DocsCtx> {
    const comissao = (cfg.comissao ?? []).map((c) => {
      const f = byId.get(c.employee_id);
      return { nome: f?.nome ?? "", matricula: f?.matricula, setor: f?.setor, funcao: c.funcao };
    });
    const candidatos = (eleicao.candidatos ?? []).map((k, i) => {
      const f = byId.get(k.employee_id);
      return { nome: k.nome, matricula: f?.matricula, setor: f?.setor, numero: i + 1, votos: k.votos, inscricao_em: k.inscricao_em } as any;
    });
    const ms = (membros ?? []).map((m) => ({ nome: m.employees?.nome ?? "", matricula: m.employees?.matricula, setor: m.employees?.setor, representacao: m.representacao, papel: m.papel }));
    const votantes = (eleicao.votantes_dia3 ?? eleicao.votantes_dia2 ?? eleicao.votantes_dia1) ?? null;
    const qrTxt = `CIPA ${gestao.gestao} - EDITAL DE CONVOCAÇÃO\nInscrições: ${fmtBR(cal.find((e) => e.key === "inicio_inscricoes")?.corrigida)} a ${fmtBR(cal.find((e) => e.key === "fim_inscricoes")?.corrigida)}\nLocal: ${cfg.local_inscricao || "SESMT"} (${cfg.horario_inicio || "07h30"} às ${cfg.horario_fim || "17h30"})\nEleição: ${fmtBR(cal.find((e) => e.key === "eleicao")?.corrigida)}\nPosse: ${fmtBR(posse)}`;
    const qr = await QRCode.toDataURL(qrTxt, { margin: 1, width: 300 });
    return {
      gestao, cal, cfg, comissao, candidatos, membros: ms,
      eleitores: (funcs ?? []).map((f) => ({ nome: f.nome, matricula: f.matricula, setor: f.setor })),
      eleitoresAptos: eleicao.eleitores_aptos ?? null, votantes,
      cargaHoras: cargaCapacitacao(gestao.grau_risco), qr,
    };
  }

  const datasReunioes = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(posse + "T00:00:00"); d.setMonth(d.getMonth() + i + 1); d.setDate(15);
    return uteisAntes(d.toISOString().slice(0, 10));
  }), [posse]);

  async function gerar(id: string, titulo: string, fn: any) {
    try {
      const ctx = await montarCtx();
      const doc = id === "reunioes" ? pdfCalendarioReunioes(ctx, datasReunioes) : fn(ctx);
      setPdf({ doc, titulo });
    } catch (e: any) { toast.error(e.message ?? "Falha ao gerar"); }
  }

  // Evidências (foto do mural / protocolo do sindicato)
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const out: Record<string, string> = {};
      for (const k of ["mural_foto_path", "protocolo_path"] as const) {
        const p = cfg[k];
        if (p) { const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p, 3600); if (data) out[k] = data.signedUrl; }
      }
      setUrls(out);
    })();
  }, [cfg.mural_foto_path, cfg.protocolo_path]);

  async function upload(k: "mural_foto_path" | "protocolo_path", file: File) {
    const path = `cipa/${gestao.id}/${k}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const novo = { ...cfg, [k]: path };
    setCfg(novo); salvar.mutate(novo);
  }

  const setOverride = (k: EtapaKey, v: string) => {
    const o = { ...(cfg.overrides ?? {}) };
    if (v) o[k] = v; else delete o[k];
    set("overrides", o);
  };

  const comissao = cfg.comissao ?? [];
  const candN = (eleicao.candidatos ?? []).length;
  const pend: Record<string, string | null> = {
    comissao: comissao.some((c) => c.funcao === "PRESIDENTE") ? null : "Defina o presidente da comissão",
    comprovantes: candN ? null : "Registre candidatos na aba Eleição",
    candidatos: candN ? null : "Registre candidatos na aba Eleição",
    cedulas: candN ? null : "Registre candidatos na aba Eleição",
    apuracao: (eleicao.candidatos ?? []).some((k) => k.votos != null) ? null : "Lance os votos na aba Eleição",
    resultado: (membros ?? []).some((m) => m.representacao === "EMPREGADOS") ? null : "Lance os eleitos em Membros",
    posse: (membros ?? []).length ? null : "Cadastre os membros",
    certificados: (membros ?? []).length ? null : "Cadastre os membros",
    convocacao: cfg.rep_empresa_nome ? null : "Informe quem assina pela empresa",
  };

  return (
    <div className="space-y-4">
      {/* Calendário */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h3 className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Calendário do processo eleitoral</h3>
            <p className="text-xs text-muted-foreground">Informe a data da posse da nova gestão; todas as etapas são calculadas. Fim de semana ou feriado → antecipa para o dia útil anterior.</p>
          </div>
          <div className="flex items-end gap-2">
            <div><Label className="text-xs">Data da posse</Label><Input type="date" value={posse} onChange={(e) => set("posse", e.target.value)} className="w-44" /></div>
            <Button variant="outline" size="sm" onClick={() => set("overrides", {})}>Recalcular tudo</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
              <th className="text-left p-2">Etapa</th><th className="text-left p-2">Prazo legal</th><th className="text-left p-2">Data exata</th><th className="text-left p-2">Data corrigida (editável)</th>
            </tr></thead>
            <tbody>
              {cal.map((e) => (
                <tr key={e.key} className="border-b border-border/50">
                  <td className="p-2 font-medium">{e.etapa}</td>
                  <td className="p-2 text-xs text-muted-foreground">{e.prazo}</td>
                  <td className="p-2 text-xs">{fmtBR(e.exata)} <span className="text-muted-foreground">{diaSemana(e.exata)}</span></td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Input type="date" value={e.corrigida} onChange={(ev) => setOverride(e.key, ev.target.value)} className="h-8 w-40" />
                      <span className="text-xs text-muted-foreground">{diaSemana(e.corrigida)}</span>
                      {e.ajustada && <Badge variant="outline" className="text-[10px]">manual</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dados */}
      <Card className="p-4 space-y-4">
        <h3 className="font-bold">Dados usados nos documentos</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div><Label className="text-xs">Assina pela empresa (nome)</Label><Input value={cfg.rep_empresa_nome ?? ""} onChange={(e) => set("rep_empresa_nome", e.target.value)} placeholder="Ex.: Anderson de Oliveira Soares" /></div>
          <div><Label className="text-xs">Cargo de quem assina</Label><Input value={cfg.rep_empresa_cargo ?? ""} onChange={(e) => set("rep_empresa_cargo", e.target.value)} placeholder="Ex.: Supervisor Administrativo" /></div>
          <div><Label className="text-xs">Presidente da CIPA em exercício</Label><Input value={cfg.presidente_cipa_nome ?? ""} onChange={(e) => set("presidente_cipa_nome", e.target.value)} /></div>
          <div className="md:col-span-2"><Label className="text-xs">Sindicato</Label><Input value={cfg.sindicato_nome ?? ""} onChange={(e) => set("sindicato_nome", e.target.value)} placeholder="Sindicato dos Metalúrgicos do Amazonas" /></div>
          <div><Label className="text-xs">Local das inscrições</Label><Input value={cfg.local_inscricao ?? ""} onChange={(e) => set("local_inscricao", e.target.value)} placeholder="SESMT" /></div>
          <div><Label className="text-xs">Horário início</Label><Input value={cfg.horario_inicio ?? ""} onChange={(e) => set("horario_inicio", e.target.value)} placeholder="07h30" /></div>
          <div><Label className="text-xs">Horário fim</Label><Input value={cfg.horario_fim ?? ""} onChange={(e) => set("horario_fim", e.target.value)} placeholder="17h30" /></div>
          <div><Label className="text-xs">Horário das reuniões</Label><Input value={cfg.reunioes_horario ?? ""} onChange={(e) => set("reunioes_horario", e.target.value)} placeholder="13h30 às 14h00" /></div>
          <div><Label className="text-xs">Apuração — local</Label><Input value={cfg.apuracao_local ?? ""} onChange={(e) => set("apuracao_local", e.target.value)} placeholder="Refeitório" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Início apuração</Label><Input value={cfg.apuracao_hora_inicio ?? ""} onChange={(e) => set("apuracao_hora_inicio", e.target.value)} placeholder="09h40" /></div>
            <div><Label className="text-xs">Fim apuração</Label><Input value={cfg.apuracao_hora_fim ?? ""} onChange={(e) => set("apuracao_hora_fim", e.target.value)} placeholder="11h00" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Votos brancos</Label><Input type="number" value={cfg.votos_brancos ?? ""} onChange={(e) => set("votos_brancos", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div><Label className="text-xs">Votos nulos</Label><Input type="number" value={cfg.votos_nulos ?? ""} onChange={(e) => set("votos_nulos", e.target.value === "" ? null : Number(e.target.value))} /></div>
          </div>
          <div className="md:col-span-3"><Label className="text-xs">Período do treinamento (certificado)</Label><Input value={cfg.treinamento_periodo ?? ""} onChange={(e) => set("treinamento_periodo", e.target.value)} placeholder="nos dias 16 e 17 de dezembro de 2026" /></div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Comissão eleitoral</Label>
          {comissao.map((c, i) => (
            <div key={c.employee_id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{byId.get(c.employee_id)?.nome ?? "—"} <span className="text-xs text-muted-foreground">{byId.get(c.employee_id)?.setor ?? ""}</span></span>
              <Select value={c.funcao} onValueChange={(v) => set("comissao", comissao.map((x, j) => (j === i ? { ...x, funcao: v as any } : x)))}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PRESIDENTE">Presidente</SelectItem><SelectItem value="SECRETARIO">Secretário(a)</SelectItem><SelectItem value="MEMBRO">Membro</SelectItem></SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => set("comissao", comissao.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <CipaEmployeePicker funcs={funcs} value="" label={null} placeholder="+ Adicionar membro da comissão…" triggerClassName="md:w-96"
            excludeIds={comissao.map((c) => c.employee_id)}
            onChange={(id) => id && set("comissao", [...comissao, { employee_id: id, funcao: comissao.length === 0 ? "PRESIDENTE" : comissao.length === 1 ? "SECRETARIO" : "MEMBRO" }])} />
        </div>
        <Button onClick={() => salvar.mutate(cfg)} disabled={salvar.isPending} className="gap-1"><Save className="h-4 w-4" /> Salvar dados e calendário</Button>
      </Card>

      {/* Documentos */}
      <Card className="p-4 space-y-2">
        <h3 className="font-bold flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos do processo</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {DOCS_LISTA.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
              {pend[d.id] ? <CircleDashed className="h-4 w-4 text-amber-500 shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.titulo}</div>
                {pend[d.id] && <div className="text-[11px] text-amber-500">{pend[d.id]}</div>}
              </div>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => gerar(d.id, d.titulo, d.fn)}><Printer className="h-3.5 w-3.5" /> Gerar</Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Divulgação */}
      <Card className="p-4 space-y-3">
        <h3 className="font-bold">Divulgação do edital de convocação</h3>
        <p className="text-xs text-muted-foreground">NR-05 5.5.1: publicar e divulgar em local de fácil acesso e visualização, e enviar cópia ao sindicato. O edital impresso já sai com QR Code (resumo do edital para o celular).</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="font-medium text-sm">1. Mural (foto como prova)</div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Data da afixação</Label><Input type="date" value={cfg.mural_data ?? ""} onChange={(e) => set("mural_data", e.target.value)} /></div>
              <div><Label className="text-xs">Local</Label><Input value={cfg.mural_local ?? ""} onChange={(e) => set("mural_local", e.target.value)} placeholder="Refeitório / portaria" /></div>
            </div>
            <label className="inline-flex items-center gap-1 text-sm cursor-pointer text-primary"><Upload className="h-4 w-4" /> Enviar foto do mural
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload("mural_foto_path", e.target.files[0])} /></label>
            {urls.mural_foto_path && <img src={urls.mural_foto_path} alt="Edital afixado no mural" className="max-h-48 rounded border border-border" />}
          </div>
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="font-medium text-sm">2. Protocolo do sindicato</div>
            <div><Label className="text-xs">Data do protocolo</Label><Input type="date" value={cfg.protocolo_data ?? ""} onChange={(e) => set("protocolo_data", e.target.value)} className="w-44" /></div>
            <label className="inline-flex items-center gap-1 text-sm cursor-pointer text-primary"><Upload className="h-4 w-4" /> Enviar foto do ofício carimbado
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload("protocolo_path", e.target.files[0])} /></label>
            {urls.protocolo_path && <img src={urls.protocolo_path} alt="Ofício protocolado no sindicato" className="max-h-48 rounded border border-border" />}
          </div>
        </div>
        <Button variant="outline" onClick={() => salvar.mutate(cfg)} disabled={salvar.isPending} className="gap-1"><Save className="h-4 w-4" /> Salvar divulgação</Button>
      </Card>

      <PDFPreviewDialog open={!!pdf} onClose={() => setPdf(null)} doc={pdf?.doc ?? null} title={pdf?.titulo}
        fileName={`CIPA_${gestao.gestao.replace(/\W+/g, "-")}_${(pdf?.titulo ?? "doc").replace(/\W+/g, "_")}.pdf`} />
    </div>
  );
}

// evita aviso de import não usado em builds estritos
void addDays;
