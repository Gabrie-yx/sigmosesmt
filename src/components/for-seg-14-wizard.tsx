import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, FileText, PenLine, X } from "lucide-react";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { gerarForSeg14, type RIAData } from "@/lib/for-seg-14-pdf";
import { sugerirForSeg14IA } from "@/lib/for-seg-14.functions";
import type jsPDF from "jspdf";
import { formatDateBR } from "@/lib/utils-date";

const OPCOES: Record<string, string[]> = {
  fonte_lesao: ["Máquinas / equipamentos","Ferramentas manuais","Veículos","Materiais","Quedas de altura","Quedas mesmo nível","Energia elétrica","Produtos químicos","Calor / fogo","Ruído","Movimentação manual","Outro"],
  tipo_acidente: ["Impacto contra","Impacto sofrido","Queda","Prensagem","Aprisionamento","Choque elétrico","Queimadura","Exposição química","Esforço excessivo","Cortante / perfurante","Projeção de partículas","Outro"],
  atos_inseguros: ["Operar sem autorização","Não usar EPI","Velocidade imprópria","Posicionamento inadequado","Falta de atenção","Brincadeiras","Desativar dispositivo de segurança","Manutenção em equipamento ligado","Não seguir procedimento","Carregar de forma incorreta","Improvisação","Outro"],
  fator_pessoal: ["Falta de conhecimento","Falta de habilidade","Motivação inadequada","Capacidade física inadequada","Capacidade mental inadequada","Fadiga","Estresse","Outro"],
  condicoes_inseguras: ["Proteção / barreira inadequada","EPI inadequado","Ferramenta defeituosa","Iluminação inadequada","Ventilação inadequada","Ruído excessivo","Piso escorregadio / irregular","Sinalização inadequada","Espaço inadequado","Exposição química","Outro"],
  fator_trabalho: ["Supervisão inadequada","Engenharia inadequada","Compra inadequada","Manutenção inadequada","Procedimento inadequado","Comunicação deficiente","Liderança deficiente","Pressão por produção","Outro"],
  natureza_lesao: ["Contusão","Corte / laceração","Fratura","Queimadura","Perfuração","Amputação","Luxação / entorse","Distensão muscular","Trauma","Intoxicação","Lesão por esforço repetitivo","Outro"],
  localizacao_lesao: ["Cabeça","Olhos","Face","Pescoço","Tórax","Abdômen","Coluna","Membros superiores","Mãos","Membros inferiores","Pés","Múltiplas","Outro"],
  procedimentos_medicos: ["Primeiros socorros","Atendimento ambulatorial","Pronto-socorro","Internação","Cirurgia","Reabilitação","Acompanhamento médico","Não houve","Outro"],
};
const QUADROS: Array<{ key: string; titulo: string }> = [
  { key: "fonte_lesao", titulo: "D1 — Fonte da lesão" },
  { key: "tipo_acidente", titulo: "D2 — Tipo de acidente" },
  { key: "atos_inseguros", titulo: "D3 — Atos inseguros" },
  { key: "fator_pessoal", titulo: "D4 — Fator pessoal" },
  { key: "condicoes_inseguras", titulo: "D5 — Condições inseguras" },
  { key: "fator_trabalho", titulo: "D6 — Fator de trabalho" },
  { key: "natureza_lesao", titulo: "D7 — Natureza da lesão" },
  { key: "localizacao_lesao", titulo: "D8 — Localização da lesão" },
  { key: "procedimentos_medicos", titulo: "D9 — Procedimentos médicos" },
];

async function fetchImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from("incident-photos").download(path);
    if (error || !data) return null;
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(data);
    });
  } catch { return null; }
}

