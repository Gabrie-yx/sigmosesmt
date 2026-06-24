import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toTitleCasePT } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Syringe, Upload, FileText, Camera, X, AlertTriangle, Undo2, CheckCircle2, User, ShieldCheck, FileText as FileIcon, HeartPulse, Building2, IdCard, UserCog, Briefcase, Users, Award, FolderOpen, UserPlus, Download, Pencil, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { SafetyOverridePanel } from "@/components/safety-override-panel";
import { AnimatedTabsBar } from "@/components/animated-tabs-bar";
import type { SafetyOverride } from "@/lib/safety-overrides";
import { formatDateBR, addMonthsToDate } from "@/lib/utils-date";
import { NRS_LIST, TIPOS_EXAME, NATUREZAS_EXAME, NATUREZA_KEY_MAP, UFS, VACINAS_LIST, BAIRROS_MANAUS } from "@/lib/constants";
import { maskCPF, maskCNPJ, maskPhone, maskCEP, maskRG } from "@/lib/masks";
import { FileViewerHost, openStorageFile } from "@/components/file-viewer";
import { openFileViewer } from "@/components/file-viewer";
import { buildEpiFichaPdf } from "@/lib/epi-ficha-pdf";
import { lazy, Suspense } from "react";
const PdfSignerDialog = lazy(() =>
  import("@/components/pdf-signer-dialog").then((m) => ({ default: m.PdfSignerDialog }))
);
import { openTermoPerdaPdf } from "@/lib/epi-termo-perda-pdf";
import { openFichaMensalPdf } from "@/lib/epi-ficha-mensal-pdf";
import { gerarFichaFuncionarioPdf, loadEmployeePhotoDataUrl } from "@/lib/employee-ficha-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { PPPEditorDialog } from "@/components/ppp/ppp-editor-dialog";
import type jsPDF from "jspdf";
import { HardHat, Printer, FileSignature, AlertCircle, Clock, FileWarning, Ban, ChevronDown } from "lucide-react";
import { OssRowActions } from "@/components/oss/oss-row-actions";
import { GraduationCap } from "lucide-react";
import { Save } from "lucide-react";
import { computeStatus, requiredCourseIds, STATUS_OVERRIDE, CATEGORIA_COLOR, CATEGORIA_LABEL, type MatrizCourse, type MatrizEntry, type RoleCourse } from "@/lib/matriz-status";
import { uploadEmployeePhoto, removeEmployeePhoto } from "@/lib/employee-photo.functions";
import { AtestadosTab } from "@/components/employees/atestados-tab";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { DesligamentoDialog } from "@/components/employees/desligamento-dialog";
import { NewEmployeeDialog } from "@/components/employees/new-employee-dialog";
import { UserMinus, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/app/employees/$id")({
  component: EmployeeDetail,
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ tab: z.string().optional() }).parse(search),
});

function EmployeeDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const router = useRouter();
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;
  return (
    <div className="p-6 md:p-8 space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        {canGoBack ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-brand"
            onClick={() => router.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-brand">
            <Link to="/app/employees"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="min-w-0">
          <EmployeeDetailContent id={id} showHeader initialTab={tab} />
        </div>
        <EmployeeContextSidebar id={id} />
      </div>
    </div>
  );
}

