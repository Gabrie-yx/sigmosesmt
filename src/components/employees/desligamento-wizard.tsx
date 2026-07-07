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
import { gerarPacoteRescisaoPdf } from "@/lib/rescisao-pacote-pdf";

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
};

const STEPS = [
  { n: 1, label: "Motivo", icon: UserMinus },
  { n: 2, label: "ASO NR-07", icon: ShieldCheck },
  { n: 3, label: "EPIs & OSs", icon: PackageOpen },
  { n: 4, label: "PPP & Confirmar", icon: ClipboardCheck },
];

export function DesligamentoWizard({ emp, company, role, open, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [pacoteId, setPacoteId] = useState<string | null>(null);
  const [pppOpen, setPppOpen] = useState(false);

  // Passo 1
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0]);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [obs, setObs] = useState("");

  // Passo 2
  const [asoExamId, setAsoExamId] = useState<string | null>(null);
  const [asoDispensado, setAsoDispensado] = useState(false);
  const [asoJustif, setAsoJustif] = useState("");

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

  // EPIs em posse
  const { data: epis } = useQuery({
    queryKey: ["desl-epis", emp?.id],
    enabled: !!emp?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("epi_deliveries")
        .select("id, item, ca, qtd, data_entrega, data_devolucao")
        .eq("employee_id", emp.id)
        .is("data_devolucao", null)
        .order("data_entrega", { ascending: false });
      return data ?? [];
    },
  });

  // OSs ativas
  const { data: oss } = useQuery({
    queryKey: ["desl-oss", emp?.id],
    enabled: !!emp?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("oss_emissoes")
        .select("id, cargo_snapshot, status, oss_templates(codigo, procedimento)")
        .eq("employee_id", emp.id)
        .in("status", ["ASSINADO", "EMITIDO", "PENDENTE_ASSINATURA"])
        .order("emitido_em", { ascending: false });
      return data ?? [];
    },
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
      const { error } = await (supabase as any).rpc("finalizar_desligamento_pacote", { _pacote_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Pacote de rescisão emitido — histórico preservado.");
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-listagem"] });
      qc.invalidateQueries({ queryKey: ["employees-desligados"] });
      qc.invalidateQueries({ queryKey: ["desligamento-pendencias"] });
      // Baixa o PDF
      try {
        const asoRow: any = asos?.find((a: any) => a.id === asoExamId);
        const doc = gerarPacoteRescisaoPdf({
          emp: { nome: emp.nome, cpf: emp.cpf, matricula: emp.matricula, admissao: emp.admissao },
          company: company ? { name: company.name, cnpj: company.cnpj } : null,
          role: role ? { name: role.name } : null,
          data_desligamento: data,
          motivo: motivoFinal,
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
        doc.save(`pacote_rescisao_${emp.nome?.toLowerCase().replace(/\s+/g, "_")}.pdf`);
      } catch (e) { console.error(e); }
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
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <UserMinus className="h-5 w-5" /> Pacote de Rescisão SST — {emp.nome}
            </DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center justify-between px-1 py-2 border-y border-slate-200">
            {STEPS.map((s, i) => {
              const Ic = s.icon;
              const active = s.n === step;
              const done = s.n < step;
              return (
                <div key={s.n} className="flex-1 flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-black ${done ? "bg-emerald-600 text-white" : active ? "bg-rose-700 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Ic className="h-4 w-4" />}
                  </div>
                  <div className="hidden md:block">
                    <div className={`text-[10px] font-black uppercase tracking-widest ${active ? "text-rose-700" : "text-slate-500"}`}>Passo {s.n}</div>
                    <div className="text-xs font-bold text-slate-700">{s.label}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done ? "bg-emerald-500" : "bg-slate-200"}`} />}
                </div>
              );
            })}
          </div>

          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 py-3">
            {step === 1 && (
              <div className="space-y-4">
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
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                  <b>NR-07 item 7.5.15.4</b>: ASO demissional é obrigatório, exceto se o último ASO tiver sido realizado há menos de <b>135 dias</b> (grau de risco 1/2) ou <b>90 dias</b> (grau 3/4). Nesse caso registre a dispensa.
                </div>
                <div className="space-y-1.5">
                  <Label>Selecione o ASO demissional *</Label>
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {(asos ?? []).length === 0 && <div className="text-xs text-slate-500 p-3">Nenhum exame no histórico.</div>}
                    {(asos ?? []).map((a: any) => (
                      <label key={a.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 ${asoExamId === a.id ? "bg-emerald-50" : ""}`}>
                        <input type="radio" name="aso" checked={asoExamId === a.id} onChange={() => { setAsoExamId(a.id); setAsoDispensado(false); }} disabled={asoDispensado} />
                        <div className="flex-1 text-xs">
                          <div className="font-bold">{a.tipo_exame ?? "Exame"} — {a.data_realizacao ? new Date(a.data_realizacao + "T00:00:00").toLocaleDateString("pt-BR") : "sem data"}</div>
                          <div className="text-slate-500">Aptidão: {a.aptidao ?? "—"}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <label className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
                  <Checkbox checked={asoDispensado} onCheckedChange={(v) => { setAsoDispensado(!!v); if (v) setAsoExamId(null); }} />
                  <div className="text-xs">
                    <div className="font-black text-amber-900">Dispensar ASO demissional</div>
                    <div className="text-amber-800">Marque somente quando o último ASO estiver dentro do prazo NR-07.</div>
                  </div>
                </label>
                {asoDispensado && (
                  <div className="space-y-1.5">
                    <Label>Justificativa da dispensa *</Label>
                    <Textarea rows={3} value={asoJustif} onChange={(e) => setAsoJustif(e.target.value)} placeholder="Ex.: ASO periódico realizado em DD/MM/AAAA (dentro dos 135 dias — grau de risco 2)." />
                    <div className="text-[10px] text-slate-500">Mínimo 10 caracteres. Ficará registrada no pacote e em auditoria.</div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-600">EPIs em posse ({(epis ?? []).length})</Label>
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 mt-1 max-h-48 overflow-y-auto">
                    {(epis ?? []).length === 0 && <div className="text-xs text-slate-500 p-3">Nenhum EPI em posse — nada a devolver.</div>}
                    {(epis ?? []).map((e: any) => (
                      <label key={e.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <Checkbox checked={!!episDevolvidos[e.id]} onCheckedChange={(v) => setEpisDevolvidos((c) => ({ ...c, [e.id]: !!v }))} />
                        <div className="flex-1 text-xs">
                          <div className="font-bold">{e.item} <span className="text-slate-500">· qtd {e.qtd}</span></div>
                          <div className="text-slate-500">CA {e.ca ?? "—"} · entregue {e.data_entrega ? new Date(e.data_entrega + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
                        </div>
                        {episDevolvidos[e.id] ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">devolvido</Badge> : <Badge className="bg-rose-100 text-rose-700 border-rose-200">pendente</Badge>}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-600">OSs ativas ({(oss ?? []).length})</Label>
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 mt-1 max-h-40 overflow-y-auto">
                    {(oss ?? []).length === 0 && <div className="text-xs text-slate-500 p-3">Nenhuma OS ativa.</div>}
                    {(oss ?? []).map((o: any) => (
                      <div key={o.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="flex-1 text-xs">
                          <div className="font-bold">{o.oss_templates?.codigo ?? "OS"} — {o.oss_templates?.procedimento ?? o.cargo_snapshot}</div>
                          <div className="text-slate-500">Status atual: {o.status}</div>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">→ SUBSTITUIDO</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">OSs ficam <b>preservadas</b> (NR-01 · 5 anos após o contrato) e mudam para SUBSTITUIDO — não são excluídas.</div>
                </div>

                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-600">Checklist adicional</Label>
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 mt-1">
                    {CHECKLIST_ITEMS.map((it) => (
                      <label key={it.key} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
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
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <div className="flex items-center gap-2 text-violet-900 font-black text-sm"><FileSignature className="h-4 w-4" /> PPP — Perfil Profissiográfico Previdenciário</div>
                  <p className="text-xs text-violet-800 mt-1">
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
                  <p className="text-[10px] text-violet-700 mt-2">A entrega do PPP ao trabalhador é responsabilidade do RH / Representante Legal — o TST prepara o rascunho.</p>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5">
                  <div className="font-black text-slate-700 uppercase tracking-widest text-[10px]">Resumo</div>
                  <div>Data: <b>{new Date(data + "T00:00:00").toLocaleDateString("pt-BR")}</b> · Motivo: <b>{motivoFinal}</b></div>
                  <div>ASO: {asoDispensado ? <b className="text-amber-700">DISPENSADO</b> : <b className="text-emerald-700">{asos?.find((a: any) => a.id === asoExamId)?.tipo_exame ?? "—"}</b>}</div>
                  <div>EPIs devolvidos: <b>{Object.values(episDevolvidos).filter(Boolean).length}</b> / {(epis ?? []).length}</div>
                  <div>OSs a substituir: <b>{(oss ?? []).length}</b></div>
                  <div>PPP: {pppEmissaoId ? <b className="text-emerald-700">vinculado</b> : <span className="text-amber-700">não vinculado</span>}</div>
                </div>

                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-black"><AlertTriangle className="h-3.5 w-3.5" />Ao emitir:</div>
                  <ul className="list-disc ml-5 space-y-0.5">
                    <li>Status passa a DESLIGADO e some das listagens ativas</li>
                    <li>OSs viram SUBSTITUIDO · bloqueio global ativado</li>
                    <li>Pacote fica <b>imutável</b> (hash SHA-256 + audit_logs)</li>
                    <li>PDF do pacote é baixado automaticamente</li>
                  </ul>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={confirmacao} onCheckedChange={(v) => setConfirmacao(!!v)} />
                  <span className="text-xs text-slate-700">Confirmo, sob minha responsabilidade técnica, que as informações são verídicas e que o processo legal do desligamento foi (ou será) conduzido pelo RH.</span>
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
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="bg-slate-900 hover:bg-slate-800">
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button
                onClick={() => finalizar.mutate()}
                disabled={!confirmacao || finalizar.isPending}
                className="bg-rose-700 hover:bg-rose-800 text-white"
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
        employee={emp}
        company={company}
        role={role}
      />
    </>
  );
}