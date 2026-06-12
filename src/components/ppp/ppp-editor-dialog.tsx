import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Send, Download, FileSignature, Lock } from "lucide-react";
import { toast } from "sonner";
import { gerarPPPPdf, emptyPPPDados, type PPPDados, type PPPRisco, type PPPResponsavel, type PPPLotacao, type PPPProfissiografia, type PPPCAT } from "@/lib/ppp-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";

function fmtBR(d?: string | null) {
  if (!d) return "";
  const iso = String(d).split("T")[0];
  const [y, m, day] = iso.split("-");
  return y && m && day ? `${day}/${m}/${y}` : String(d);
}

function tipoFromCategoria(cat?: string | null): string {
  switch ((cat ?? "").toUpperCase()) {
    case "FISICO": return "Físico";
    case "QUIMICO": return "Químico";
    case "BIOLOGICO": return "Biológico";
    case "ERGONOMICO": return "Ergonômico";
    case "ACIDENTE": return "Acidente";
    default: return "—";
  }
}

type EmpresaRow = any;
type EmpRow = any;
type RoleRow = any;

export function PPPEditorDialog({
  open, onOpenChange, employee, company, role,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: EmpRow | null;
  company: EmpresaRow | null;
  role: RoleRow | null;
}) {
  const qc = useQueryClient();
  const empId = employee?.id;
  const [pppId, setPppId] = useState<string | null>(null);
  const [status, setStatus] = useState<"RASCUNHO" | "EMITIDO" | "CANCELADO">("RASCUNHO");
  const [numero, setNumero] = useState<string | null>(null);
  const [dados, setDados] = useState<PPPDados>(() => emptyPPPDados());
  const [tab, setTab] = useState("emp");
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);

  const isFinal = status === "EMITIDO";

  // Carrega rascunho existente OU pré-preenche com defaults
  useQuery({
    queryKey: ["ppp-load", empId, open],
    enabled: !!empId && open,
    queryFn: async () => {
      // 1) procura rascunho mais recente
      const { data: rasc } = await supabase
        .from("ppp_emissoes" as any)
        .select("*")
        .eq("employee_id", empId)
        .eq("status", "RASCUNHO")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rasc) {
        setPppId((rasc as any).id);
        setStatus("RASCUNHO");
        setNumero(null);
        setDados({ ...emptyPPPDados(), ...((rasc as any).dados as PPPDados) });
        return rasc;
      }

      // 2) Pré-preenche com defaults
      const defaults = await buildDefaults(employee, company, role);
      setPppId(null);
      setStatus("RASCUNHO");
      setNumero(null);
      setDados(defaults);
      return null;
    },
  });

  async function handleSave(newStatus: "RASCUNHO" | "EMITIDO") {
    if (!empId) return;
    setSaving(true);
    try {
      const payload: any = {
        employee_id: empId,
        company_id: company?.id ?? null,
        role_id: role?.id ?? null,
        status: newStatus,
        dados: dados,
        observacoes: dados.observacoes,
      };
      let res;
      if (pppId) {
        res = await supabase.from("ppp_emissoes" as any).update(payload).eq("id", pppId).select("*").single();
      } else {
        res = await supabase.from("ppp_emissoes" as any).insert(payload).select("*").single();
      }
      if (res.error) throw res.error;
      const row: any = res.data;
      setPppId(row.id);
      setStatus(row.status);
      setNumero(row.numero ?? null);
      qc.invalidateQueries({ queryKey: ["ppp-list", empId] });
      toast.success(newStatus === "EMITIDO" ? `PPP ${row.numero} emitido!` : "Rascunho salvo.");
    } catch (e: any) {
      console.error("[ppp-save]", e);
      toast.error("Erro ao salvar: " + (e?.message ?? "desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    try {
      const doc = gerarPPPPdf(dados, { numero });
      setPreviewDoc(doc);
    } catch (e: any) {
      console.error("[ppp-pdf]", e);
      toast.error("Erro ao gerar PDF: " + (e?.message ?? "desconhecido"));
    }
  }

  const set = <K extends keyof PPPDados>(k: K, v: PPPDados[K]) =>
    setDados((d) => ({ ...d, [k]: v }));

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <FileSignature className="h-5 w-5 text-violet-700" />
              <span>PPP — Perfil Profissiográfico Previdenciário</span>
              {isFinal && numero && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                  <Lock className="h-3 w-3 mr-1" />{numero}
                </Badge>
              )}
              {!isFinal && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">Rascunho</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="emp">1. Empresa & Trabalhador</TabsTrigger>
                <TabsTrigger value="lot">2. Lotação & Profissiografia</TabsTrigger>
                <TabsTrigger value="risk">3. Riscos & EPIs</TabsTrigger>
                <TabsTrigger value="resp">4. Responsáveis & Emissão</TabsTrigger>
              </TabsList>

              {/* TAB 1 */}
              <TabsContent value="emp" className="space-y-4 mt-4">
                <Card className="p-4 space-y-3">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">Dados administrativos (1-3)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="1. CNPJ / CEI / CAEPF / CNO" value={dados.empresa_cnpj} onChange={(v) => set("empresa_cnpj", v)} disabled={isFinal} />
                    <Field label="3. CNAE" value={dados.empresa_cnae} onChange={(v) => set("empresa_cnae", v)} disabled={isFinal} />
                  </div>
                  <Field label="2. Nome Empresarial" value={dados.empresa_nome} onChange={(v) => set("empresa_nome", v)} disabled={isFinal} />
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">Trabalhador (4-11)</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2"><Field label="4. Nome" value={dados.trab_nome} onChange={(v) => set("trab_nome", v)} disabled={isFinal} /></div>
                    <Field label="5. BR/PDH" value={dados.trab_br_pdh} onChange={(v) => set("trab_br_pdh", v)} disabled={isFinal} />
                    <Field label="6. CPF" value={dados.trab_cpf} onChange={(v) => set("trab_cpf", v)} disabled={isFinal} />
                    <Field label="7. Data Nascimento" value={dados.trab_nascimento} onChange={(v) => set("trab_nascimento", v)} placeholder="DD/MM/AAAA" disabled={isFinal} />
                    <div>
                      <Label className="text-xs font-bold">8. Sexo</Label>
                      <Select value={dados.trab_sexo} onValueChange={(v) => set("trab_sexo", v)} disabled={isFinal}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Masculino">Masculino</SelectItem>
                          <SelectItem value="Feminino">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Field label="9. Matrícula eSocial" value={dados.trab_matricula_esocial} onChange={(v) => set("trab_matricula_esocial", v)} disabled={isFinal} />
                    <Field label="10. Data Admissão" value={dados.trab_admissao} onChange={(v) => set("trab_admissao", v)} placeholder="DD/MM/AAAA" disabled={isFinal} />
                    <Field label="11. Regime Revezamento" value={dados.regime_revezamento} onChange={(v) => set("regime_revezamento", v)} disabled={isFinal} />
                  </div>
                </Card>

                <Card className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">12. CAT Registrada</div>
                    {!isFinal && <Button size="sm" variant="outline" onClick={() => set("cats", [...dados.cats, { data: "", numero: "" }])}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>}
                  </div>
                  {dados.cats.length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma CAT registrada</p>}
                  {dados.cats.map((c, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5"><Field label="12.1 Data" value={c.data} onChange={(v) => updateArr(setDados, "cats", i, { ...c, data: v })} disabled={isFinal} placeholder="DD/MM/AAAA" /></div>
                      <div className="col-span-6"><Field label="12.2 Número" value={c.numero} onChange={(v) => updateArr(setDados, "cats", i, { ...c, numero: v })} disabled={isFinal} /></div>
                      {!isFinal && <Button size="sm" variant="ghost" className="col-span-1 text-rose-600" onClick={() => set("cats", dados.cats.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                </Card>
              </TabsContent>

              {/* TAB 2 */}
              <TabsContent value="lot" className="space-y-4 mt-4">
                <Card className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">13. Lotação e Atribuição</div>
                    {!isFinal && <Button size="sm" variant="outline" onClick={() => set("lotacoes", [...dados.lotacoes, { periodo: "", cnpj: "", setor: "", cargo: "", funcao: "", cbo: "", gfip_esocial: "00" }])}><Plus className="h-3 w-3 mr-1" />Adicionar período</Button>}
                  </div>
                  {dados.lotacoes.map((l, i) => (
                    <Card key={i} className="p-3 bg-slate-50 space-y-2">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4"><Field label="13.1 Período" value={l.periodo} onChange={(v) => updateArr(setDados, "lotacoes", i, { ...l, periodo: v })} disabled={isFinal} placeholder="DD/MM/AAAA a DD/MM/AAAA" /></div>
                        <div className="col-span-4"><Field label="13.2 CNPJ" value={l.cnpj} onChange={(v) => updateArr(setDados, "lotacoes", i, { ...l, cnpj: v })} disabled={isFinal} /></div>
                        <div className="col-span-3"><Field label="13.3 Setor" value={l.setor} onChange={(v) => updateArr(setDados, "lotacoes", i, { ...l, setor: v })} disabled={isFinal} /></div>
                        {!isFinal && <Button size="sm" variant="ghost" className="col-span-1 text-rose-600 self-end" onClick={() => set("lotacoes", dados.lotacoes.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4"><Field label="13.4 Cargo" value={l.cargo} onChange={(v) => updateArr(setDados, "lotacoes", i, { ...l, cargo: v })} disabled={isFinal} /></div>
                        <div className="col-span-4"><Field label="13.5 Função" value={l.funcao} onChange={(v) => updateArr(setDados, "lotacoes", i, { ...l, funcao: v })} disabled={isFinal} /></div>
                        <div className="col-span-2"><Field label="13.6 CBO" value={l.cbo} onChange={(v) => updateArr(setDados, "lotacoes", i, { ...l, cbo: v })} disabled={isFinal} /></div>
                        <div className="col-span-2"><Field label="13.7 GFIP/eSocial" value={l.gfip_esocial} onChange={(v) => updateArr(setDados, "lotacoes", i, { ...l, gfip_esocial: v })} disabled={isFinal} /></div>
                      </div>
                    </Card>
                  ))}
                </Card>

                <Card className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">14. Profissiografia (atividades)</div>
                    {!isFinal && <Button size="sm" variant="outline" onClick={() => set("profissiografias", [...dados.profissiografias, { periodo: "", descricao: "" }])}><Plus className="h-3 w-3 mr-1" />Adicionar período</Button>}
                  </div>
                  {dados.profissiografias.map((p, i) => (
                    <div key={i} className="space-y-2 p-3 bg-slate-50 rounded">
                      <div className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-3"><Field label="14.1 Período" value={p.periodo} onChange={(v) => updateArr(setDados, "profissiografias", i, { ...p, periodo: v })} disabled={isFinal} /></div>
                        <div className="col-span-8">
                          <Label className="text-xs font-bold">14.2 Descrição das atividades</Label>
                          <Textarea rows={4} value={p.descricao} onChange={(e) => updateArr(setDados, "profissiografias", i, { ...p, descricao: e.target.value })} disabled={isFinal} className="text-sm" />
                        </div>
                        {!isFinal && <Button size="sm" variant="ghost" className="col-span-1 text-rose-600 mt-6" onClick={() => set("profissiografias", dados.profissiografias.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                  ))}
                </Card>
              </TabsContent>

              {/* TAB 3 */}
              <TabsContent value="risk" className="space-y-4 mt-4">
                <Card className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">15. Exposição a Fatores de Risco</div>
                    {!isFinal && <Button size="sm" variant="outline" onClick={() => set("riscos", [...dados.riscos, { periodo: "", tipo: "Físico", fator_risco: "", intensidade: "NA", tecnica: "NA", epc_eficaz: "NA", epi_eficaz: "NA", ca_epi: "" }])}><Plus className="h-3 w-3 mr-1" />Adicionar risco</Button>}
                  </div>
                  {dados.riscos.map((r, i) => (
                    <Card key={i} className="p-3 bg-slate-50 space-y-2">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3"><Field label="15.1 Período" value={r.periodo} onChange={(v) => updateArr(setDados, "riscos", i, { ...r, periodo: v })} disabled={isFinal} /></div>
                        <div className="col-span-2">
                          <Label className="text-xs font-bold">15.2 Tipo</Label>
                          <Select value={r.tipo} onValueChange={(v) => updateArr(setDados, "riscos", i, { ...r, tipo: v })} disabled={isFinal}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Físico","Químico","Biológico","Ergonômico","Acidente"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-6"><Field label="15.3 Fator de Risco" value={r.fator_risco} onChange={(v) => updateArr(setDados, "riscos", i, { ...r, fator_risco: v })} disabled={isFinal} /></div>
                        {!isFinal && <Button size="sm" variant="ghost" className="col-span-1 text-rose-600 self-end" onClick={() => set("riscos", dados.riscos.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3"><Field label="15.4 Intensidade/Concentração" value={r.intensidade} onChange={(v) => updateArr(setDados, "riscos", i, { ...r, intensidade: v })} disabled={isFinal} /></div>
                        <div className="col-span-4"><Field label="15.5 Técnica Utilizada" value={r.tecnica} onChange={(v) => updateArr(setDados, "riscos", i, { ...r, tecnica: v })} disabled={isFinal} /></div>
                        <div className="col-span-2">
                          <Label className="text-xs font-bold">15.6 EPC Eficaz</Label>
                          <Select value={r.epc_eficaz} onValueChange={(v) => updateArr(setDados, "riscos", i, { ...r, epc_eficaz: v })} disabled={isFinal}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem><SelectItem value="NA">NA</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs font-bold">15.7 EPI Eficaz</Label>
                          <Select value={r.epi_eficaz} onValueChange={(v) => updateArr(setDados, "riscos", i, { ...r, epi_eficaz: v })} disabled={isFinal}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem><SelectItem value="NA">NA</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1"><Field label="15.8 CA" value={r.ca_epi} onChange={(v) => updateArr(setDados, "riscos", i, { ...r, ca_epi: v })} disabled={isFinal} /></div>
                      </div>
                    </Card>
                  ))}
                </Card>

                <Card className="p-4 space-y-2">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">15.9 Atendimento NR-06 / NR-01 (S/N)</div>
                  <SNQuestion label="Foi tentada a implementação de medidas de proteção coletiva, optando-se pelo EPI por inviabilidade técnica?" value={dados.nr_medidas_protecao} onChange={(v) => set("nr_medidas_protecao", v)} disabled={isFinal} />
                  <SNQuestion label="Foram observadas as condições de funcionamento e do uso ininterrupto do EPI ao longo do tempo?" value={dados.nr_funcionamento_epi} onChange={(v) => set("nr_funcionamento_epi", v)} disabled={isFinal} />
                  <SNQuestion label="Foi observado o prazo de validade conforme o CA do MTP?" value={dados.nr_prazo_validade} onChange={(v) => set("nr_prazo_validade", v)} disabled={isFinal} />
                  <SNQuestion label="Foi observada a periodicidade de troca definida pelos programas ambientais, comprovada mediante recibo?" value={dados.nr_periodicidade_troca} onChange={(v) => set("nr_periodicidade_troca", v)} disabled={isFinal} />
                  <SNQuestion label="Foi observada a higienização?" value={dados.nr_higienizacao} onChange={(v) => set("nr_higienizacao", v)} disabled={isFinal} />
                </Card>
              </TabsContent>

              {/* TAB 4 */}
              <TabsContent value="resp" className="space-y-4 mt-4">
                <Card className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">16. Responsável pelos Registros Ambientais</div>
                    {!isFinal && <Button size="sm" variant="outline" onClick={() => set("responsaveis", [...dados.responsaveis, { periodo: "", cpf: "", registro: "", nome: "" }])}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>}
                  </div>
                  {dados.responsaveis.map((r, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded">
                      <div className="col-span-3"><Field label="16.1 Período" value={r.periodo} onChange={(v) => updateArr(setDados, "responsaveis", i, { ...r, periodo: v })} disabled={isFinal} /></div>
                      <div className="col-span-2"><Field label="16.2 CPF" value={r.cpf} onChange={(v) => updateArr(setDados, "responsaveis", i, { ...r, cpf: v })} disabled={isFinal} /></div>
                      <div className="col-span-3"><Field label="16.3 Reg. Cons. Classe" value={r.registro} onChange={(v) => updateArr(setDados, "responsaveis", i, { ...r, registro: v })} disabled={isFinal} /></div>
                      <div className="col-span-3"><Field label="16.4 Nome do profissional" value={r.nome} onChange={(v) => updateArr(setDados, "responsaveis", i, { ...r, nome: v })} disabled={isFinal} /></div>
                      {!isFinal && <Button size="sm" variant="ghost" className="col-span-1 text-rose-600" onClick={() => set("responsaveis", dados.responsaveis.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">17. Emissão & 18. Representante Legal</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="17. Data Emissão" value={dados.data_emissao} onChange={(v) => set("data_emissao", v)} placeholder="DD/MM/AAAA" disabled={isFinal} />
                    <Field label="18.1 CPF Representante Legal" value={dados.rep_legal_cpf} onChange={(v) => set("rep_legal_cpf", v)} disabled={isFinal} />
                    <Field label="18.2 Nome Representante Legal" value={dados.rep_legal_nome} onChange={(v) => set("rep_legal_nome", v)} disabled={isFinal} />
                  </div>
                </Card>

                <Card className="p-4 space-y-2">
                  <Label className="text-xs font-bold">Observações</Label>
                  <Textarea rows={3} value={dados.observacoes} onChange={(e) => set("observacoes", e.target.value)} disabled={isFinal} />
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="flex-wrap gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fechar</Button>
            {!isFinal && (
              <Button variant="secondary" onClick={() => handleSave("RASCUNHO")} disabled={saving} className="gap-1.5">
                <Save className="h-4 w-4" /> Salvar rascunho
              </Button>
            )}
            <Button variant="outline" onClick={handleDownload} disabled={saving} className="gap-1.5">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
            {!isFinal && (
              <Button onClick={() => handleSave("EMITIDO")} disabled={saving} className="gap-1.5 bg-violet-700 hover:bg-violet-800">
                <Send className="h-4 w-4" /> Emitir versão final
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PDFPreviewDialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
        fileName={`PPP_${(employee?.nome ?? "funcionario").toLowerCase().replace(/\s+/g, "_")}${numero ? `_${numero.replace(/[/]/g, "-")}` : ""}.pdf`}
        title="PPP — Pré-visualização"
      />
    </>
  );
}

function updateArr<K extends keyof PPPDados>(setter: React.Dispatch<React.SetStateAction<PPPDados>>, key: K, i: number, val: any) {
  setter((d) => {
    const arr = [...(d[key] as any[])];
    arr[i] = val;
    return { ...d, [key]: arr };
  });
}

function Field({ label, value, onChange, disabled, placeholder }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs font-bold">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className="h-9 text-sm" />
    </div>
  );
}

function SNQuestion({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1 border-b border-slate-100 last:border-0">
      <p className="flex-1 text-xs text-slate-700 leading-snug">{label}</p>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-24 h-8 shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem><SelectItem value="NA">NA</SelectItem></SelectContent>
      </Select>
    </div>
  );
}

async function buildDefaults(emp: EmpRow, company: EmpresaRow | null, role: RoleRow | null): Promise<PPPDados> {
  const d = emptyPPPDados();
  // Empresa
  d.empresa_cnpj = company?.cnpj ?? "";
  d.empresa_nome = company?.name ?? "";
  d.empresa_cnae = company?.cnae ?? "";
  // Trabalhador
  d.trab_nome = emp?.nome ?? "";
  d.trab_cpf = emp?.cpf ?? "";
  d.trab_nascimento = fmtBR(emp?.data_nascimento);
  d.trab_sexo = emp?.sexo ?? "";
  d.trab_matricula_esocial = emp?.matricula ?? emp?.pis ?? "";
  d.trab_admissao = fmtBR(emp?.admissao);

  const periodo = `${fmtBR(emp?.admissao) || "—"} a atual`;
  // Lotação
  d.lotacoes = [{
    periodo,
    cnpj: company?.cnpj ?? "",
    setor: emp?.setor ?? "",
    cargo: role?.name ?? "",
    funcao: role?.name ?? "",
    cbo: emp?.cbo ?? "",
    gfip_esocial: "00",
  }];
  // Profissiografia
  d.profissiografias = [{ periodo, descricao: role?.atividades ?? "" }];

  // Riscos: puxa do cargo
  if (emp?.role_id) {
    const { data: rs } = await supabase
      .from("cargo_riscos")
      .select("*, catalogo_riscos(nome, categoria, codigo_esocial)")
      .eq("role_id", emp.role_id)
      .eq("ativo", true);

    d.riscos = ((rs as any[]) ?? []).map((r: any) => {
      const nome = r.catalogo_riscos?.nome ?? "—";
      const cat = tipoFromCategoria(r.catalogo_riscos?.categoria);
      const intensidade = r.intensidade != null ? `${r.intensidade}${r.unidade ? " " + r.unidade : ""}` : "NA";
      return {
        periodo,
        tipo: cat,
        fator_risco: nome,
        intensidade,
        tecnica: r.tecnica_medicao ?? "NA",
        epc_eficaz: "NA",
        epi_eficaz: r.epi_atenuacao_db != null ? "Sim" : "NA",
        ca_epi: "",
      } as PPPRisco;
    });
  }

  d.data_emissao = new Date().toLocaleDateString("pt-BR");
  return d;
}