export function EmployeeDetailContent({ id, showHeader = true, initialTab }: { id: string; showHeader?: boolean; initialTab?: string }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const VALID_TABS = ["profile","nrs","docs","epi","health"];
  const [tab, setTab] = useState<string>(VALID_TABS.includes(initialTab ?? "") ? (initialTab as string) : "profile");
  const [healthSub, setHealthSub] = useState<string>(initialTab === "vaccines" ? "vaccines" : "exams");

  const { data: emp } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name,cnpj").order("name")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("*").order("name")).data ?? [],
  });
  const { data: exams } = useQuery({
    queryKey: ["exams", id],
    queryFn: async () => (await supabase.from("employee_exams").select("*").eq("employee_id", id).order("data_realizacao", { ascending: false })).data ?? [],
  });
  const { data: epis } = useQuery({
    queryKey: ["epis", id],
    queryFn: async () => (await supabase.from("epi_deliveries").select("*").eq("employee_id", id).order("data_entrega", { ascending: false })).data ?? [],
  });
  const { data: vaccines } = useQuery({
    queryKey: ["vaccines", id],
    queryFn: async () => (await supabase.from("employee_vaccinations").select("*").eq("employee_id", id).order("data_aplicacao", { ascending: false })).data ?? [],
  });
  const { data: overrides = [] } = useQuery({
    queryKey: ["safety-overrides", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_overrides")
        .select("*")
        .eq("employee_id", id);
      if (error) throw error;
      return (data ?? []) as SafetyOverride[];
    },
  });
  const { data: ossValid = false } = useQuery({
    queryKey: ["oss-valid", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oss_emissoes")
        .select("expira_em,status")
        .eq("employee_id", id)
        .eq("status", "ASSINADO");
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).some((r: any) => !r.expira_em || new Date(r.expira_em).getTime() > now);
    },
  });

  const role = (roles ?? []).find((r: any) => r.id === emp?.role_id) ?? null;
  const status = emp ? calculateSafetyStatus(emp as any, role as any, (exams ?? []) as any, (vaccines ?? []) as any, overrides, ossValid) : null;

  // Constrói lista de chaves disponíveis para liberação granular
  const availableItemKeys = useMemo(() => {
    const keys = new Set<string>();
    if (role?.req_aso) keys.add("ASO");
    if (role?.req_integra) keys.add("INTEGRACAO");
    (role?.req_nrs ?? []).forEach((nr: string) => keys.add(nr));
    (role?.req_exames ?? []).forEach((ex: string) => keys.add(`EXAME:${ex}`));
    (role?.req_vacinas ?? []).forEach((v: string) => keys.add(`VACINA:${v}`));
    keys.add("OS");
    return Array.from(keys);
  }, [role]);
  const canEditHeader = isEditor || isAdmin;
  const [uploadingHeaderPhoto, setUploadingHeaderPhoto] = useState(false);
  const uploadEmployeePhotoFn = useServerFn(uploadEmployeePhoto);
  const removeEmployeePhotoFn = useServerFn(removeEmployeePhoto);
  const [fichaDoc, setFichaDoc] = useState<jsPDF | null>(null);
  const [gerandoFicha, setGerandoFicha] = useState(false);
  const [pppOpen, setPppOpen] = useState(false);
  const [desligamentoOpen, setDesligamentoOpen] = useState(false);

  async function gerarFichaPdf() {
    if (!emp) return;
    setGerandoFicha(true);
    try {
      const [atestadosRes, acidentesRes, photoDataUrl] = await Promise.all([
        supabase.from("employee_atestados").select("*").eq("employee_id", id).order("data_inicio", { ascending: false }),
        supabase.from("acidentes_trabalho").select("*").eq("employee_id", id).order("data_acidente", { ascending: false }),
        loadEmployeePhotoDataUrl(emp.foto_url),
      ]);
      const company = (companies ?? []).find((c: any) => c.id === emp.company_id) ?? null;
      const doc = gerarFichaFuncionarioPdf({
        emp,
        companyName: company?.name ?? null,
        roleName: role?.name ?? null,
        photoDataUrl,
        atestados: (atestadosRes.data as any[]) ?? [],
        exams: (exams as any[]) ?? [],
        acidentes: (acidentesRes.data as any[]) ?? [],
      });
      setFichaDoc(doc);
    } catch (e: any) {
      console.error("[ficha-pdf] erro:", e);
      toast.error("Erro ao gerar a ficha: " + (e?.message || "desconhecido"));
    } finally {
      setGerandoFicha(false);
    }
  }

  // O PPP agora abre num editor (rascunho + emissão final). Veja PPPEditorDialog.

  const { data: docsList } = useQuery({
    queryKey: ["docs-summary", id],
    queryFn: async () => (await supabase.from("employee_docs").select("tipo").eq("employee_id", id)).data ?? [],
  });
  const REQUIRED_DOCS = ["RG", "CPF", "Comprovante Residência", "Comprovante MEI", "Cartão de Vacina"];
  const docsTipos = new Set((docsList ?? []).map((d: any) => d.tipo));
  const missingDocs = REQUIRED_DOCS.filter((t) => !docsTipos.has(t));
  const docsOk = missingDocs.length === 0;

  // --- Estado das pills de atalho (verde = ok, âmbar = parcial, vermelho = pendente) ---
  const asoTone: "ok" | "warn" | "rose" | "slate" = useMemo(() => {
    if (!role?.req_aso) return "slate";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const asos = (exams ?? []).filter((e: any) => /aso/i.test(String(e.tipo_exame ?? "")));
    if (asos.length === 0) return "rose";
    const vigente = asos.some((e: any) => {
      if (!e.data_vencimento) return true;
      const v = new Date(String(e.data_vencimento) + "T00:00:00");
      return v.getTime() >= today.getTime();
    });
    if (!vigente) return "rose";
    const proxVenc = asos.some((e: any) => {
      if (!e.data_vencimento) return false;
      const v = new Date(String(e.data_vencimento) + "T00:00:00");
      const dias = Math.ceil((v.getTime() - today.getTime()) / 86400000);
      return dias >= 0 && dias <= 30;
    });
    return proxVenc ? "warn" : "ok";
  }, [role, exams]);

  const nrTone: "ok" | "warn" | "rose" | "slate" = useMemo(() => {
    const req: string[] = role?.req_nrs ?? [];
    if (req.length === 0) return "slate";
    const empNrs: Record<string, string> = (emp as any)?.nrs ?? {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let faltando = 0; let vencendo = 0;
    req.forEach((nr) => {
      const d = empNrs[nr];
      if (!d) { faltando++; return; }
      const dt = new Date(String(d) + "T00:00:00");
      // NR vale 12 meses por padrão; alerta nos últimos 30 dias
      const venc = new Date(dt); venc.setFullYear(venc.getFullYear() + 1);
      const dias = Math.ceil((venc.getTime() - today.getTime()) / 86400000);
      if (dias < 0) faltando++;
      else if (dias <= 30) vencendo++;
    });
    if (faltando > 0) return "rose";
    if (vencendo > 0) return "warn";
    return "ok";
  }, [role, emp]);

  const docsTone: "ok" | "warn" | "rose" = docsOk
    ? "ok"
    : missingDocs.length === REQUIRED_DOCS.length
    ? "rose"
    : "warn";

  function initialsOf(name?: string | null) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async function removeHeaderPhoto() {
    if (!emp?.foto_url) return;
    if (!confirm("Remover a foto do colaborador?")) return;
    try {
      await removeEmployeePhotoFn({ data: { employeeId: emp.id } });
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Foto removida");
    } catch (e: any) {
      console.error("[foto] erro ao remover:", e);
      toast.error("Erro ao remover foto: " + (e?.message || "desconhecido"));
    }
  }

  async function handleHeaderPhotoUpload(file: File) {
    if (!file || !emp) return;
    setUploadingHeaderPhoto(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("A foto deve ter no máximo 10MB.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      await uploadEmployeePhotoFn({
        data: {
          employeeId: emp.id,
          fileName: file.name || "foto.jpg",
          contentType: file.type || "image/jpeg",
          base64,
        },
      });
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Foto atualizada");
    } catch (e: any) {
      console.error("[foto] erro ao enviar:", e);
      toast.error("Erro ao enviar foto: " + (e?.message || "desconhecido"));
    } finally {
      setUploadingHeaderPhoto(false);
    }
  }

  if (!emp) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      {showHeader && (
      <Card className="p-5 sm:p-6 rounded-2xl border-slate-200 shadow-sm">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 sm:gap-5 items-start">
        <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0">
          <label className={`relative h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border-2 border-slate-200 flex items-center justify-center bg-gradient-to-br from-brand/80 to-brand text-white ${canEditHeader ? "cursor-pointer hover:border-brand transition-colors" : ""}`}>
            {emp.foto_url ? (
              <img src={emp.foto_url} alt={emp.nome} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-black tracking-wider select-none">{initialsOf(emp.nome)}</span>
            )}
            {canEditHeader && (
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingHeaderPhoto}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // limpa o value para permitir reescolher o mesmo arquivo depois
                  e.target.value = "";
                  if (file) handleHeaderPhotoUpload(file);
                }}
              />
            )}
          </label>
          {canEditHeader && emp.foto_url && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeHeaderPhoto(); }}
              title="Remover foto"
              className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-600 hover:text-destructive hover:border-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
            <h1 className="heading-display text-lg sm:text-2xl lg:text-[28px] leading-tight text-slate-100/95 break-words min-w-0 tracking-tight drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]">{emp.nome}</h1>
            <div className="shrink-0 flex flex-row flex-wrap sm:flex-col items-start sm:items-end gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {isEditor && (tab === "profile" || tab === "nrs") && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("employee:save-tab", { detail: { tab } }))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                    title="Salvar alterações desta aba"
                  >
                    <Save className="h-3.5 w-3.5" /> Salvar
                  </button>
                )}
                {status && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 ring-1 ring-slate-200 pl-2 pr-2.5 py-1">
                    <span className={`h-2 w-2 rounded-full ${status.colorClass}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{status.label}</span>
                  </div>
                )}
              </div>
              {isEditor && (
                emp.status === "DESLIGADO" ? (
                  <button
                    type="button"
                    onClick={() => setDesligamentoOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-colors"
                    title="Reativar funcionário"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reativar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDesligamentoOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-800 hover:bg-rose-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-colors"
                    title="Registrar desligamento do funcionário"
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Desligamento
                  </button>
                )
              )}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">CPF</span>
              <span className="font-mono text-slate-800">{emp.cpf ?? "—"}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Matrícula</span>
              <span className="text-slate-800">{emp.matricula ?? "—"}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Função</span>
              <span className="text-slate-800 truncate max-w-[220px]">{role?.name ?? "—"}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admissão</span>
              <span className="text-slate-800">
                {emp.admissao ? new Date(emp.admissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
              </span>
            </span>
          </div>
        </div>
        </div>
        <div className="mt-6 pt-5 border-t border-rose-100/10 flex flex-nowrap items-center justify-between gap-3">
          {/* Navegação de seções */}
          <div className="inline-flex shrink-0 items-center gap-4 rounded-2xl border border-rose-200/15 bg-gradient-to-b from-rose-950/40 to-rose-950/10 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_18px_-8px_rgba(0,0,0,0.6)]">
            <QuickTabBtn icon={HeartPulse} label="ASO" tone={asoTone} active={tab === "health"} onClick={() => { setTab("health"); setHealthSub("exams"); }} />
            <QuickTabBtn icon={Award} label="NR" tone={nrTone} active={tab === "nrs"} onClick={() => setTab("nrs")} />
            <QuickTabBtn icon={FolderOpen} label="Docs" tone={docsTone} active={tab === "docs"} onClick={() => setTab("docs")} />
            <QuickTabBtn icon={HardHat} label="EPI" tone="slate" active={tab === "epi"} onClick={() => setTab("epi")} />
          </div>

          {/* Ações documentais */}
          <div className="flex flex-nowrap items-center gap-2 ml-auto shrink-0">
            <div className="inline-flex shrink-0 items-center gap-3 rounded-2xl border border-rose-200/15 bg-gradient-to-b from-rose-950/40 to-rose-950/10 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_18px_-8px_rgba(0,0,0,0.6)]">
              <Link
                to="/app/audit"
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[11px] font-black uppercase tracking-widest text-rose-50/95 hover:bg-rose-100/10 hover:text-white transition-colors"
                title="Auditar"
              >
                <ClipboardCheck className="h-4 w-4" /> Auditar
              </Link>
              <span className="h-4 w-px bg-rose-200/20" />
              <button
                type="button"
                onClick={gerarFichaPdf}
                disabled={gerandoFicha}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[11px] font-black uppercase tracking-widest text-rose-50/95 hover:bg-rose-100/10 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-wait"
                title="Gerar ficha em PDF"
              >
                <FileText className="h-4 w-4" /> {gerandoFicha ? "Gerando…" : "Ficha"}
              </button>
              <span className="h-4 w-px bg-rose-200/20" />
              <button
                type="button"
                onClick={() => setPppOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[11px] font-black uppercase tracking-widest text-rose-50/95 hover:bg-rose-100/10 hover:text-white transition-colors"
                title="Emitir PPP (Perfil Profissiográfico Previdenciário)"
              >
                <FileSignature className="h-4 w-4" /> PPP
              </button>
            </div>
          </div>
        </div>
      </Card>
      )}

      {emp.status === "DESLIGADO" && (
        <Card className="p-4 rounded-2xl border-2 border-rose-300 bg-rose-50 flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-rose-600 text-white flex items-center justify-center">
            <UserMinus className="h-5 w-5" />
          </div>
          <div className="flex-1 text-sm">
            <div className="text-sm font-black uppercase tracking-widest text-rose-700">Funcionário DESLIGADO</div>
            <div className="text-xs text-rose-900 mt-0.5">
              {(emp as any).data_desligamento && (
                <>Desligado em <strong>{new Date((emp as any).data_desligamento + "T00:00:00").toLocaleDateString("pt-BR")}</strong>. </>
              )}
              {(emp as any).motivo_desligamento && <>Motivo: <strong>{(emp as any).motivo_desligamento}</strong>. </>}
              Histórico mantido por exigência legal (até 20 anos). Novas emissões bloqueadas.
            </div>
          </div>
        </Card>
      )}

      {!docsOk && (
        <Card className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50 flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-amber-500 text-white flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-black uppercase tracking-widest text-amber-700">Documentação incompleta</div>
            <div className="text-xs text-amber-800 mt-0.5">
              Pendências: <strong>{missingDocs.join(", ")}</strong>. A geração de relatórios e fichas está bloqueada até que todos os 5 documentos obrigatórios sejam enviados.
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-100" onClick={() => setTab("docs")}>
            Ir para Docs
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {status && status.msgs.length > 0 ? (
          <Card className="glass-vinho p-4 rounded-2xl h-full flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-300" />
              <span className="text-xs font-black uppercase tracking-widest text-rose-100/90">
                Pendências detectadas
              </span>
              <Badge className="bg-rose-500/20 text-rose-100 border border-rose-300/30 text-[10px]">
                {status.msgs.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {status.msgs.map((m, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="border-rose-300/30 bg-white/5 text-rose-50 text-[11px]"
                >
                  {m}
                </Badge>
              ))}
            </div>
          </Card>
        ) : (
          <div className="hidden lg:block" />
        )}
        <SafetyOverridePanel employeeId={id} employeeName={emp.nome} availableItemKeys={availableItemKeys} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <AnimatedTabsBar
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "profile", label: "Perfil", icon: User },
            { value: "nrs", label: "NRs", icon: ShieldCheck },
            { value: "docs", label: "Docs", icon: FileIcon },
            { value: "epi", label: "EPI", icon: HardHat },
            { value: "health", label: "Saúde", icon: HeartPulse },
            { value: "oss", label: "OS", icon: FileSignature },
            { value: "matriz", label: "Matriz", icon: GraduationCap },
          ]}
        />

        <TabsContent value="profile" className="mt-4">
          <ProfileTab key={emp.id} emp={emp} companies={companies ?? []} roles={roles ?? []} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
        </TabsContent>
        <TabsContent value="nrs" className="mt-4">
          <NrsTab key={emp.id} emp={emp} role={role} canEdit={isEditor} qc={qc} />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <DocsTab empId={id} />
        </TabsContent>
        <TabsContent value="epi" className="mt-4">
          <EpiTab empId={id} epis={epis ?? []} emp={emp} company={(companies ?? []).find((c: any) => c.id === emp.company_id) ?? null} role={role} canEdit={isEditor} canDelete={isAdmin} qc={qc} docsOk={docsOk} missingDocs={missingDocs} />
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          <Tabs value={healthSub} onValueChange={setHealthSub}>
            <TabsList className="grid grid-cols-3 w-full max-w-xl">
              <TabsTrigger value="exams">Exames / ASO</TabsTrigger>
              <TabsTrigger value="vaccines">Vacinas</TabsTrigger>
              <TabsTrigger value="atestados">Atestados</TabsTrigger>
            </TabsList>
            <TabsContent value="exams" className="mt-4">
              <HealthTab empId={id} exams={exams ?? []} role={role} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
            </TabsContent>
            <TabsContent value="vaccines" className="mt-4">
              <VaccinesTab empId={id} vaccines={vaccines ?? []} role={role} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
            </TabsContent>
            <TabsContent value="atestados" className="mt-4">
              <AtestadosTab empId={id} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="matriz" className="mt-4">
          <MatrizTab emp={emp} canEdit={isEditor} />
        </TabsContent>
        <TabsContent value="oss" className="mt-4">
          <OssTab empId={id} empNome={emp.nome} />
        </TabsContent>
      </Tabs>
      <FileViewerHost />
      <PDFPreviewDialog
        open={!!fichaDoc}
        onClose={() => setFichaDoc(null)}
        doc={fichaDoc}
        fileName={`ficha_${(emp?.nome ?? "funcionario").toLowerCase().replace(/\s+/g, "_")}.pdf`}
        title="Ficha do Colaborador"
      />
      <PPPEditorDialog
        open={pppOpen}
        onOpenChange={setPppOpen}
        employee={emp}
        company={(companies ?? []).find((c: any) => c.id === emp?.company_id) ?? null}
        role={role}
      />
      <DesligamentoDialog
        emp={emp as any}
        open={desligamentoOpen}
        onClose={() => setDesligamentoOpen(false)}
      />
    </div>
  );
}

/* ============ CONTEXT SIDEBAR (empresa + colegas) ============ */
function QuickTabBtn({ icon: Icon, label, tone = "rose", active, onClick }: { icon: any; label: string; tone?: "rose" | "slate" | "ok" | "warn"; active?: boolean; onClick: () => void }) {
  const palette = tone === "slate"
    ? "bg-gradient-to-b from-rose-100/15 to-rose-100/5 text-rose-50 hover:from-rose-100/25 hover:to-rose-100/10 ring-rose-200/20"
    : tone === "ok"
    ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white hover:from-emerald-600 hover:to-emerald-800 ring-emerald-300/40"
    : tone === "warn"
    ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white hover:from-amber-500 hover:to-amber-700 ring-amber-300/40"
    : "bg-gradient-to-br from-rose-500 to-[#991b1b] text-white hover:from-rose-600 hover:to-[#7B1E2B] ring-rose-300/40";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-black uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_-2px_rgba(0,0,0,0.45)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_-4px_rgba(0,0,0,0.55)] hover:-translate-y-0.5 transition-all ring-1 ${palette} ${active ? "ring-2 ring-offset-2 ring-offset-rose-950 ring-rose-300/70" : ""}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function EmployeeContextSidebar({ id }: { id: string }) {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [openNewEmployee, setOpenNewEmployee] = useState(false);
  const { data: emp } = useQuery({
    queryKey: ["employee-sidebar", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, company_id")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const companyId = emp?.company_id ?? null;

  const { data: company } = useQuery({
    queryKey: ["company-sidebar", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, type, cnpj, encarregado1, encarregado2, email, data_entrada")
        .eq("id", companyId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: coworkers } = useQuery({
    queryKey: ["coworkers-sidebar", companyId, id],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, status, role_id, foto_url")
        .eq("company_id", companyId!)
        .neq("id", id)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rolesMap } = useQuery({
    queryKey: ["roles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("id, name");
      const m = new Map<string, string>();
      (data ?? []).forEach((r: any) => m.set(r.id, r.name));
      return m;
    },
  });

  if (!companyId) {
    return (
      <aside className="space-y-4 lg:sticky lg:top-6">
        <Card className="p-4 rounded-2xl border-dashed text-center text-xs text-slate-500">
          Funcionário sem empresa vinculada.
        </Card>
      </aside>
    );
  }

  const totalVinculos = (coworkers?.length ?? 0) + 1;
  const entrada = company?.data_entrada
    ? new Date(company.data_entrada + "T00:00:00").toLocaleDateString("pt-BR")
    : "N/A";

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      {/* CARD DA EMPRESA — estilo gradiente */}
      {company ? (
        <div className="relative p-5 rounded-2xl border border-white/10 text-white overflow-hidden shadow-lg"
             style={{ background: "linear-gradient(135deg, #991b1b 0%, #7B1E2B 60%, #4a0e15 100%)" }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-red-300/20 blur-2xl pointer-events-none" />

          <div className="relative flex justify-between items-start mb-3">
            <div className="text-[9px] font-black px-2 py-1 rounded inline-flex items-center gap-1 text-white bg-white/15 backdrop-blur ring-1 ring-white/20">
              <Briefcase className="h-3 w-3" /> {company.type ?? "—"}
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur pl-1 pr-3 py-1 shadow-md shadow-black/20">
              <span className="h-8 w-8 rounded-full bg-white/25 ring-1 ring-white/40 flex items-center justify-center">
                <Users className="h-4 w-4 text-white" />
              </span>
              <div className="leading-none">
                <div className="text-base font-black text-white tabular-nums">{totalVinculos}</div>
                <div className="text-[8px] font-black uppercase tracking-widest text-white/80">Vínculos</div>
              </div>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center backdrop-blur shrink-0">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-black uppercase text-white leading-tight">{company.name}</h3>
          </div>

          <p className="relative text-[10px] font-bold uppercase mt-2 text-white/70 flex items-center gap-1">
            <IdCard className="h-3 w-3" /> CNPJ: {company.cnpj || "Não informado"} <span className="mx-1">|</span> ENTRADA: {entrada}
          </p>

          <div className="relative mt-4 pt-4 border-t border-white/20 text-xs font-bold text-white/90">
            <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-white" /> {company.encarregado1 ? `Empreiteiro: ${company.encarregado1}` : "S/ Empreiteiro"}</div>
            <div className="flex items-center gap-2 mt-1"><UserCog className="h-3.5 w-3.5 text-white" /> {company.encarregado2 ? `Encarregado: ${company.encarregado2}` : "S/ Encarregado"}</div>
          </div>
        </div>
      ) : (
        <Card className="p-4 rounded-2xl text-xs text-slate-400">Carregando empresa…</Card>
      )}

      {/* AÇÕES — paleta coesa (brand + navy + outlines) */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpenNewEmployee(true)} disabled={!isEditor} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#991b1b] to-[#7B1E2B] hover:from-[#7B1E2B] hover:to-[#4a0e15] text-white text-[10px] font-black uppercase tracking-widest px-3 py-2.5 shadow-sm hover:shadow-md transition-all disabled:pointer-events-none disabled:opacity-50">
          <UserPlus className="h-3.5 w-3.5" /> Novo Func.
        </button>
        <Link to="/app/companies" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white text-[10px] font-black uppercase tracking-widest px-3 py-2.5 shadow-sm hover:shadow-md transition-all">
          <Upload className="h-3.5 w-3.5" /> Importar CSV
        </Link>
        <Link to="/app/companies" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#0f172a] text-[10px] font-black uppercase tracking-widest px-3 py-2.5 shadow-sm hover:shadow-md transition-all ring-1 ring-slate-200 hover:ring-[#991b1b]/40">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Link>
        <Link to="/app/companies" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-rose-50 text-[#991b1b] text-[10px] font-black uppercase tracking-widest px-3 py-2.5 shadow-sm hover:shadow-md transition-all ring-1 ring-[#991b1b]/30 hover:ring-[#991b1b]/60">
          <Pencil className="h-3.5 w-3.5" /> Editar Empr.
        </Link>
        <Link to="/app/companies" className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest px-3 py-2.5 shadow-sm hover:shadow-md transition-all ring-1 ring-dashed ring-slate-300 hover:ring-[#991b1b]/40 hover:text-[#991b1b]">
          <Plus className="h-3.5 w-3.5" /> Nova Empresa
        </Link>
      </div>

      <NewEmployeeDialog
        open={openNewEmployee}
        onOpenChange={setOpenNewEmployee}
        defaultCompanyId={companyId ?? undefined}
        onCreated={() => qc.invalidateQueries({ queryKey: ["coworkers-sidebar", companyId, id] })}
      />

      <Card className="p-4 rounded-2xl border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Demais funcionários</div>
          <span className="text-[10px] font-black text-slate-500">{coworkers?.length ?? 0}</span>
        </div>
        {!coworkers ? (
          <div className="text-xs text-slate-400">Carregando…</div>
        ) : coworkers.length === 0 ? (
          <div className="text-xs text-slate-400">Nenhum outro funcionário nesta empresa.</div>
        ) : (
          <ul className="space-y-1 max-h-[480px] overflow-y-auto -mx-1 pr-1">
            {coworkers.map((c: any) => {
              const statusDot =
                c.status === "ATIVO" ? "bg-emerald-500"
                : c.status === "AFASTADO" ? "bg-amber-500"
                : "bg-rose-500";
              const initials = (() => {
                const parts = (c.nome ?? "").trim().split(/\s+/);
                const a = parts[0]?.[0] ?? "";
                const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
                return (a + b).toUpperCase();
              })();
              const palettes = [
                "from-rose-500 to-pink-600",
                "from-amber-500 to-orange-600",
                "from-emerald-500 to-teal-600",
                "from-sky-500 to-indigo-600",
                "from-violet-500 to-fuchsia-600",
                "from-cyan-500 to-blue-600",
                "from-lime-500 to-emerald-600",
                "from-red-500 to-rose-700",
              ];
              let h = 0;
              for (let i = 0; i < (c.nome ?? "").length; i++) h = (h * 31 + c.nome.charCodeAt(i)) >>> 0;
              const grad = palettes[h % palettes.length];
              return (
                <li key={c.id}>
                  <Link
                    to="/app/employees/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors group"
                  >
                    <div className={`relative h-9 w-9 shrink-0 rounded-full overflow-hidden bg-gradient-to-br ${grad} text-white text-[11px] font-black flex items-center justify-center ring-2 ring-white shadow-sm`}>
                      {c.foto_url ? (
                        <img src={c.foto_url} alt={c.nome} className="h-full w-full object-cover" />
                      ) : (
                        <span className="select-none">{initials}</span>
                      )}
                      <span className={`absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${statusDot}`} title={c.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 truncate group-hover:text-brand">{c.nome}</div>
                      <div className="text-[10px] text-slate-500 truncate">{rolesMap?.get(c.role_id) ?? "—"}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </aside>
  );
}

/* ============ PROFILE ============ */
function AssinaturaField({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Field label="Assinatura digital">
        <div className="flex items-center gap-2">
          {value ? (
            <img src={value} alt="Assinatura" className="h-10 w-32 object-contain border border-slate-200 rounded bg-white" />
          ) : (
            <div className="h-10 w-32 border border-dashed border-slate-300 rounded grid place-items-center text-[10px] text-slate-400 uppercase tracking-widest">Sem assinatura</div>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
            {value ? "Substituir" : "Capturar"}
          </Button>
          {value && !disabled && (
            <Button type="button" size="sm" variant="ghost" className="text-rose-600" onClick={() => onChange(null)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </Field>
      <SignaturePadDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={(r) => { onChange(r.dataUrl); setOpen(false); }}
        title="Assinatura do funcionário"
      />
    </>
  );
}

function GheField({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const { data: ghes } = useQuery({
    queryKey: ["pgr_ghe_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pgr_ghe").select("id, numero, setor").eq("ativo", true).order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Field label="GHE (PGR)">
      <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="— sem GHE —" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— sem GHE —</SelectItem>
          {(ghes ?? []).map((g: any) => (
            <SelectItem key={g.id} value={g.id}>GHE {g.numero} · {g.setor}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ProfileTab({ emp, companies, roles, canEdit, canDelete, qc }: any) {
  const [f, setF] = useState<any>(emp);
  // Re-sincroniza o formulário sempre que o funcionário muda.
  // Sem isso, navegar de um colaborador pra outro deixava dados antigos
  // no estado e um Save sobrescrevia o registro errado.
  useEffect(() => { setF(emp); }, [emp?.id]);
  const save = useMutation({
    mutationFn: async () => {
      // Trava de segurança: só grava se o id do formulário bater com o id do registro alvo.
      if (f?.id && emp?.id && f.id !== emp.id) {
        throw new Error("Inconsistência detectada: o formulário não corresponde ao funcionário atual. Recarregue a página antes de salvar.");
      }
      // Trava anti-sobrescrita: se o NOME mudou em relação ao registro carregado,
      // exige confirmação. Já tivemos casos do usuário abrir a ficha de um
      // funcionário, digitar o nome de OUTRA pessoa achando que era um cadastro
      // novo e gravar — destruindo o registro original. Esse confirm bloqueia
      // a regravação acidental.
      const nomeOriginal = (emp?.nome ?? "").trim();
      const nomeNovo = toTitleCasePT((f?.nome ?? "").trim());
      if (nomeOriginal && nomeNovo && nomeOriginal.toLowerCase() !== nomeNovo.toLowerCase()) {
        const ok = confirm(
          `Você está alterando o NOME deste funcionário:\n\n` +
          `  De:  ${nomeOriginal}\n` +
          `  Para: ${nomeNovo}\n\n` +
          `Se sua intenção era CADASTRAR UM NOVO funcionário, clique em "Cancelar" ` +
          `e use o botão "Novo funcionário" na lista. Continuar vai sobrescrever ` +
          `o registro atual e perder os dados de "${nomeOriginal}".\n\n` +
          `Deseja realmente renomear?`
        );
        if (!ok) throw new Error("Alteração de nome cancelada pelo usuário.");
      }
      const { id: _id, created_at, updated_at, ...rest } = f;
      const payload = { ...rest, nome: toTitleCasePT(rest.nome) };
      const { error } = await supabase.from("employees").update(payload).eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee", emp.id] }); qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  // Listener do botão Salvar do cabeçalho (mesma mutation do botão do rodapé)
  useEffect(() => {
    if (!canEdit) return;
    const handler = (e: any) => {
      if (e?.detail?.tab === "profile" && !save.isPending) save.mutate();
    };
    window.addEventListener("employee:save-tab", handler as EventListener);
    return () => window.removeEventListener("employee:save-tab", handler as EventListener);
  }, [canEdit, save]);
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").delete().eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); window.location.href = "/app/employees"; },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome *"><Input value={f.nome ?? ""} onChange={(e) => setF({ ...f, nome: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Status">
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVO">ATIVO</SelectItem>
              <SelectItem value="INATIVO">INATIVO</SelectItem>
              <SelectItem value="AFASTADO">AFASTADO</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Empresa">
          <Select value={f.company_id ?? ""} onValueChange={(v) => setF({ ...f, company_id: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Cargo">
          <Select value={f.role_id ?? ""} onValueChange={(v) => setF({ ...f, role_id: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <GheField value={f.ghe_id ?? null} onChange={(v) => setF({ ...f, ghe_id: v })} disabled={!canEdit} />
        <Field label="Setor">
          <Input
            list="setor-options"
            value={f.setor ?? ""}
            onChange={(e) => setF({ ...f, setor: e.target.value.toUpperCase() })}
            placeholder="Ex.: ALMOXARIFADO, PRODUCAO"
            disabled={!canEdit}
            maxLength={50}
          />
          <datalist id="setor-options">
            <option value="ALMOXARIFADO" />
            <option value="PRODUCAO" />
            <option value="ADMINISTRATIVO" />
            <option value="SESMT" />
            <option value="MANUTENCAO" />
            <option value="QUALIDADE" />
          </datalist>
        </Field>
        <Field label="CPF"><Input inputMode="numeric" maxLength={14} placeholder="000.000.000-00" value={maskCPF(f.cpf ?? "")} onChange={(e) => setF({ ...f, cpf: maskCPF(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="Matrícula"><Input value={f.matricula ?? ""} onChange={(e) => setF({ ...f, matricula: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="RG"><Input placeholder="0000000" maxLength={12} value={maskRG(f.rg ?? "")} onChange={(e) => setF({ ...f, rg: maskRG(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="Órgão Emissor"><Input value={f.rg_orgao ?? ""} onChange={(e) => setF({ ...f, rg_orgao: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="CNH"><Input inputMode="numeric" maxLength={11} placeholder="00000000000" value={(f.cnh ?? "").replace(/\D/g, "").slice(0, 11)} onChange={(e) => setF({ ...f, cnh: e.target.value.replace(/\D/g, "").slice(0, 11) })} disabled={!canEdit} /></Field>
        <Field label="Data de Nascimento"><Input type="date" value={f.data_nascimento ?? ""} onChange={(e) => setF({ ...f, data_nascimento: e.target.value || null })} disabled={!canEdit} /></Field>
        <Field label="Sexo">
          <Select value={f.sexo ?? ""} onValueChange={(v) => setF({ ...f, sexo: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="PIS / NIT (eSocial)"><Input inputMode="numeric" maxLength={14} placeholder="00000000000" value={f.pis ?? ""} onChange={(e) => setF({ ...f, pis: e.target.value.replace(/\D/g, "").slice(0, 14) })} disabled={!canEdit} /></Field>
        <AssinaturaField value={f.assinatura_url ?? null} onChange={(v) => setF({ ...f, assinatura_url: v })} disabled={!canEdit} />
        <Field label="Tipo cadastro">
          <Select value={f.tipo_cadastro} onValueChange={(v) => setF({ ...f, tipo_cadastro: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NAO_MEI">CLT</SelectItem>
              <SelectItem value="MEI">MEI</SelectItem>
              <SelectItem value="TERCEIRIZADO">TERCEIRIZADO</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="CNPJ (MEI)"><Input inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" value={maskCNPJ(f.cnpj ?? "")} onChange={(e) => setF({ ...f, cnpj: maskCNPJ(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="Admissão"><Input type="date" value={f.admissao ?? ""} onChange={(e) => setF({ ...f, admissao: e.target.value || null })} disabled={!canEdit} /></Field>
        <Field label="Email"><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="WhatsApp"><Input inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" value={maskPhone(f.whatsapp ?? "")} onChange={(e) => setF({ ...f, whatsapp: maskPhone(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="Contato Emergência"><Input value={f.nome_contato ?? ""} onChange={(e) => setF({ ...f, nome_contato: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="WhatsApp Emergência"><Input inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" value={maskPhone(f.whatsapp_emergencia ?? "")} onChange={(e) => setF({ ...f, whatsapp_emergencia: maskPhone(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="CEP">
          <Input
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            value={maskCEP(f.cep ?? "")}
            onChange={async (e) => {
              const masked = maskCEP(e.target.value);
              setF((prev: any) => ({ ...prev, cep: masked }));
              const digits = masked.replace(/\D/g, "");
              if (digits.length === 8) {
                try {
                  const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
                  const j = await r.json();
                  if (!j?.erro) {
                    setF((prev: any) => ({
                      ...prev,
                      endereco: prev.endereco || [j.logradouro, j.complemento].filter(Boolean).join(", "),
                      bairro: j.bairro || prev.bairro,
                      cidade: j.localidade || prev.cidade,
                      uf: j.uf || prev.uf,
                    }));
                  }
                } catch { /* ignore */ }
              }
            }}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Endereço" className="md:col-span-2"><Input value={f.endereco ?? ""} onChange={(e) => setF({ ...f, endereco: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Bairro">
          <Select value={f.bairro ?? ""} onValueChange={(v) => setF({ ...f, bairro: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="Selecione o bairro" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {BAIRROS_MANAUS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cidade"><Input value={f.cidade ?? ""} onChange={(e) => setF({ ...f, cidade: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="UF">
          <Select value={f.uf ?? ""} onValueChange={(v) => setF({ ...f, uf: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex justify-between pt-4 border-t">
        {canDelete ? (
          <Button variant="destructive" onClick={() => { if (confirm("Excluir colaborador?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4 mr-2" />Excluir
          </Button>
        ) : <div />}
        {canEdit && <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar alterações</Button>}
      </div>
    </Card>
  );
}

function Field({ label, children, className }: any) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* ============ NRs ============ */
function NrsTab({ emp, role, canEdit, qc }: any) {
  const [nrs, setNrs] = useState<Record<string, string>>(emp.nrs ?? {});
  const [intDate, setIntDate] = useState(emp.data_integracao ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").update({ nrs, data_integracao: intDate || null }).eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee", emp.id] }); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  // Listener do botão Salvar do cabeçalho
  useEffect(() => {
    if (!canEdit) return;
    const handler = (e: any) => {
      if (e?.detail?.tab === "nrs" && !save.isPending) save.mutate();
    };
    window.addEventListener("employee:save-tab", handler as EventListener);
    return () => window.removeEventListener("employee:save-tab", handler as EventListener);
  }, [canEdit, save]);

  const reqNrs: string[] = role?.req_nrs ?? [];
  const allNrs = Array.from(new Set([...reqNrs, ...NRS_LIST])).sort();

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-1.5 max-w-xs">
        <Label className="text-xs">Data da Integração</Label>
        <Input type="date" value={intDate ?? ""} onChange={(e) => setIntDate(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {allNrs.map((nr) => {
          const isReq = reqNrs.includes(nr);
          return (
            <div key={nr} className={`rounded-md border p-3 ${isReq ? "border-brand" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{nr}</span>
                {isReq && <Badge className="bg-brand text-brand-foreground text-[10px]">Requerida</Badge>}
              </div>
              <Input
                type="date"
                value={nrs[nr] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const copy = { ...nrs };
                  if (v) copy[nr] = v; else delete copy[nr];
                  setNrs(copy);
                }}
                disabled={!canEdit}
              />
            </div>
          );
        })}
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button></div>}
    </Card>
  );
}

