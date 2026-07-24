import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ClipboardCheck, HeartPulse, User2, Cigarette, Activity, Stethoscope, FileText } from "lucide-react";

// Anamnese Ocupacional estruturada — NR-07 / PCMSO
// Salva em anamneses_ocupacionais (JSONB por seção). Vincula opcionalmente a atendimento e/ou exam_id.

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  atendimentoId?: string | null;
  examId?: string | null;
  natureza?: string;
  onSaved?: (id: string) => void;
};

type ExameFisico = {
  pa_sistolica?: number | null;
  pa_diastolica?: number | null;
  fc?: number | null;
  fr?: number | null;
  temperatura?: number | null;
  peso?: number | null;
  altura?: number | null;
  ausculta_cardiaca?: string;
  ausculta_pulmonar?: string;
  abdome?: string;
  neurologico?: string;
  osteomuscular?: string;
  observacoes?: string;
};

type Habitos = {
  tabagismo?: "NUNCA" | "EX_FUMANTE" | "ATUAL";
  cigarros_dia?: number | null;
  anos_fumo?: number | null;
  etilismo?: "NAO" | "SOCIAL" | "FREQUENTE";
  atividade_fisica?: "SEDENTARIO" | "LEVE" | "MODERADA" | "INTENSA";
  horas_sono?: number | null;
  drogas_ilicitas?: boolean;
};

type Antecedentes = {
  hipertensao?: boolean;
  diabetes?: boolean;
  cardiopatia?: boolean;
  asma?: boolean;
  epilepsia?: boolean;
  cirurgia_previa?: boolean;
  fratura_previa?: boolean;
  hernia?: boolean;
  transtorno_mental?: boolean;
  detalhes?: string;
};

type OcupacionalPrev = { empresa: string; cargo: string; anos: string; riscos: string };

const ANTEC_CAMPOS: { key: keyof Antecedentes; label: string }[] = [
  { key: "hipertensao", label: "Hipertensão arterial" },
  { key: "diabetes", label: "Diabetes" },
  { key: "cardiopatia", label: "Cardiopatia" },
  { key: "asma", label: "Asma / DPOC" },
  { key: "epilepsia", label: "Epilepsia" },
  { key: "cirurgia_previa", label: "Cirurgia prévia" },
  { key: "fratura_previa", label: "Fratura prévia" },
  { key: "hernia", label: "Hérnia" },
  { key: "transtorno_mental", label: "Transtorno mental" },
];

