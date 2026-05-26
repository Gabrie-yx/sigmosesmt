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
  Upload, Download, Trash2, ChevronRight, Pencil, Eye, FileText,
} from "lucide-react";
import { CATEGORIA_COLOR, CATEGORIA_LABEL } from "@/lib/matriz-status";
import { gerarListaPresenca } from "@/lib/lista-presenca-pdf";
import { sortMatrixCourses } from "@/lib/nr-order";
import { AttendeesDialog } from "@/routes/app.trainings";
import { MediaViewerDialog, type MediaItem } from "@/components/media-viewer-dialog";
import { ReacaoGerarDialog } from "@/components/cursos/reacao-gerar-dialog";

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
        .select("id,codigo,nome,categoria,periodicidade,carga_horaria_h,ativo,ordem")
        .order("ordem");
      if (error) throw error;
      return sortMatrixCourses(data ?? []);
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

  const { data: aderencia = {} } = useQuery({
    queryKey: ["cursos-aderencia"],
    queryFn: async () => {
      const [empRes, rcRes, scRes, entRes] = await Promise.all([
        supabase.from("employees").select("id,role_id,setor,status").eq("status", "ATIVO"),
        supabase.from("training_matrix_role_courses").select("role_id,course_id"),
        supabase.from("training_matrix_sector_courses").select("setor,course_id"),
        supabase.from("training_matrix_entries").select("employee_id,course_id,data_realizacao,status_override"),
      ]);
      const employees = empRes.data ?? [];
      const rcByCourse: Record<string, Set<string>> = {};
      (rcRes.data ?? []).forEach((r: any) => { (rcByCourse[r.course_id] ??= new Set()).add(r.role_id); });
      const scByCourse: Record<string, Set<string>> = {};
      (scRes.data ?? []).forEach((s: any) => { (scByCourse[s.course_id] ??= new Set()).add(s.setor); });
      const allCourseIds = new Set<string>([...Object.keys(rcByCourse), ...Object.keys(scByCourse)]);
      const required: Record<string, Set<string>> = {};
      allCourseIds.forEach((cid) => {
        const set = (required[cid] = new Set<string>());
        const roles = rcByCourse[cid];
        const setores = scByCourse[cid];
        employees.forEach((e: any) => {
          if ((roles && e.role_id && roles.has(e.role_id)) || (setores && e.setor && setores.has(e.setor))) {
            set.add(e.id);
          }
        });
      });
      const trained: Record<string, Set<string>> = {};
      (entRes.data ?? []).forEach((e: any) => {
        const ok = e.data_realizacao || e.status_override === "REALIZADO";
        if (!ok) return;
        (trained[e.course_id] ??= new Set()).add(e.employee_id);
      });
      const result: Record<string, { precisam: number; treinados: number; faltam: number }> = {};
      allCourseIds.forEach((cid) => {
        const req = required[cid] ?? new Set();
        const tr = trained[cid] ?? new Set();
        let count = 0;
        req.forEach((empId) => { if (tr.has(empId)) count++; });
        result[cid] = { precisam: req.size, treinados: count, faltam: Math.max(0, req.size - count) };
      });
      return result;
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
            const ad = (aderencia as any)[c.id];
            const pct = ad && ad.precisam > 0 ? Math.round((ad.treinados / ad.precisam) * 100) : null;
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
                {ad && ad.precisam > 0 && pct !== null && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1">
                      <span className="text-slate-500">Aderência</span>
                      <span className={pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1.5 font-bold text-slate-500">
                      <span>{ad.treinados}/{ad.precisam} treinados</span>
                      {ad.faltam > 0 && <span className="text-red-600">{ad.faltam} faltam</span>}
                    </div>
                  </div>
                )}
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
  const [editTurma, setEditTurma] = useState<any | null>(null);
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
                onEdit={() => setEditTurma(t)}
              />
            ))
          )}
        </div>

        {(novaOpen || editTurma) && (
          <NovaTurmaForm
            courseId={courseId}
            course={course}
            turma={editTurma}
            onClose={() => { setNovaOpen(false); setEditTurma(null); }}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["turmas-do-curso", courseId] });
              qc.invalidateQueries({ queryKey: ["cursos-ministrados-trainings"] });
              qc.invalidateQueries({ queryKey: ["trainings"] });
              setNovaOpen(false);
              setEditTurma(null);
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

