import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileSignature, ShieldCheck, PackageOpen, ClipboardCheck, Download, UserMinus } from "lucide-react";
import { PPPEditorDialog } from "@/components/ppp/ppp-editor-dialog";

const MOTIVOS = [
  "Fim de contrato terceirizado",
  "Pedido de demissão",
  "Dispensa sem justa causa",
  "Dispensa por justa causa",
  "Acordo entre as partes",
  "Aposentadoria",
  "Término de obra",
  "Falecimento",
  "Outro",
];

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: "equipamentos_devolvidos", label: "Equipamentos / crachá / uniforme devolvidos" },
  { key: "ferramentas_devolvidas", label: "Ferramentas devolvidas" },
  { key: "acessos_revogados", label: "Acessos físicos e de sistema revogados" },
];

type Props = {
  emp: any;
  company?: any;
  role?: any;
  open: boolean;
  onClose: () => void;
  /** "novo" (padrão) desliga agora · "regularizacao" reconstitui pacote para quem já está DESLIGADO */
  modo?: "novo" | "regularizacao";
};

const STEPS = [
  { n: 1, label: "Motivo", icon: UserMinus },
  { n: 2, label: "ASO NR-07", icon: ShieldCheck },
  { n: 3, label: "EPIs & OSs", icon: PackageOpen },
  { n: 4, label: "PPP & Confirmar", icon: ClipboardCheck },
];

