import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import {
  GraduationCap, Plus, Search, Layers, Calendar, Clock, Users,
  ClipboardList, Image as ImageIcon, FileCheck2, MessageSquare,
  Upload, Download, Trash2, ChevronRight,
} from "lucide-react";
import { CATEGORIA_COLOR, CATEGORIA_LABEL } from "@/lib/matriz-status";
import { gerarListaPresenca } from "@/lib/lista-presenca-pdf";

const MODALIDADES = ["PRESENCIAL", "ONLINE", "HIBRIDA"] as const;
const TIPOS_REALIZACAO = ["INTERNO", "EXTERNO", "IN_COMPANY"] as const;
const TIPOS_REAL_LABEL: Record<string, string> = {
  INTERNO: "Interno", EXTERNO: "Externo", IN_COMPANY: "In Company",
};
const MOD_LABEL: Record<string, string> = {
  PRESENCIAL: "Presencial", ONLINE: "Online", HIBRIDA: "Híbrida",
};
const ANEXO_TIPOS = [
  { value: "LISTA_PRESENCA", label: "Lista de Presença", icon: ClipboardList, color: "violet" },
  { value: "FOTO", label: "Foto", icon: ImageIcon, color: "blue" },
  { value: "EFICACIA", label: "Avaliação de Eficácia", icon: FileCheck2, color: "emerald" },
  { value: "REACAO", label: "Avaliação de Reação", icon: MessageSquare, color: "amber" },
  { value: "CERTIFICADO", label: "Certificado", icon: Download, color: "slate" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

export function CursosMinistradosPanel() {
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState<string>("__all__");
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["cursos-ministrados-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_matrix_courses")
        .select("id,codigo,nome,categoria,periodicidade,carga_horaria_h,ativo")
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: trainings = [] } = useQuery({
    queryKey: ["cursos-ministrados-trainings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("*")
        .order("data_realizacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const turmasPorCurso = useMemo(() => {
    const m: Record<string, any[]> = {};
    trainings.forEach((t: any) => {
      if (!t.course_id) return;
      (m[t.course_id] ??= []).push(t);
    });
    return m;
  }, [trainings]);

  const filtered = useMemo(() => {
    return courses.filter((c: any) => {
      if (!c.ativo) return false;
      if (filtroCat !== "__all__" && c.categoria !== filtroCat) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!c.codigo.toLowerCase().includes(q) && !c.nome.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [courses, busca, filtroCat]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por código ou nome (NR-06, NR-17, ...)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs font-bold">
          {filtered.length} cursos
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-dashed border-slate-200">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-xs uppercase font-bold">Nenhum curso encontrado</p>
          <p className="text-[11px] mt-1 text-slate-400">
            Cadastre cursos em <b>Matriz de Treinamento</b> para que apareçam aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c: any) => {
            const turmas = turmasPorCurso[c.id] ?? [];
            const ultima = turmas[0];
            const catColor = CATEGORIA_COLOR[c.categoria] ?? CATEGORIA_COLOR.OUTRO;
            return (
              <button
                key={c.id}
                onClick={() => setOpenCourseId(c.id)}
                className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-[#991b1b]/40 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${catColor}`}>
                    {CATEGORIA_LABEL[c.categoria] ?? c.categoria ?? "—"}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#991b1b] group-hover:translate-x-0.5 transition" />
                </div>
                <div className="text-xs font-black text-[#991b1b] uppercase tracking-widest mb-1">{c.codigo}</div>
                <h4 className="text-sm font-bold text-slate-800 line-clamp-2 min-h-[2.5rem]">{c.nome}</h4>
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase text-slate-500">
                  <div className="flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {turmas.length} turma{turmas.length !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1 truncate">
                    <Calendar className="h-3 w-3" />
                    {ultima ? formatDateBR(ultima.data_realizacao) : "—"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openCourseId && (
        <TurmasDialog
          courseId={openCourseId}
          course={courses.find((c: any) => c.id === openCourseId)}
          onClose={() => setOpenCourseId(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Dialog: turmas de um curso
// ============================================================================

function TurmasDialog({ courseId, course, onClose }: { courseId: string; course: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [novaOpen, setNovaOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-do-curso", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("*")
        .eq("course_id", courseId)
        .order("data_realizacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-[#991b1b]" />
            <span className="font-black text-[#991b1b]">{course?.codigo}</span>
            <span className="text-slate-600">— {course?.nome}</span>
          </DialogTitle>
        </DialogHeader>

        {isEditor && (
          <div className="flex justify-end">
            <Button onClick={() => setNovaOpen(true)} className="bg-[#991b1b] hover:bg-[#7f1d1d]">
              <Plus className="h-4 w-4 mr-2" /> Nova Turma
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {turmas.length === 0 ? (
            <div className="text-center text-slate-400 py-10 text-xs uppercase font-bold border border-dashed border-slate-200 rounded-xl">
              Nenhuma turma realizada ainda.
            </div>
          ) : (
            turmas.map((t: any) => (
              <TurmaRow
                key={t.id}
                turma={t}
                course={course}
                expanded={expandedId === t.id}
                onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
              />
            ))
          )}
        </div>

        {novaOpen && (
          <NovaTurmaForm
            courseId={courseId}
            course={course}
            onClose={() => setNovaOpen(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["turmas-do-curso", courseId] });
              qc.invalidateQueries({ queryKey: ["cursos-ministrados-trainings"] });
              qc.invalidateQueries({ queryKey: ["trainings"] });
              setNovaOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Linha de turma (resumo + expansão com anexos)
// ============================================================================

function TurmaRow({ turma, course, expanded, onToggle }: { turma: any; course: any; expanded: boolean; onToggle: () => void }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();

  const { data: anexos = [] } = useQuery({
    queryKey: ["training-anexos", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_anexos")
        .select("*")
        .eq("training_id", turma.id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: expanded,
  });

  const { data: participantesCount = 0 } = useQuery({
    queryKey: ["training-participantes-count", turma.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("training_attendees")
        .select("*", { count: "exact", head: true })
        .eq("training_id", turma.id);
      return count ?? 0;
    },
  });

  const uploadAnexo = useMutation({
    mutationFn: async ({ file, tipo, descricao }: { file: File; tipo: string; descricao?: string }) => {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `anexos/${turma.id}/${tipo.toLowerCase()}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("training-docs").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("training_anexos").insert({
        training_id: turma.id,
        tipo,
        file_path: path,
        descricao: descricao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-anexos", turma.id] });
      toast.success("Anexo enviado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeAnexo = useMutation({
    mutationFn: async (anexo: any) => {
      await supabase.storage.from("training-docs").remove([anexo.file_path]);
      const { error } = await supabase.from("training_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-anexos", turma.id] });
      toast.success("Anexo removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function abrirAnexo(path: string) {
    const { data, error } = await supabase.storage.from("training-docs").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  async function gerarLista() {
    try {
      const { data: atts } = await supabase
        .from("training_attendees")
        .select("employee_id")
        .eq("training_id", turma.id);
      const empIds = Array.from(new Set((atts ?? []).map((a: any) => a.employee_id).filter(Boolean)));
      if (empIds.length === 0) {
        toast.warning("Nenhum participante na turma");
        return;
      }
      const { data: empData } = await supabase
        .from("employees")
        .select("id, nome, company_id, role_id")
        .in("id", empIds);
      const compIds = Array.from(new Set((empData ?? []).map((e: any) => e.company_id).filter(Boolean)));
      const roleIds = Array.from(new Set((empData ?? []).map((e: any) => e.role_id).filter(Boolean)));
      const [compRes, roleRes] = await Promise.all([
        compIds.length ? supabase.from("companies").select("id,name").in("id", compIds) : Promise.resolve({ data: [] as any[] }),
        roleIds.length ? supabase.from("roles").select("id,name").in("id", roleIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const compMap = Object.fromEntries((compRes.data ?? []).map((c: any) => [c.id, c.name]));
      const roleMap = Object.fromEntries((roleRes.data ?? []).map((r: any) => [r.id, r.name]));
      const participantes = (empData ?? []).map((e: any) => ({
        nome: e.nome ?? "",
        empresa: compMap[e.company_id] ?? "",
        cargo: roleMap[e.role_id] ?? "",
      }));
      const tipoMap: Record<string, "INTERNO" | "EXTERNO" | "IN COMPANY"> = {
        INTERNO: "INTERNO", EXTERNO: "EXTERNO", IN_COMPANY: "IN COMPANY",
      };
      const doc = gerarListaPresenca({
        titulo: `${course.codigo} — ${course.nome}`,
        instrutor: turma.instrutor ?? "",
        assunto: turma.titulo ?? course.nome,
        tipo: tipoMap[turma.tipo_realizacao] ?? "INTERNO",
        data: formatDateBR(turma.data_realizacao),
        cargaHoraria: `${turma.carga_horaria_h}h`,
        instituicao: turma.instituicao ?? "",
        local: turma.local ?? "",
        participantes,
      });
      doc.save(`lista-presenca-${course.codigo}-${turma.data_realizacao}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar lista");
    }
  }

  const fotosCount = anexos.filter((a: any) => a.tipo === "FOTO").length;

  return (
    <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-white transition-colors text-left"
      >
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#991b1b] text-white flex flex-col items-center justify-center">
          <div className="text-[9px] font-black uppercase">
            {new Date(turma.data_realizacao).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
          </div>
          <div className="text-base font-black leading-none">
            {new Date(turma.data_realizacao).getDate()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate">
            {turma.titulo || `Turma ${formatDateBR(turma.data_realizacao)}`}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-bold uppercase text-slate-500">
            <span><Clock className="h-3 w-3 inline mr-1" />{turma.carga_horaria_h}h</span>
            {turma.modalidade && (
              <Badge variant="outline" className="text-[9px] py-0 h-4">{MOD_LABEL[turma.modalidade] ?? turma.modalidade}</Badge>
            )}
            {turma.tipo_realizacao && (
              <Badge variant="outline" className="text-[9px] py-0 h-4">{TIPOS_REAL_LABEL[turma.tipo_realizacao] ?? turma.tipo_realizacao}</Badge>
            )}
            {turma.instrutor && <span>👤 {turma.instrutor}</span>}
            <span><Users className="h-3 w-3 inline mr-1" />{participantesCount} part.</span>
          </div>
        </div>
        <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="p-4 border-t border-slate-200 bg-white space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={gerarLista}>
              <ClipboardList className="h-4 w-4 mr-1" /> Gerar Lista de Presença (PDF)
            </Button>
            {isEditor && ANEXO_TIPOS.map(({ value, label, icon: Icon }) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept={value === "FOTO" ? "image/*" : ".pdf,image/*"}
                  multiple={value === "FOTO"}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (value === "FOTO" && fotosCount + files.length > 5) {
                      toast.error("Máximo de 5 fotos por turma");
                      return;
                    }
                    files.forEach((file) => uploadAnexo.mutate({ file, tipo: value }));
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase px-3 py-2 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 transition">
                  <Upload className="h-3.5 w-3.5" />
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              </label>
            ))}
          </div>

          <div>
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
              Anexos ({anexos.length})
            </div>
            {anexos.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-3 text-center border border-dashed border-slate-200 rounded">
                Nenhum anexo. Use os botões acima para enviar os documentos homologados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {anexos.map((a: any) => {
                  const meta = ANEXO_TIPOS.find((x) => x.value === a.tipo);
                  const Icon = meta?.icon ?? Upload;
                  return (
                    <div key={a.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-700 truncate">{meta?.label ?? a.tipo}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {a.file_path.split("/").pop()}
                        </div>
                      </div>
                      <button onClick={() => abrirAnexo(a.file_path)} className="w-6 h-6 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center" title="Abrir">
                        <Download className="h-3 w-3" />
                      </button>
                      {isAdmin && (
                        <button onClick={() => { if (confirm("Remover este anexo?")) removeAnexo.mutate(a); }} className="w-6 h-6 rounded bg-red-100 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center" title="Remover">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 italic">
            Para gerenciar participantes desta turma, use a aba <b>Grade Atual</b>.
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Form: nova turma
// ============================================================================

function NovaTurmaForm({ courseId, course, onClose, onSaved }: { courseId: string; course: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    titulo: "",
    data_realizacao: today(),
    data_fim: today(),
    carga_horaria_h: Number(course?.carga_horaria_h ?? 8),
    validade_meses: 12,
    instrutor: "",
    instituicao: "",
    local: "",
    modalidade: "PRESENCIAL" as typeof MODALIDADES[number],
    tipo_realizacao: "INTERNO" as typeof TIPOS_REALIZACAO[number],
    observacoes: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        course_id: courseId,
        tipo: `${course.codigo} — ${course.nome}`,
        titulo: f.titulo || null,
        data_realizacao: f.data_realizacao,
        data_fim: f.data_fim || null,
        carga_horaria_h: f.carga_horaria_h,
        validade_meses: f.validade_meses,
        instrutor: f.instrutor || null,
        instituicao: f.instituicao || null,
        local: f.local || null,
        modalidade: f.modalidade,
        tipo_realizacao: f.tipo_realizacao,
        observacoes: f.observacoes || null,
      };
      const { error } = await supabase.from("trainings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turma cadastrada");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Turma — {course?.codigo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Título / Identificação da Turma</Label>
            <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder={`Ex.: ${course?.codigo} Turma ${new Date().toLocaleDateString("pt-BR")}`} className="mt-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[10px] font-black text-slate-500 uppercase">Data Início</Label>
              <Input type="date" required value={f.data_realizacao} onChange={(e) => setF({ ...f, data_realizacao: e.target.value })} className="mt-2" />
            </div>
            <div>
              <Label className="text-[10px] font-black text-slate-500 uppercase">Data Término</Label>
              <Input type="date" value={f.data_fim} onChange={(e) => setF({ ...f, data_fim: e.target.value })} className="mt-2" />
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[10px] font-black text-slate-500 uppercase">Modalidade</Label>
              <Select value={f.modalidade} onValueChange={(v) => setF({ ...f, modalidade: v as any })}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map((m) => <SelectItem key={m} value={m}>{MOD_LABEL[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black text-slate-500 uppercase">Tipo</Label>
              <Select value={f.tipo_realizacao} onValueChange={(v) => setF({ ...f, tipo_realizacao: v as any })}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_REALIZACAO.map((t) => <SelectItem key={t} value={t}>{TIPOS_REAL_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <Input value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} placeholder="Auditório, sala, link de transmissão..." className="mt-2" />
          </div>

          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Observações</Label>
            <Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} className="mt-2" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending} className="bg-[#991b1b] hover:bg-[#7f1d1d]">
              <Plus className="h-4 w-4 mr-2" /> Cadastrar Turma
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 italic">
            Após cadastrar a turma você poderá adicionar participantes pela aba <b>Grade Atual</b> e enviar os anexos homologados (lista de presença, fotos, eficácia, reação) na própria turma.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
