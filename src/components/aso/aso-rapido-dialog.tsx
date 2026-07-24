import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extrairDadosAso } from "@/lib/aso-ocr.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Upload, Stethoscope, CheckCircle2, X, Search } from "lucide-react";
import { toast } from "sonner";
import { onlyDigits } from "@/lib/validators/cpf";

type Emp = { id: string; nome: string; matricula: string | null; cpf: string | null; status: string };

function addMonths(iso: string, m: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}
function normalize(s: string) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
}
function scoreMatch(a: string, b: string) {
  const A = new Set(normalize(a).split(" ").filter((t) => t.length >= 2));
  const B = new Set(normalize(b).split(" ").filter((t) => t.length >= 2));
  if (!A.size || !B.size) return 0;
  let i = 0; A.forEach((t) => B.has(t) && i++);
  return i / Math.max(A.size, B.size);
}

export function AsoRapidoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const extrair = useServerFn(extrairDadosAso);
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "revisar">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [empId, setEmpId] = useState<string>("");
  const [empSearch, setEmpSearch] = useState("");

  const [f, setF] = useState({
    tipo_exame: "Clínico",
    natureza: "PERIODICO" as "ADMISSIONAL" | "PERIODICO" | "RETORNO_TRABALHO" | "MUDANCA_RISCO" | "DEMISSIONAL" | "SEMESTRAL",
    periodicidade_meses: 12,
    data_realizacao: new Date().toISOString().slice(0, 10),
    data_vencimento: addMonths(new Date().toISOString().slice(0, 10), 12),
    aptidao: "SIM" as "SIM" | "NAO",
    observacoes: "",
    medico_nome: "",
    medico_crm: "",
  });

  const { data: employees } = useQuery({
    queryKey: ["aso-rapido-emps"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, nome, matricula, cpf, status").eq("status", "ATIVO").order("nome");
      return (data ?? []) as Emp[];
    },
  });

  const filteredEmps = useMemo(() => {
    const q = normalize(empSearch);
    if (!q) return (employees ?? []).slice(0, 30);
    return (employees ?? []).filter((e) =>
      normalize(e.nome).includes(q) ||
      (e.matricula ?? "").toLowerCase().includes(empSearch.toLowerCase()) ||
      (onlyDigits(e.cpf ?? "").includes(onlyDigits(empSearch)) && onlyDigits(empSearch).length >= 3),
    ).slice(0, 30);
  }, [employees, empSearch]);

  const reset = () => {
    setStep("upload"); setFile(null); setAnalyzing(false);
    setEmpId(""); setEmpSearch("");
    setF({
      tipo_exame: "Clínico", natureza: "PERIODICO", periodicidade_meses: 12,
      data_realizacao: new Date().toISOString().slice(0, 10),
      data_vencimento: addMonths(new Date().toISOString().slice(0, 10), 12),
      aptidao: "SIM", observacoes: "", medico_nome: "", medico_crm: "",
    });
  };

  async function analisar() {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("Arquivo > 15MB. Reduza a resolução."); return; }
    setAnalyzing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const r = await extrair({ data: { fileBase64: b64, mime: file.type || "application/pdf" } });
      if (r.error) { toast.error(r.error); return; }
      const x = r.extraido ?? {};
      // Auto-match funcionário
      if (!empId && x.nome && employees) {
        const alvoCpf = onlyDigits(x.cpf ?? "");
        const alvoMat = (x.matricula ?? "").trim();
        let best: { e: Emp; sc: number } | null = null;
        for (const e of employees) {
          if (alvoCpf && onlyDigits(e.cpf ?? "") === alvoCpf) { best = { e, sc: 1 }; break; }
          if (alvoMat && (e.matricula ?? "") === alvoMat) { best = { e, sc: 1 }; break; }
          const sc = scoreMatch(x.nome, e.nome);
          if (!best || sc > best.sc) best = { e, sc };
        }
        if (best && best.sc >= 0.6) { setEmpId(best.e.id); toast.success(`Funcionário identificado: ${best.e.nome}`); }
      }
      const dr = x.data_realizacao || f.data_realizacao;
      const dv = x.data_vencimento || addMonths(dr, Number(f.periodicidade_meses));
      setF((prev) => ({
        ...prev,
        tipo_exame: x.tipo_exame || prev.tipo_exame,
        natureza: (x.natureza as any) || prev.natureza,
        data_realizacao: dr,
        data_vencimento: dv,
        aptidao: (x.aptidao as any) || prev.aptidao,
        medico_nome: x.medico_nome || prev.medico_nome,
        medico_crm: x.medico_crm || prev.medico_crm,
        observacoes: x.observacoes || prev.observacoes,
      }));
      setStep("revisar");
      toast.success("Dados extraídos — revise antes de salvar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao analisar");
    } finally { setAnalyzing(false); }
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!empId) throw new Error("Selecione o funcionário");
      if (!f.data_realizacao) throw new Error("Data de realização obrigatória");
      const venc = f.data_vencimento || addMonths(f.data_realizacao, Number(f.periodicidade_meses) || 12);
      let anexo_path: string | null = null;
      if (file) {
        const path = `${empId}/exames/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        anexo_path = path;
      }
      const obs = [f.observacoes, f.medico_nome ? `Médico: ${f.medico_nome}${f.medico_crm ? ` (CRM ${f.medico_crm})` : ""}` : ""].filter(Boolean).join(" | ");
      const { data: inserted, error } = await supabase.from("employee_exams").insert({
        employee_id: empId,
        tipo_exame: f.tipo_exame || "ASO Clínico",
        natureza: f.natureza,
        periodicidade_meses: Number(f.periodicidade_meses) || 12,
        data_realizacao: f.data_realizacao,
        data_vencimento: venc,
        aptidao: f.aptidao,
        observacoes: obs || null,
        anexo_path,
      }).select("id").single();
      if (error) throw error;
      // Fecha convocação pendente se existir
      const { data: conv } = await supabase.from("convocacoes_exames")
        .select("id").eq("employee_id", empId).eq("status", "PENDENTE")
        .order("convocado_em", { ascending: false }).limit(1).maybeSingle();
      if (conv?.id && inserted?.id) {
        await supabase.from("convocacoes_exames").update({
          status: "ATENDIDA", atendida_em: new Date().toISOString(), atendida_exam_id: inserted.id,
        }).eq("id", conv.id);
      }
    },
    onSuccess: () => {
      toast.success("ASO registrado com sucesso");
      qc.invalidateQueries({ queryKey: ["asos-kpis"] });
      qc.invalidateQueries({ queryKey: ["asos-registrados"] });
      qc.invalidateQueries({ queryKey: ["asos-agenda-hoje"] });
      reset(); onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const empSel = employees?.find((e) => e.id === empId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl bg-slate-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-emerald-300" /> ASO Rápido
          </DialogTitle>
          <p className="text-xs text-slate-400">Anexe o ASO em papel — a IA extrai os campos e você só revisa.</p>
        </DialogHeader>

        {step === "upload" ? (
          <div className="space-y-4">
            <div>
              <Label className="text-slate-200 text-xs">Arquivo do ASO (PDF, JPG, PNG)</Label>
              <div
                onClick={() => fileInput.current?.click()}
                className="mt-1 rounded-lg border-2 border-dashed border-white/15 hover:border-emerald-400/40 bg-slate-800/40 cursor-pointer p-6 text-center transition"
              >
                <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                {file ? (
                  <div className="text-sm text-white">{file.name} <span className="text-slate-500">({(file.size / 1024).toFixed(0)} KB)</span></div>
                ) : (
                  <>
                    <div className="text-sm text-slate-300">Clique para escolher o arquivo</div>
                    <div className="text-[11px] text-slate-500 mt-1">Máx 15MB</div>
                  </>
                )}
              </div>
              <input ref={fileInput} type="file" accept="application/pdf,image/*" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <button
                type="button"
                onClick={() => setStep("revisar")}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-2 text-left"
              >
                Preencher manualmente (sem anexo)
              </button>
              <Button onClick={analisar} disabled={!file || analyzing} className="bg-emerald-600 hover:bg-emerald-500">
                {analyzing ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Analisando...</>) : (<><Sparkles className="h-4 w-4 mr-1.5" /> Extrair com IA</>)}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            {/* Funcionário */}
            <div>
              <Label className="text-slate-200 text-xs">Funcionário *</Label>
              {empSel ? (
                <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2.5">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{empSel.nome}</div>
                    <div className="text-[11px] text-slate-400">Mat. {empSel.matricula ?? "—"}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEmpId("")} className="text-slate-400 hover:text-white">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative mt-1">
                    <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-500" />
                    <Input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                      placeholder="Buscar por nome, matrícula ou CPF"
                      className="pl-8 bg-slate-800 border-white/10 text-white" />
                  </div>
                  {filteredEmps.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-slate-800/60 divide-y divide-white/5">
                      {filteredEmps.map((e) => (
                        <button key={e.id} type="button" onClick={() => { setEmpId(e.id); setEmpSearch(""); }}
                          className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm text-slate-200">
                          <div className="truncate">{e.nome}</div>
                          <div className="text-[11px] text-slate-500">Mat. {e.matricula ?? "—"}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-200 text-xs">Natureza *</Label>
                <Select value={f.natureza} onValueChange={(v) => setF({ ...f, natureza: v as any })}>
                  <SelectTrigger className="bg-slate-800 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMISSIONAL">Admissional</SelectItem>
                    <SelectItem value="PERIODICO">Periódico</SelectItem>
                    <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                    <SelectItem value="RETORNO_TRABALHO">Retorno ao Trabalho</SelectItem>
                    <SelectItem value="MUDANCA_RISCO">Mudança de Risco</SelectItem>
                    <SelectItem value="DEMISSIONAL">Demissional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-200 text-xs">Tipo</Label>
                <Input value={f.tipo_exame} onChange={(e) => setF({ ...f, tipo_exame: e.target.value })}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-slate-200 text-xs">Realização *</Label>
                <Input type="date" value={f.data_realizacao}
                  onChange={(e) => {
                    const v = e.target.value;
                    setF({ ...f, data_realizacao: v, data_vencimento: addMonths(v, Number(f.periodicidade_meses) || 12) });
                  }}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-slate-200 text-xs">Period. (meses)</Label>
                <Input type="number" value={f.periodicidade_meses}
                  onChange={(e) => {
                    const p = Number(e.target.value) || 12;
                    setF({ ...f, periodicidade_meses: p, data_vencimento: addMonths(f.data_realizacao, p) });
                  }}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-slate-200 text-xs">Vencimento</Label>
                <Input type="date" value={f.data_vencimento}
                  onChange={(e) => setF({ ...f, data_vencimento: e.target.value })}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-200 text-xs">Aptidão *</Label>
                <Select value={f.aptidao} onValueChange={(v) => setF({ ...f, aptidao: v as any })}>
                  <SelectTrigger className="bg-slate-800 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIM">Apto</SelectItem>
                    <SelectItem value="NAO">Inapto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                {f.aptidao === "NAO" && (
                  <Badge className="bg-red-500/15 text-red-200 ring-1 ring-red-400/30">Portaria bloqueia acesso automaticamente</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-200 text-xs">Médico</Label>
                <Input value={f.medico_nome} onChange={(e) => setF({ ...f, medico_nome: e.target.value })}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-slate-200 text-xs">CRM</Label>
                <Input value={f.medico_crm} onChange={(e) => setF({ ...f, medico_crm: e.target.value })}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
            </div>

            <div>
              <Label className="text-slate-200 text-xs">Observações</Label>
              <Textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })}
                className="bg-slate-800 border-white/10 text-white" />
            </div>

            {file && (
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Anexo: {file.name}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "revisar" && (
            <Button variant="ghost" onClick={() => setStep("upload")} className="text-slate-400 hover:text-white">Voltar</Button>
          )}
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} className="border-white/15">Cancelar</Button>
          {step === "revisar" && (
            <Button onClick={() => salvar.mutate()} disabled={!empId || salvar.isPending} className="bg-emerald-600 hover:bg-emerald-500">
              {salvar.isPending ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Salvando...</>) : (<><Stethoscope className="h-4 w-4 mr-1.5" /> Registrar ASO</>)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}