export function DesligamentoWizard({ emp, company, role, open, onClose, modo = "novo" }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [pacoteId, setPacoteId] = useState<string | null>(null);
  const [pppOpen, setPppOpen] = useState(false);

  // Passo 1
  const [data, setData] = useState<string>(() =>
    modo === "regularizacao" && emp?.data_desligamento
      ? String(emp.data_desligamento).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [motivo, setMotivo] = useState<string>(() => {
    if (modo === "regularizacao" && emp?.motivo_desligamento) {
      return MOTIVOS.includes(emp.motivo_desligamento) ? emp.motivo_desligamento : "Outro";
    }
    return MOTIVOS[0];
  });
  const [motivoOutro, setMotivoOutro] = useState("");
  const [obs, setObs] = useState("");

  // Passo 2
  const [asoExamId, setAsoExamId] = useState<string | null>(null);
  const [asoDispensado, setAsoDispensado] = useState(false);
  const [asoJustif, setAsoJustif] = useState("");
  const [novoAsoData, setNovoAsoData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [novoAsoAptidao, setNovoAsoAptidao] = useState<string>("APTO");
  const [novoAsoFile, setNovoAsoFile] = useState<File | null>(null);


  // Passo 3
  const [episDevolvidos, setEpisDevolvidos] = useState<Record<string, boolean>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Passo 4
  const [pppEmissaoId, setPppEmissaoId] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1); setPacoteId(null); setAsoExamId(null); setAsoDispensado(false);
      setAsoJustif(""); setEpisDevolvidos({}); setChecklist({}); setPppEmissaoId(null);
      setConfirmacao(false); setObs(""); setMotivo(MOTIVOS[0]); setMotivoOutro("");
    }
  }, [open]);

  // Carrega ASOs recentes (para escolher demissional)
  const { data: asos } = useQuery({
    queryKey: ["desl-asos", emp?.id],
    enabled: !!emp?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("employee_exams")
        .select("id, tipo_exame, data_realizacao, aptidao")
        .eq("employee_id", emp.id)
        .order("data_realizacao", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // Registra um ASO demissional na hora (com upload opcional do documento)
  const registrarAso = useMutation({
    mutationFn: async () => {
      if (!emp?.id) throw new Error("Funcionário inválido");
      if (!novoAsoData) throw new Error("Informe a data de realização");
      let anexo_path: string | null = null;
      if (novoAsoFile) {
        const path = `${emp.id}/exames/${Date.now()}_${novoAsoFile.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, novoAsoFile, { upsert: false });
        if (upErr) throw upErr;
        anexo_path = path;
      }
      const { data: inserted, error } = await supabase.from("employee_exams").insert({
        employee_id: emp.id,
        tipo_exame: "ASO Demissional",
        natureza: "DEMISSIONAL",
        data_realizacao: novoAsoData,
        // demissional não gera periodicidade: vencimento = própria data
        data_vencimento: novoAsoData,
        periodicidade_meses: 0,
        aptidao: novoAsoAptidao,
        anexo_path,
      } as any).select("id").single();
      if (error) throw error;
      return inserted?.id as string;

    },
    onSuccess: async (id) => {
      toast.success("ASO demissional registrado");
      setNovoAsoFile(null);
      await qc.invalidateQueries({ queryKey: ["desl-asos", emp?.id] });
      if (id) { setAsoExamId(id); setAsoDispensado(false); }
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar ASO"),
  });



  // EPIs em posse
  const { data: epis } = useQuery({
    queryKey: ["desl-epis", emp?.id],
    enabled: !!emp?.id && open,
    queryFn: async () => {
      // Traz TUDO ainda em posse + devolvidos nos últimos 90 dias
      // (para reconstruir pacote de quem já foi desligado / regularização)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { data } = await supabase.from("epi_deliveries")
        .select("id, item, ca, qtd, data_entrega, data_devolucao")
        .eq("employee_id", emp.id)
        .or(`data_devolucao.is.null,data_devolucao.gte.${cutoff.toISOString().slice(0, 10)}`)
        .order("data_entrega", { ascending: false });
      return data ?? [];
    },
  });

  // Pré-marca como "devolvidos" os que já têm data_devolucao gravada no banco
  useEffect(() => {
    if (!epis) return;
    const preset: Record<string, boolean> = {};
    (epis as any[]).forEach((e) => {
      if (e.data_devolucao) preset[e.id] = true;
    });
    setEpisDevolvidos((cur) => ({ ...preset, ...cur }));
  }, [epis]);

  // OSs — traz TODO o histórico (todos os status) para o pacote de rescisão.
  // Consulta em 2 etapas (sem join embutido) porque o embed oss_templates pode
  // falhar por RLS/cache de schema e devolvia lista vazia silenciosamente.
  const { data: oss } = useQuery({
    queryKey: ["desl-oss", emp?.id],
    enabled: !!emp?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("oss_emissoes")
        .select("id, template_id, cargo_snapshot, status, emitido_em, pdf_path, pdf_assinado_path")
        .eq("employee_id", emp.id)
        .order("emitido_em", { ascending: false });
      if (error) { console.error("[desligamento] falha ao buscar OSs", error); throw error; }
      const rows = (data ?? []) as any[];
      const ids = [...new Set(rows.map((r) => r.template_id).filter(Boolean))];
      let tpls: Record<string, any> = {};
      if (ids.length) {
        const { data: t } = await supabase.from("oss_templates").select("id, codigo, procedimento").in("id", ids);
        (t ?? []).forEach((x: any) => { tpls[x.id] = x; });
      }
      return rows.map((r) => ({ ...r, oss_templates: tpls[r.template_id] ?? null }));
    },
  });

  // Documentos de OS anexados na ficha (upload manual / legado)
  const { data: ossDocs } = useQuery({
    queryKey: ["desl-oss-docs", emp?.id],
    enabled: !!emp?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("employee_docs")
        .select("id, tipo, descricao, file_path, uploaded_at")
        .eq("employee_id", emp.id)
        .or("tipo.ilike.%OS%,tipo.ilike.%ordem de servi%,descricao.ilike.%ordem de servi%")
        .order("uploaded_at", { ascending: false });
      return data ?? [];
    },
  });

  // Upload manual de OS assinada (quando não existe emissão no sistema)
  const [ossFile, setOssFile] = useState<File | null>(null);
  const uploadOs = useMutation({
    mutationFn: async () => {
      if (!emp?.id || !ossFile) throw new Error("Selecione o arquivo da OS");
      const path = `${emp.id}/os/${Date.now()}_${ossFile.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, ossFile, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("employee_docs").insert({
        employee_id: emp.id,
        tipo: "Ordem de Serviço (OS)",
        descricao: "OS anexada no processo de desligamento",
        file_path: path,
        sem_validade: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("OS anexada ao histórico");
      setOssFile(null);
      await qc.invalidateQueries({ queryKey: ["desl-oss-docs", emp?.id] });
      await qc.invalidateQueries({ queryKey: ["docs", emp?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao anexar OS"),
  });


  // PPP existente
  const { data: pppExistente } = useQuery({
    queryKey: ["desl-ppp", emp?.id],
    enabled: !!emp?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("ppp_emissoes")
        .select("id, status, numero")
        .eq("employee_id", emp.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPppEmissaoId((data as any).id);
      return data;
    },
  });

  const motivoFinal = motivo === "Outro" ? (motivoOutro.trim() || "Outro") : motivo;

  const salvarRascunho = useMutation({
    mutationFn: async () => {
      const asoRow = asos?.find((a: any) => a.id === asoExamId);
      const payload: any = {
        employee_id: emp.id,
        data_desligamento: data,
        motivo: motivoFinal,
        regularizacao: modo === "regularizacao",
        aso_exam_id: asoExamId,
        aso_dispensado: asoDispensado,
        aso_dispensa_justificativa: asoDispensado ? asoJustif : null,
        ppp_emissao_id: pppEmissaoId,
        epis_devolvidos: (epis ?? []).filter((e: any) => episDevolvidos[e.id]).map((e: any) => ({ id: e.id, item: e.item, ca: e.ca, qtd: e.qtd, data_entrega: e.data_entrega })),
        epis_pendentes: (epis ?? []).filter((e: any) => !episDevolvidos[e.id]).map((e: any) => ({ id: e.id, item: e.item, ca: e.ca, qtd: e.qtd, data_entrega: e.data_entrega })),
        oss_afetadas: (oss ?? []).map((o: any) => ({ id: o.id, codigo: o.oss_templates?.codigo, template: o.oss_templates?.procedimento, status_antes: o.status, status_depois: "SUBSTITUIDO" })),
        checklist: { ...checklist, aso_demissional: !!(asoRow || asoDispensado), epis_devolvidos: (epis ?? []).length === 0 || (epis ?? []).every((e: any) => episDevolvidos[e.id]), ppp_pendente: !!pppEmissaoId },
        observacoes: obs || null,
      };
      if (pacoteId) {
        const { error } = await supabase.from("desligamento_pacotes" as any).update(payload).eq("id", pacoteId);
        if (error) throw error;
        return pacoteId;
      }
      const { data: row, error } = await supabase.from("desligamento_pacotes" as any).insert(payload).select("id").single();
      if (error) throw error;
      setPacoteId((row as any).id);
      return (row as any).id as string;
    },
  });

  const finalizar = useMutation({
    mutationFn: async () => {
      const id = await salvarRascunho.mutateAsync();
      // Persiste devolução no epi_deliveries para os marcados que ainda não têm data_devolucao
      const paraDevolver = (epis ?? [])
        .filter((e: any) => episDevolvidos[e.id] && !e.data_devolucao)
        .map((e: any) => e.id);
      if (paraDevolver.length > 0) {
        const { error: devErr } = await supabase
          .from("epi_deliveries")
          .update({ data_devolucao: data })
          .in("id", paraDevolver);
        if (devErr) throw devErr;
      }
      const { error } = await (supabase as any).rpc("finalizar_desligamento_pacote", { _pacote_id: id });
      if (error) throw error;

      // Gera o PDF, arquiva no Storage privado e grava a URL no pacote
      try {
        const asoRow: any = asos?.find((a: any) => a.id === asoExamId);
        const { gerarPacoteRescisaoPdf } = await import("@/lib/rescisao-pacote-pdf");
        const doc = gerarPacoteRescisaoPdf({
          emp: { nome: emp.nome, cpf: emp.cpf, matricula: emp.matricula, admissao: emp.admissao },
          company: company ? { name: company.name, cnpj: company.cnpj } : null,
          role: role ? { name: role.name } : null,
          data_desligamento: data,
          motivo: motivoFinal,
          regularizacao: modo === "regularizacao",
          aso: asoDispensado
            ? { dispensado: true, dispensa_justificativa: asoJustif }
            : { data: asoRow?.data_realizacao, aptidao: asoRow?.aptidao },
          ppp_numero: (pppExistente as any)?.numero ?? null,
          epis_devolvidos: (epis ?? []).filter((e: any) => episDevolvidos[e.id]).map((e: any) => ({ item: e.item, ca: e.ca, qtd: e.qtd, data_entrega: e.data_entrega })),
          epis_pendentes: (epis ?? []).filter((e: any) => !episDevolvidos[e.id]).map((e: any) => ({ item: e.item, ca: e.ca, qtd: e.qtd, data_entrega: e.data_entrega })),
          oss_afetadas: (oss ?? []).map((o: any) => ({ codigo: o.oss_templates?.codigo, template: o.oss_templates?.procedimento, status_antes: o.status, status_depois: "SUBSTITUIDO" })),
          checklist: { ...checklist, aso_demissional: !!(asoRow || asoDispensado), epis_devolvidos: (epis ?? []).length === 0 || (epis ?? []).every((e: any) => episDevolvidos[e.id]), ppp_pendente: !!pppEmissaoId },
          observacoes: obs,
          sha256: id,
        });
        // Anexa as Ordens de Serviço existentes (evidência documental) ao final do pacote.
        const anexosOs: { bucket: string; path: string; rotulo: string }[] = [
          ...(oss ?? [])
            .map((o: any) => {
              const p = o.pdf_assinado_path || o.pdf_path;
              if (!p) return null;
              return {
                bucket: "oss-pdfs",
                path: p as string,
                rotulo: `OS ${o.oss_templates?.codigo ?? ""} ${o.oss_templates?.procedimento ?? o.cargo_snapshot ?? ""}`.trim(),
              };
            })
            .filter(Boolean) as any[],
          ...(ossDocs ?? [])
            .filter((d: any) => d.file_path && /\.pdf$/i.test(d.file_path))
            .map((d: any) => ({
              bucket: "employee-docs",
              path: d.file_path as string,
              rotulo: d.descricao || d.tipo || "Ordem de Serviço",
            })),
        ];

        let finalBytes: ArrayBuffer | Uint8Array = doc.output("arraybuffer") as ArrayBuffer;
        if (anexosOs.length > 0) {
          const { anexarOsAoPacote } = await import("@/lib/anexar-os-pacote");
          const res = await anexarOsAoPacote(finalBytes, anexosOs);
          finalBytes = res.bytes;
          if (res.anexadas.length) toast.success(`${res.anexadas.length} OS anexada(s) ao pacote`);
          if (res.falhas.length) toast.warning(`Não foi possível anexar: ${res.falhas.join(", ")}`);
        } else {
          toast.warning("Nenhuma OS assinada localizada — lacuna registrada no pacote.");
        }

        const blob = new Blob([finalBytes as BlobPart], { type: "application/pdf" });
        const path = `${id}.pdf`;
        const up = await supabase.storage.from("desligamento-pacotes").upload(path, blob, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (!up.error) {
          await supabase.from("desligamento_pacotes" as any).update({ pdf_url: path }).eq("id", id);
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pacote_rescisao_${emp.nome?.toLowerCase().replace(/\s+/g, "_")}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) { console.error(e); }
      return id;
    },
    onSuccess: (id) => {
      toast.success("Pacote de rescisão emitido — histórico preservado.");
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-listagem"] });
      qc.invalidateQueries({ queryKey: ["employees-desligados"] });
      qc.invalidateQueries({ queryKey: ["desligamento-pendencias"] });
      qc.invalidateQueries({ queryKey: ["desligados-pacotes-emitidos"] });
      qc.invalidateQueries({ queryKey: ["desligamento-pacote-status", emp.id] });
      qc.invalidateQueries({ queryKey: ["desligamento-pacote-view", emp.id] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao emitir pacote"),
  });

  // Validações por passo
  const canNext = useMemo(() => {
    if (step === 1) return !!data && !!motivoFinal && (motivo !== "Outro" || motivoOutro.trim().length > 0);
    if (step === 2) return asoDispensado ? asoJustif.trim().length >= 10 : !!asoExamId;
    if (step === 3) return true;
    return true;
  }, [step, data, motivoFinal, motivo, motivoOutro, asoDispensado, asoJustif, asoExamId]);

  const stepIcon = STEPS[step - 1].icon;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--brand-text)]">
              <UserMinus className="h-5 w-5" /> Pacote de Rescisão SST — {emp.nome}
            </DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center justify-between px-1 py-2 border-y border-border">
            {STEPS.map((s, i) => {
              const Ic = s.icon;
              const active = s.n === step;
              const done = s.n < step;
              return (
                <div key={s.n} className="flex-1 flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-black ${done ? "bg-emerald-600 text-white" : active ? "bg-[var(--brand)] text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Ic className="h-4 w-4" />}
                  </div>
                  <div className="hidden md:block">
                    <div className={`text-[10px] font-black uppercase tracking-widest ${active ? "text-[var(--brand-text)]" : "text-muted-foreground"}`}>Passo {s.n}</div>
                    <div className="text-xs font-bold text-foreground">{s.label}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done ? "bg-emerald-500" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>

          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 py-3">
            {step === 1 && (
              <div className="space-y-4">
                {modo === "regularizacao" && (
                  <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <div className="font-black uppercase tracking-widest text-[10px] mb-1">📋 Modo Regularização Retroativa</div>
                    O funcionário já consta como <b>DESLIGADO</b> desde{" "}
                    <b>{emp?.data_desligamento ? new Date(emp.data_desligamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</b>.
                    Esse pacote reconstitui a documentação de SST (ASO, EPIs, OSs, PPP) com base nos registros existentes.
                    Ficará marcado como <b>REGULARIZAÇÃO</b> no PDF, no audit_log e no hash SHA-256.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data do desligamento *</Label>
                    <Input type="date" value={data} max={new Date().toISOString().slice(0, 10)} min={emp.admissao ?? undefined} onChange={(e) => setData(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Motivo *</Label>
                    <Select value={motivo} onValueChange={setMotivo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {motivo === "Outro" && (
                  <div className="space-y-1.5">
                    <Label>Especifique</Label>
                    <Input value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Pendências, particularidades…" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
                  <b className="text-foreground">NR-07 item 7.5.15.4</b>: ASO demissional é obrigatório, exceto se o último ASO tiver sido realizado há menos de <b className="text-foreground">135 dias</b> (grau de risco 1/2) ou <b className="text-foreground">90 dias</b> (grau 3/4). Nesse caso registre a dispensa.
                </div>

                <div className="space-y-1.5">
                  <Label>Selecione o ASO demissional *</Label>
                  <div className="rounded-lg border border-border divide-y divide-border max-h-56 overflow-y-auto">
                    {(asos ?? []).length === 0 && <div className="text-xs text-muted-foreground p-3">Nenhum exame no histórico.</div>}
                    {(asos ?? []).map((a: any) => (
                      <label key={a.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40 ${asoExamId === a.id ? "bg-accent/60" : ""}`}>
                        <input type="radio" name="aso" checked={asoExamId === a.id} onChange={() => { setAsoExamId(a.id); setAsoDispensado(false); }} disabled={asoDispensado} />
                        <div className="flex-1 text-xs">
                          <div className="font-bold">{a.tipo_exame ?? "Exame"} — {a.data_realizacao ? new Date(a.data_realizacao + "T00:00:00").toLocaleDateString("pt-BR") : "sem data"}</div>
                          <div className="text-muted-foreground">Aptidão: {a.aptidao ?? "—"}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {!asoDispensado && (
                  <div className="rounded-lg border border-border bg-card/60 p-3 space-y-2">
                    <div className="text-xs font-black uppercase tracking-widest text-foreground">Anexar ASO demissional agora</div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase">Data de realização *</Label>
                        <Input type="date" value={novoAsoData} onChange={(e) => setNovoAsoData(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase">Aptidão</Label>
                        <Select value={novoAsoAptidao} onValueChange={setNovoAsoAptidao}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="APTO">APTO</SelectItem>
                            <SelectItem value="INAPTO">INAPTO</SelectItem>
                            <SelectItem value="APTO COM RESTRIÇÕES">APTO COM RESTRIÇÕES</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase">Arquivo (PDF/imagem)</Label>
                        <Input type="file" accept="application/pdf,image/*" onChange={(e) => setNovoAsoFile(e.target.files?.[0] ?? null)} />
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => registrarAso.mutate()}
                      disabled={registrarAso.isPending || !novoAsoData}
                      className="text-[11px] font-black uppercase tracking-widest"
                    >
                      {registrarAso.isPending ? "Enviando…" : "Registrar ASO demissional"}
                    </Button>
                  </div>
                )}

                <label className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 cursor-pointer">
                  <Checkbox checked={asoDispensado} onCheckedChange={(v) => { setAsoDispensado(!!v); if (v) setAsoExamId(null); }} />
                  <div className="text-xs">
                    <div className="font-black text-amber-200">Dispensar ASO demissional</div>
                    <div className="text-amber-100/80">Marque somente quando o último ASO estiver dentro do prazo NR-07.</div>
                  </div>
                </label>

                {asoDispensado && (
                  <div className="space-y-1.5">
                    <Label>Justificativa da dispensa *</Label>
                    <Textarea rows={3} value={asoJustif} onChange={(e) => setAsoJustif(e.target.value)} placeholder="Ex.: ASO periódico realizado em DD/MM/AAAA (dentro dos 135 dias — grau de risco 2)." />
                    <div className="text-[10px] text-muted-foreground">Mínimo 10 caracteres. Ficará registrada no pacote e em auditoria.</div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">EPIs em posse ({(epis ?? []).length})</Label>
                  <div className="rounded-lg border border-border divide-y divide-border mt-1 max-h-48 overflow-y-auto">
                    {(epis ?? []).length === 0 && <div className="text-xs text-muted-foreground p-3">Nenhum EPI em posse — nada a devolver.</div>}
                    {(epis ?? []).map((e: any) => (
                      <label key={e.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <Checkbox checked={!!episDevolvidos[e.id]} onCheckedChange={(v) => setEpisDevolvidos((c) => ({ ...c, [e.id]: !!v }))} />
                        <div className="flex-1 text-xs">
                          <div className="font-bold">{e.item} <span className="text-muted-foreground">· qtd {e.qtd}</span></div>
                          <div className="text-muted-foreground">CA {e.ca ?? "—"} · entregue {e.data_entrega ? new Date(e.data_entrega + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
                        </div>
                        {episDevolvidos[e.id] ? <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/40">devolvido</Badge> : <Badge className="bg-red-500/15 text-red-200 border-red-500/40">pendente</Badge>}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Histórico de OSs ({(oss ?? []).length})</Label>
                  <div className="rounded-lg border border-border divide-y divide-border mt-1 max-h-40 overflow-y-auto">
                    {(oss ?? []).length === 0 && <div className="text-xs text-muted-foreground p-3">Nenhuma OS emitida no histórico.</div>}
                    {(oss ?? []).map((o: any) => (
                      <div key={o.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="flex-1 text-xs">
                          <div className="font-bold">{o.oss_templates?.codigo ?? "OS"} — {o.oss_templates?.procedimento ?? o.cargo_snapshot}</div>
                          <div className="text-muted-foreground">Status atual: {o.status}</div>
                        </div>
                        <Badge className="bg-amber-500/15 text-amber-200 border-amber-500/40">→ SUBSTITUIDO</Badge>
                      </div>
                    ))}
                  </div>
                  {(ossDocs ?? []).length > 0 && (
                    <div className="rounded-lg border border-border divide-y divide-border mt-2 max-h-32 overflow-y-auto">
                      {(ossDocs as any[]).map((d) => (
                        <div key={d.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                          <div className="flex-1">
                            <div className="font-bold">{d.tipo}</div>
                            <div className="text-muted-foreground">{d.descricao ?? "—"} · {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString("pt-BR") : "—"}</div>
                          </div>
                          <Badge variant="outline">anexo</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-lg border border-border bg-muted/30 p-3 mt-2 space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Anexar OS assinada (PDF/imagem)</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="file"
                        accept="application/pdf,image/*"
                        className="h-9 text-xs flex-1 min-w-[200px]"
                        onChange={(e) => setOssFile(e.target.files?.[0] ?? null)}
                      />
                      <Button size="sm" onClick={() => uploadOs.mutate()} disabled={!ossFile || uploadOs.isPending}>
                        {uploadOs.isPending ? "Enviando…" : "Anexar OS"}
                      </Button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Todo o histórico de OSs é <b>preservado</b> (NR-01 · 5 anos após o contrato). Ativas mudam para SUBSTITUIDO — nada é excluído.</div>
                </div>


                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Checklist adicional</Label>
                  <div className="rounded-lg border border-border divide-y divide-border mt-1">
                    {CHECKLIST_ITEMS.map((it) => (
                      <label key={it.key} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <Checkbox checked={!!checklist[it.key]} onCheckedChange={(v) => setChecklist((c) => ({ ...c, [it.key]: !!v }))} />
                        <span className="text-xs">{it.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-violet-300 bg-violet-100 p-3">
                  <div className="flex items-center gap-2 text-violet-950 font-black text-sm"><FileSignature className="h-4 w-4" /> PPP — Perfil Profissiográfico Previdenciário</div>
                  <p className="text-xs text-violet-950 mt-1">
                    {pppEmissaoId && (pppExistente as any)?.numero
                      ? <>Já existe PPP emitido: <b>{(pppExistente as any).numero}</b>.</>
                      : pppEmissaoId
                        ? <>Rascunho de PPP vinculado ao pacote. Abra o editor para conferir e emitir.</>
                        : <>Nenhum PPP encontrado. Abra o editor: os campos já vêm pré-preenchidos com os dados do funcionário.</>
                    }
                  </p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setPppOpen(true)}>
                    <FileSignature className="h-3.5 w-3.5 mr-1.5" /> Abrir editor de PPP
                  </Button>
                  <p className="text-[10px] text-violet-900 mt-2">A entrega do PPP ao trabalhador é responsabilidade do RH / Representante Legal — o TST prepara o rascunho.</p>
                </div>

                <div className="rounded-lg bg-card border border-border p-3 text-xs text-foreground space-y-1.5">
                  <div className="font-black text-foreground uppercase tracking-widest text-[10px]">Resumo</div>
                  <div>Data: <b>{new Date(data + "T00:00:00").toLocaleDateString("pt-BR")}</b> · Motivo: <b>{motivoFinal}</b></div>
                  <div>ASO: {asoDispensado ? <b className="text-amber-200">DISPENSADO</b> : <b className="text-emerald-300">{asos?.find((a: any) => a.id === asoExamId)?.tipo_exame ?? "—"}</b>}</div>
                  <div>EPIs devolvidos: <b>{Object.values(episDevolvidos).filter(Boolean).length}</b> / {(epis ?? []).length}</div>
                  <div>OSs a substituir: <b>{(oss ?? []).length}</b></div>
                  <div>PPP: {pppEmissaoId ? <b className="text-emerald-300">vinculado</b> : <span className="text-amber-200">não vinculado</span>}</div>
                </div>

                <div className="rounded-lg bg-red-500/10 border border-red-500/40 p-3 text-xs text-red-100 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-black text-red-200"><AlertTriangle className="h-3.5 w-3.5" />Ao emitir:</div>
                  <ul className="list-disc ml-5 space-y-0.5">
                    {modo === "novo" ? (
                      <>
                        <li>Status passa a DESLIGADO e some das listagens ativas</li>
                        <li>OSs viram SUBSTITUIDO · bloqueio global ativado</li>
                      </>
                    ) : (
                      <>
                        <li>Status permanece DESLIGADO (já estava)</li>
                        <li>Pacote fica marcado como <b>REGULARIZAÇÃO retroativa</b></li>
                      </>
                    )}
                    <li>Pacote fica <b>imutável</b> (hash SHA-256 + audit_logs)</li>
                    <li>PDF do pacote é baixado automaticamente</li>
                  </ul>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={confirmacao} onCheckedChange={(v) => setConfirmacao(!!v)} />
                  <span className="text-xs text-muted-foreground">Confirmo, sob minha responsabilidade técnica, que as informações são verídicas e que o processo legal do desligamento foi (ou será) conduzido pelo RH.</span>
                </label>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={onClose} disabled={finalizar.isPending}>Cancelar</Button>
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={finalizar.isPending}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
            {step < 4 && (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-primary-foreground">
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button
                onClick={() => finalizar.mutate()}
                disabled={!confirmacao || finalizar.isPending}
                className="bg-red-700 hover:bg-red-800 text-white"
              >
                <Download className="h-4 w-4 mr-1.5" />
                {finalizar.isPending ? "Emitindo…" : "Emitir pacote"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PPPEditorDialog
        open={pppOpen}
        onOpenChange={(v) => {
          setPppOpen(v);
          if (!v) {
            // recarrega PPP
            qc.invalidateQueries({ queryKey: ["desl-ppp", emp?.id] });
          }
        }}
        employee={emp ? { ...emp, data_desligamento: emp.data_desligamento ?? data } : emp}
        company={company}
        role={role}
      />
    </>
  );
}