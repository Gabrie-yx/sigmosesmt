import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, Plus, Pencil, Trash2, Users, Paperclip, Download, X, FileText, Clock, Link2, Building2, ClipboardList, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR, daysUntil } from "@/lib/utils-date";
import { gerarListaPresenca } from "@/lib/lista-presenca-pdf";
import { CursosMinistradosPanel } from "@/components/cursos/cursos-ministrados-panel";
import { sortMatrixCourses } from "@/lib/nr-order";

export const Route = createFileRoute("/app/trainings")({
  component: TrainingsPage,
});

const TIPOS_FIXOS = ["NR", "Integração", "Reciclagem", "DDS", "Palestra", "Outro"];

const SITUACOES = ["APROVADO", "REPROVADO", "PRESENTE", "AUSENTE"] as const;
const MODALIDADES = ["PRESENCIAL", "ONLINE", "HIBRIDA"] as const;
const MOD_LABEL: Record<string, string> = { PRESENCIAL: "Presencial", ONLINE: "Online", HIBRIDA: "Híbrida" };

const today = () => new Date().toISOString().slice(0, 10);

function addMonths(date: string, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function TrainingsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openAttendees, setOpenAttendees] = useState<string | null>(null);
  const [gerarListaFor, setGerarListaFor] = useState<any | null>(null);
  const [f, setF] = useState({
    tipo: TIPOS_FIXOS[0],
    titulo: "",
    instrutor: "",
    instituicao: "",
    local: "",
    data_realizacao: today(),
    carga_horaria_h: 8,
    validade_meses: 12,
    observacoes: "",
    course_id: "" as string,
    modalidade: "PRESENCIAL" as typeof MODALIDADES[number],
  });
  const [file, setFile] = useState<File | null>(null);
  const [assinaturaFile, setAssinaturaFile] = useState<File | null>(null);

  const { data: trainings = [] } = useQuery({
    queryKey: ["trainings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trainings").select("*").order("data_realizacao", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: matrixCourses = [] } = useQuery({
    queryKey: ["matrix-courses-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_matrix_courses")
        .select("id,codigo,nome,periodicidade,ativo")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return sortMatrixCourses(data ?? []);
    },
  });

  const { data: attendeesCounts = {} } = useQuery({
    queryKey: ["training-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_attendees").select("training_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.training_id] = (counts[r.training_id] ?? 0) + 1; });
      return counts;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!f.course_id) {
        throw new Error("Selecione o Curso da Matriz — o vínculo é obrigatório para atualizar a Matriz de Treinamento.");
      }
      let anexo_path: string | null = null;
      if (file) {
        const path = `${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("training-docs").upload(path, file);
        if (upErr) throw upErr;
        anexo_path = path;
      }
      let assinatura_path: string | null = null;
      if (assinaturaFile) {
        const path = `assinaturas/${Date.now()}_${assinaturaFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("training-docs").upload(path, assinaturaFile);
        if (upErr) throw upErr;
        assinatura_path = path;
      }
      const payload: any = {
        tipo: f.tipo, titulo: f.titulo || null, instrutor: f.instrutor || null,
        instituicao: f.instituicao || null, data_realizacao: f.data_realizacao,
        carga_horaria_h: f.carga_horaria_h, validade_meses: f.validade_meses,
        observacoes: f.observacoes || null,
        course_id: f.course_id || null,
        local: f.local || null,
        modalidade: f.modalidade,
      };
      if (anexo_path) payload.anexo_path = anexo_path;
      if (assinatura_path) payload.assinatura_path = assinatura_path;
      if (editingId) {
        const { error } = await supabase.from("trainings").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const { data, error } = await supabase.from("trainings").insert(payload).select("id").single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["trainings"] });
      toast.success(editingId ? "Treinamento atualizado" : "Treinamento cadastrado");
      const wasNew = !editingId;
      reset();
      if (wasNew && newId) setOpenAttendees(newId);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trainings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trainings"] });
      qc.invalidateQueries({ queryKey: ["training-counts"] });
      toast.success("Treinamento removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function reset() {
    setEditingId(null);
    setFile(null);
    setAssinaturaFile(null);
    setF({
      tipo: TIPOS_FIXOS[0], titulo: "", instrutor: "", instituicao: "", local: "",
      data_realizacao: today(), carga_horaria_h: 8, validade_meses: 12, observacoes: "",
      course_id: "", modalidade: "PRESENCIAL",
    });
  }

  function startEdit(t: any) {
    setEditingId(t.id);
    setF({
      tipo: t.tipo, titulo: t.titulo ?? "", instrutor: t.instrutor ?? "",
      instituicao: t.instituicao ?? "", local: t.local ?? "", data_realizacao: t.data_realizacao,
      carga_horaria_h: Number(t.carga_horaria_h), validade_meses: t.validade_meses,
      observacoes: t.observacoes ?? "",
      course_id: t.course_id ?? "",
      modalidade: (t.modalidade as any) ?? "PRESENCIAL",
    });
    setFile(null);
    setAssinaturaFile(null);
  }

  async function downloadAnexo(path: string) {
    const { data, error } = await supabase.storage.from("training-docs").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  async function pathToDataUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("training-docs").download(path);
    if (error || !data) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(data);
    });
  }

  async function gerarLista(t: any) {
    try {
      const { data: atts, error } = await supabase
        .from("training_attendees")
        .select("employee_id")
        .eq("training_id", t.id);
      if (error) throw error;
      const empIds = Array.from(new Set((atts ?? []).map((a: any) => a.employee_id).filter(Boolean)));
      const empRes = empIds.length
        ? await supabase.from("employees").select("id, nome, company_id, role_id").in("id", empIds)
        : { data: [] as any[] };
      const empMap = Object.fromEntries((empRes.data ?? []).map((e: any) => [e.id, e]));
      const compIds = Array.from(new Set((empRes.data ?? []).map((e: any) => e.company_id).filter(Boolean)));
      const roleIds = Array.from(new Set((empRes.data ?? []).map((e: any) => e.role_id).filter(Boolean)));
      const [compRes, roleRes] = await Promise.all([
        compIds.length ? supabase.from("companies").select("id,name").in("id", compIds) : Promise.resolve({ data: [] as any[] }),
        roleIds.length ? supabase.from("roles").select("id,name").in("id", roleIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const compMap = Object.fromEntries((compRes.data ?? []).map((c: any) => [c.id, c.name]));
      const roleMap = Object.fromEntries((roleRes.data ?? []).map((r: any) => [r.id, r.name]));
      const participantes = (atts ?? []).map((a: any) => {
        const e = empMap[a.employee_id] ?? {};
        return {
          nome: e.nome ?? "",
          empresa: compMap[e.company_id] ?? "",
          cargo: roleMap[e.role_id] ?? "",
        };
      });
      const assinaturaDataUrl = await pathToDataUrl(t.assinatura_path);
      const doc = gerarListaPresenca({
        titulo: `${t.tipo}${t.titulo ? " — " + t.titulo : ""}`,
        instrutor: t.instrutor ?? "",
        assinaturaDataUrl,
        assunto: t.observacoes ?? t.titulo ?? t.tipo,
        tipo: "INTERNO",
        data: formatDateBR(t.data_realizacao),
        cargaHoraria: `${t.carga_horaria_h}h`,
        instituicao: t.instituicao ?? "",
        local: t.local ?? "",
        participantes,
      });
      doc.save(`lista-presenca-${(t.titulo || t.tipo).replace(/[^\w-]/g, "_")}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar lista");
    }
  }

  return (
    <div className="p-6 md:p-8 animate-fadeIn h-full overflow-y-auto custom-scrollbar">
      <h2 className="heading-display text-3xl md:text-4xl text-rose-100 mb-8 flex items-center gap-3 drop-shadow-[0_2px_12px_rgba(220,38,70,0.45)]">
        <GraduationCap className="h-8 w-8 text-rose-300" /> Treinamentos &amp; Integrações
      </h2>

      <Tabs defaultValue="cursos" className="w-full">
        <TabsList className="glass-card mb-6 p-1.5 gap-1 bg-transparent border-0">
          <TabsTrigger
            value="cursos"
            className="text-xs font-black uppercase tracking-wider text-rose-100/70 data-[state=active]:text-white data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-600/80 data-[state=active]:to-rose-900/80 data-[state=active]:shadow-[0_0_20px_-4px_rgba(220,38,70,0.6)] rounded-lg transition-all"
          >
            Cursos Ministrados
          </TabsTrigger>
          <TabsTrigger
            value="grade"
            className="text-xs font-black uppercase tracking-wider text-rose-100/70 data-[state=active]:text-white data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-600/80 data-[state=active]:to-rose-900/80 data-[state=active]:shadow-[0_0_20px_-4px_rgba(220,38,70,0.6)] rounded-lg transition-all"
          >
            Grade Atual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cursos">
          <CursosMinistradosPanel />
        </TabsContent>

        <TabsContent value="grade">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* FORM */}
        {isEditor && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                {editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingId ? "Editar Treinamento" : "Novo Treinamento"}
              </span>
              {editingId && (
                <button onClick={reset} className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-200 uppercase font-black">
                  Cancelar
                </button>
              )}
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-black text-slate-500 uppercase">Tipo</Label>
                  <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_FIXOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-black text-slate-500 uppercase">Data de Realização</Label>
                  <Input type="date" required value={f.data_realizacao} onChange={(e) => setF({ ...f, data_realizacao: e.target.value })} className="mt-2" />
                </div>
              </div>

              <div>
                <Label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Curso da Matriz (vínculo automático) <span className="text-red-600">*</span>
                </Label>
                <Select value={f.course_id || ""} onValueChange={(v) => {
                  const c = matrixCourses.find((x: any) => x.id === v);
                  setF({ ...f, course_id: v, tipo: c ? `${c.codigo} — ${c.nome}` : f.tipo });
                }}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione o curso da matriz..." /></SelectTrigger>
                  <SelectContent>
                    {matrixCourses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} — {c.nome} ({c.periodicidade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 mt-1">
                  <b>Obrigatório.</b> Todo participante marcado como <b>APROVADO</b> ou <b>PRESENTE</b> recebe automaticamente a data deste evento na sua Matriz de Treinamento.
                </p>
              </div>

              <div>
                <Label className="text-[10px] font-black text-slate-500 uppercase">Título / Turma</Label>
                <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex: NR-35 Turma 12/2026" className="mt-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-black text-slate-500 uppercase">Instrutor</Label>
                  <Input value={f.instrutor} onChange={(e) => setF({ ...f, instrutor: e.target.value })} className="mt-2" />
                </div>
                <div>
                  <Label className="text-[10px] font-black text-slate-500 uppercase">Instituição</Label>
                  <Input value={f.instituicao} onChange={(e) => setF({ ...f, instituicao: e.target.value })} className="mt-2" />
                </div>
              </div>

              <div>
                <Label className="text-[10px] font-black text-slate-500 uppercase">Local</Label>
                <Input value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} placeholder="Ex.: Auditório DMN" className="mt-2" />
              </div>

              <div>
                <Label className="text-[10px] font-black text-slate-500 uppercase">Modalidade</Label>
                <Select value={f.modalidade} onValueChange={(v) => setF({ ...f, modalidade: v as any })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => <SelectItem key={m} value={m}>{MOD_LABEL[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-black text-slate-500 uppercase">Carga Horária (h)</Label>
                  <Input type="number" min={0} step={0.5} value={f.carga_horaria_h} onChange={(e) => setF({ ...f, carga_horaria_h: Number(e.target.value) })} className="mt-2" />
                </div>
                <div>
                  <Label className="text-[10px] font-black text-slate-500 uppercase">Validade (meses)</Label>
                  <Input type="number" min={1} value={f.validade_meses} onChange={(e) => setF({ ...f, validade_meses: Number(e.target.value) })} className="mt-2" />
                </div>
              </div>

              <div>
                <Label className="text-[10px] font-black text-slate-500 uppercase">Observações</Label>
                <Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} className="mt-2" rows={2} />
              </div>

              <div>
                <Label className="text-[10px] font-black text-slate-500 uppercase">Certificado / Lista de Presença (PDF)</Label>
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2" />
              </div>

              <div>
                <Label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Assinatura do Instrutor (PNG)
                </Label>
                <Input type="file" accept="image/png" onChange={(e) => setAssinaturaFile(e.target.files?.[0] ?? null)} className="mt-2" />
                <p className="text-[10px] text-slate-500 mt-1">PNG transparente recomendado — aparece no campo "ASSINATURA" da lista de presença.</p>
              </div>

              <Button type="submit" disabled={save.isPending} className="w-full bg-[#991b1b] hover:bg-[#7f1d1d] text-xs font-black uppercase tracking-widest h-auto py-4 rounded-xl">
                {editingId ? "Salvar Alterações" : "Cadastrar Treinamento"}
              </Button>
            </form>
          </div>
        )}

        {/* LIST */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" /> Histórico ({trainings.length})
          </h3>
          <div className="space-y-3 max-h-[700px] overflow-y-auto custom-scrollbar pr-2">
            {trainings.length === 0 && (
              <div className="text-center text-slate-400 py-10 font-bold uppercase text-xs border border-dashed border-slate-200 rounded-2xl">
                Nenhum treinamento cadastrado.
              </div>
            )}
            {trainings.map((t: any) => (
              <div key={t.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-colors">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black uppercase text-[#991b1b] tracking-widest">{t.tipo}</div>
                    <h4 className="text-sm font-black text-slate-800 truncate">{t.titulo || "—"}</h4>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setOpenAttendees(t.id)} className="w-7 h-7 rounded bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors" title="Participantes">
                      <Users className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setGerarListaFor(t)} className="w-7 h-7 rounded bg-violet-100 text-violet-600 hover:bg-violet-600 hover:text-white flex items-center justify-center" title="Gerar Lista de Presença (PDF)">
                      <ClipboardList className="h-3.5 w-3.5" />
                    </button>
                    {t.anexo_path && (
                      <button onClick={() => downloadAnexo(t.anexo_path)} className="w-7 h-7 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center" title="Baixar anexo">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isEditor && (
                      <button onClick={() => startEdit(t)} className="w-7 h-7 rounded bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white flex items-center justify-center" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => { if (confirm("Excluir treinamento e toda a lista de presença?")) del.mutate(t.id); }} className="w-7 h-7 rounded bg-red-100 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-bold text-slate-500 uppercase">
                  <div><Clock className="h-3 w-3 inline mr-1" />{formatDateBR(t.data_realizacao)}</div>
                  <div>{t.carga_horaria_h}h</div>
                  <div>Val: {t.validade_meses}m</div>
                  <div className="flex items-center gap-1"><Users className="h-3 w-3" />{attendeesCounts[t.id] ?? 0} part.</div>
                </div>
                {(t.instrutor || t.instituicao) && (
                  <div className="text-[10px] text-slate-500 mt-2">
                    {t.instrutor && <span>👤 {t.instrutor}</span>}
                    {t.instrutor && t.instituicao && <span className="mx-1">•</span>}
                    {t.instituicao && <span>🏫 {t.instituicao}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>
        </TabsContent>
      </Tabs>

      {openAttendees && (
        <AttendeesDialog
          trainingId={openAttendees}
          training={trainings.find((t: any) => t.id === openAttendees)}
          onClose={() => setOpenAttendees(null)}
        />
      )}
      {gerarListaFor && (
        <GerarListaDialog
          training={gerarListaFor}
          onClose={() => setGerarListaFor(null)}
        />
      )}
    </div>
  );
}

export function AttendeesDialog({ trainingId, training, onClose }: { trainingId: string; training: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [bulkCompany, setBulkCompany] = useState<string>("");
  const [bulkSituacao, setBulkSituacao] = useState<typeof SITUACOES[number]>("PRESENTE");

  const { data: attendees = [] } = useQuery({
    queryKey: ["training-attendees", trainingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_attendees")
        .select("*, employees(nome, matricula, company_id)")
        .eq("training_id", trainingId);
      if (error) throw error;
      return data;
    },
  });

  const { data: emps = [] } = useQuery({
    queryKey: ["employees-light"],
    queryFn: async () =>
      (
        await supabase
          .from("employees")
          .select("id,nome,matricula,company_id,status")
          .eq("status", "ATIVO")
          .order("nome")
      ).data ?? [],
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name")).data ?? [],
  });

  const enrolled = new Set(attendees.map((a: any) => a.employee_id));
  const available = emps.filter((e: any) => !enrolled.has(e.id));
  const companyById = useMemo(() => new Map(companies.map((c: any) => [c.id, c.name])), [companies]);
  const companyEmployees = useMemo(
    () => (bulkCompany ? available.filter((e: any) => e.company_id === bulkCompany) : []),
    [available, bulkCompany],
  );

  const add = useMutation({
    mutationFn: async (employeeId: string) => {
      if (!employeeId) throw new Error("Selecione um colaborador");
      const data_vencimento = addMonths(training.data_realizacao, training.validade_meses);
      const { error } = await supabase.from("training_attendees").insert({
        training_id: trainingId,
        employee_id: employeeId,
        situacao: bulkSituacao,
        data_vencimento,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-attendees", trainingId] });
      qc.invalidateQueries({ queryKey: ["training-counts"] });
      toast.success("Participante adicionado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_attendees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-attendees", trainingId] });
      qc.invalidateQueries({ queryKey: ["training-counts"] });
      toast.success("Participante removido");
    },
  });

  const bulkAdd = useMutation({
    mutationFn: async () => {
      if (!bulkCompany) throw new Error("Selecione uma empresa");
      const targets = emps.filter((e: any) => e.company_id === bulkCompany && !enrolled.has(e.id));
      if (targets.length === 0) throw new Error("Nenhum colaborador novo dessa empresa");
      const data_vencimento = addMonths(training.data_realizacao, training.validade_meses);
      const rows = targets.map((e: any) => ({
        training_id: trainingId,
        employee_id: e.id,
        situacao: bulkSituacao,
        data_vencimento,
      }));
      const { error } = await supabase.from("training_attendees").insert(rows);
      if (error) throw error;
      return targets.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["training-attendees", trainingId] });
      qc.invalidateQueries({ queryKey: ["training-counts"] });
      toast.success(`${n} participantes adicionados`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkRemoveAll = useMutation({
    mutationFn: async () => {
      const ids = attendees.map((a: any) => a.id);
      if (ids.length === 0) throw new Error("Não há participantes para remover");
      const { error } = await supabase.from("training_attendees").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["training-attendees", trainingId] });
      qc.invalidateQueries({ queryKey: ["training-counts"] });
      toast.success(`${n} participantes removidos`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkRemoveCompany = useMutation({
    mutationFn: async () => {
      if (!bulkCompany) throw new Error("Selecione uma empresa");
      const ids = attendees
        .filter((a: any) => a.employees?.company_id === bulkCompany)
        .map((a: any) => a.id);
      if (ids.length === 0) throw new Error("Nenhum participante dessa empresa");
      const { error } = await supabase.from("training_attendees").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["training-attendees", trainingId] });
      qc.invalidateQueries({ queryKey: ["training-counts"] });
      toast.success(`${n} participantes removidos`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function statusColor(a: any) {
    if (a.situacao === "REPROVADO" || a.situacao === "AUSENTE") return "bg-rose-950/60 text-rose-200 border-rose-500/40";
    if (a.data_vencimento) {
      const d = daysUntil(a.data_vencimento);
      if (d !== null && d < 0) return "bg-rose-950/60 text-rose-200 border-rose-500/40";
      if (d !== null && d <= 30) return "bg-amber-950/60 text-amber-200 border-amber-500/40";
    }
    return "bg-emerald-950/60 text-emerald-200 border-emerald-500/40";
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Participantes — {training?.tipo} {training?.titulo && `• ${training.titulo}`}
          </DialogTitle>
        </DialogHeader>

        {isEditor && (
          <div className="rounded-xl p-4 border border-rose-500/20 bg-black/30 backdrop-blur-sm shadow-[0_0_24px_-12px_rgba(220,38,70,0.35)]">
            <Label className="text-[10px] font-black text-rose-200/80 uppercase flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Adicionar em massa por empresa
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mt-2 mb-4">
              <select
                value={bulkCompany}
                onChange={(e) => setBulkCompany(e.target.value)}
                className="md:col-span-7 bg-black/40 border border-white/15 text-rose-50 rounded-md px-3 py-2 text-xs font-semibold focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 [&>option]:bg-slate-900 [&>option]:text-rose-50"
              >
                <option value="">-- selecione empresa --</option>
                {companies.map((c: any) => {
                  const ativos = emps.filter((e: any) => e.company_id === c.id).length;
                  const jaAdd = emps.filter((e: any) => e.company_id === c.id && enrolled.has(e.id)).length;
                  const restantes = ativos - jaAdd;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} — {jaAdd}/{ativos} já na turma · {restantes} a adicionar
                    </option>
                  );
                })}
              </select>
              <Select value={bulkSituacao} onValueChange={(v) => setBulkSituacao(v as any)}>
                <SelectTrigger className="md:col-span-3 bg-black/40 border-white/15 text-rose-50"><SelectValue /></SelectTrigger>
                <SelectContent>{SITUACOES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={() => bulkAdd.mutate()} disabled={bulkAdd.isPending || !bulkCompany} className="md:col-span-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-[0_0_18px_-4px_rgba(220,38,70,0.6)]">
                <Users className="h-4 w-4 mr-1" /> Add Todos
              </Button>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!bulkCompany || bulkRemoveCompany.isPending}
                  onClick={() => {
                    if (confirm(`Remover TODOS os participantes da empresa selecionada?`)) bulkRemoveCompany.mutate();
                  }}
                  className="border-rose-500/40 bg-rose-950/30 text-rose-200 hover:bg-rose-900/50"
                >
                  <X className="h-4 w-4 mr-1" /> Excluir da empresa selecionada
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={attendees.length === 0 || bulkRemoveAll.isPending}
                  onClick={() => {
                    if (confirm(`Remover TODOS os ${attendees.length} participantes desta turma? Esta ação não pode ser desfeita.`)) bulkRemoveAll.mutate();
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Excluir todos ({attendees.length})
                </Button>
              </div>
            )}

            <Label className="text-[10px] font-black text-rose-200/70 uppercase">Funcionários da empresa selecionada</Label>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-white/10 bg-black/30">
              {!bulkCompany ? (
                <div className="px-3 py-4 text-xs font-bold uppercase text-muted-foreground">Selecione uma empresa acima para carregar os funcionários.</div>
              ) : companyEmployees.length === 0 ? (
                <div className="px-3 py-4 text-xs font-bold uppercase text-muted-foreground">Todos os funcionários dessa empresa já estão na lista.</div>
              ) : (
                companyEmployees.map((e: any) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => add.mutate(e.id)}
                    disabled={add.isPending}
                    className="flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left text-xs transition last:border-b-0 hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-black text-foreground">{e.nome}</span>
                      <span className="block truncate font-bold uppercase text-muted-foreground">
                        {e.matricula ? `MAT: ${e.matricula} • ` : ""}{companyById.get(e.company_id) ?? "S/ EMPRESA"}
                      </span>
                    </span>
                    <span className="shrink-0 rounded bg-primary px-2 py-1 font-black uppercase text-primary-foreground">Adicionar</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {attendees.length === 0 ? (
            <div className="text-center text-rose-200/60 py-8 text-xs uppercase font-bold">Nenhum participante.</div>
          ) : (
            attendees.map((a: any) => {
              const c = companies.find((x: any) => x.id === a.employees?.company_id);
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 border border-white/10 rounded-lg bg-white/[0.03]">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-rose-50 truncate">{a.employees?.nome ?? "—"}</div>
                    <div className="text-[10px] text-rose-200/60 uppercase font-bold">
                      {a.employees?.matricula && `MAT: ${a.employees.matricula} • `}{c?.name ?? "S/ EMPRESA"}
                    </div>
                  </div>
                  <div className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${statusColor(a)}`}>
                    {a.situacao}
                  </div>
                  {a.nota !== null && a.nota !== undefined && (
                    <div className="text-xs font-bold text-rose-100">Nota: {a.nota}</div>
                  )}
                  {a.data_vencimento && (
                    <div className="text-[10px] text-rose-200/60 font-bold">
                      Vence: {formatDateBR(a.data_vencimento)}
                    </div>
                  )}
                  {isAdmin && (
                    <button onClick={() => { if (confirm("Remover participante?")) remove.mutate(a.id); }} className="w-7 h-7 rounded bg-red-100 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function urlToDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function GerarListaDialog({ training, onClose }: { training: any; onClose: () => void }) {
  const [companiesSel, setCompaniesSel] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [autoSig, setAutoSig] = useState<boolean>(true);
  const [generating, setGenerating] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["lista-presenca-participantes", training.id],
    queryFn: async () => {
      const { data: atts } = await supabase
        .from("training_attendees")
        .select("employee_id")
        .eq("training_id", training.id);
      const ids = Array.from(new Set((atts ?? []).map((a: any) => a.employee_id).filter(Boolean)));
      if (!ids.length) return [] as any[];
      const [empRes, compRes, roleRes] = await Promise.all([
        supabase.from("employees").select("id,nome,company_id,role_id,assinatura_url").in("id", ids),
        supabase.from("companies").select("id,name"),
        supabase.from("roles").select("id,name"),
      ]);
      const cMap = Object.fromEntries((compRes.data ?? []).map((c: any) => [c.id, c.name]));
      const rMap = Object.fromEntries((roleRes.data ?? []).map((r: any) => [r.id, r.name]));
      return (empRes.data ?? []).map((e: any) => ({
        id: e.id,
        nome: e.nome ?? "",
        empresa: cMap[e.company_id] ?? "",
        empresaId: e.company_id ?? "",
        cargo: rMap[e.role_id] ?? "",
        assinatura_url: e.assinatura_url ?? null,
      }));
    },
  });

  const empresas = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; comSig: number }>();
    rows.forEach((r: any) => {
      const k = r.empresaId || "—";
      const name = r.empresa || "(sem empresa)";
      const cur = map.get(k) ?? { id: k, name, total: 0, comSig: 0 };
      cur.total += 1;
      if (r.assinatura_url) cur.comSig += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [rows]);

  // Inicializa: todas as empresas marcadas quando carregar
  const initRef = useState({ done: false })[0];
  if (!initRef.done && empresas.length && companiesSel.size === 0) {
    initRef.done = true;
    setCompaniesSel(new Set(empresas.map((e) => e.id)));
  }

  const selecionados = useMemo(
    () =>
      rows.filter(
        (r: any) => companiesSel.has(r.empresaId || "—") && !excluded.has(r.id),
      ),
    [rows, companiesSel, excluded],
  );
  const comSigTotal = selecionados.filter((r: any) => r.assinatura_url).length;

  function toggleEmpresa(id: string) {
    const n = new Set(companiesSel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setCompaniesSel(n);
  }
  function togglePessoa(id: string) {
    const n = new Set(excluded);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setExcluded(n);
  }

  async function pathToDataUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data } = await supabase.storage.from("training-docs").download(path);
    if (!data) return null;
    return await new Promise<string>((r) => {
      const fr = new FileReader();
      fr.onloadend = () => r(fr.result as string);
      fr.readAsDataURL(data);
    });
  }

  async function handleGerar() {
    if (!selecionados.length) {
      toast.error("Selecione ao menos 1 participante.");
      return;
    }
    setGenerating(true);
    try {
      const sigs = autoSig
        ? await Promise.all(selecionados.map((r: any) => urlToDataUrl(r.assinatura_url)))
        : selecionados.map(() => null);
      const assinaturaDataUrl = await pathToDataUrl(training.assinatura_path);
      const participantes = selecionados.map((r: any, i: number) => ({
        nome: r.nome,
        empresa: r.empresa,
        cargo: r.cargo,
        assinaturaDataUrl: sigs[i] ?? null,
      }));
      const doc = gerarListaPresenca({
        titulo: `${training.tipo}${training.titulo ? " — " + training.titulo : ""}`,
        instrutor: training.instrutor ?? "",
        assinaturaDataUrl,
        assunto: training.observacoes ?? training.titulo ?? training.tipo,
        tipo: "INTERNO",
        data: formatDateBR(training.data_realizacao),
        cargaHoraria: `${training.carga_horaria_h}h`,
        instituicao: training.instituicao ?? "",
        local: training.local ?? "",
        participantes,
      });
      const empresaTag =
        companiesSel.size === empresas.length
          ? "todas"
          : empresas
              .filter((e) => companiesSel.has(e.id))
              .map((e) => e.name.replace(/[^\w]+/g, ""))
              .join("-")
              .slice(0, 40) || "filtrada";
      doc.save(
        `lista-presenca-${(training.titulo || training.tipo).replace(/[^\w-]/g, "_")}-${empresaTag}.pdf`,
      );
      toast.success(`PDF gerado com ${selecionados.length} participante(s).`);
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar lista");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-rose-400" />
            Gerar Lista de Presença
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-[11px] font-bold uppercase tracking-wide">
                  Estampar assinatura digital automaticamente
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {comSigTotal} de {selecionados.length} selecionados têm assinatura cadastrada na ficha. Os demais aparecem com a célula em branco para rubrica manual.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoSig}
                onChange={(e) => setAutoSig(e.target.checked)}
                className="h-5 w-5 accent-rose-500"
              />
            </div>
          </div>

          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wide mb-2 block">
              Filtrar por empresa
            </Label>
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Carregando…</p>
            ) : empresas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum participante nesta turma.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {empresas.map((e) => {
                  const on = companiesSel.has(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEmpresa(e.id)}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${
                        on
                          ? "border-rose-500/50 bg-rose-500/10"
                          : "border-white/10 bg-white/[0.02] opacity-60"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{e.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {e.total} pessoas · {e.comSig} c/ assinatura
                        </div>
                      </div>
                      <input type="checkbox" readOnly checked={on} className="h-4 w-4 accent-rose-500 pointer-events-none" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selecionados.length > 0 && (
            <details className="rounded-xl border border-white/10 bg-white/[0.03]">
              <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold uppercase tracking-wide">
                Refinar manualmente ({selecionados.length} selecionados)
              </summary>
              <div className="max-h-56 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1">
                {rows
                  .filter((r: any) => companiesSel.has(r.empresaId || "—"))
                  .sort((a: any, b: any) => a.nome.localeCompare(b.nome, "pt-BR"))
                  .map((r: any) => {
                    const included = !excluded.has(r.id);
                    return (
                      <label
                        key={r.id}
                        className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-white/5 rounded px-1"
                      >
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => togglePessoa(r.id)}
                          className="h-3.5 w-3.5 accent-rose-500"
                        />
                        <span className={included ? "" : "line-through opacity-50"}>
                          {r.nome}
                          <span className="text-muted-foreground ml-2">· {r.empresa}</span>
                          {r.assinatura_url && (
                            <span className="ml-2 text-[9px] text-emerald-400 font-bold">ASSIN.</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </details>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={generating}>
              Cancelar
            </Button>
            <Button
              onClick={handleGerar}
              disabled={generating || !selecionados.length}
              className="bg-gradient-to-br from-rose-600 to-rose-800 text-white"
            >
              {generating ? "Gerando…" : `Gerar PDF (${selecionados.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