export function AnamneseDialog({ open, onOpenChange, employeeId, atendimentoId, examId, natureza = "PERIODICO", onSaved }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [queixa, setQueixa] = useState("");
  const [hda, setHda] = useState("");
  const [antPes, setAntPes] = useState<Antecedentes>({});
  const [antFam, setAntFam] = useState<Antecedentes>({});
  const [antOcup, setAntOcup] = useState<OcupacionalPrev[]>([]);
  const [habitos, setHabitos] = useState<Habitos>({});
  const [medicacoes, setMedicacoes] = useState("");
  const [alergias, setAlergias] = useState("");
  const [ef, setEf] = useState<ExameFisico>({});
  const [hipoteses, setHipoteses] = useState("");
  const [conduta, setConduta] = useState("");
  const [aptidao, setAptidao] = useState<string>("APTO");
  const [restricoes, setRestricoes] = useState("");
  const [obs, setObs] = useState("");
  const [medicoNome, setMedicoNome] = useState("");
  const [medicoCrm, setMedicoCrm] = useState("");
  const [finalizar, setFinalizar] = useState(true);

  // Prefill do coordenador PCMSO ativo
  const { data: coord } = useQuery({
    queryKey: ["pcmso-coord-ativo-para-anamnese"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pcmso_coordenadores" as any)
        .select("nome, crm, crm_uf")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: emp } = useQuery({
    queryKey: ["anamnese-emp", employeeId],
    enabled: open && !!employeeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nome, matricula, cpf, data_nascimento, sexo, roles(name), setor")
        .eq("id", employeeId)
        .single();
      return data as any;
    },
  });

  const { data: ultimaAnamnese } = useQuery({
    queryKey: ["anamnese-ultima", employeeId],
    enabled: open && !!employeeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("anamneses_ocupacionais" as any)
        .select("*")
        .eq("employee_id", employeeId)
        .order("data_anamnese", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (!open) return;
    if (coord && !medicoNome) {
      setMedicoNome(coord.nome ?? "");
      setMedicoCrm(coord.crm ? `${coord.crm}${coord.crm_uf ? "/" + coord.crm_uf : ""}` : "");
    }
  }, [open, coord, medicoNome]);

  useEffect(() => {
    if (!open) return;
    // Reset ao abrir
    setQueixa(""); setHda(""); setAntPes({}); setAntFam({}); setAntOcup([]);
    setHabitos({}); setMedicacoes(""); setAlergias(""); setEf({});
    setHipoteses(""); setConduta(""); setAptidao("APTO"); setRestricoes(""); setObs("");
    setMedicoNome(""); setMedicoCrm(""); setFinalizar(true);
  }, [open]);

  const importarUltima = () => {
    if (!ultimaAnamnese) { toast.error("Nenhuma anamnese anterior encontrada"); return; }
    setAntPes((ultimaAnamnese.antecedentes_pessoais ?? {}) as Antecedentes);
    setAntFam((ultimaAnamnese.antecedentes_familiares ?? {}) as Antecedentes);
    setAntOcup((ultimaAnamnese.antecedentes_ocupacionais ?? []) as OcupacionalPrev[]);
    setHabitos((ultimaAnamnese.habitos ?? {}) as Habitos);
    setMedicacoes(ultimaAnamnese.medicacoes_uso ?? "");
    setAlergias(ultimaAnamnese.alergias ?? "");
    toast.success("Histórico da última anamnese importado. Revise antes de salvar.");
  };

  const imc = ef.peso && ef.altura ? +(ef.peso / (ef.altura * ef.altura)).toFixed(1) : null;

  const salvar = async () => {
    if (!employeeId) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const payload: any = {
        employee_id: employeeId,
        atendimento_id: atendimentoId ?? null,
        exam_id: examId ?? null,
        natureza,
        medico_nome: medicoNome || null,
        medico_crm: medicoCrm || null,
        data_anamnese: new Date().toISOString().slice(0, 10),
        queixa_principal: queixa || null,
        hda: hda || null,
        antecedentes_pessoais: antPes,
        antecedentes_familiares: antFam,
        antecedentes_ocupacionais: antOcup,
        habitos,
        medicacoes_uso: medicacoes || null,
        alergias: alergias || null,
        exame_fisico: { ...ef, imc },
        hipoteses_diagnosticas: hipoteses || null,
        conduta: conduta || null,
        aptidao,
        restricoes: restricoes || null,
        observacoes: obs || null,
        finalizada: finalizar,
        finalizada_em: finalizar ? new Date().toISOString() : null,
        created_by: userRes.user?.id ?? null,
      };

      const { data, error } = await supabase
        .from("anamneses_ocupacionais" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      toast.success("Anamnese salva.");
      qc.invalidateQueries({ queryKey: ["anamneses"] });
      qc.invalidateQueries({ queryKey: ["atendimentos-hoje"] });
      onSaved?.((data as any).id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const addOcupacional = () => setAntOcup([...antOcup, { empresa: "", cargo: "", anos: "", riscos: "" }]);
  const removeOcupacional = (i: number) => setAntOcup(antOcup.filter((_, idx) => idx !== i));
  const updateOcupacional = (i: number, key: keyof OcupacionalPrev, v: string) => {
    const copy = [...antOcup]; copy[i] = { ...copy[i], [key]: v }; setAntOcup(copy);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col bg-slate-950 border-white/10 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-300" />
            Anamnese Ocupacional — NR-07 / PCMSO
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs flex items-center gap-2 flex-wrap">
            {emp ? <>Paciente: <span className="text-slate-200 font-medium">{emp.nome}</span></> : "Carregando…"}
            {emp?.roles?.name && <Badge variant="outline" className="border-white/15 text-slate-300">{emp.roles.name}</Badge>}
            <Badge className="bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30">{natureza}</Badge>
            {ultimaAnamnese && (
              <Button size="sm" variant="ghost" onClick={importarUltima} className="h-6 text-[11px] text-emerald-300 hover:text-emerald-200 ml-auto">
                Importar última anamnese
              </Button>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-3 -mr-3">
          <Tabs defaultValue="queixa" className="w-full">
            <TabsList className="bg-slate-900/60 border border-white/10 flex-wrap h-auto">
              <TabsTrigger value="queixa"><FileText className="h-3.5 w-3.5 mr-1" /> Queixa/HDA</TabsTrigger>
              <TabsTrigger value="antecedentes"><User2 className="h-3.5 w-3.5 mr-1" /> Antecedentes</TabsTrigger>
              <TabsTrigger value="habitos"><Cigarette className="h-3.5 w-3.5 mr-1" /> Hábitos</TabsTrigger>
              <TabsTrigger value="ocupacional"><Activity className="h-3.5 w-3.5 mr-1" /> Ocupacional</TabsTrigger>
              <TabsTrigger value="exame"><HeartPulse className="h-3.5 w-3.5 mr-1" /> Exame Físico</TabsTrigger>
              <TabsTrigger value="parecer"><Stethoscope className="h-3.5 w-3.5 mr-1" /> Parecer</TabsTrigger>
            </TabsList>

            <TabsContent value="queixa" className="pt-4 space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Queixa Principal</Label>
                <Textarea value={queixa} onChange={(e) => setQueixa(e.target.value)} rows={2}
                  placeholder="Ex.: Dor lombar há 3 dias, sem irradiação…" className="bg-slate-900/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">História da Doença Atual (HDA)</Label>
                <Textarea value={hda} onChange={(e) => setHda(e.target.value)} rows={4}
                  placeholder="Início, evolução, fatores desencadeantes, tratamentos prévios…" className="bg-slate-900/50 border-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Medicações em uso</Label>
                  <Textarea value={medicacoes} onChange={(e) => setMedicacoes(e.target.value)} rows={2}
                    placeholder="Nome, dose, frequência" className="bg-slate-900/50 border-white/10" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Alergias</Label>
                  <Textarea value={alergias} onChange={(e) => setAlergias(e.target.value)} rows={2}
                    placeholder="Medicamentos, alimentos, outros" className="bg-slate-900/50 border-white/10" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="antecedentes" className="pt-4 space-y-4">
              <SecaoAntecedentes titulo="Antecedentes Pessoais" data={antPes} onChange={setAntPes} />
              <SecaoAntecedentes titulo="Antecedentes Familiares" data={antFam} onChange={setAntFam} />
            </TabsContent>

            <TabsContent value="habitos" className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Tabagismo</Label>
                  <Select value={habitos.tabagismo ?? ""} onValueChange={(v) => setHabitos({ ...habitos, tabagismo: v as any })}>
                    <SelectTrigger className="bg-slate-900/50 border-white/10"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/10">
                      <SelectItem value="NUNCA">Nunca fumou</SelectItem>
                      <SelectItem value="EX_FUMANTE">Ex-fumante</SelectItem>
                      <SelectItem value="ATUAL">Fumante atual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Etilismo</Label>
                  <Select value={habitos.etilismo ?? ""} onValueChange={(v) => setHabitos({ ...habitos, etilismo: v as any })}>
                    <SelectTrigger className="bg-slate-900/50 border-white/10"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/10">
                      <SelectItem value="NAO">Não</SelectItem>
                      <SelectItem value="SOCIAL">Social</SelectItem>
                      <SelectItem value="FREQUENTE">Frequente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {habitos.tabagismo === "ATUAL" && (
                  <>
                    <NumField label="Cigarros/dia" value={habitos.cigarros_dia ?? null} onChange={(v) => setHabitos({ ...habitos, cigarros_dia: v })} />
                    <NumField label="Anos fumando" value={habitos.anos_fumo ?? null} onChange={(v) => setHabitos({ ...habitos, anos_fumo: v })} />
                  </>
                )}
                <div>
                  <Label className="text-xs text-slate-400">Atividade física</Label>
                  <Select value={habitos.atividade_fisica ?? ""} onValueChange={(v) => setHabitos({ ...habitos, atividade_fisica: v as any })}>
                    <SelectTrigger className="bg-slate-900/50 border-white/10"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/10">
                      <SelectItem value="SEDENTARIO">Sedentário</SelectItem>
                      <SelectItem value="LEVE">Leve (1-2x/sem)</SelectItem>
                      <SelectItem value="MODERADA">Moderada (3-4x/sem)</SelectItem>
                      <SelectItem value="INTENSA">Intensa (5+/sem)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField label="Horas de sono/noite" value={habitos.horas_sono ?? null} onChange={(v) => setHabitos({ ...habitos, horas_sono: v })} />
                <label className="flex items-center gap-2 mt-6 text-sm text-slate-200">
                  <Checkbox checked={!!habitos.drogas_ilicitas}
                    onCheckedChange={(v) => setHabitos({ ...habitos, drogas_ilicitas: !!v })} />
                  Uso de drogas ilícitas
                </label>
              </div>
            </TabsContent>

            <TabsContent value="ocupacional" className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">Empregos anteriores e riscos ocupacionais (NR-07 7.5.2)</p>
                <Button size="sm" variant="outline" onClick={addOcupacional} className="border-white/15 h-7 text-xs">+ Adicionar</Button>
              </div>
              {antOcup.length === 0 && <p className="text-xs text-slate-500 italic">Nenhum antecedente ocupacional registrado.</p>}
              {antOcup.map((o, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 p-2 rounded-lg border border-white/10 bg-slate-900/40">
                  <Input placeholder="Empresa" value={o.empresa} onChange={(e) => updateOcupacional(i, "empresa", e.target.value)} className="col-span-4 bg-slate-900/50 border-white/10 h-8 text-xs" />
                  <Input placeholder="Cargo" value={o.cargo} onChange={(e) => updateOcupacional(i, "cargo", e.target.value)} className="col-span-3 bg-slate-900/50 border-white/10 h-8 text-xs" />
                  <Input placeholder="Período" value={o.anos} onChange={(e) => updateOcupacional(i, "anos", e.target.value)} className="col-span-2 bg-slate-900/50 border-white/10 h-8 text-xs" />
                  <Input placeholder="Riscos" value={o.riscos} onChange={(e) => updateOcupacional(i, "riscos", e.target.value)} className="col-span-2 bg-slate-900/50 border-white/10 h-8 text-xs" />
                  <Button size="sm" variant="ghost" onClick={() => removeOcupacional(i)} className="col-span-1 h-8 text-red-300 hover:text-red-200">×</Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="exame" className="pt-4 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <NumField label="PA sistólica (mmHg)" value={ef.pa_sistolica ?? null} onChange={(v) => setEf({ ...ef, pa_sistolica: v })} />
                <NumField label="PA diastólica (mmHg)" value={ef.pa_diastolica ?? null} onChange={(v) => setEf({ ...ef, pa_diastolica: v })} />
                <NumField label="FC (bpm)" value={ef.fc ?? null} onChange={(v) => setEf({ ...ef, fc: v })} />
                <NumField label="FR (irpm)" value={ef.fr ?? null} onChange={(v) => setEf({ ...ef, fr: v })} />
                <NumField label="Temperatura (°C)" step="0.1" value={ef.temperatura ?? null} onChange={(v) => setEf({ ...ef, temperatura: v })} />
                <NumField label="Peso (kg)" step="0.1" value={ef.peso ?? null} onChange={(v) => setEf({ ...ef, peso: v })} />
                <NumField label="Altura (m)" step="0.01" value={ef.altura ?? null} onChange={(v) => setEf({ ...ef, altura: v })} />
                <div>
                  <Label className="text-xs text-slate-400">IMC (calc.)</Label>
                  <div className="h-8 rounded-md bg-slate-900/50 border border-white/10 px-2 flex items-center text-sm text-emerald-200">
                    {imc ?? "—"} {imc && <ImcBadge imc={imc} />}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TxField label="Ausculta cardíaca" value={ef.ausculta_cardiaca} onChange={(v) => setEf({ ...ef, ausculta_cardiaca: v })} />
                <TxField label="Ausculta pulmonar" value={ef.ausculta_pulmonar} onChange={(v) => setEf({ ...ef, ausculta_pulmonar: v })} />
                <TxField label="Abdome" value={ef.abdome} onChange={(v) => setEf({ ...ef, abdome: v })} />
                <TxField label="Neurológico" value={ef.neurologico} onChange={(v) => setEf({ ...ef, neurologico: v })} />
                <TxField label="Osteomuscular" value={ef.osteomuscular} onChange={(v) => setEf({ ...ef, osteomuscular: v })} />
                <TxField label="Observações do exame" value={ef.observacoes} onChange={(v) => setEf({ ...ef, observacoes: v })} />
              </div>
            </TabsContent>

            <TabsContent value="parecer" className="pt-4 space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Hipóteses diagnósticas</Label>
                <Textarea value={hipoteses} onChange={(e) => setHipoteses(e.target.value)} rows={2} className="bg-slate-900/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Conduta</Label>
                <Textarea value={conduta} onChange={(e) => setConduta(e.target.value)} rows={2}
                  placeholder="Ex.: liberar, encaminhar, solicitar exames complementares…" className="bg-slate-900/50 border-white/10" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Aptidão</Label>
                  <Select value={aptidao} onValueChange={setAptidao}>
                    <SelectTrigger className="bg-slate-900/50 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/10">
                      <SelectItem value="APTO">Apto</SelectItem>
                      <SelectItem value="APTO_COM_RESTRICOES">Apto com restrições</SelectItem>
                      <SelectItem value="INAPTO">Inapto</SelectItem>
                      <SelectItem value="PENDENTE_EXAMES">Pendente exames complementares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-slate-400">Restrições / recomendações</Label>
                  <Input value={restricoes} onChange={(e) => setRestricoes(e.target.value)} className="bg-slate-900/50 border-white/10" placeholder="Ex.: evitar carga > 15kg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Médico examinador</Label>
                  <Input value={medicoNome} onChange={(e) => setMedicoNome(e.target.value)} className="bg-slate-900/50 border-white/10" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">CRM</Label>
                  <Input value={medicoCrm} onChange={(e) => setMedicoCrm(e.target.value)} className="bg-slate-900/50 border-white/10" placeholder="Ex.: 12345/AM" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Observações finais</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="bg-slate-900/50 border-white/10" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <Checkbox checked={finalizar} onCheckedChange={(v) => setFinalizar(!!v)} />
                Finalizar anamnese ao salvar
              </label>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/15">Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar anamnese
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SecaoAntecedentes({ titulo, data, onChange }: { titulo: string; data: Antecedentes; onChange: (v: Antecedentes) => void }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">{titulo}</p>
      <div className="grid grid-cols-3 gap-2">
        {ANTEC_CAMPOS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
            <Checkbox checked={!!data[key]} onCheckedChange={(v) => onChange({ ...data, [key]: !!v })} />
            {label}
          </label>
        ))}
      </div>
      <Textarea placeholder="Detalhes (opcional)" value={data.detalhes ?? ""} onChange={(e) => onChange({ ...data, detalhes: e.target.value })}
        rows={2} className="bg-slate-900/50 border-white/10 mt-2 text-xs" />
    </div>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number | null; onChange: (v: number | null) => void; step?: string }) {
  return (
    <div>
      <Label className="text-xs text-slate-400">{label}</Label>
      <Input type="number" step={step ?? "1"} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="bg-slate-900/50 border-white/10 h-8" />
    </div>
  );
}
function TxField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-slate-400">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="bg-slate-900/50 border-white/10 h-8" />
    </div>
  );
}
function ImcBadge({ imc }: { imc: number }) {
  let tone = "text-emerald-300", txt = "normal";
  if (imc < 18.5) { tone = "text-amber-300"; txt = "baixo"; }
  else if (imc >= 25 && imc < 30) { tone = "text-amber-300"; txt = "sobrepeso"; }
  else if (imc >= 30 && imc < 35) { tone = "text-orange-300"; txt = "obesidade I"; }
  else if (imc >= 35 && imc < 40) { tone = "text-red-300"; txt = "obesidade II"; }
  else if (imc >= 40) { tone = "text-red-400"; txt = "obesidade III"; }
  return <span className={`ml-2 text-[10px] uppercase tracking-wider ${tone}`}>{txt}</span>;
}