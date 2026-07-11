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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import {
  GraduationCap, Plus, Search, Layers, Calendar, Clock, Users,
  ClipboardList, Image as ImageIcon, FileCheck2, MessageSquare,
  Upload, Download, Trash2, ChevronRight, Pencil, Eye, FileText,
  PenLine, PenOff,
} from "lucide-react";
import { Sparkles } from "lucide-react";
import { CATEGORIA_COLOR, CATEGORIA_LABEL } from "@/lib/matriz-status";
import { gerarListaPresenca, baixarPdf } from "@/lib/lista-presenca-pdf";
import { sortMatrixCourses } from "@/lib/nr-order";
import { AttendeesDialog } from "@/routes/app.trainings";
import { MediaViewerDialog, type MediaItem } from "@/components/media-viewer-dialog";
import { ReacaoGerarDialog } from "@/components/cursos/reacao-gerar-dialog";
import { ExtrairListaIADialog } from "@/components/cursos/extrair-lista-ia-dialog";

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

  // Soma de participantes (APROVADO/PRESENTE) de todas as turmas realizadas de cada curso.
  // É a soma direta das listas de presença — sem cruzar com matriz.
  const { data: treinadosPorCurso = {} } = useQuery({
    queryKey: ["cursos-treinados-por-curso"],
    queryFn: async () => {
      const { data: atts, error } = await supabase
        .from("training_attendees")
        .select("training_id, situacao, trainings!inner(course_id)")
        .in("situacao", ["APROVADO", "PRESENTE"])
        .limit(50000);
      if (error) throw error;
      const result: Record<string, number> = {};
      (atts ?? []).forEach((a: any) => {
        const cid = a.trainings?.course_id;
        if (!cid) return;
        result[cid] = (result[cid] ?? 0) + 1;
      });
      return result;
    },
  });

  // Aderência à matriz — usada APENAS para preencher a barra proporcional (meta X de Y).
  const { data: aderenciaPorCurso = {} } = useQuery({
    queryKey: ["cursos-aderencia"],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from("training_matrix_entries")
        .select("course_id, employee_id, data_realizacao")
        .limit(100000);
      if (error) throw error;
      const map: Record<string, { total: number; ok: number }> = {};
      (entries ?? []).forEach((e: any) => {
        if (!e.course_id) return;
        const m = (map[e.course_id] ??= { total: 0, ok: 0 });
        m.total += 1;
        if (e.data_realizacao) m.ok += 1;
      });
      return map;
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
      <div className="glass-card glass-shine flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-200/60 z-10" />
          <Input
            placeholder="Buscar por código ou nome (NR-06, NR-17, ...)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 bg-black/30 border-white/10 text-rose-50 placeholder:text-rose-200/40 focus-visible:ring-rose-500/40 focus-visible:border-rose-500/40"
          />
        </div>
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger className="w-[200px] bg-black/30 border-white/10 text-rose-50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge className="text-xs font-bold bg-rose-950/60 text-rose-100 border border-rose-500/30 shadow-[0_0_14px_-4px_rgba(220,38,70,0.6)] hover:bg-rose-900/70">
          {filtered.length} cursos
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-rose-200/70">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-40 text-rose-300" />
          <p className="text-xs uppercase font-bold text-rose-100">Nenhum curso encontrado</p>
          <p className="text-[11px] mt-1 text-rose-200/50">
            Cadastre cursos em <b>Matriz de Treinamento</b> para que apareçam aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c: any) => {
            const turmas = turmasPorCurso[c.id] ?? [];
            const ultima = turmas[0];
            const catColor = CATEGORIA_COLOR[c.categoria] ?? CATEGORIA_COLOR.OUTRO;
            const treinados = (treinadosPorCurso as any)[c.id] ?? 0;
            const ad = (aderenciaPorCurso as any)[c.id] as { total: number; ok: number } | undefined;
            const pct = ad && ad.total > 0 ? Math.round((ad.ok / ad.total) * 100) : 0;
            return (
              <button
                key={c.id}
                onClick={() => setOpenCourseId(c.id)}
                className="glass-card text-left p-5 hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-rose-950/70 text-rose-100 border border-rose-500/30 shadow-[0_0_12px_-4px_rgba(220,38,70,0.5)]">
                    {CATEGORIA_LABEL[c.categoria] ?? c.categoria ?? "—"}
                  </div>
                  <ChevronRight className="h-4 w-4 text-rose-300/60 group-hover:text-rose-200 group-hover:translate-x-0.5 transition" />
                </div>
                <div className="text-xs font-black text-rose-300 uppercase tracking-widest mb-1">{c.codigo}</div>
                <h4 className="text-sm font-bold text-rose-50 line-clamp-2 min-h-[2.5rem]">{c.nome}</h4>
                <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase text-rose-200/60">
                  <div className="flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {turmas.length} turma{turmas.length !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1 truncate">
                    <Calendar className="h-3 w-3" />
                    {ultima ? formatDateBR(ultima.data_realizacao) : "—"}
                  </div>
                </div>
                {treinados > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-black uppercase mb-1.5">
                      <span className="text-amber-200/70">Treinados</span>
                      <span className="text-amber-300">{treinados}</span>
                    </div>
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden ring-1 ring-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.75)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {ad && ad.total > 0 && (
                      <div className="mt-1 text-[9px] font-black uppercase tracking-wider text-amber-200/60 text-right">
                        Meta {ad.ok}/{ad.total}
                      </div>
                    )}
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
            <GraduationCap className="h-5 w-5 text-rose-300" />
            <span className="font-black text-rose-200">{course?.codigo}</span>
            <span className="text-rose-100/80">— {course?.nome}</span>
          </DialogTitle>
        </DialogHeader>

        {isEditor && (
          <div className="flex justify-end">
            <Button onClick={() => setNovaOpen(true)} className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-[0_0_18px_-4px_rgba(220,38,70,0.6)]">
              <Plus className="h-4 w-4 mr-2" /> Nova Turma
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {turmas.length === 0 ? (
            <div className="text-center text-rose-200/60 py-10 text-xs uppercase font-bold border border-dashed border-white/15 rounded-xl">
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
  const [extrairIAOpen, setExtrairIAOpen] = useState(false);

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
        .select("id, nome, company_id, role_id, assinatura_url")
        .in("id", empIds);
      const compIds = Array.from(new Set((empData ?? []).map((e: any) => e.company_id).filter(Boolean)));
      const roleIds = Array.from(new Set((empData ?? []).map((e: any) => e.role_id).filter(Boolean)));
      const [compRes, roleRes] = await Promise.all([
        compIds.length ? supabase.from("companies").select("id,name").in("id", compIds) : Promise.resolve({ data: [] as any[] }),
        roleIds.length ? supabase.from("roles").select("id,name").in("id", roleIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const compMap = Object.fromEntries((compRes.data ?? []).map((c: any) => [c.id, c.name]));
      const roleMap = Object.fromEntries((roleRes.data ?? []).map((r: any) => [r.id, r.name]));

      // Helper: URL pública da assinatura → data URL PNG com fundo transparente.
      // Preserva a COR ORIGINAL do traço (caneta azul fica azul).
      const { fetchSignatureAsCleanDataUrl: urlToDataUrl } = await import("@/lib/signature-utils");

      const enriched = (empData ?? []).map((e: any) => ({
        nome: e.nome ?? "",
        empresa: compMap[e.company_id] ?? "",
        cargo: roleMap[e.role_id] ?? "",
        assinatura_url: e.assinatura_url ?? null,
      }));
      // Ordena empresa A→Z, depois nome A→Z (igual DDS)
      enriched.sort(
        (a, b) =>
          (a.empresa || "").localeCompare(b.empresa || "", "pt-BR") ||
          (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
      );
      // Estampa assinaturas digitais automaticamente
      const sigs = await Promise.all(enriched.map((r) => urlToDataUrl(r.assinatura_url)));
      const empresasUnicas = new Set(enriched.map((r) => r.empresa || "(sem empresa)"));
      const agruparPorEmpresa = empresasUnicas.size > 1;
      const participantes = enriched.map((r, i) => ({
        nome: r.nome,
        empresa: r.empresa,
        cargo: r.cargo,
        assinaturaDataUrl: sigs[i] ?? null,
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
        agruparPorEmpresa,
      });
      baixarPdf(doc, `lista-presenca-${course.codigo}-${turma.data_realizacao}.pdf`);
      const comSig = sigs.filter(Boolean).length;
      toast.success(
        `Lista gerada com ${participantes.length} participante(s)` +
          (comSig ? ` — ${comSig} assinatura(s) estampada(s).` : "."),
      );
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar lista");
    }
  }

  const fotosCount = anexos.filter((a: any) => a.tipo === "FOTO").length;

  return (
    <div className="rounded-xl border border-rose-500/20 bg-black/30 backdrop-blur-sm overflow-hidden shadow-[0_0_24px_-12px_rgba(220,38,70,0.35)]">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-rose-950/30 transition-colors text-left"
      >
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-rose-600 to-rose-800 text-white flex flex-col items-center justify-center shadow-[0_0_14px_-4px_rgba(220,38,70,0.7)] ring-1 ring-rose-400/30">
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
          <div className="text-sm font-bold text-rose-50 truncate">
            {turma.titulo || `Turma ${formatDateBR(turma.data_realizacao)}`}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-bold uppercase text-rose-200/70">
            <span><Clock className="h-3 w-3 inline mr-1" />{turma.carga_horaria_h}h</span>
            {turma.modalidade && (
              <Badge variant="outline" className="text-[9px] py-0 h-4 bg-rose-950/60 text-rose-100 border-rose-500/30">{MOD_LABEL[turma.modalidade] ?? turma.modalidade}</Badge>
            )}
            {turma.tipo_realizacao && (
              <Badge variant="outline" className="text-[9px] py-0 h-4 bg-rose-950/60 text-rose-100 border-rose-500/30">{TIPOS_REAL_LABEL[turma.tipo_realizacao] ?? turma.tipo_realizacao}</Badge>
            )}
            {turma.instrutor && <span>👤 {turma.instrutor}</span>}
            <span><Users className="h-3 w-3 inline mr-1" />{participantesCount} part.</span>
            {turma.course_id && matrizSync.total > 0 && (
              <Badge
                variant="outline"
                className={`text-[9px] py-0 h-4 ${
                  matrizSync.sincronizados === matrizSync.total
                    ? "bg-emerald-950/60 text-emerald-200 border-emerald-500/30"
                    : "bg-amber-950/60 text-amber-200 border-amber-500/30"
                }`}
              >
                Matriz: {matrizSync.sincronizados}/{matrizSync.total}
              </Badge>
            )}
            {!turma.course_id && (
              <Badge variant="outline" className="text-[9px] py-0 h-4 bg-rose-950/60 text-rose-200 border-rose-500/30">
                Sem vínculo c/ matriz
              </Badge>
            )}
          </div>
        </div>
        <ChevronRight className={`h-5 w-5 text-rose-300/70 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="p-4 border-t border-rose-500/15 bg-black/40 space-y-4">
          {/* === 1) GESTÃO DA TURMA === */}
          {isEditor && (
            <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-rose-200/80 mb-2 flex items-center gap-1.5">
                <Users className="h-3 w-3" /> 1. Gestão da turma
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setParticipantesOpen(true)} className="border-white/15 bg-white/5 text-rose-50 hover:bg-rose-950/40 hover:border-rose-500/40">
                  <Users className="h-4 w-4 mr-1" /> Participantes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExtrairIAOpen(true)}
                  disabled={!(anexos as any[]).some((a) => a.tipo === "LISTA_PRESENCA")}
                  className="border-violet-400/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 disabled:opacity-40"
                  title={(anexos as any[]).some((a) => a.tipo === "LISTA_PRESENCA") ? "Extrair participantes da Lista de Presença com IA" : "Anexe uma Lista de Presença primeiro"}
                >
                  <Sparkles className="h-4 w-4 mr-1" /> Extrair participantes (IA)
                </Button>
                <Button size="sm" variant="outline" onClick={onEdit} className="border-white/15 bg-white/5 text-rose-50 hover:bg-rose-950/40 hover:border-rose-500/40">
                  <Pencil className="h-4 w-4 mr-1" /> Editar turma
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-200 border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/50 ml-auto"
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
              <p className="text-[10px] text-rose-200/50 mt-2">
                Adicione participantes manualmente ou extraia automaticamente da Lista de Presença anexada.
              </p>
            </section>
          )}

          {/* === 2) GERAR DOCUMENTOS (PDF em branco) === */}
          <section className="rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-sky-200 mb-2 flex items-center gap-1.5">
              <Download className="h-3 w-3" /> 2. Gerar documentos (PDF em branco para impressão)
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={gerarLista} className="border-sky-400/40 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20">
                <ClipboardList className="h-4 w-4 mr-1" /> Lista de Presença
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReacaoOpen(true)}
                className="border-sky-400/40 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
              >
                <MessageSquare className="h-4 w-4 mr-1" /> Avaliações de Reação
              </Button>
            </div>
            <p className="text-[10px] text-sky-200/60 mt-2">
              PDFs prontos para imprimir e os participantes assinarem. Depois, escaneie e anexe abaixo.
            </p>
          </section>

          {/* === 3) ANEXAR COMPROVANTES (após o treinamento) === */}
          {isEditor && (
            <section className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-2 flex items-center gap-1.5">
                <Upload className="h-3 w-3" /> 3. Anexar comprovantes preenchidos
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Lista de Presença assinada */}
                {ANEXO_TIPOS.filter((t) => t.value === "LISTA_PRESENCA").map(({ value, label, icon: Icon }) => (
                  <label key={value} className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        files.forEach((file) => uploadAnexo.mutate({ file, tipo: value }));
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition">
                      <Upload className="h-3.5 w-3.5 text-emerald-200/80" />
                      <Icon className="h-3.5 w-3.5" />
                      {label} assinada
                    </span>
                  </label>
                ))}
                {/* Reações preenchidas */}
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
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition">
                    <Upload className="h-3.5 w-3.5 text-emerald-200/80" />
                    <MessageSquare className="h-3.5 w-3.5" />
                    Reações preenchidas
                  </span>
                </label>
                {/* Outros: Foto, Eficácia, Certificado */}
                {ANEXO_TIPOS.filter((t) => t.value !== "LISTA_PRESENCA").map(({ value, label, icon: Icon }) => (
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
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition">
                      <Upload className="h-3.5 w-3.5 text-emerald-200/80" />
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-emerald-200/60 mt-2">
                Envie a lista assinada, as avaliações de reação preenchidas, fotos do treinamento, avaliação de eficácia e certificados.
              </p>
            </section>
          )}

          <div>
            <div className="text-[10px] font-black uppercase text-rose-200/70 tracking-widest mb-2">
              Anexos ({anexos.length})
            </div>
            {imageAnexos.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase text-rose-200/60 mb-1">Fotos ({imageAnexos.length})</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {imageAnexos.map((a: any, i: number) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setViewerIndex(i)}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40 hover:border-rose-500/60 transition"
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
                        <div className="w-full h-full flex items-center justify-center text-rose-200/40">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {anexos.length === 0 ? (
              <div className="text-xs text-rose-200/50 italic py-3 text-center border border-dashed border-white/15 rounded">
                Nenhum anexo. Use os botões acima para enviar os documentos homologados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {anexos.map((a: any) => {
                  const meta = ANEXO_TIPOS.find((x) => x.value === a.tipo);
                  const Icon = a.tipo === "REACAO" ? MessageSquare : meta?.icon ?? Upload;
                  const label = meta?.label ?? (a.tipo === "REACAO" ? "Avaliação de Reação" : a.tipo);
                  return (
                    <div key={a.id} className="flex items-center gap-2 p-2 border border-white/10 rounded-lg bg-white/[0.03]">
                      <Icon className="h-4 w-4 text-rose-200/70" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-rose-50 truncate">{label}</div>
                        <div className="text-[10px] text-rose-200/60 truncate">
                          {a.file_path.split("/").pop()}
                        </div>
                      </div>
                      <button onClick={() => abrirAnexo(a.file_path)} className="w-6 h-6 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-white flex items-center justify-center" title="Visualizar">
                        <Eye className="h-3 w-3" />
                      </button>
                      {isAdmin && (
                        <button onClick={() => { if (confirm("Remover este anexo?")) removeAnexo.mutate(a); }} className="w-6 h-6 rounded bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white flex items-center justify-center" title="Remover">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
      {extrairIAOpen && (() => {
        const listaAnexo = (anexos as any[]).find((a) => a.tipo === "LISTA_PRESENCA");
        if (!listaAnexo) return null;
        return (
          <ExtrairListaIADialog
            trainingId={turma.id}
            anexoPath={listaAnexo.file_path}
            onClose={() => setExtrairIAOpen(false)}
            onConfirmado={() => {
              qc.invalidateQueries({ queryKey: ["training-participantes-count", turma.id] });
              qc.invalidateQueries({ queryKey: ["training-matriz-sync", turma.id, turma.course_id, turma.data_realizacao] });
              qc.invalidateQueries({ queryKey: ["cursos-aderencia"] });
            }}
          />
        );
      })()}
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