/* ============ DOCS ============ */
function DocsTab({ empId }: any) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const { data: docs } = useQuery({
    queryKey: ["docs", empId],
    queryFn: async () => (await supabase.from("employee_docs").select("*").eq("employee_id", empId).order("uploaded_at", { ascending: false })).data ?? [],
  });
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const [extraTipo, setExtraTipo] = useState("CNH");
  const [extraFile, setExtraFile] = useState<File | null>(null);

  async function uploadFor(tipo: string, file: File) {
    setUploadingTipo(tipo);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${empId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("employee_docs").insert({ employee_id: empId, tipo, file_path: path });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["docs", empId] });
      qc.invalidateQueries({ queryKey: ["docs-summary", empId] });
      toast.success(`${tipo} enviado`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingTipo(null);
    }
  }

  const uploadExtra = useMutation({
    mutationFn: async () => {
      if (!extraFile) throw new Error("Selecione um arquivo");
      await uploadFor(extraTipo, extraFile);
    },
    onSuccess: () => setExtraFile(null),
  });

  const del = useMutation({
    mutationFn: async (d: any) => {
      if (!d?.id || !d?.file_path) throw new Error("Documento inválido. Atualize a página e tente novamente.");
      await supabase.storage.from("employee-docs").remove([d.file_path]);
      const { error } = await supabase.from("employee_docs").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs", empId] }); qc.invalidateQueries({ queryKey: ["docs-summary", empId] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function openDoc(path: string) {
    if (!path) { toast.error("Documento sem arquivo vinculado. Atualize a página e tente novamente."); return; }
    await openStorageFile("employee-docs", path);
  }

  const REQUIRED_DOCS = ["RG", "CPF", "Comprovante Residência", "Comprovante MEI", "Cartão de Vacina"];
  const TIPOS_EXTRA = ["CNH", "CTPS", "Título de Eleitor", "Certificado Reservista", "Foto 3x4", "Contrato", "Outro"];

  const docsByTipo = (docs ?? []).reduce((acc: Record<string, any[]>, d: any) => {
    (acc[d.tipo] ||= []).push(d);
    return acc;
  }, {});

  const missing = REQUIRED_DOCS.filter((t) => !(docsByTipo[t]?.length));
  const allOk = missing.length === 0;
  const extraDocs = (docs ?? []).filter((d: any) => !REQUIRED_DOCS.includes(d.tipo));

  return (
    <div className="space-y-4">
      <Card className={`p-4 flex items-center justify-between rounded-2xl border-2 ${allOk ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${allOk ? "bg-emerald-500" : "bg-amber-500"} text-white`}>
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className={`text-sm font-black uppercase tracking-widest ${allOk ? "text-emerald-700" : "text-amber-700"}`}>
              {allOk ? "Documentos em dia" : "Documentos pendentes"}
            </div>
            <div className="text-xs text-slate-600">
              {allOk
                ? `Todos os ${REQUIRED_DOCS.length} documentos obrigatórios foram enviados.`
                : `Faltando: ${missing.join(", ")}`}
            </div>
          </div>
        </div>
        <Badge className={`${allOk ? "bg-emerald-600" : "bg-amber-600"} text-white text-[10px] font-black uppercase tracking-widest`}>
          {REQUIRED_DOCS.length - missing.length}/{REQUIRED_DOCS.length}
        </Badge>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">Documentos obrigatórios</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REQUIRED_DOCS.map((tipo) => {
            const items = docsByTipo[tipo] ?? [];
            const has = items.length > 0;
            return (
              <div
                key={tipo}
                className={`rounded-xl border p-3 flex items-center gap-3 transition-colors ${
                  has
                    ? "border-emerald-400/30 bg-gradient-to-br from-emerald-900/30 to-emerald-950/20"
                    : "border-rose-300/15 bg-gradient-to-br from-rose-950/40 to-[#1a0408]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                }`}
              >
                <div
                  className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center text-white border ${
                    has
                      ? "bg-gradient-to-br from-emerald-500/80 to-emerald-700/80 border-emerald-200/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_-2px_rgba(0,0,0,0.5)]"
                      : "bg-gradient-to-br from-rose-100/15 to-rose-100/5 border-rose-100/25 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.25),0_6px_16px_-4px_rgba(0,0,0,0.5)]"
                  }`}
                >
                  <FileText className="h-4 w-4 drop-shadow" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-rose-50 truncate">{tipo}</div>
                  <div className="text-[10px] text-rose-200/60">
                    {has ? `Enviado em ${formatDateBR(items[0].uploaded_at)}` : "Não enviado"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {has && (
                    <Button size="sm" variant="ghost" onClick={() => openDoc(items[0].file_path)}>
                      <FileText className="h-4 w-4 mr-1" />Ver
                    </Button>
                  )}
                  {isEditor && (
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        disabled={uploadingTipo === tipo}
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFor(tipo, file); e.target.value = ""; }}
                      />
                      <span className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold rounded-md bg-brand text-white hover:bg-brand/90 cursor-pointer">
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        {uploadingTipo === tipo ? "Enviando..." : has ? "Substituir" : "Enviar"}
                      </span>
                    </label>
                  )}
                  {has && isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(items[0])}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">Outros documentos</div>
        {isEditor && (
          <form onSubmit={(e) => { e.preventDefault(); uploadExtra.mutate(); }} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end border-b pb-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={extraTipo} onValueChange={setExtraTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_EXTRA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Arquivo (PDF/Imagem)</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setExtraFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" className="md:col-span-3" disabled={uploadExtra.isPending || !extraFile}>
              <Upload className="h-4 w-4 mr-2" /> Enviar documento
            </Button>
          </form>
        )}
        {extraDocs.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3">Nenhum documento adicional</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Arquivo</TableHead><TableHead>Enviado em</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {extraDocs.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.tipo}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openDoc(d.file_path)}>
                      <FileText className="h-4 w-4 mr-1" />Ver
                    </Button>
                  </TableCell>
                  <TableCell>{formatDateBR(d.uploaded_at)}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => del.mutate(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SignedDocsList employeeId={empId} />
    </div>
  );
}

function SignedDocsList({ employeeId }: { employeeId: string }) {
  const qc = useQueryClient();
  const { data: signedDocs } = useQuery({
    queryKey: ["signed-docs", employeeId],
    queryFn: async () => {
      // 1) Docs ligados diretamente ao funcionário (fichas de EPI)
      const { data: porFunc, error: e1 } = await supabase
        .from("documentos_assinados")
        .select("*")
        .eq("referencia_id", employeeId);
      if (e1) throw e1;
      // 2) Termos de perda — referencia_id aponta para epi_deliveries.id
      const { data: perdas, error: e2 } = await supabase
        .from("epi_deliveries")
        .select("id")
        .eq("employee_id", employeeId)
        .eq("motivo_entrega", "PERDA_EXTRAVIO");
      if (e2) throw e2;
      const perdaIds = (perdas ?? []).map((p: any) => p.id);
      let termos: any[] = [];
      if (perdaIds.length) {
        const { data: t, error: e3 } = await supabase
          .from("documentos_assinados")
          .select("*")
          .eq("modulo", "termo_perda")
          .in("referencia_id", perdaIds);
        if (e3) throw e3;
        termos = t ?? [];
      }
      const all = [...(porFunc ?? []), ...termos];
      // dedup + ordena por data desc
      const seen = new Set<string>();
      return all
        .filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    },
  });

  async function openSigned(path: string | null, name?: string) {
    if (!path) {
      toast.error("Documento assinado sem arquivo vinculado.");
      return;
    }
    await openStorageFile("sesmt-docs", path, name);
  }

  async function excluir(d: any) {
    if (!confirm(`Excluir definitivamente o documento "${d.nome_arquivo}"?\n\nEsta ação remove o PDF assinado e o registro do histórico. Não há como desfazer.`))
      return;
    try {
      if (d.pdf_assinado_path) {
        await supabase.storage.from("sesmt-docs").remove([d.pdf_assinado_path]);
      }
      const { error } = await supabase.from("documentos_assinados").delete().eq("id", d.id);
      if (error) throw error;
      toast.success("Documento excluído.");
      qc.invalidateQueries({ queryKey: ["signed-docs", employeeId] });
      qc.invalidateQueries({ queryKey: ["documentos-assinados"] });
    } catch (e: any) {
      toast.error("Falha ao excluir: " + (e?.message ?? "erro desconhecido"));
    }
  }

  if (!signedDocs?.length) return null;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-emerald-600" />
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">Documentos Assinados Digitalmente</div>
        </div>
        <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
          {signedDocs.length} DOCS
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {signedDocs.map((d: any) => {
          const isTermo = d.modulo === "termo_perda" || d.nome_arquivo.toLowerCase().includes("termo_perda");
          return (
            <div key={d.id} className={`rounded-xl border ${isTermo ? "border-rose-100 bg-rose-50/30" : "border-emerald-100 bg-white"} p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow`}>
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${isTermo ? "bg-rose-100 text-rose-600" : "bg-emerald-50 text-emerald-600"} flex items-center justify-center`}>
                  {isTermo ? <FileWarning className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate max-w-[140px]" title={d.nome_arquivo}>
                    {d.nome_arquivo}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {formatDateBR(d.created_at)} · {d.total_assinaturas} assinaturas
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => openSigned(d.pdf_assinado_path, d.nome_arquivo)} 
                  className={`${isTermo ? "text-rose-600 hover:text-rose-700 hover:bg-rose-100" : "text-brand hover:text-brand hover:bg-brand/5"}`}
                >
                  <FileText className="h-4 w-4 mr-1" /> Ver
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => excluir(d)}
                  title="Excluir documento"
                  className="text-slate-400 hover:text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}


/* ============ VACCINES ============ */
function VaccinesTab({ empId, vaccines, role, canEdit, canDelete, qc }: any) {
  const [f, setF] = useState<any>({
    tipo_vacina: VACINAS_LIST[0],
    dose: "1ª dose",
    data_aplicacao: new Date().toISOString().slice(0, 10),
    data_proxima_dose: "",
    lote: "",
    fabricante: "",
    observacoes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const reqVacinas: string[] = role?.req_vacinas ?? [];
  const riscoBio: boolean = !!role?.risco_biologico;

  const create = useMutation({
    mutationFn: async () => {
      let anexo_path: string | null = null;
      if (file) {
        const path = `${empId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("vaccination-cards").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        anexo_path = path;
      }
      const { error } = await supabase.from("employee_vaccinations").insert({
        employee_id: empId,
        tipo_vacina: f.tipo_vacina,
        dose: f.dose || null,
        data_aplicacao: f.data_aplicacao,
        data_proxima_dose: f.data_proxima_dose || null,
        lote: f.lote || null,
        fabricante: f.fabricante || null,
        observacoes: f.observacoes || null,
        anexo_path,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccines", empId] });
      qc.invalidateQueries({ queryKey: ["employee", empId] });
      setFile(null);
      toast.success("Vacina registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_vaccinations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vaccines", empId] }); toast.success("Removida"); },
  });

  async function openCard(path: string) {
    await openStorageFile("vaccination-cards", path);
  }

  // Status por vacina obrigatória
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const latestByType: Record<string, any> = {};
  vaccines.forEach((v: any) => {
    if (!latestByType[v.tipo_vacina] || new Date(v.data_aplicacao) > new Date(latestByType[v.tipo_vacina].data_aplicacao)) {
      latestByType[v.tipo_vacina] = v;
    }
  });

  return (
    <Card className="p-6 space-y-6">
      {riscoBio && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex gap-3 items-start">
          <Syringe className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900">
            <div className="font-black uppercase tracking-widest mb-1">Função com Risco Biológico (PCMSO Rev.05)</div>
            Esta função exige imunização ativa. Vacinas vencidas ou sem carteira anexada bloqueiam automaticamente o status do colaborador e a emissão de PTE para Limpeza de Tanque.
          </div>
        </div>
      )}

      {reqVacinas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reqVacinas.map((vac) => {
            const v = latestByType[vac];
            let cls = "border-red-300 bg-red-50";
            let label = "Falta";
            if (v) {
              if (!v.anexo_path) { cls = "border-red-300 bg-red-50"; label = "Sem carteira"; }
              else if (v.data_proxima_dose) {
                const exp = new Date(v.data_proxima_dose + "T00:00:00");
                if (exp < today) { cls = "border-red-300 bg-red-50"; label = "Vencida"; }
                else { cls = "border-emerald-300 bg-emerald-50"; label = "Em dia"; }
              } else { cls = "border-emerald-300 bg-emerald-50"; label = "Em dia"; }
            }
            return (
              <div key={vac} className={`rounded-xl border p-3 ${cls}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-800">{vac}</span>
                  <Badge className="text-[9px]">{label}</Badge>
                </div>
                {v && (
                  <div className="text-[10px] text-slate-600 font-bold uppercase">
                    Aplicada: {formatDateBR(v.data_aplicacao)}
                    {v.data_proxima_dose && <> · Próx.: {formatDateBR(v.data_proxima_dose)}</>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end border-t pt-4">
          <Field label="Vacina">
            <Select value={f.tipo_vacina} onValueChange={(v) => setF({ ...f, tipo_vacina: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VACINAS_LIST.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Dose">
            <Select value={f.dose} onValueChange={(v) => setF({ ...f, dose: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1ª dose">1ª dose</SelectItem>
                <SelectItem value="2ª dose">2ª dose</SelectItem>
                <SelectItem value="3ª dose">3ª dose</SelectItem>
                <SelectItem value="Reforço">Reforço</SelectItem>
                <SelectItem value="Dose única">Dose única</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aplicação"><Input type="date" required value={f.data_aplicacao} onChange={(e) => setF({ ...f, data_aplicacao: e.target.value })} /></Field>
          <Field label="Próxima dose / Validade"><Input type="date" value={f.data_proxima_dose} onChange={(e) => setF({ ...f, data_proxima_dose: e.target.value })} /></Field>
          <Field label="Lote"><Input value={f.lote} onChange={(e) => setF({ ...f, lote: e.target.value })} /></Field>
          <Field label="Fabricante"><Input value={f.fabricante} onChange={(e) => setF({ ...f, fabricante: e.target.value })} /></Field>
          <Field label="Carteira (PDF/Imagem)" className="col-span-2">
            <div className="flex items-center gap-2">
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <Badge variant="outline" className="text-[10px]"><Upload className="h-3 w-3 mr-1" />{file.name}</Badge>}
            </div>
          </Field>
          <Field label="Observações" className="col-span-2 md:col-span-4"><Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field>
          <Button type="submit" className="col-span-2 md:col-span-4" disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Registrar Vacina
          </Button>
        </form>
      )}

      <Table>
        <TableHeader><TableRow><TableHead>Vacina</TableHead><TableHead>Dose</TableHead><TableHead>Aplicação</TableHead><TableHead>Próxima/Validade</TableHead><TableHead>Lote</TableHead><TableHead>Carteira</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {vaccines.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma vacina registrada</TableCell></TableRow>}
          {vaccines.map((v: any) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">{v.tipo_vacina}</TableCell>
              <TableCell>{v.dose ?? "—"}</TableCell>
              <TableCell>{formatDateBR(v.data_aplicacao)}</TableCell>
              <TableCell>{v.data_proxima_dose ? formatDateBR(v.data_proxima_dose) : "—"}</TableCell>
              <TableCell>{v.lote ?? "—"}</TableCell>
              <TableCell>
                {v.anexo_path ? (
                  <Button size="sm" variant="ghost" onClick={() => openCard(v.anexo_path)}>
                    <FileText className="h-4 w-4 mr-1" /> Ver
                  </Button>
                ) : <span className="text-xs text-red-500 font-bold">Sem anexo</span>}
              </TableCell>
              <TableCell className="text-right">
                {canDelete && <Button size="icon" variant="ghost" onClick={() => del.mutate(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ============ EPI ============ */
type EstoqueRow = {
  id: string;
  codigo_material: string;
  nome_material: string;
  ca: string | null;
  quantidade_atual: number;
};
function EpiTab({ empId, epis, emp, company, role, canEdit, canDelete, qc, docsOk, missingDocs }: any) {
  const { data: stockItems = [] } = useQuery({
    queryKey: ["estoque_epi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("id, codigo_material, nome_material, ca, quantidade_atual")
        .order("nome_material");
      if (error) throw error;
      return (data ?? []) as EstoqueRow[];
    },
  });

  type MotivoEntrega = "PRIMEIRA_ENTREGA" | "TROCA_DESGASTE" | "EMPRESTIMO" | "PERDA_EXTRAVIO";
  const MOTIVO_LABEL: Record<MotivoEntrega, string> = {
    PRIMEIRA_ENTREGA: "1ª Entrega",
    TROCA_DESGASTE: "Troca por desgaste/vencimento",
    EMPRESTIMO: "Empréstimo (uso temporário)",
    PERDA_EXTRAVIO: "Reposição por perda/extravio",
  };
  const MOTIVO_COLOR: Record<MotivoEntrega, string> = {
    PRIMEIRA_ENTREGA: "bg-gradient-to-br from-rose-700/80 to-rose-950/80 ring-1 ring-rose-400/40",
    TROCA_DESGASTE: "bg-gradient-to-br from-rose-600/70 to-rose-900/70 ring-1 ring-rose-300/30",
    EMPRESTIMO: "bg-gradient-to-br from-amber-700/80 to-rose-950/80 ring-1 ring-amber-400/40",
    PERDA_EXTRAVIO: "bg-gradient-to-br from-rose-500 to-rose-800 ring-1 ring-rose-300/50",
  };

  const [f, setF] = useState<{
    epi_id: string; ca: string; qtd: string; data_entrega: string;
    motivo_entrega: MotivoEntrega; data_devolucao_prevista: string;
    valor_unitario: string; observacoes: string;
  }>({
    epi_id: "", ca: "", qtd: "1", data_entrega: new Date().toISOString().slice(0, 10),
    motivo_entrega: "PRIMEIRA_ENTREGA", data_devolucao_prevista: "",
    valor_unitario: "", observacoes: "",
  });
  const selected = stockItems.find((s) => s.id === f.epi_id) ?? null;
  const MOTIVOS_DEV = ["Danificado", "Desgaste Natural", "Extravio", "Mal Uso", "Furto", "Uso Temporário"];
  const [substitution, setSubstitution] = useState<{ prev: any; candidates: any[]; motivo: string; data: string; obs: string } | null>(null);

  // Alerta de reincidência: mesmo EPI entregue ao colaborador nos últimos 30 dias
  const reincidencia = (() => {
    if (!selected) return null;
    const norm = (s: any) => String(s ?? "").trim().toLowerCase();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ant = (epis ?? []).find(
      (e: any) => norm(e.item) === norm(selected.nome_material) && new Date(e.data_entrega).getTime() >= cutoff,
    );
    return ant ?? null;
  })();

  function resetForm() {
    setF({
      epi_id: "", ca: "", qtd: "1", data_entrega: new Date().toISOString().slice(0, 10),
      motivo_entrega: "PRIMEIRA_ENTREGA", data_devolucao_prevista: "",
      valor_unitario: "", observacoes: "",
    });
  }

  /** Cria registro na ficha do colaborador + dá baixa no estoque (RPC). */
  async function insertNewDelivery() {
    if (!selected) throw new Error("Selecione um EPI do estoque");
    const qtd = Math.max(1, Number(f.qtd) || 1);
    if ((selected.quantidade_atual ?? 0) < qtd) {
      throw new Error(`Saldo insuficiente no estoque SESMT (atual: ${selected.quantidade_atual})`);
    }
    // 1) baixa atômica no estoque + log em historico_entregas
    const { error: rpcErr } = await supabase.rpc("registrar_entrega_epi", {
      _epi_id: selected.id,
      _cpf: emp?.cpf ?? "",
      _nome: emp?.nome ?? "",
      _qtd: qtd,
    });
    if (rpcErr) throw rpcErr;
    // 2) registro na ficha do colaborador
    const valor = f.valor_unitario ? Number(String(f.valor_unitario).replace(",", ".")) : null;
    const { error } = await supabase.from("epi_deliveries").insert({
      employee_id: empId,
      item: selected.nome_material,
      ca: (f.ca || selected.ca) || null,
      tamanho: null,
      qtd,
      data_entrega: f.data_entrega,
      motivo_entrega: f.motivo_entrega,
      data_devolucao_prevista: f.motivo_entrega === "EMPRESTIMO" && f.data_devolucao_prevista
        ? f.data_devolucao_prevista : null,
      valor_unitario: valor,
      observacoes: f.observacoes || null,
    } as any);
    if (error) throw error;

    // 3) Se for perda/extravio, gera termo de responsabilidade automaticamente
    if (f.motivo_entrega === "PERDA_EXTRAVIO") {
      const { fname, bytes } = openTermoPerdaPdf({
        emp, company, role,
        item: selected.nome_material,
        ca: (f.ca || selected.ca) || null,
        qtd,
        valor_unitario: valor,
        data_entrega: f.data_entrega,
        observacoes: f.observacoes,
        assinaturaColaboradorDataUrl: (emp as any)?.assinatura_url ?? null,
      });
      // Em vez de openFileViewer, usamos o PdfSignerDialog para ver e poder salvar
      setSignerSrc({ bytes, name: fname, modulo: "termo_perda", referenciaId: undefined });
    }
  }

  const create = useMutation({
    mutationFn: insertNewDelivery,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      resetForm();
      toast.success("Entrega registrada e estoque atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const substituteMut = useMutation({
    mutationFn: async () => {
      if (!substitution) return;
      const obs = `Motivo: ${substitution.motivo}${substitution.obs ? ` — ${substitution.obs}` : ""}`;
      const { error: upErr } = await supabase
        .from("epi_deliveries")
        .update({ data_devolucao: substitution.data, observacoes: obs })
        .eq("id", substitution.prev.id);
      if (upErr) throw upErr;
      // devolve o anterior ao estoque (se identificado)
      const prevItem = stockItems.find((s) => s.nome_material === substitution.prev.item);
      if (prevItem) {
        await supabase.rpc("registrar_movimentacao_epi", {
          _epi_id: prevItem.id,
          _qtd: Number(substitution.prev.qtd) || 1,
          _tipo: "DEVOLUCAO",
          _cpf: emp?.cpf ?? "",
          _nome: emp?.nome ?? "",
        });
      }
      await insertNewDelivery();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      resetForm();
      setSubstitution(null);
      toast.success("Substituição registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function submitDelivery() {
    if (!selected) return;
    // Só dispara o fluxo de substituição para "troca por desgaste".
    // Empréstimo, perda e 1ª entrega seguem direto (registram nova entrega).
    if (f.motivo_entrega === "TROCA_DESGASTE") {
      const norm = (s: any) => String(s ?? "").trim().toLowerCase();
      const ativos = (epis ?? []).filter((e: any) => !e.data_devolucao);
      if (ativos.length === 0) {
        toast.error(
          "Este colaborador não possui nenhum EPI ativo para substituir. Se for a primeira vez que ele recebe este item, use '1ª Entrega'.",
        );
        return;
      }
      // pré-seleciona o item de mesmo nome, se houver
      const prev =
        ativos.find((e: any) => norm(e.item) === norm(selected.nome_material)) ?? ativos[0];
      setSubstitution({
        prev,
        candidates: ativos,
        motivo: "Desgaste Natural",
        data: f.data_entrega,
        obs: "",
      });
      return;
    }
    create.mutate();
  }

  const del = useMutation({
    mutationFn: async (id: string) => {
      const target = (epis ?? []).find((e: any) => e.id === id);
      const { error } = await supabase.from("epi_deliveries").delete().eq("id", id);
      if (error) throw error;
      if (target && !target.data_devolucao) {
        const stockRow = stockItems.find((s) => s.nome_material === target.item);
        if (stockRow) {
          await supabase.rpc("registrar_movimentacao_epi", {
            _epi_id: stockRow.id,
            _qtd: Number(target.qtd) || 1,
            _tipo: "DEVOLUCAO",
            _cpf: emp?.cpf ?? "",
            _nome: emp?.nome ?? "",
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [returning, setReturning] = useState<any | null>(null);
  const [retForm, setRetForm] = useState<{ motivo: string; data: string; obs: string }>({
    motivo: "Desgaste Natural", data: new Date().toISOString().slice(0, 10), obs: "",
  });
  function openReturn(item: any) {
    setRetForm({ motivo: "Desgaste Natural", data: new Date().toISOString().slice(0, 10), obs: "" });
    setReturning(item);
  }

  const returnMut = useMutation({
    mutationFn: async () => {
      if (!returning) return;
      const obs = `Motivo: ${retForm.motivo}${retForm.obs ? ` — ${retForm.obs}` : ""}`;
      const { error } = await supabase
        .from("epi_deliveries")
        .update({ data_devolucao: retForm.data, observacoes: obs })
        .eq("id", returning.id);
      if (error) throw error;
      const stockRow = stockItems.find((s) => s.nome_material === returning.item);
      if (stockRow) {
        await supabase.rpc("registrar_movimentacao_epi", {
          _epi_id: stockRow.id,
          _qtd: Number(returning.qtd) || 1,
          _tipo: "DEVOLUCAO",
          _cpf: emp?.cpf ?? "",
          _nome: emp?.nome ?? "",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Devolução registrada");
      setReturning(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const undoReturn = useMutation({
    mutationFn: async (id: string) => {
      const target = (epis ?? []).find((e: any) => e.id === id);
      const { error } = await supabase
        .from("epi_deliveries")
        .update({ data_devolucao: null, observacoes: null })
        .eq("id", id);
      if (error) throw error;
      if (target) {
        const stockRow = stockItems.find((s) => s.nome_material === target.item);
        if (stockRow) {
          await supabase.rpc("registrar_entrega_epi", {
            _epi_id: stockRow.id,
            _cpf: emp?.cpf ?? "",
            _nome: emp?.nome ?? "",
            _qtd: Number(target.qtd) || 1,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Devolução desfeita");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ===== Cenário "Não devolvido" — fecha entrega como perda/extravio
  // (não retorna ao estoque, gera Termo de Perda)
  const [notReturning, setNotReturning] = useState<any | null>(null);
  const [nrForm, setNrForm] = useState<{ data: string; valor: string; obs: string }>({
    data: new Date().toISOString().slice(0, 10), valor: "", obs: "",
  });
  function openNotReturned(item: any) {
    setNrForm({ data: new Date().toISOString().slice(0, 10), valor: item.valor_unitario ? String(item.valor_unitario).replace(".", ",") : "", obs: "" });
    setNotReturning(item);
  }
  const notReturnMut = useMutation({
    mutationFn: async () => {
      if (!notReturning) return;
      const valor = nrForm.valor ? Number(String(nrForm.valor).replace(",", ".")) : null;
      const obsHeader = `NÃO DEVOLVIDO — perda/extravio${nrForm.obs ? ` — ${nrForm.obs}` : ""}`;
      const { error } = await supabase
        .from("epi_deliveries")
        .update({
          data_devolucao: nrForm.data,
          observacoes: obsHeader,
          motivo_entrega: "PERDA_EXTRAVIO",
          valor_unitario: valor ?? notReturning.valor_unitario ?? null,
        } as any)
        .eq("id", notReturning.id);
      if (error) throw error;
      // gera termo de perda
      const { fname, bytes } = openTermoPerdaPdf({
        emp, company, role,
        item: notReturning.item,
        ca: notReturning.ca ?? null,
        qtd: Number(notReturning.qtd) || 1,
        valor_unitario: valor ?? notReturning.valor_unitario ?? null,
        data_entrega: notReturning.data_entrega,
        observacoes: nrForm.obs || "Item não devolvido pelo colaborador.",
      });
      setSignerSrc({ bytes, name: fname, modulo: "termo_perda", referenciaId: notReturning.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Marcado como não devolvido. Termo gerado.");
      setNotReturning(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function gerarFicha() {
    if (!epis?.length) {
      toast.error("Sem entregas registradas — nada a assinar.");
      return;
    }
    const { data: existing, error: existingErr } = await supabase
      .from("documentos_assinados")
      .select("id, pdf_assinado_path, nome_arquivo")
      .eq("modulo", "ficha-epi")
      .eq("referencia_id", empId)
      .not("pdf_assinado_path", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingErr) {
      toast.error("Falha ao consultar ficha assinada: " + existingErr.message);
      return;
    }
    if (existing?.pdf_assinado_path) {
      setSignerSrc({
        bytes: existing.pdf_assinado_path,
        name: existing.nome_arquivo ?? `Ficha_EPI_${(emp?.nome ?? "colaborador").replace(/\s+/g, "_")}.pdf`,
        modulo: "ficha-epi",
        referenciaId: empId,
        documentId: existing.id,
      });
      return;
    }
    if (!docsOk) {
      toast.warning(`Atenção: documentação pendente (${(missingDocs ?? []).join(", ")}). Ficha emitida mesmo assim.`);
    }
    const doc = buildEpiFichaPdf({ emp, company, role, epis });
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    const fname = `Ficha_EPI_${(emp?.nome ?? "colaborador").replace(/\s+/g, "_")}.pdf`;
    setSignerSrc({ bytes, name: fname, modulo: "ficha-epi", referenciaId: empId });
  }

  const [signerSrc, setSignerSrc] = useState<{
    bytes: Uint8Array | string;
    name: string;
    modulo?: string;
    referenciaId?: string;
    documentId?: string;
  } | null>(null);

  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-black uppercase tracking-wider text-brand">Controle de EPIs</h2>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-1">
            Itens vinculados ao Estoque SESMT — saída automática ao registrar entrega
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => gerarFicha()}
            title="Visualizar e Assinar Ficha de EPI"
            className="bg-gradient-to-br from-rose-600/90 via-rose-800/90 to-rose-950/90 hover:from-rose-500 hover:to-rose-900 text-rose-50 font-black uppercase tracking-widest text-xs ring-1 ring-rose-400/40 shadow-[0_0_24px_rgba(244,80,110,0.35)]"
            size="lg"
          >
            <Printer className="h-4 w-4 mr-2" /> Ficha em PDF
          </Button>
          {(() => {
            const perdas = (epis ?? []).filter((e: any) => e.motivo_entrega === "PERDA_EXTRAVIO");
            const abrirTermo = async (p: any) => {
              // 1) Tenta reabrir um termo já assinado para esta perda
              const { data: existing } = await supabase
                .from("documentos_assinados")
                .select("id, pdf_assinado_path, nome_arquivo")
                .eq("modulo", "termo_perda")
                .eq("referencia_id", p.id)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (existing?.pdf_assinado_path) {
                const { data: signed, error: sErr } = await supabase
                  .storage.from("sesmt-docs")
                  .createSignedUrl(existing.pdf_assinado_path, 3600);
                if (!sErr && signed?.signedUrl) {
                  const buf = await fetch(signed.signedUrl).then(r => r.arrayBuffer());
                  setSignerSrc({
                    bytes: new Uint8Array(buf),
                    name: existing.nome_arquivo ?? "Termo_Perda.pdf",
                    modulo: "termo_perda",
                    referenciaId: p.id,
                    documentId: existing.id,
                  });
                  return;
                }
              }
              // 2) Caso contrário, gera um termo novo (em branco)
              const { fname, bytes } = openTermoPerdaPdf({
                emp, company, role,
                item: p.item, ca: p.ca, qtd: p.qtd,
                valor_unitario: p.valor_unitario,
                data_entrega: p.data_entrega,
                observacoes: p.observacoes,
              });
              setSignerSrc({
                bytes, name: fname,
                modulo: "termo_perda",
                referenciaId: p.id,
              });
            };
            if (perdas.length === 0) {
              return (
                <Button
                  onClick={() => toast.info("Não há registros de perda/extravio para este colaborador.")}
                  variant="outline"
                  className="border-rose-200 text-rose-400 hover:bg-rose-50 font-black uppercase tracking-widest text-xs"
                  size="lg"
                >
                  <FileWarning className="h-4 w-4 mr-2" /> Termo de Perda
                </Button>
              );
            }
            if (perdas.length === 1) {
              return (
                <Button
                  onClick={() => abrirTermo(perdas[0])}
                  variant="outline"
                  className="border-rose-600 text-rose-600 hover:bg-rose-50 font-black uppercase tracking-widest text-xs"
                  size="lg"
                >
                  <FileWarning className="h-4 w-4 mr-2" /> Termo de Perda
                </Button>
              );
            }
            // 2+ perdas → dropdown com histórico
            const ordenadas = [...perdas].sort((a, b) =>
              (b.data_entrega ?? "").localeCompare(a.data_entrega ?? "")
            );
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-rose-600 text-rose-600 hover:bg-rose-50 font-black uppercase tracking-widest text-xs"
                    size="lg"
                  >
                    <FileWarning className="h-4 w-4 mr-2" />
                    Termo de Perda
                    <Badge className="ml-2 bg-rose-600 text-white text-[10px] px-1.5 py-0">{perdas.length}</Badge>
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {perdas.length} extravios registrados
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ordenadas.map((p: any) => {
                    const valorTotal = (Number(p.valor_unitario) || 0) * (Number(p.qtd) || 1);
                    return (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => abrirTermo(p)}
                        className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="font-bold text-xs text-slate-800 truncate">{p.item}</span>
                          <span className="text-[10px] font-black text-rose-600 shrink-0">
                            R$ {valorTotal.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{formatDateBR(p.data_entrega)}</span>
                          <span>•</span>
                          <span>QTD {p.qtd}</span>
                          {p.ca && <><span>•</span><span>CA {p.ca}</span></>}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-[9px] text-slate-400 italic">
                    Termos assinados ficam arquivados na seção "Documentos Assinados" abaixo.
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
        </div>
      </Card>

      {canEdit && (
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="h-4 w-4 text-brand" />
            <h3 className="text-xs font-black uppercase tracking-widest text-brand">Registrar entrega de EPI</h3>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); submitDelivery(); }} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-12 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da entrega</Label>
              <Select
                value={f.motivo_entrega}
                onValueChange={(v) => setF({ ...f, motivo_entrega: v as MotivoEntrega })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMEIRA_ENTREGA">🟢 1ª Entrega — colaborador nunca recebeu este item</SelectItem>
                  <SelectItem value="TROCA_DESGASTE">🔵 Troca por desgaste / vencimento — substitui o anterior</SelectItem>
                  <SelectItem value="EMPRESTIMO">🟡 Empréstimo — uso temporário, com previsão de devolução</SelectItem>
                  <SelectItem value="PERDA_EXTRAVIO">🔴 Reposição por perda / extravio — gera termo de responsabilidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reincidencia && f.motivo_entrega === "PRIMEIRA_ENTREGA" && (
              <div className="md:col-span-12 rounded-lg border-2 border-amber-300 bg-amber-50 p-3 flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <div className="font-black uppercase tracking-wider">Atenção: possível reincidência</div>
                  <div className="mt-0.5">
                    Este colaborador já recebeu <strong>{reincidencia.item}</strong> em{" "}
                    <strong>{formatDateBR(reincidencia.data_entrega)}</strong>{" "}
                    ({Math.floor((Date.now() - new Date(reincidencia.data_entrega).getTime()) / 86400000)} dias atrás).
                    Verifique se o motivo correto não é <em>Troca</em>, <em>Empréstimo</em> ou <em>Perda</em>.
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-6 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descrição do EPI (do estoque SESMT)</Label>
              <Select
                value={f.epi_id}
                onValueChange={(v) => {
                  const prod = stockItems.find((s) => s.id === v);
                  setF({ ...f, epi_id: v, ca: prod?.ca ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={stockItems.length ? "Selecione um EPI…" : "Nenhum item cadastrado no Estoque SESMT"} />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">Cadastre itens no Painel de Estoque SESMT</div>
                  ) : (
                    stockItems.map((s) => (
                      <SelectItem key={s.id} value={s.id} disabled={(s.quantidade_atual ?? 0) <= 0}>
                        {s.nome_material} {s.ca ? `(CA ${s.ca})` : ""} — saldo: {s.quantidade_atual}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">C.A.</Label>
              <Input value={f.ca} onChange={(e) => setF({ ...f, ca: e.target.value })} placeholder="—" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entrega</Label>
              <Input type="date" value={f.data_entrega} onChange={(e) => setF({ ...f, data_entrega: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">QTD</Label>
              <Input type="number" min="1" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} />
            </div>

            {f.motivo_entrega === "EMPRESTIMO" && (
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  <Clock className="h-3 w-3 inline mr-1" /> Devolução prevista
                </Label>
                <Input
                  type="date"
                  value={f.data_devolucao_prevista}
                  onChange={(e) => setF({ ...f, data_devolucao_prevista: e.target.value })}
                  className="border-amber-300"
                  required
                />
              </div>
            )}

            {f.motivo_entrega === "PERDA_EXTRAVIO" && (
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-rose-700">
                  Valor unitário (p/ termo) R$
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={f.valor_unitario}
                  onChange={(e) => setF({ ...f, valor_unitario: e.target.value })}
                  className="border-rose-300"
                />
              </div>
            )}

            {(f.motivo_entrega === "EMPRESTIMO" || f.motivo_entrega === "PERDA_EXTRAVIO") && (
              <div className="md:col-span-12 space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Observações {f.motivo_entrega === "PERDA_EXTRAVIO" && "(será impressa no termo)"}
                </Label>
                <Textarea
                  rows={2}
                  value={f.observacoes}
                  onChange={(e) => setF({ ...f, observacoes: e.target.value })}
                  placeholder={
                    f.motivo_entrega === "EMPRESTIMO"
                      ? "Ex: empréstimo para visita técnica do dia X"
                      : "Ex: B.O. nº 1234, perda no canteiro de obras…"
                  }
                />
              </div>
            )}

            <div className="md:col-span-12 flex justify-end">
              <Button
                type="submit"
                disabled={create.isPending || !f.epi_id || (f.motivo_entrega === "EMPRESTIMO" && !f.data_devolucao_prevista)}
                className={
                  f.motivo_entrega === "PERDA_EXTRAVIO" ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : f.motivo_entrega === "EMPRESTIMO" ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-brand text-white"
                }
              >
                {f.motivo_entrega === "PERDA_EXTRAVIO" ? <FileWarning className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {f.motivo_entrega === "PERDA_EXTRAVIO" ? "Registrar e gerar termo de perda"
                : f.motivo_entrega === "EMPRESTIMO" ? "Registrar empréstimo"
                : "Registrar entrega"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {(() => {
        const emprestimos = (epis ?? []).filter(
          (e: any) => e.motivo_entrega === "EMPRESTIMO" && !e.data_devolucao,
        );
        if (!emprestimos.length) return null;
        return (
          <Card className="p-5 rounded-2xl border-amber-300 bg-amber-50/40">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-amber-700" />
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-800">
                EPIs emprestados — aguardando devolução ({emprestimos.length})
              </h3>
            </div>
            <div className="space-y-2">
              {emprestimos.map((e: any) => {
                const venc = e.data_devolucao_prevista
                  ? Math.floor((new Date(e.data_devolucao_prevista).getTime() - Date.now()) / 86400000)
                  : null;
                const atrasado = venc !== null && venc < 0;
                return (
                  <div key={e.id} className={`flex items-center gap-3 p-3 rounded-xl border ${atrasado ? "border-rose-300 bg-rose-50" : "border-amber-200 bg-white"}`}>
                    <Clock className={`h-5 w-5 ${atrasado ? "text-rose-600" : "text-amber-600"} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-slate-800 uppercase">{e.item} <span className="text-xs text-slate-500">(QTD: {e.qtd})</span></div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                        Entregue em {formatDateBR(e.data_entrega)} • Devolução prevista: {e.data_devolucao_prevista ? formatDateBR(e.data_devolucao_prevista) : "—"}
                        {venc !== null && (
                          <span className={`ml-2 ${atrasado ? "text-rose-700" : "text-amber-700"}`}>
                            ({atrasado ? `${Math.abs(venc)}d em atraso` : `faltam ${venc}d`})
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => openReturn(e)} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Receber de volta
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      <Card className="p-5 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-slate-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Histórico de EPIs recebidos</h3>
        </div>
        {epis.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">Nenhum EPI entregue</div>
        )}
        <div className="space-y-2">
          {epis.map((e: any) => (
            <div
              key={e.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition backdrop-blur-md ${e.data_devolucao ? "border-amber-400/25 bg-gradient-to-br from-amber-950/40 via-rose-950/40 to-black/60" : "border-rose-400/20 bg-gradient-to-br from-rose-950/50 via-[#1a0810]/70 to-black/70 hover:from-rose-900/60 hover:to-rose-950/70 hover:border-rose-400/40 hover:shadow-[0_0_20px_rgba(244,80,110,0.25)]"}`}
            >
              <div className="h-10 w-10 rounded-lg bg-black/40 border border-rose-400/20 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(244,80,110,0.25)_inset]">
                <HardHat className="h-5 w-5 text-rose-300 drop-shadow-[0_0_6px_rgba(244,80,110,0.7)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-rose-50 uppercase">{e.item}</span>
                  {e.tamanho && <span className="text-xs text-rose-200/70">({e.tamanho})</span>}
                  <Badge className="text-[10px] bg-gradient-to-br from-rose-900/70 to-black/70 text-rose-100 ring-1 ring-rose-400/30">QTD: {e.qtd}</Badge>
                  {e.motivo_entrega && (
                    <Badge className={`${MOTIVO_COLOR[e.motivo_entrega as MotivoEntrega] ?? "bg-slate-500"} text-white text-[10px]`}>
                      {MOTIVO_LABEL[e.motivo_entrega as MotivoEntrega] ?? e.motivo_entrega}
                    </Badge>
                  )}
                  {e.data_devolucao ? (
                    <Badge className="bg-gradient-to-br from-amber-600/80 to-rose-900/80 text-amber-50 text-[10px] ring-1 ring-amber-300/40">DEVOLVIDO</Badge>
                  ) : (
                    <Badge className="bg-gradient-to-br from-rose-600/80 to-rose-950/80 text-rose-50 text-[10px] ring-1 ring-rose-300/40 shadow-[0_0_10px_rgba(244,80,110,0.45)]">EM USO</Badge>
                  )}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-rose-200/60 mt-0.5">
                  C.A.: {e.ca ?? "N/A"} • Entregue em: <span className="text-rose-100">{formatDateBR(e.data_entrega)}</span>
                  {e.data_devolucao && (
                    <> • Devolvido em: <span className="text-amber-300">{formatDateBR(e.data_devolucao)}</span></>
                  )}
                </div>
                {e.data_devolucao && e.observacoes && (
                  <div className="text-[11px] text-amber-200/80 mt-0.5 normal-case">{e.observacoes}</div>
                )}
              </div>
              {canEdit && !e.data_devolucao && (
                <>
                  <Button size="sm" variant="outline" onClick={() => openReturn(e)} className="border-amber-400/40 bg-black/30 text-amber-200 hover:bg-amber-900/30 hover:text-amber-100">
                    <Undo2 className="h-4 w-4 mr-1" /> Devolver
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openNotReturned(e)} className="border-rose-400/40 bg-black/30 text-rose-200 hover:bg-rose-900/30 hover:text-rose-100" title="Marcar como não devolvido (perda/extravio)">
                    <Ban className="h-4 w-4 mr-1" /> Não devolvido
                  </Button>
                </>
              )}
              {canEdit && e.data_devolucao && (
                <Button size="sm" variant="ghost" onClick={() => undoReturn.mutate(e.id)} title="Desfazer devolução">
                  <CheckCircle2 className="h-4 w-4 text-rose-300" />
                </Button>
              )}
              {canDelete && (
                <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!returning} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-amber-600" />
              Devolução de EPI
            </DialogTitle>
          </DialogHeader>
          {returning && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-black uppercase text-slate-700">{returning.item}</div>
                <div className="text-slate-500 mt-0.5">QTD: {returning.qtd} • Entregue em {formatDateBR(returning.data_entrega)}</div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da devolução</Label>
                <Select value={retForm.motivo} onValueChange={(v) => setRetForm({ ...retForm, motivo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DEV.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data da devolução</Label>
                <Input type="date" value={retForm.data} onChange={(e) => setRetForm({ ...retForm, data: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações (opcional)</Label>
                <Textarea rows={3} value={retForm.obs} onChange={(e) => setRetForm({ ...retForm, obs: e.target.value })} placeholder="Detalhes adicionais sobre a devolução…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReturning(null)}>Cancelar</Button>
            <Button onClick={() => returnMut.mutate()} disabled={returnMut.isPending || !retForm.data || !retForm.motivo} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Undo2 className="h-4 w-4 mr-2" /> Registrar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!substitution} onOpenChange={(o) => !o && setSubstitution(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-amber-600" />
              Substituição de EPI
            </DialogTitle>
          </DialogHeader>
          {substitution && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                Para registrar uma <strong>troca por desgaste</strong>, escolha qual EPI ativo está sendo substituído.
                O item antigo será baixado automaticamente com o motivo informado.
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  EPI antigo sendo substituído
                </Label>
                <Select
                  value={substitution.prev?.id ?? ""}
                  onValueChange={(v) => {
                    const novo = substitution.candidates.find((c) => c.id === v);
                    if (novo) setSubstitution({ ...substitution, prev: novo });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o EPI antigo" /></SelectTrigger>
                  <SelectContent>
                    {substitution.candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.item} {c.ca ? `(CA ${c.ca})` : ""} — entregue em {c.data_entrega?.split("-").reverse().join("/")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">
                  Listando todos os EPIs ativos deste colaborador. Pré-selecionado: item de mesmo nome do novo, se houver.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da substituição</Label>
                <Select value={substitution.motivo} onValueChange={(v) => setSubstitution({ ...substitution, motivo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DEV.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data da devolução do anterior</Label>
                <Input type="date" value={substitution.data} onChange={(e) => setSubstitution({ ...substitution, data: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações (opcional)</Label>
                <Textarea rows={3} value={substitution.obs} onChange={(e) => setSubstitution({ ...substitution, obs: e.target.value })} placeholder="Detalhes adicionais (ex: B.O. do furto, etc.)" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubstitution(null)}>Cancelar</Button>
            <Button onClick={() => substituteMut.mutate()} disabled={substituteMut.isPending || !substitution?.data || !substitution?.motivo} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Confirmar substituição e entregar novo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!notReturning} onOpenChange={(o) => !o && setNotReturning(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-rose-600" />
              Marcar EPI como não devolvido
            </DialogTitle>
          </DialogHeader>
          {notReturning && (
            <div className="space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                <strong>Atenção:</strong> esta ação registra <strong>perda/extravio</strong> do item{" "}
                <strong className="uppercase">{notReturning.item}</strong>. O EPI <u>não retorna ao estoque</u> e
                será gerado um <strong>Termo de Responsabilidade por Perda</strong> para assinatura do colaborador
                (base para desconto em folha conforme NR-06 / Art. 462 CLT).
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data do registro</Label>
                  <Input type="date" value={nrForm.data} onChange={(e) => setNrForm({ ...nrForm, data: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Valor unitário (R$)</Label>
                  <Input inputMode="decimal" placeholder="0,00" value={nrForm.valor} onChange={(e) => setNrForm({ ...nrForm, valor: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações (impressas no termo)</Label>
                <Textarea rows={3} value={nrForm.obs} onChange={(e) => setNrForm({ ...nrForm, obs: e.target.value })} placeholder="Ex.: rescisão sem devolução, item perdido em obra, B.O. nº…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotReturning(null)}>Cancelar</Button>
            <Button onClick={() => notReturnMut.mutate()} disabled={notReturnMut.isPending} className="bg-rose-600 hover:bg-rose-700 text-white">
              <FileWarning className="h-4 w-4 mr-2" /> Confirmar e gerar termo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {signerSrc && (
        <Suspense fallback={null}>
          <PdfSignerDialog
            open={!!signerSrc}
            onClose={() => setSignerSrc(null)}
            source={signerSrc?.bytes ?? null}
            nomeArquivo={signerSrc?.name ?? "ficha-epi.pdf"}
            modulo={signerSrc?.modulo ?? "ficha-epi"}
            referenciaId={signerSrc?.referenciaId ?? empId}
            documentId={signerSrc?.documentId}
          />
        </Suspense>
      )}
    </div>
  );
}
/* ============ HEALTH ============ */
const NATUREZA_LABELS: { key: "ADMISSIONAL" | "PERIODICO" | "RETORNO_TRABALHO" | "MUDANCA_RISCO" | "DEMISSIONAL" | "SEMESTRAL"; label: string }[] = [
  { key: "ADMISSIONAL", label: "Admissional" },
  { key: "PERIODICO", label: "Periódico" },
  { key: "SEMESTRAL", label: "Semestral" },
  { key: "RETORNO_TRABALHO", label: "Retorno ao Trabalho" },
  { key: "MUDANCA_RISCO", label: "Mudança de Risco Ocupacional" },
  { key: "DEMISSIONAL", label: "Demissional" },
];

function HealthTab({ empId, exams, role, canEdit, canDelete, qc }: any) {
  const [f, setF] = useState<any>({
    tipo_exame: "ASO Clínico", natureza: "Periódico", periodicidade_meses: 12,
    data_realizacao: new Date().toISOString().slice(0, 10), data_vencimento: addMonthsToDate(new Date().toISOString().slice(0, 10), 12),
    aptidao: "SIM", observacoes: "",
  });
  const [examFile, setExamFile] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const venc = f.data_vencimento || addMonthsToDate(f.data_realizacao, Number(f.periodicidade_meses) || 12);
      let anexo_path: string | null = null;
      if (examFile) {
        const path = `${empId}/exames/${Date.now()}_${examFile.name}`;
        const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, examFile, { upsert: false });
        if (upErr) throw upErr;
        anexo_path = path;
      }
      const { error } = await supabase.from("employee_exams").insert({
        employee_id: empId, tipo_exame: f.tipo_exame, natureza: f.natureza,
        periodicidade_meses: Number(f.periodicidade_meses) || 12,
        data_realizacao: f.data_realizacao, data_vencimento: venc,
        aptidao: f.aptidao, observacoes: f.observacoes || null, anexo_path,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", empId] }); qc.invalidateQueries({ queryKey: ["employee", empId] }); setExamFile(null); toast.success("Exame registrado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (ex: any) => {
      if (ex.anexo_path) await supabase.storage.from("employee-docs").remove([ex.anexo_path]);
      const { error } = await supabase.from("employee_exams").delete().eq("id", ex.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", empId] }); toast.success("Removido"); },
  });

  async function openExam(path: string) {
    await openStorageFile("employee-docs", path);
  }

  // ===== Aptidão por Natureza/Risco (PCMSO/ISO 9001) =====
  const exMatrix: Record<string, string[]> = role?.exames_por_natureza ?? {};
  const riscos = role?.riscos ?? {};
  const today = new Date().toISOString().slice(0, 10);

  // último exame por (natureza-key + tipo)
  function latestFor(naturezaKey: string, tipo: string) {
    const list = (exams ?? []).filter((ex: any) => {
      const k = NATUREZA_KEY_MAP[ex.natureza] ?? null;
      return k === naturezaKey && (ex.tipo_exame || "").toLowerCase().includes(tipo.toLowerCase().split(" ")[0]);
    });
    if (!list.length) return null;
    return list.sort((a: any, b: any) => (b.data_realizacao || "").localeCompare(a.data_realizacao || ""))[0];
  }

  function statusForReq(naturezaKey: string, tipo: string) {
    const ex = latestFor(naturezaKey, tipo);
    if (!ex) return { state: "PENDENTE" as const, ex: null };
    if (ex.aptidao === "NÃO") return { state: "INAPTO" as const, ex };
    if (ex.data_vencimento && ex.data_vencimento < today) return { state: "VENCIDO" as const, ex };
    return { state: "OK" as const, ex };
  }

  function naturezaAptidao(naturezaKey: string, reqs: string[]) {
    if (!reqs.length) return "SEM_EXIGENCIA" as const;
    let pendente = false;
    for (const tipo of reqs) {
      const s = statusForReq(naturezaKey, tipo).state;
      if (s === "INAPTO") return "INAPTO" as const;
      if (s !== "OK") pendente = true;
    }
    return pendente ? "PENDENTE" : "APTO";
  }

  const todasCategoriasRisco: { key: string; label: string }[] = [
    { key: "acidente_mecanico", label: "Acidente / Mecânico" },
    { key: "fisicos", label: "Físicos" },
    { key: "quimicos", label: "Químicos" },
    { key: "biologicos", label: "Biológicos" },
    { key: "ergonomicos", label: "Ergonômicos" },
    { key: "psicossociais", label: "Psicossociais" },
  ];

  return (
    <Card className="p-6 space-y-6">
      {/* Painel PCMSO / ISO 9001 — Exigências do Cargo */}
      {role && (
        <div className="rounded-lg border-2 border-brand/30 bg-gradient-to-br from-brand/5 to-transparent p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-brand">Aptidão por Natureza · PCMSO/ISO 9001</span>
            {role.ghe && <Badge variant="outline" className="font-bold">GHE {role.ghe}</Badge>}
            {role.setor && <Badge variant="outline">{role.setor}</Badge>}
            {role.cbo && <Badge variant="outline">CBO {role.cbo}</Badge>}
            <span className="text-xs text-muted-foreground">· Cargo: <strong>{role.name}</strong></span>
          </div>

          {/* Riscos do GHE */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Riscos Ocupacionais do GHE</div>
            <div className="flex flex-wrap gap-1.5">
              {todasCategoriasRisco.map((cat) => {
                const items: string[] = riscos?.[cat.key] ?? [];
                if (!items.length) return null;
                return items.map((it) => (
                  <Badge key={`${cat.key}-${it}`} variant="secondary" className="text-[10px]">
                    <span className="opacity-60 mr-1">{cat.label}:</span>{it}
                  </Badge>
                ));
              })}
              {todasCategoriasRisco.every((c) => !(riscos?.[c.key]?.length)) && (
                <span className="text-xs text-muted-foreground italic">Sem riscos cadastrados no cargo.</span>
              )}
            </div>
            {riscos?.descricao && <div className="text-xs text-slate-600 italic">{riscos.descricao}</div>}
          </div>

          {/* Matriz de exames por natureza */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {NATUREZA_LABELS.map(({ key, label }) => {
              const reqs: string[] = exMatrix?.[key] ?? [];
              const apt = naturezaAptidao(key, reqs);
              const tone =
                apt === "APTO" ? "border-emerald-300 bg-emerald-50" :
                apt === "INAPTO" ? "border-rose-300 bg-rose-50" :
                apt === "PENDENTE" ? "border-amber-300 bg-amber-50" :
                "border-slate-200 bg-slate-50";
              const badge =
                apt === "APTO" ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />APTO</Badge> :
                apt === "INAPTO" ? <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />INAPTO</Badge> :
                apt === "PENDENTE" ? <Badge className="bg-amber-500 hover:bg-amber-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" />PENDENTE</Badge> :
                <Badge variant="outline">SEM EXIGÊNCIA</Badge>;
              return (
                <div key={key} className={`rounded-md border p-3 ${tone}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
                    {badge}
                  </div>
                  {reqs.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic">Nenhum procedimento exigido pelo cargo.</div>
                  ) : (
                    <ul className="space-y-1">
                      {reqs.map((tipo) => {
                        const s = statusForReq(key, tipo);
                        const icon =
                          s.state === "OK" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
                          s.state === "INAPTO" ? <Ban className="h-3.5 w-3.5 text-rose-600" /> :
                          s.state === "VENCIDO" ? <Clock className="h-3.5 w-3.5 text-amber-600" /> :
                          <AlertCircle className="h-3.5 w-3.5 text-slate-500" />;
                        const txt =
                          s.state === "OK" ? `válido até ${formatDateBR(s.ex.data_vencimento)}` :
                          s.state === "INAPTO" ? `INAPTO em ${formatDateBR(s.ex!.data_realizacao)}` :
                          s.state === "VENCIDO" ? `vencido em ${formatDateBR(s.ex!.data_vencimento)}` :
                          "não realizado";
                        return (
                          <li key={tipo} className="flex items-center gap-2 text-xs">
                            {icon}
                            <span className="font-medium">{tipo}</span>
                            <span className="text-slate-500">— {txt}</span>
                            {canEdit && s.state !== "OK" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] ml-auto"
                                onClick={() => setF((p: any) => ({ ...p, tipo_exame: TIPOS_EXAME.includes(tipo as any) ? tipo : p.tipo_exame, natureza: NATUREZA_LABELS.find(n => n.key === key)!.label }))}
                              >
                                Registrar
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end border-b pb-4">
          <Field label="Tipo">
            <Select value={f.tipo_exame} onValueChange={(v) => setF({ ...f, tipo_exame: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_EXAME.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Natureza">
            <Select value={f.natureza} onValueChange={(v) => setF({ ...f, natureza: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{NATUREZAS_EXAME.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Periodicidade (meses)"><Input type="number" min="1" value={f.periodicidade_meses} onChange={(e) => setF({ ...f, periodicidade_meses: e.target.value })} /></Field>
          <Field label="Aptidão">
            <Select value={f.aptidao} onValueChange={(v) => setF({ ...f, aptidao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIM">APTO</SelectItem>
                <SelectItem value="NÃO">INAPTO</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Realização"><Input type="date" value={f.data_realizacao} onChange={(e) => setF({ ...f, data_realizacao: e.target.value, data_vencimento: addMonthsToDate(e.target.value, Number(f.periodicidade_meses) || 12) })} /></Field>
          <Field label="Vencimento"><Input type="date" value={f.data_vencimento} onChange={(e) => setF({ ...f, data_vencimento: e.target.value })} /></Field>
          <Field label="PDF do exame/ASO" className="col-span-2">
            <div className="flex items-center gap-2">
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setExamFile(e.target.files?.[0] ?? null)} />
              {examFile && <Badge variant="outline" className="text-[10px]"><Upload className="h-3 w-3 mr-1" />{examFile.name}</Badge>}
            </div>
          </Field>
          <Field label="Observações" className="col-span-2 md:col-span-4"><Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field>
          <Button type="submit" className="col-span-2 md:col-span-4" disabled={create.isPending}><Plus className="h-4 w-4 mr-2" />Registrar exame</Button>
        </form>
      )}
      <Table>
        <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Natureza</TableHead><TableHead>Realização</TableHead><TableHead>Vencimento</TableHead><TableHead>Aptidão</TableHead><TableHead>PDF</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {exams.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum exame</TableCell></TableRow>}
          {exams.map((ex: any) => (
            <TableRow key={ex.id}>
              <TableCell className="font-medium">{ex.tipo_exame}</TableCell>
              <TableCell>{ex.natureza}</TableCell>
              <TableCell>{formatDateBR(ex.data_realizacao)}</TableCell>
              <TableCell>{formatDateBR(ex.data_vencimento)}</TableCell>
              <TableCell><Badge variant={ex.aptidao === "SIM" ? "default" : "destructive"}>{ex.aptidao === "SIM" ? "APTO" : "INAPTO"}</Badge></TableCell>
              <TableCell>
                {ex.anexo_path ? (
                  <Button size="sm" variant="ghost" onClick={() => openExam(ex.anexo_path)}><FileText className="h-4 w-4 mr-1" />Ver</Button>
                ) : <span className="text-xs text-red-500 font-bold">Sem PDF</span>}
              </TableCell>
              <TableCell className="text-right">
                {canDelete && <Button size="icon" variant="ghost" onClick={() => del.mutate(ex)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
function MatrizTab({ emp, canEdit }: { emp: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ course: MatrizCourse; entry?: MatrizEntry } | null>(null);

  const { data: courses = [] } = useQuery<MatrizCourse[]>({
    queryKey: ["matriz-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_matrix_courses").select("*").eq("ativo", true).order("ordem");
      if (error) throw error;
      return data as MatrizCourse[];
    },
  });
  const { data: roleCourses = [] } = useQuery<RoleCourse[]>({
    queryKey: ["matriz-role-courses"],
    queryFn: async () => (await supabase.from("training_matrix_role_courses").select("*")).data as RoleCourse[] ?? [],
  });
  const { data: entries = [] } = useQuery<MatrizEntry[]>({
    queryKey: ["matriz-entries", emp.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_matrix_entries").select("*").eq("employee_id", emp.id);
      if (error) throw error;
      return data as MatrizEntry[];
    },
  });

  const requiredIds = useMemo(
    () => requiredCourseIds({ role_id: emp.role_id }, roleCourses),
    [emp.role_id, roleCourses],
  );
  const entryByCourse = useMemo(() => {
    const m = new Map<string, MatrizEntry>();
    entries.forEach((e) => m.set(e.course_id, e));
    return m;
  }, [entries]);

  // Cursos exibidos: somente os obrigatórios pela função.
  // Histórico/manual fora da função não entra na matriz do funcionário.
  const cursosExibidos = useMemo(
    () => courses.filter((c) => requiredIds.has(c.id)),
    [courses, requiredIds],
  );

  const stats = useMemo(() => {
    const counts: Record<string, number> = { REALIZADO: 0, "A VENCER": 0, VENCIDO: 0, PENDENTE: 0, "EM ANDAMENTO": 0, "N/A": 0 };
    cursosExibidos.forEach((c) => {
      const st = computeStatus(entryByCourse.get(c.id), c);
      counts[st.label] = (counts[st.label] ?? 0) + 1;
    });
    const aderencia = cursosExibidos.length
      ? Math.round((counts.REALIZADO / cursosExibidos.length) * 100)
      : 0;
    return { counts, aderencia, total: cursosExibidos.length };
  }, [cursosExibidos, entryByCourse]);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-[#991b1b]" />
          <div>
            <div className="text-lg font-black text-slate-800">Matriz de Treinamento</div>
            <div className="text-xs text-slate-500">Cursos exigidos pela função e setor do funcionário</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-black text-emerald-600">{stats.aderencia}%</div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Aderência</div>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] font-bold uppercase">
            <span className="px-2 py-1 rounded border bg-emerald-100 text-emerald-700 border-emerald-300">Realiz: {stats.counts.REALIZADO}</span>
            <span className="px-2 py-1 rounded border bg-amber-100 text-amber-700 border-amber-300">A venc: {stats.counts["A VENCER"]}</span>
            <span className="px-2 py-1 rounded border bg-red-100 text-red-700 border-red-300">Pend/Venc: {stats.counts.VENCIDO + stats.counts.PENDENTE}</span>
          </div>
        </div>
      </div>

      {cursosExibidos.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl text-xs uppercase font-bold text-slate-400">
          Nenhum curso vinculado ao setor ({emp.setor ?? "—"}) ou função deste funcionário.<br />
          Configure em <strong>Matriz de Treinamento → Vincular Cursos</strong>.
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="w-32">Categoria</TableHead>
                <TableHead className="w-24">Periodic.</TableHead>
                <TableHead className="w-32">Realização</TableHead>
                <TableHead className="w-32">Vencimento</TableHead>
                <TableHead className="w-32">Status</TableHead>
                {canEdit && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cursosExibidos.map((c) => {
                const entry = entryByCourse.get(c.id);
                const st = computeStatus(entry, c);
                const cat = c.categoria ?? "NR";
                return (
                  <TableRow key={c.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-bold">{c.codigo}</TableCell>
                    <TableCell>{c.nome}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${CATEGORIA_COLOR[cat] ?? CATEGORIA_COLOR.OUTRO}`}>
                        {CATEGORIA_LABEL[cat] ?? cat}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs uppercase font-bold">{c.periodicidade}</TableCell>
                    <TableCell className="text-xs">{entry?.data_realizacao ? formatDateBR(entry.data_realizacao) : "—"}</TableCell>
                    <TableCell className="text-xs">{st.expira ? formatDateBR(st.expira) : "—"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded border text-[10px] font-black ${st.color}`}>{st.label}</span>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ course: c, entry })}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <MatrizEntryDialog
          empId={emp.id}
          course={editing.course}
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["matriz-entries", emp.id] }); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function MatrizEntryDialog({ empId, course, entry, onClose, onSaved }:
  { empId: string; course: MatrizCourse; entry?: MatrizEntry; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState(entry?.data_realizacao ?? "");
  const [stOver, setStOver] = useState(entry?.status_override ?? "AUTO");
  const [obs, setObs] = useState(entry?.observacao ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        employee_id: empId, course_id: course.id,
        data_realizacao: data || null,
        status_override: stOver === "AUTO" ? null : stOver,
        observacao: obs || null,
      };
      if (entry) {
        const { error } = await supabase.from("training_matrix_entries").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_matrix_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{course.codigo} — {course.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] uppercase font-black">Data de realização</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] uppercase font-black">Status (sobrescrever)</Label>
            <Select value={stOver} onValueChange={setStOver}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Automático</SelectItem>
                {STATUS_OVERRIDE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase font-black">Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// OssTab — Ordens de Serviço de Segurança do funcionário
// =====================================================
function OssTab({ empId, empNome }: { empId: string; empNome: string }) {
  const qc = useQueryClient();
  const { isEditor } = useAuth();

  const { data: emissoes = [], isLoading } = useQuery({
    queryKey: ["employee-oss", empId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oss_emissoes")
        .select("id, template_id, template_revisao, cargo_snapshot, status, motivo_emissao, emitido_em, assinado_em, expira_em, pdf_gerado_path, pdf_assinado_path, oss_templates(titulo, setor)")
        .eq("employee_id", empId)
        .order("emitido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const now = Date.now();
  const hasValidSigned = emissoes.some(
    (e: any) => e.status === "ASSINADO" && (!e.expira_em || new Date(e.expira_em).getTime() > now),
  );

  const STATUS_META: Record<string, { label: string; cls: string }> = {
    PENDENTE_ASSINATURA: { label: "Pendente assinatura", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    ASSINADO: { label: "Assinado", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    VENCIDO: { label: "Vencido", cls: "bg-red-100 text-red-800 border-red-300" },
    SUBSTITUIDO: { label: "Substituído", cls: "bg-slate-100 text-slate-600 border-slate-300" },
    CANCELADO: { label: "Cancelado", cls: "bg-red-50 text-red-700 border-red-200 line-through" },
  };

  function abrirPdf(em: any) {
    const path = em.pdf_assinado_path ?? em.pdf_gerado_path;
    if (!path) {
      toast.error("Esta OS ainda não tem PDF salvo no Storage. Use o módulo SESMT → OSS para emitir/anexar.");
      return;
    }
    const fname = `OS-${em.cargo_snapshot}-${empNome}.pdf`;
    openStorageFile("oss-pdfs", path, fname);
  }

  const uploadAssinado = useMutation({
    mutationFn: async ({ em, file }: { em: any; file: File }) => {
      const path = `${em.id}/${Date.now()}-assinado.pdf`;
      const { error: upErr } = await supabase.storage.from("oss-pdfs").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("oss_emissoes")
        .update({
          pdf_assinado_path: path,
          status: "ASSINADO",
          assinado_em: new Date().toISOString(),
        })
        .eq("id", em.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PDF assinado anexado");
      qc.invalidateQueries({ queryKey: ["employee-oss", empId] });
      qc.invalidateQueries({ queryKey: ["oss-valid", empId] });
      qc.invalidateQueries({ queryKey: ["oss-emissoes"] });
    },
    onError: (e: any) => toast.error("Erro no upload: " + e.message),
  });

  return (
    <div className="space-y-4">
      {!isLoading && !hasValidSigned && (
        <Card className="p-3 border-red-300 bg-red-50 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold text-red-800">Funcionário sem Ordem de Serviço assinada</div>
            <div className="text-xs text-red-700 mt-0.5">
              Risco trabalhista — NR-01 item 1.4.1 alínea "c". A OS é o documento formal de ciência dos riscos da função.
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-3 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-rose-600" />
            <span className="text-sm font-bold">Histórico de OS</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/oss">Ir para módulo OSS</Link>
          </Button>
        </div>
        {isLoading && <div className="p-6 text-sm text-slate-500">Carregando...</div>}
        {!isLoading && emissoes.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma OS emitida para este funcionário ainda.
            <div className="text-xs mt-2">
              Acesse <Link to="/app/oss" className="text-rose-600 underline">SESMT → OSS</Link> para emitir.
            </div>
          </div>
        )}
        {!isLoading && emissoes.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo / Cargo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Emitido</TableHead>
                <TableHead>Assinado</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emissoes.map((em: any) => {
                const meta = STATUS_META[em.status] ?? { label: em.status, cls: "" };
                return (
                  <TableRow key={em.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{em.oss_templates?.titulo ?? em.cargo_snapshot}</div>
                      <div className="text-[10px] text-slate-500">{em.cargo_snapshot} · Rev.{em.template_revisao}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${meta.cls} text-[10px]`}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDateBR(em.emitido_em.slice(0, 10))}</TableCell>
                    <TableCell className="text-xs">{em.assinado_em ? formatDateBR(em.assinado_em.slice(0, 10)) : "—"}</TableCell>
                    <TableCell className="text-xs">{em.expira_em ? formatDateBR(em.expira_em.slice(0, 10)) : "—"}</TableCell>
                    <TableCell className="text-[10px] text-slate-600">{String(em.motivo_emissao).replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirPdf(em)}
                          title={em.pdf_assinado_path ? "Visualizar / Imprimir / Baixar PDF assinado" : (em.pdf_gerado_path ? "Visualizar PDF (não assinado)" : "Sem PDF no Storage")}
                          disabled={!em.pdf_assinado_path && !em.pdf_gerado_path}
                        >
                          <FileIcon className="h-3.5 w-3.5 mr-1" />
                          {em.pdf_assinado_path ? "Ver assinada" : "Ver"}
                        </Button>
                        {isEditor && em.status === "PENDENTE_ASSINATURA" && (
                          <OssUploadAssinadoButton onPick={(f) => uploadAssinado.mutate({ em, file: f })} disabled={uploadAssinado.isPending} />
                        )}
                        <OssRowActions
                          em={em}
                          invalidateKeys={[["employee-oss", empId], ["oss-valid", empId], ["oss-emissoes"]]}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-3 text-[11px] text-slate-600 bg-slate-50">
        <strong>Onde fica o PDF assinado?</strong> No bucket <code>oss-pdfs</code> do Storage.
        Quando você clica em <em>Ver assinada</em>, o sistema abre o PDF dentro do próprio SIGMO
        com botões de impressão e download — sem precisar sair da ficha do funcionário.
      </Card>
    </div>
  );
}

function OssUploadAssinadoButton({ onPick, disabled }: { onPick: (f: File) => void; disabled?: boolean }) {
  const [key, setKey] = useState(0);
  return (
    <label className="inline-flex">
      <input
        key={key}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          setKey((k) => k + 1);
        }}
      />
      <Button asChild variant="outline" size="sm" disabled={disabled} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
        <span><Upload className="h-3.5 w-3.5 mr-1" />Anexar assinada</span>
      </Button>
    </label>
  );
}