function TurmaRow({ turma, course, expanded, onToggle, onEdit }: { turma: any; course: any; expanded: boolean; onToggle: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [participantesOpen, setParticipantesOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [reacaoOpen, setReacaoOpen] = useState(false);

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

  const imageAnexos = useMemo(
    () => (anexos as any[]).filter((a) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(a.file_path)),
    [anexos]
  );

  const pdfAnexos = useMemo(
    () => (anexos as any[]).filter((a) => /\.pdf$/i.test(a.file_path)),
    [anexos]
  );

  const viewableAnexos = useMemo(
    () => [...imageAnexos, ...pdfAnexos],
    [imageAnexos, pdfAnexos]
  );

  const { data: signedUrls = {} } = useQuery({
    queryKey: ["training-anexos-signed", turma.id, viewableAnexos.map((a) => a.id).join(",")],
    enabled: expanded && viewableAnexos.length > 0,
    queryFn: async () => {
      const paths = viewableAnexos.map((a) => a.file_path);
      const { data, error } = await supabase.storage.from("training-docs").createSignedUrls(paths, 60 * 30);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((d, i) => { if (d.signedUrl) map[paths[i]] = d.signedUrl; });
      return map;
    },
  });

  const mediaItems: MediaItem[] = viewableAnexos
    .map((a) => ({
      url: signedUrls[a.file_path],
      name: a.file_path.split("/").pop() ?? "arquivo",
      kind: /\.pdf$/i.test(a.file_path) ? ("pdf" as const) : ("image" as const),
    }))
    .filter((m) => !!m.url);

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

  // Quantos participantes desta turma já estão refletidos na Matriz de Treinamento.
  const { data: matrizSync = { sincronizados: 0, total: 0 } } = useQuery({
    queryKey: ["training-matriz-sync", turma.id, turma.course_id, turma.data_realizacao],
    queryFn: async () => {
      if (!turma.course_id) return { sincronizados: 0, total: 0 };
      const { data: atts } = await supabase
        .from("training_attendees")
        .select("employee_id, situacao")
        .eq("training_id", turma.id);
      const elegiveis = (atts ?? []).filter((a: any) => ["APROVADO", "PRESENTE"].includes(a.situacao));
      if (elegiveis.length === 0) return { sincronizados: 0, total: 0 };
      const empIds = elegiveis.map((a: any) => a.employee_id);
      const { data: entries } = await supabase
        .from("training_matrix_entries")
        .select("employee_id, data_realizacao")
        .eq("course_id", turma.course_id)
        .in("employee_id", empIds);
      const sync = (entries ?? []).filter(
        (e: any) => e.data_realizacao === turma.data_realizacao,
      ).length;
      return { sincronizados: sync, total: elegiveis.length };
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

  const excluirTurma = useMutation({
    mutationFn: async () => {
      const { data: anx } = await supabase
        .from("training_anexos").select("file_path").eq("training_id", turma.id);
      const paths = (anx ?? []).map((a: any) => a.file_path).filter(Boolean);
      if (paths.length) await supabase.storage.from("training-docs").remove(paths);
      await supabase.from("training_anexos").delete().eq("training_id", turma.id);
      await supabase.from("training_attendees").delete().eq("training_id", turma.id);
      const { error } = await supabase.from("trainings").delete().eq("id", turma.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["turmas-do-curso", turma.course_id] });
      qc.invalidateQueries({ queryKey: ["cursos-ministrados-trainings"] });
      qc.invalidateQueries({ queryKey: ["trainings"] });
      toast.success("Turma excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function abrirAnexo(path: string) {
    const idx = viewableAnexos.findIndex((a) => a.file_path === path);
    if (idx >= 0 && mediaItems[idx]) {
      setViewerIndex(idx);
      return;
    }
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
          {(() => {
            const [yy, mm, dd] = String(turma.data_realizacao).split("T")[0].split("-");
            const localDate = new Date(Number(yy), Number(mm) - 1, Number(dd));
            return (
              <>
                <div className="text-[9px] font-black uppercase">
                  {localDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                </div>
                <div className="text-base font-black leading-none">{Number(dd)}</div>
              </>
            );
          })()}
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
            {turma.course_id && matrizSync.total > 0 && (
              <Badge
                variant="outline"
                className={`text-[9px] py-0 h-4 ${
                  matrizSync.sincronizados === matrizSync.total
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                Matriz: {matrizSync.sincronizados}/{matrizSync.total}
              </Badge>
            )}
            {!turma.course_id && (
              <Badge variant="outline" className="text-[9px] py-0 h-4 bg-red-50 text-red-700 border-red-200">
                Sem vínculo c/ matriz
              </Badge>
            )}
          </div>
        </div>
        <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="p-4 border-t border-slate-200 bg-white space-y-4">
          {isEditor && (
            <div className="flex flex-wrap gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setParticipantesOpen(true)}>
                <Users className="h-4 w-4 mr-1" /> Participantes
              </Button>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-1" /> Editar dados da turma
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    if (confirm("Excluir esta turma? Anexos e participantes vinculados também serão removidos. A matriz NÃO é revertida automaticamente.")) {
                      excluirTurma.mutate();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir turma
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={gerarLista}>
              <ClipboardList className="h-4 w-4 mr-1" /> Gerar Lista de Presença (PDF)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReacaoOpen(true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              <MessageSquare className="h-4 w-4 mr-1" /> Gerar Avaliações de Reação
            </Button>
            {isEditor && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach((file) => uploadAnexo.mutate({ file, tipo: "REACAO" }));
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase px-3 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition">
                  <Upload className="h-3.5 w-3.5" />
                  <MessageSquare className="h-3.5 w-3.5" />
                  Anexar Reações Preenchidas
                </span>
              </label>
            )}
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
            {imageAnexos.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Fotos ({imageAnexos.length})</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {imageAnexos.map((a: any, i: number) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setViewerIndex(i)}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:border-[#991b1b] transition"
                      title="Clique para ampliar"
                    >
                      {signedUrls[a.file_path] ? (
                        <img
                          src={signedUrls[a.file_path]}
                          alt={a.file_path.split("/").pop() ?? ""}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pdfAnexos.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Documentos PDF ({pdfAnexos.length})</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {pdfAnexos.map((a: any, i: number) => {
                    const meta = ANEXO_TIPOS.find((x) => x.value === a.tipo);
                    const label = meta?.label ?? (a.tipo === "REACAO" ? "Reação" : a.tipo);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setViewerIndex(imageAnexos.length + i)}
                        className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-gradient-to-br from-red-50 to-slate-100 hover:border-[#991b1b] transition flex flex-col items-center justify-center p-2"
                        title={`Clique para visualizar: ${a.file_path.split("/").pop()}`}
                      >
                        <FileText className="h-10 w-10 text-red-600 group-hover:scale-110 transition-transform" />
                        <div className="text-[9px] font-bold text-slate-600 mt-1 text-center uppercase truncate w-full">{label}</div>
                        <div className="text-[8px] text-slate-400 truncate w-full text-center">{a.file_path.split("/").pop()}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {anexos.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-3 text-center border border-dashed border-slate-200 rounded">
                Nenhum anexo. Use os botões acima para enviar os documentos homologados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {anexos.map((a: any) => {
                  const meta = ANEXO_TIPOS.find((x) => x.value === a.tipo);
                  const Icon = a.tipo === "REACAO" ? MessageSquare : meta?.icon ?? Upload;
                  const label = meta?.label ?? (a.tipo === "REACAO" ? "Avaliação de Reação" : a.tipo);
                  return (
                    <div key={a.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-700 truncate">{label}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {a.file_path.split("/").pop()}
                        </div>
                      </div>
                      <button onClick={() => abrirAnexo(a.file_path)} className="w-6 h-6 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center" title="Visualizar">
                        <Eye className="h-3 w-3" />
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
            Dica: o botão <b>Participantes</b> permite adicionar individualmente ou em massa por empresa.
          </div>
        </div>
      )}
      <MediaViewerDialog
        items={mediaItems}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
      />
      {reacaoOpen && (
        <ReacaoGerarDialog
          open={reacaoOpen}
          onClose={() => setReacaoOpen(false)}
          turma={turma}
          course={course}
          participantesCount={participantesCount}
        />
      )}
      {participantesOpen && (
        <AttendeesDialog
          trainingId={turma.id}
          training={turma}
          onClose={() => {
            setParticipantesOpen(false);
            qc.invalidateQueries({ queryKey: ["training-participantes-count", turma.id] });
            qc.invalidateQueries({ queryKey: ["training-matriz-sync", turma.id, turma.course_id, turma.data_realizacao] });
            qc.invalidateQueries({ queryKey: ["cursos-aderencia"] });
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Form: nova turma
// ============================================================================

function NovaTurmaForm({ courseId, course, turma, onClose, onSaved }: { courseId: string; course: any; turma?: any | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!turma?.id;
  const [f, setF] = useState({
    titulo: turma?.titulo ?? "",
    data_realizacao: turma?.data_realizacao ?? today(),
    data_fim: turma?.data_fim ?? today(),
    carga_horaria_h: Number(turma?.carga_horaria_h ?? course?.carga_horaria_h ?? 8),
    validade_meses: Number(turma?.validade_meses ?? 12),
    instrutor: turma?.instrutor ?? "",
    instituicao: turma?.instituicao ?? "",
    local: turma?.local ?? "",
    modalidade: (turma?.modalidade ?? "PRESENCIAL") as typeof MODALIDADES[number],
    tipo_realizacao: (turma?.tipo_realizacao ?? "INTERNO") as typeof TIPOS_REALIZACAO[number],
    observacoes: turma?.observacoes ?? "",
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
      if (isEdit) {
        const { error } = await supabase.from("trainings").update(payload).eq("id", turma.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trainings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Turma atualizada" : "Turma cadastrada");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Turma" : "Nova Turma"} — {course?.codigo}</DialogTitle>
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
              {isEdit ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {isEdit ? "Salvar alterações" : "Cadastrar Turma"}
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 italic">
            {isEdit
              ? "Ao alterar a data, a matriz dos participantes APROVADOS/PRESENTES é atualizada automaticamente para a nova data."
              : "Após cadastrar a turma você poderá adicionar participantes pela aba Grade Atual e enviar os anexos homologados na própria turma."}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