export function ForSeg14Wizard({
  open, onClose, acidente, companies,
}: {
  open: boolean;
  onClose: () => void;
  acidente: any;
  companies: Array<{ id: string; name: string }>;
}) {
  const qc = useQueryClient();
  const sugerirIA = useServerFn(sugerirForSeg14IA);
  const [step, setStep] = useState("1");
  const [data, setData] = useState<RIAData>({});
  const [pdf, setPdf] = useState<jsPDF | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [sigOpen, setSigOpen] = useState<null | "sesmt" | "encarregado" | "cipa" | "gerente">(null);

  const emp = companies.find((c) => c.id === acidente?.company_id);

  // Pré-carrega plano de ações vinculadas (via NC ligada ao acidente)
  const { data: acoesVinculadas = [] } = useQuery({
    queryKey: ["plano-acoes-acidente", acidente?.id],
    enabled: !!acidente?.id && open,
    queryFn: async () => {
      const { data: ncs } = await supabase
        .from("nao_conformidades")
        .select("id")
        .eq("pendencia_origem", `acidentes_trabalho:${acidente.id}`);
      const ncIds = (ncs ?? []).map((n: any) => n.id);
      if (!ncIds.length) return [];
      const { data: pa } = await supabase
        .from("plano_acoes")
        .select("id, titulo, descricao, quando, responsavel_execucao, status")
        .in("nc_id", ncIds);
      return pa ?? [];
    },
  });

  // Carrega relatório existente (mais recente) p/ este acidente
  const { data: relatorios = [] } = useQuery({
    queryKey: ["ria", acidente?.id],
    enabled: !!acidente?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("relatorios_investigacao_acidente")
        .select("*")
        .eq("acidente_id", acidente.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Inicializa dados a partir do acidente + ações importadas
  useEffect(() => {
    if (!open || !acidente) return;
    const existente = relatorios[0];
    if (existente) {
      setData({
        numero: existente.numero,
        ...((existente.dados_gerais ?? {}) as Record<string, unknown>),
        enquadramento: (existente.enquadramento ?? {}) as Record<string, string[]>,
        porques: (existente.porques ?? []) as RIAData["porques"],
        acoes_imediatas: (existente.acoes_imediatas ?? []) as RIAData["acoes_imediatas"],
        plano_acao: (existente.plano_acao ?? []) as RIAData["plano_acao"],
        participantes: (existente.participantes ?? []) as RIAData["participantes"],
        assinaturas: (existente.assinaturas ?? {}) as RIAData["assinaturas"],
        fotos_local: (existente.fotos_local ?? []) as string[],
        fotos_lesao: (existente.fotos_lesao ?? []) as string[],
      });
      return;
    }
    const planoFromDb = (acoesVinculadas ?? []).map((p: any) => ({
      acao: p.titulo || p.descricao || "—",
      prazo: p.quando ? formatDateBR(p.quando) : "—",
      responsavel: p.responsavel_execucao || "—",
      status: p.status || "ABERTA",
    }));
    setData({
      obra_setor: `${emp?.name ?? ""}${acidente.vitima_setor ? " — " + acidente.vitima_setor : ""}`,
      data_acidente: acidente.data_acidente ? formatDateBR(acidente.data_acidente) : "",
      endereco: [acidente.local_municipio, acidente.local_uf].filter(Boolean).join(" / "),
      descricao: acidente.descricao || "",
      vitima_fatal: acidente.tipo === "FATAL",
      hora: acidente.hora_acidente ?? "",
      horas_trabalhadas: acidente.horas_trabalhadas_antes != null ? String(acidente.horas_trabalhadas_antes) : "",
      local_acidente: acidente.local_acidente ?? "",
      vitima_nome: acidente.vitima_nome ?? "",
      vitima_funcao: acidente.vitima_cargo ?? "",
      vitima_re: acidente.vitima_matricula ?? "",
      vitima_admissao: "",
      tipo_funcionario: "PROPRIO",
      categoria:
        acidente.tipo === "FATAL" ? "FATAL" :
        acidente.tipo === "COM_AFASTAMENTO" ? "COM_AFAST" : "SEM_AFAST",
      tipo_servico: "",
      instruido: undefined, hora_extra: undefined, acidente_anterior: undefined,
      tinha_pt: undefined, tinha_apr: undefined, fez_integracao: undefined, tinha_os: undefined,
      superior: "", testemunhas: acidente.testemunhas ?? "", epis: "",
      enquadramento: {},
      porques: [{pergunta:"", resposta:""},{pergunta:"", resposta:""},{pergunta:"", resposta:""},{pergunta:"", resposta:""},{pergunta:"", resposta:""}],
      causa_imediata: acidente.causa_imediata ?? "",
      causa_basica: acidente.causa_basica ?? "",
      acoes_imediatas: [],
      plano_acao: planoFromDb,
      participantes: [],
      assinaturas: {},
      fotos_local: [],
      fotos_lesao: [],
    });
    // Pré-carrega fotos do acidente
    (async () => {
      const paths: string[] = acidente.evidencias_urls ?? [];
      const urls: string[] = [];
      for (const p of paths.slice(0, 6)) {
        const u = await fetchImageAsDataUrl(p);
        if (u) urls.push(u);
      }
      if (urls.length) setData((d) => ({ ...d, fotos_local: urls }));
    })();
  }, [open, acidente, emp?.name, relatorios.length, acoesVinculadas.length]);

  const set = <K extends keyof RIAData>(k: K, v: RIAData[K]) => setData((d) => ({ ...d, [k]: v }));

  const iaMut = useMutation({
    mutationFn: async () =>
      sugerirIA({ data: {
        acidenteId: acidente.id,
        descricao: data.descricao || acidente.descricao || "",
        parteCorpo: acidente.parte_corpo_atingida,
        naturezaLesao: acidente.natureza_lesao,
        agenteCausador: acidente.agente_causador,
        local: acidente.local_acidente,
        cargo: acidente.vitima_cargo,
      }}),
    onSuccess: (r: any) => {
      if (r?.error || !r?.sugestao) { toast.error(r?.error || "IA não retornou sugestão"); return; }
      setData((d) => ({
        ...d,
        enquadramento: r.sugestao.enquadramento ?? d.enquadramento,
        porques: Array.isArray(r.sugestao.porques) && r.sugestao.porques.length ? r.sugestao.porques : d.porques,
        causa_imediata: r.sugestao.causa_imediata ?? d.causa_imediata,
        causa_basica: r.sugestao.causa_basica ?? d.causa_basica,
      }));
      toast.success("Sugestões da IA aplicadas — revise antes de gerar");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro IA"),
  });

  const salvarMut = useMutation({
    mutationFn: async () => {
      const { numero, enquadramento, porques, acoes_imediatas, plano_acao, participantes, assinaturas, fotos_local, fotos_lesao, ...gerais } = data;
      const payload = {
        acidente_id: acidente.id,
        dados_gerais: gerais,
        enquadramento: enquadramento ?? {},
        porques: porques ?? [],
        acoes_imediatas: acoes_imediatas ?? [],
        plano_acao: plano_acao ?? [],
        participantes: participantes ?? [],
        assinaturas: assinaturas ?? {},
        fotos_local: fotos_local ?? [],
        fotos_lesao: fotos_lesao ?? [],
        status: "GERADO",
      };
      const existente = relatorios[0];
      if (existente) {
        const { error } = await supabase
          .from("relatorios_investigacao_acidente")
          .update(payload).eq("id", existente.id);
        if (error) throw error;
        return { ...payload, numero: existente.numero };
      } else {
        const { data: ins, error } = await supabase
          .from("relatorios_investigacao_acidente")
          .insert(payload).select("numero").single();
        if (error) throw error;
        return { ...payload, numero: ins?.numero };
      }
    },
    onSuccess: (saved: any) => {
      const doc = gerarForSeg14({ ...data, numero: saved.numero });
      setPdf(doc);
      setPdfOpen(true);
      qc.invalidateQueries({ queryKey: ["ria", acidente.id] });
      toast.success(`Relatório ${saved.numero} salvo`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const toggleEnq = (k: string, v: string, checked: boolean) => {
    setData((d) => {
      const cur = (d.enquadramento ?? {})[k] ?? [];
      const next = checked ? [...new Set([...cur, v])] : cur.filter((x) => x !== v);
      return { ...d, enquadramento: { ...(d.enquadramento ?? {}), [k]: next } };
    });
  };

  const setPorque = (i: number, k: "pergunta" | "resposta", v: string) => {
    setData((d) => {
      const arr = [...(d.porques ?? [])];
      arr[i] = { ...(arr[i] ?? { pergunta: "", resposta: "" }), [k]: v };
      return { ...d, porques: arr };
    });
  };

  const yesNo = (v: boolean | undefined, set: (b: boolean | undefined) => void) => (
    <div className="flex gap-1.5">
      <Button type="button" size="sm" variant={v === true ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => set(true)}>Sim</Button>
      <Button type="button" size="sm" variant={v === false ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => set(false)}>Não</Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => set(undefined)}>—</Button>
    </div>
  );

  const sigBlocks = useMemo(() =>
    (["sesmt","encarregado","cipa","gerente"] as const).map((k) => ({
      key: k,
      label: { sesmt:"SESMT", encarregado:"Encarregado", cipa:"CIPA", gerente:"Gerente ADM" }[k],
    })), []);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              FOR-SEG 14 · Investigação de Acidente
              {data.numero && <span className="text-xs text-muted-foreground">({data.numero})</span>}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={step} onValueChange={setStep} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="1">A/B · Dados</TabsTrigger>
              <TabsTrigger value="2">D · Enquadramento</TabsTrigger>
              <TabsTrigger value="3">E · 5 Porquês</TabsTrigger>
              <TabsTrigger value="4">F/J · Ações</TabsTrigger>
              <TabsTrigger value="5">I · Equipe</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1">
              <TabsContent value="1" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Obra / Setor"><Input value={data.obra_setor ?? ""} onChange={(e) => set("obra_setor", e.target.value)} /></Field>
                  <Field label="Data do acidente"><Input value={data.data_acidente ?? ""} onChange={(e) => set("data_acidente", e.target.value)} /></Field>
                </div>
                <Field label="Endereço"><Input value={data.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} /></Field>
                <Field label="Descrição do acidente"><Textarea rows={4} value={data.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Hora"><Input value={data.hora ?? ""} onChange={(e) => set("hora", e.target.value)} /></Field>
                  <Field label="Hs trabalhadas"><Input value={data.horas_trabalhadas ?? ""} onChange={(e) => set("horas_trabalhadas", e.target.value)} /></Field>
                  <Field label="Local do acidente"><Input value={data.local_acidente ?? ""} onChange={(e) => set("local_acidente", e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome do acidentado"><Input value={data.vitima_nome ?? ""} onChange={(e) => set("vitima_nome", e.target.value)} /></Field>
                  <Field label="RE / Matrícula"><Input value={data.vitima_re ?? ""} onChange={(e) => set("vitima_re", e.target.value)} /></Field>
                  <Field label="Função"><Input value={data.vitima_funcao ?? ""} onChange={(e) => set("vitima_funcao", e.target.value)} /></Field>
                  <Field label="Data admissão"><Input placeholder="dd/mm/aaaa" value={data.vitima_admissao ?? ""} onChange={(e) => set("vitima_admissao", e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo de funcionário">
                    <div className="flex gap-2">
                      {["PROPRIO","TERCEIRO"].map((v) => (
                        <Button key={v} type="button" size="sm" variant={data.tipo_funcionario === v ? "default" : "outline"} onClick={() => set("tipo_funcionario", v)}>{v}</Button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Categoria do acidente">
                    <div className="flex flex-wrap gap-2">
                      {[["SEM_AFAST","S/ afast"],["COM_DTC","C/ DTC"],["COM_AFAST","C/ afast"],["FATAL","Fatal"]].map(([v,l]) => (
                        <Button key={v} type="button" size="sm" variant={data.categoria === v ? "default" : "outline"} onClick={() => set("categoria", v)}>{l}</Button>
                      ))}
                    </div>
                  </Field>
                </div>
                <Field label="Tipo de serviço"><Input value={data.tipo_servico ?? ""} onChange={(e) => set("tipo_servico", e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Superior imediato"><Input value={data.superior ?? ""} onChange={(e) => set("superior", e.target.value)} /></Field>
                  <Field label="Testemunhas"><Input value={data.testemunhas ?? ""} onChange={(e) => set("testemunhas", e.target.value)} /></Field>
                </div>
                <Field label="EPIs utilizados no momento"><Input value={data.epis ?? ""} onChange={(e) => set("epis", e.target.value)} /></Field>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Recebeu instruções">{yesNo(data.instruido, (b) => set("instruido", b))}</Field>
                  <Field label="Hora extra">{yesNo(data.hora_extra, (b) => set("hora_extra", b))}</Field>
                  <Field label="Acidente anterior">{yesNo(data.acidente_anterior, (b) => set("acidente_anterior", b))}</Field>
                  <Field label="PT emitida">{yesNo(data.tinha_pt, (b) => set("tinha_pt", b))}</Field>
                  <Field label="APR da tarefa">{yesNo(data.tinha_apr, (b) => set("tinha_apr", b))}</Field>
                  <Field label="Fez integração">{yesNo(data.fez_integracao, (b) => set("fez_integracao", b))}</Field>
                  <Field label="OS do cargo">{yesNo(data.tinha_os, (b) => set("tinha_os", b))}</Field>
                  <Field label="Vítima fatal">{yesNo(data.vitima_fatal, (b) => set("vitima_fatal", b))}</Field>
                </div>
              </TabsContent>

              <TabsContent value="2" className="space-y-3 mt-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">Marque as opções aplicáveis em cada quadro. A IA pode sugerir um pré-preenchimento.</p>
                  <Button size="sm" variant="outline" onClick={() => iaMut.mutate()} disabled={iaMut.isPending} className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />{iaMut.isPending ? "Sugerindo..." : "Sugerir D + E com IA"}
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {QUADROS.map((q) => (
                    <div key={q.key} className="border rounded p-2">
                      <div className="text-xs font-bold uppercase text-slate-700 mb-1.5">{q.titulo}</div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        {OPCOES[q.key].map((o) => {
                          const checked = (data.enquadramento?.[q.key] ?? []).includes(o);
                          return (
                            <label key={o} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                              <Checkbox checked={checked} onCheckedChange={(c) => toggleEnq(q.key, o, !!c)} className="h-3.5 w-3.5" />
                              <span>{o}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="3" className="space-y-3 mt-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => iaMut.mutate()} disabled={iaMut.isPending} className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />{iaMut.isPending ? "Sugerindo..." : "Sugerir D + E com IA"}
                  </Button>
                </div>
                {(data.porques ?? []).map((p, i) => (
                  <div key={i} className="grid md:grid-cols-[40px_1fr_1fr] gap-2 items-start">
                    <div className="text-lg font-bold text-slate-400 mt-2">{i+1}.</div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Pergunta</Label>
                      <Input value={p.pergunta} onChange={(e) => setPorque(i, "pergunta", e.target.value)} placeholder="Por que…" />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Resposta</Label>
                      <Input value={p.resposta} onChange={(e) => setPorque(i, "resposta", e.target.value)} />
                    </div>
                  </div>
                ))}
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Causa imediata"><Textarea rows={3} value={data.causa_imediata ?? ""} onChange={(e) => set("causa_imediata", e.target.value)} /></Field>
                  <Field label="Causa básica (raiz)"><Textarea rows={3} value={data.causa_basica ?? ""} onChange={(e) => set("causa_basica", e.target.value)} /></Field>
                </div>
              </TabsContent>

              <TabsContent value="4" className="space-y-4 mt-3">
                <RepeatList
                  title="F — Ações imediatas tomadas"
                  items={data.acoes_imediatas ?? []}
                  cols={[{ k: "acao", label: "Ação", wide: true }, { k: "quem", label: "Quem" }, { k: "status", label: "Status" }]}
                  onChange={(v) => set("acoes_imediatas", v as any)}
                  empty={{ acao: "", quem: "", status: "" }}
                />
                <RepeatList
                  title="J — Plano de ação (corretivas/preventivas)"
                  hint={acoesVinculadas.length ? `${acoesVinculadas.length} ação(ões) importadas do Plano de Ações vinculado` : "Adicione manualmente ou vincule via NC"}
                  items={data.plano_acao ?? []}
                  cols={[{ k: "acao", label: "Ação", wide: true }, { k: "prazo", label: "Prazo" }, { k: "responsavel", label: "Responsável" }, { k: "status", label: "Status" }]}
                  onChange={(v) => set("plano_acao", v as any)}
                  empty={{ acao: "", prazo: "", responsavel: "", status: "ABERTA" }}
                />
              </TabsContent>

              <TabsContent value="5" className="space-y-4 mt-3">
                <RepeatList
                  title="I — Participantes da investigação"
                  items={(data.participantes ?? []).map((p) => ({ nome: p.nome, funcao: p.funcao, _assinatura: p.assinatura ?? "" }))}
                  cols={[{ k: "nome", label: "Nome", wide: true }, { k: "funcao", label: "Função" }]}
                  onChange={(v) => set("participantes", (v as any[]).map((x) => ({ nome: x.nome, funcao: x.funcao, assinatura: x._assinatura || null })))}
                  empty={{ nome: "", funcao: "", _assinatura: "" }}
                />
                <div className="border rounded p-3">
                  <div className="text-xs font-bold uppercase text-slate-700 mb-2">Assinaturas finais</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {sigBlocks.map((b) => {
                      const sig = data.assinaturas?.[b.key];
                      return (
                        <div key={b.key} className="border rounded p-2 space-y-2">
                          <div className="text-[11px] font-bold uppercase text-slate-600">{b.label}</div>
                          <Input placeholder="Nome do responsável" value={sig?.nome ?? ""} onChange={(e) => set("assinaturas", { ...(data.assinaturas ?? {}), [b.key]: { nome: e.target.value, img: sig?.img ?? null } } as any)} />
                          {sig?.img ? (
                            <div className="flex items-center gap-2 border bg-white rounded p-1">
                              <img src={sig.img} alt="Assinatura" className="h-10 object-contain flex-1" />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set("assinaturas", { ...(data.assinaturas ?? {}), [b.key]: { nome: sig.nome, img: null } } as any)}><X className="h-3.5 w-3.5"/></Button>
                            </div>
                          ) : (
                            <Button type="button" size="sm" variant="outline" className="w-full gap-1" onClick={() => setSigOpen(b.key)}>
                              <PenLine className="h-3.5 w-3.5" /> Assinar / importar
                            </Button>
                          )}
                          <p className="text-[10px] text-muted-foreground">{sig?.img ? "Assinada digitalmente" : "Sem assinatura — sairá linha em branco no PDF"}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="border-t pt-3">
            <div className="flex justify-between items-center w-full">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <div className="flex gap-2">
                {step !== "1" && <Button variant="outline" onClick={() => setStep(String(Number(step)-1))}>Anterior</Button>}
                {step !== "5"
                  ? <Button onClick={() => setStep(String(Number(step)+1))}>Próximo</Button>
                  : <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending} className="bg-red-600 hover:bg-red-700 gap-1.5">
                      <FileText className="h-4 w-4" />{salvarMut.isPending ? "Gerando..." : "Salvar e gerar PDF"}
                    </Button>}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PDFPreviewDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        doc={pdf}
        fileName={`FOR-SEG-14_${data.numero ?? "rascunho"}.pdf`}
        title="FOR-SEG 14 — Investigação de Acidente"
      />

      <SignaturePadDialog
        open={!!sigOpen}
        onClose={() => setSigOpen(null)}
        title={`Assinatura — ${sigOpen ?? ""}`}
        onConfirm={(r) => {
          if (!sigOpen) return;
          const cur = data.assinaturas?.[sigOpen];
          set("assinaturas", { ...(data.assinaturas ?? {}), [sigOpen]: { nome: cur?.nome ?? "", img: r.dataUrl } } as any);
          setSigOpen(null);
        }}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RepeatList<T extends Record<string, string>>({
  title, hint, items, cols, onChange, empty,
}: {
  title: string;
  hint?: string;
  items: T[];
  cols: Array<{ k: keyof T & string; label: string; wide?: boolean }>;
  onChange: (v: T[]) => void;
  empty: T;
}) {
  return (
    <div className="border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold uppercase text-slate-700">{title}</div>
        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => onChange([...items, { ...empty }])}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground mb-2">{hint}</p>}
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhum item.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid gap-2" style={{ gridTemplateColumns: cols.map(c => c.wide ? "2fr" : "1fr").join(" ") + " auto" }}>
              {cols.map((c) => (
                <Input key={c.k} placeholder={c.label} value={it[c.k] ?? ""} onChange={(e) => {
                  const next = [...items]; next[i] = { ...next[i], [c.k]: e.target.value } as T; onChange(next);
                }} className="h-8 text-xs" />
              ))}
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-700" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}