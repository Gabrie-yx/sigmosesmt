import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, Save, FileText, Printer, Check, ChevronLeft, ChevronRight, X, Search, ShieldAlert, Unlock, Info, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { gerarAPR, type APRPdfRisco, type APRPdfAssinatura } from "@/lib/apr-pdf";
import { DEFAULT_TEXTO_GERAIS } from "@/lib/apr-defaults";
import { formatDateBR } from "@/lib/utils-date";
import dmnLogo from "@/assets/dmn-logo.png";
import {
  detectarExigenciaPTE,
  detectarCategoriasPTE,
  CATEGORIA_PTE_TO_RISCO_LABEL,
  type CategoriaDetectada,
} from "@/lib/apr-pte-rules";
import { PteLookupSheet } from "@/components/aprs/pte-lookup-sheet";
import { hasGlobalOverride, type SafetyOverride } from "@/lib/safety-overrides";
import { useAuth } from "@/hooks/use-auth";
import { printPdf } from "@/lib/pdf-print";
import type jsPDF from "jspdf";

const PDFPreviewDialog = lazy(() =>
  import("@/components/pdf-preview-dialog").then((m) => ({ default: m.PDFPreviewDialog })),
);

/* ---------- tipos ---------- */
type APR = {
  id?: string; numero?: string;
  casco_id?: string | null; pte_id?: string | null;
  empresa_id?: string | null; encarregado_id?: string | null; tst_id?: string | null;
  local?: string | null; setor?: string | null;
  atividade_descricao: string;
  data_emissao: string;
  hora_inicio?: string | null; hora_fim?: string | null;
  hora_inicio_sexta?: string | null; hora_fim_sexta?: string | null;
  validade_dias: number; data_validade?: string | null;
  dias_semana?: string[] | null;
  condicoes_climaticas?: string | null; observacoes_gerais?: string | null;
  status: string; exige_pte: boolean;
  texto_gerais?: string | null;
};

type Risco = {
  id?: string; ordem: number;
  catalogo_risco_id?: string | null;
  risco_nome: string; risco_categoria?: string | null;
  efeitos_danos?: string | null;
  probabilidade: number; severidade: number; nivel_risco?: number;
  acoes_preventivas?: string | null;
  epis: string[]; nrs: string[];
  responsavel_acoes?: string | null;
  passo_a_passo?: string | null;
};

type Assin = {
  id?: string; papel: "EXECUTANTE" | "TST" | "ENCARREGADO";
  employee_id?: string | null;
  nome: string; cpf?: string | null; funcao?: string | null;
  ordem: number;
  assinou_em?: string | null;
};

function nivelMeta(n: number) {
  switch (n) {
    case 2: return { label: "TRIVIAL", cls: "bg-emerald-500" };
    case 3: return { label: "TOLERÁVEL", cls: "bg-lime-500" };
    case 4: return { label: "MODERADO", cls: "bg-yellow-500" };
    case 5: return { label: "SUBSTANCIAL", cls: "bg-orange-500" };
    case 6: return { label: "INACEITÁVEL", cls: "bg-red-600" };
    default: return { label: "—", cls: "bg-slate-400" };
  }
}

const emptyApr: APR = {
  atividade_descricao: "",
  data_emissao: new Date().toISOString().slice(0, 10),
  validade_dias: 7, status: "RASCUNHO", exige_pte: false,
  texto_gerais: DEFAULT_TEXTO_GERAIS,
  hora_inicio: "07:30", hora_fim: "17:30",
  hora_inicio_sexta: "07:30", hora_fim_sexta: "16:30",
  dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"],
};

const EMPTY_QUERY_LIST: [] = [];

/* ---------- componentes visuais (espelho do papel) ---------- */
const APR_RED = "#dc3545";
const APR_ORANGE = "#ff9900";

function PaperCell({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-black p-1.5 ${className}`}>
      <div className="text-[10px] font-bold uppercase text-slate-700 mb-0.5">{label}</div>
      {children}
    </div>
  );
}

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;

/* Cabeçalho COMPLETO homologado ISO 9001 — replicado exatamente do formulário oficial.
   Estrutura idêntica ao print: 4 linhas, mesmos campos, mesma ordem. */
function PaperFullHeader({
  apr, setApr, empresa, casco, enc, tst, employees, companies, pagina, totalPaginas = 4,
}: {
  apr: APR; setApr?: (a: APR) => void;
  empresa?: any; casco?: any; enc?: any; tst?: any;
  employees?: any[]; companies?: any[];
  pagina: number; totalPaginas?: number;
}) {
  const editable = !!setApr;
  const responsavel = empresa?.name ?? enc?.nome ?? "—";
  const elaboradoPor = tst?.nome ?? "—";
  return (
    <div className="border-2 border-black text-black bg-white text-[11px]">
      {/* Linha 1 — barra de marca + título + bloco ISO */}
      <div className="grid grid-cols-[110px_1fr_150px] border-b-2 border-black">
        <div className="border-r-2 border-black flex items-center justify-center p-1 bg-white">
          <img src={dmnLogo} alt="DMN Estaleiro" className="max-h-[60px] object-contain" />
        </div>
        <div className="flex flex-col items-center justify-center py-1 px-2 border-r-2 border-black">
          <div className="font-black text-lg leading-tight text-center">DMN ESTALEIRO DA AMAZONIA LTDA</div>
          <div className="text-xs border-t border-black w-full text-center pt-0.5 mt-0.5 font-semibold">
            APR – Análise Preliminar de Riscos
          </div>
        </div>
        <div className="grid grid-rows-4 text-[10px] font-bold leading-none">
          <div className="border-b border-black px-2 flex items-center">CÓD.FOR-SEG 07</div>
          <div className="border-b border-black px-2 flex items-center">REVISÃO: 00</div>
          <div className="border-b border-black px-2 flex items-center">DATA: 30/08/2025</div>
          <div className="px-2 flex items-center">PÁG.: {String(pagina).padStart(2, "0")}/{String(totalPaginas).padStart(2, "0")}</div>
        </div>
      </div>

      {/* Linha 2 — CNPJ | Início | Fim | APR Nº | Validade (dias) | Página X de N */}
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1.1fr_1fr_0.9fr] border-b border-black font-semibold">
        <div className="px-2 py-1 border-r border-black"><b>CNPJ:</b> 13.378.697/0001-80</div>
        <div className="px-2 py-1 border-r border-black flex items-center gap-1">
          <b>Início:</b>{editable ? (
            <Input type="date" className="h-6 text-[11px] border-0 p-0 flex-1"
              value={apr.data_emissao}
              onChange={(e) => setApr!({ ...apr, data_emissao: e.target.value })} />
          ) : (apr.data_emissao ? formatDateBR(apr.data_emissao) : "—")}
        </div>
        <div className="px-2 py-1 border-r border-black flex items-center gap-1">
          <b>Fim:</b>{editable ? (
            <Input type="date" className="h-6 text-[11px] border-0 p-0 flex-1"
              value={apr.data_validade ?? ""}
              onChange={(e) => setApr!({ ...apr, data_validade: e.target.value || null })} />
          ) : (apr.data_validade ? formatDateBR(apr.data_validade) : "—")}
        </div>
        <div className="px-2 py-1 border-r border-black"><b>APR Nº</b> {apr.numero ?? "—"}</div>
        <div className="px-2 py-1 border-r border-black flex items-center gap-1">
          <b>Validade:</b>{editable ? (
            <Select value={String(apr.validade_dias)} onValueChange={(v) => setApr!({ ...apr, validade_dias: parseInt(v) })}>
              <SelectTrigger className="h-6 text-[11px] border-0 p-0 flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 7, 15, 30].map((n) => <SelectItem key={n} value={String(n)}>{n} dia{n > 1 ? "s" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <span>{apr.validade_dias} dia{apr.validade_dias > 1 ? "s" : ""}</span>}
        </div>
        <div className="px-2 py-1 text-right"><b>Página</b> {pagina} de {totalPaginas}</div>
      </div>

      {/* Linha 3 — ATIVIDADE PRINCIPAL | SERVIÇO DETALHADO */}
      <div className="grid grid-cols-[1fr_1.2fr] border-b border-black">
        <div className="px-2 py-1 border-r border-black">
          <div className="font-bold text-[10px]">ATIVIDADE PRINCIPAL:</div>
          {editable ? (
            <Textarea rows={2} className="border-0 p-0 text-[11px] resize-none focus-visible:ring-0 min-h-0"
              value={apr.atividade_descricao}
              onChange={(e) => setApr!({ ...apr, atividade_descricao: e.target.value })} />
          ) : <span>{apr.atividade_descricao || "—"}{casco?.numero ? ` - CASCO ${casco.numero}` : ""}</span>}
        </div>
        <div className="px-2 py-1">
          <div className="font-bold text-[10px]">SERVIÇO DETALHADO:</div>
          {editable ? (
            <Textarea rows={2} className="border-0 p-0 text-[11px] resize-none focus-visible:ring-0 min-h-0"
              value={apr.observacoes_gerais ?? ""}
              onChange={(e) => setApr!({ ...apr, observacoes_gerais: e.target.value || null })} />
          ) : <span>{apr.observacoes_gerais ?? "—"}</span>}
        </div>
      </div>

      {/* Linha 4 — Elaborado por | Responsável pelo serviço | Local | Horário */}
      <div className="grid grid-cols-[1.1fr_1.2fr_1fr_1.4fr]">
        <div className="px-2 py-1 border-r border-black">
          <div className="font-bold text-[10px]">ELABORADO POR (TST):</div>
          {editable ? (
            <Select value={apr.tst_id ?? "none"} onValueChange={(v) => setApr!({ ...apr, tst_id: v === "none" ? null : v })}>
              <SelectTrigger className="h-6 text-[11px] border-0 p-0"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {(employees ?? []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <span>{elaboradoPor}</span>}
        </div>
        <div className="px-2 py-1 border-r border-black">
          <div className="font-bold text-[10px]">RESPONSÁVEL PELO SERVIÇO (EMPRESA):</div>
          {editable ? (
            <Select value={apr.empresa_id ?? "none"} onValueChange={(v) => setApr!({ ...apr, empresa_id: v === "none" ? null : v })}>
              <SelectTrigger className="h-6 text-[11px] border-0 p-0"><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhuma —</SelectItem>
                {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <span>{responsavel}</span>}
        </div>
        <div className="px-2 py-1 border-r border-black">
          <div className="font-bold text-[10px]">LOCAL DA ATIVIDADE:</div>
          {editable ? (
            <Input className="h-6 text-[11px] border-0 p-0"
              value={apr.local ?? ""}
              onChange={(e) => setApr!({ ...apr, local: e.target.value })}
              placeholder="Ex.: Casco 23, deck superior" />
          ) : <span>{apr.local ?? "—"}</span>}
        </div>
        <div className="px-2 py-1 leading-tight">
          <div className="font-bold text-[10px]">HORÁRIO DA ATIVIDADE:</div>
          {editable ? (
            <div className="flex flex-col gap-0.5 text-[10px]">
              <div className="flex flex-wrap gap-0.5">
                {DIAS.map((d) => {
                  const active = (apr.dias_semana ?? []).includes(d);
                  return (
                    <button key={d} type="button"
                      onClick={() => {
                        const cur = new Set(apr.dias_semana ?? []);
                        if (cur.has(d)) cur.delete(d); else cur.add(d);
                        setApr!({ ...apr, dias_semana: Array.from(cur) });
                      }}
                      className={`px-1 py-0.5 rounded text-[9px] font-bold border ${active ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-300"}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-1 items-center">
                <span className="font-bold">Seg-Qui</span>
                <Input type="time" className="h-5 text-[10px] border p-0.5" value={apr.hora_inicio ?? ""} onChange={(e) => setApr!({ ...apr, hora_inicio: e.target.value })} />
                <span>às</span>
                <Input type="time" className="h-5 text-[10px] border p-0.5" value={apr.hora_fim ?? ""} onChange={(e) => setApr!({ ...apr, hora_fim: e.target.value })} />
                <span className="font-bold">Sexta</span>
                <Input type="time" className="h-5 text-[10px] border p-0.5" value={apr.hora_inicio_sexta ?? ""} onChange={(e) => setApr!({ ...apr, hora_inicio_sexta: e.target.value })} />
                <span>às</span>
                <Input type="time" className="h-5 text-[10px] border p-0.5" value={apr.hora_fim_sexta ?? ""} onChange={(e) => setApr!({ ...apr, hora_fim_sexta: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="text-[10px] leading-tight">
              <div><b>Seg–Qui:</b> {apr.hora_inicio ?? "--:--"} às {apr.hora_fim ?? "--:--"}</div>
              <div><b>Sexta:</b> {apr.hora_inicio_sexta ?? "--:--"} às {apr.hora_fim_sexta ?? "--:--"}</div>
              {(apr.dias_semana?.length ?? 0) > 0 && (
                <div className="text-[9px] text-slate-600">{(apr.dias_semana ?? []).join(" · ")}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- componente principal ---------- */
function SignatureBox({
  title, nome, value, height, onChange,
}: {
  title: string;
  nome: string;
  value: string | null;
  height: number;
  onChange: (value: string | null, height: number) => void;
}) {
  const onUpload = (file: File | null) => {
    if (!file) return;
    if (file.type !== "image/png") { toast.error("A assinatura deve estar em PNG"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string, height || 80);
    reader.readAsDataURL(file);
  };
  return (
    <div className="border-2 border-black">
      <div className="bg-slate-100 p-1 text-center font-bold text-xs border-b border-black">{title}</div>
      <div className="p-3 text-center min-h-[120px] flex flex-col items-center justify-end gap-1">
        {value ? (
          <>
            <img src={value} alt={title} style={{ height: `${height}px` }} className="object-contain max-w-full" />
            <div className="flex items-center gap-2 w-full px-2 pt-1">
              <span className="text-[10px] text-slate-500">Tamanho</span>
              <input
                type="range" min={20} max={140} step={2} value={height}
                onChange={(e) => onChange(value, Number(e.target.value))}
                className="flex-1 accent-red-700"
              />
              <button type="button" onClick={() => onChange(null, 80)} className="text-[10px] text-red-700 hover:underline">
                Remover
              </button>
            </div>
          </>
        ) : (
          <label className="cursor-pointer text-[11px] text-red-700 hover:underline px-2 py-1 border border-dashed border-red-700/50 rounded">
            Enviar assinatura (PNG)
            <input type="file" accept="image/png" className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0] ?? null)} />
          </label>
        )}
        <div className="text-sm font-medium mt-1">{nome}</div>
        <div className="border-t border-black w-full mt-1 pt-1 text-[10px] italic">Assinatura</div>
      </div>
    </div>
  );
}

export function AprForm({ aprId, onClose }: { aprId?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [apr, setApr] = useState<APR>(() => ({
    ...emptyApr,
    ...((qc.getQueryData(["apr-form-draft", "new"]) as Partial<APR> | undefined) ?? {}),
  }));
  const [riscos, setRiscos] = useState<Risco[]>(
    () => (qc.getQueryData(["apr-form-draft", "new-riscos"]) as Risco[] | undefined) ?? [],
  );
  const [assinaturas, setAssinaturas] = useState<Assin[]>([]);
  const [tab, setTab] = useState<"p1" | "p2" | "p3" | "p4" | "p5">("p1");
  const [pteSheetOpen, setPteSheetOpen] = useState(false);
  const [pteSheetRiscoSugerido, setPteSheetRiscoSugerido] = useState<string | null>(null);
  // PTEs vinculadas "no rascunho" (APR ainda não salva) — guardamos os IDs aqui
  // para que a cobertura por categoria funcione antes do save. No save, gravamos
  // apr_id nessas linhas.
  const [draftPteIds, setDraftPteIds] = useState<string[]>([]);
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const currentAprId = apr.id ?? aprId ?? null;

  // (SignatureBox declarado abaixo, fora do componente)

  // catálogos
  const { data: cascos = EMPTY_QUERY_LIST } = useQuery({ queryKey: ["cascos-light"], queryFn: async () => (await supabase.from("cascos").select("id,numero,nome,status").eq("status", "ATIVO").order("numero")).data ?? [] });
  const { data: companies = EMPTY_QUERY_LIST } = useQuery({ queryKey: ["companies-light"], queryFn: async () => (await supabase.from("companies").select("id,name,cnpj").order("name")).data ?? [] });
  const { data: employees = EMPTY_QUERY_LIST } = useQuery({ queryKey: ["employees-light-apr"], queryFn: async () => (await supabase.from("employees").select("id,nome,cpf,company_id,role_id,status").eq("status", "ATIVO").order("nome")).data ?? [] });
  const { data: roles = EMPTY_QUERY_LIST } = useQuery({ queryKey: ["roles-light"], queryFn: async () => (await supabase.from("roles").select("id,name").order("name")).data ?? [] });
  const { data: catRiscos = EMPTY_QUERY_LIST } = useQuery({ queryKey: ["catalogo_riscos_form"], queryFn: async () => (await supabase.from("catalogo_riscos").select("*").eq("ativo", true).order("nome")).data ?? [] });
  const { data: ptes = EMPTY_QUERY_LIST } = useQuery({ queryKey: ["ptes-light"], queryFn: async () => (await supabase.from("ptes").select("id,numero,data_emissao,risco,status").order("data_emissao", { ascending: false }).limit(50)).data ?? [] });
  const { data: ossValidIds = new Set<string>() } = useQuery({
    queryKey: ["oss-valid-set-apr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oss_emissoes")
        .select("employee_id,expira_em,status")
        .eq("status", "ASSINADO");
      if (error) throw error;
      const now = Date.now();
      const s = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (!r.expira_em || new Date(r.expira_em).getTime() > now) s.add(r.employee_id);
      });
      return s;
    },
  });
  const { data: overridesAll = [] } = useQuery({
    queryKey: ["safety-overrides-active-apr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_overrides")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as SafetyOverride[];
    },
  });
  function hasOsOverride(empId: string) {
    const ov = overridesAll.filter((o) => o.employee_id === empId);
    return hasGlobalOverride(ov) || ov.some((o) => o.item_key === "OS");
  }
  const { user } = useAuth();
  const liberarOs = useMutation({
    mutationFn: async ({ empId, nome }: { empId: string; nome: string }) => {
      if (!user) throw new Error("Sessão expirada");
      const justificativa = window.prompt(
        `Justificativa para liberar ${nome} sem OS Assinada (mín. 10 caracteres, ISO 9001):`,
        "Liberação emergencial via APR — OS será emitida em até 5 dias úteis",
      );
      if (justificativa === null) throw new Error("__cancel__");
      if (justificativa.trim().length < 10) throw new Error("Justificativa muito curta (mín. 10 caracteres)");
      const expira_em = new Date(Date.now() + 30 * 86400000).toISOString();
      const { error } = await supabase.from("safety_overrides").insert({
        employee_id: empId,
        scope: "ITEM",
        item_key: "OS",
        justificativa: justificativa.trim(),
        liberado_por: user.id,
        liberado_por_email: user.email ?? null,
        expira_em,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["safety-overrides-active-apr"] });
      qc.invalidateQueries({ queryKey: ["safety-overrides-all"] });
      qc.invalidateQueries({ queryKey: ["safety-overrides"] });
      toast.success("OS liberada por 30 dias — registre a emissão da OS o quanto antes");
    },
    onError: (e: any) => {
      if (e?.message === "__cancel__") return;
      toast.error(e.message);
    },
  });
  // PTEs JÁ vinculadas a esta APR (1 APR ↔ N PTEs, uma por categoria detectada)
  const { data: linkedPtes = EMPTY_QUERY_LIST } = useQuery({
    queryKey: ["ptes-linked-apr", currentAprId],
    enabled: !!currentAprId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () =>
      (await supabase
        .from("ptes")
        .select("id,numero,data_emissao,risco,status")
        .eq("apr_id", currentAprId!)
        .order("data_emissao", { ascending: false })
      ).data ?? [],
  });

  const empresa = useMemo(() => companies.find((c: any) => c.id === apr.empresa_id), [companies, apr.empresa_id]);
  const casco = useMemo(() => cascos.find((c: any) => c.id === apr.casco_id), [cascos, apr.casco_id]);
  const enc = useMemo(() => employees.find((e: any) => e.id === apr.encarregado_id), [employees, apr.encarregado_id]);
  const tst = useMemo(() => employees.find((e: any) => e.id === apr.tst_id), [employees, apr.tst_id]);
  const pte = useMemo(() => ptes.find((p: any) => p.id === apr.pte_id), [ptes, apr.pte_id]);

  const deteccaoPTE = useMemo(
    () => detectarExigenciaPTE(riscos.map((r) => ({ risco_nome: r.risco_nome, nrs: r.nrs }))),
    [riscos],
  );
  const categoriasDetectadas = useMemo<CategoriaDetectada[]>(
    () => detectarCategoriasPTE(riscos.map((r) => ({ risco_nome: r.risco_nome, nrs: r.nrs }))),
    [riscos],
  );
  /** Mescla a PTE legada (apr.pte_id) caso ela não esteja na lista de linked. */
  const todasPtesVinculadas = useMemo(() => {
    const map = new Map<string, any>();
    (linkedPtes as any[])
      .filter((p) => p.status !== "CANCELADA" && p.status !== "ENCERRADA")
      .forEach((p) => map.set(p.id, p));
    if (apr.pte_id && pte && pte.status !== "CANCELADA" && pte.status !== "ENCERRADA" && !map.has(apr.pte_id)) map.set(apr.pte_id, pte);
    // Rascunho: PTEs vinculadas antes do save (apr_id ainda não persistido)
    for (const draftId of draftPteIds) {
      if (map.has(draftId)) continue;
      const draftPte = (ptes as any[]).find((p: any) => p.id === draftId);
      if (draftPte && draftPte.status !== "CANCELADA" && draftPte.status !== "ENCERRADA") {
        map.set(draftId, draftPte);
      }
    }
    return Array.from(map.values());
  }, [linkedPtes, apr.pte_id, pte, draftPteIds, ptes]);
  /** Para cada categoria detectada → PTE que a cobre (match por ptes.risco === riscoLabel) */
  const coberturaCategorias = useMemo(() => {
    return categoriasDetectadas.map((cat) => {
      const cobertura = cat.riscoLabel
        ? todasPtesVinculadas.find((p: any) => (p.risco ?? "") === cat.riscoLabel)
        : null;
      return { ...cat, pte: cobertura ?? null };
    });
  }, [categoriasDetectadas, todasPtesVinculadas]);
  const categoriasPendentes = coberturaCategorias.filter((c) => !c.pte && c.riscoLabel);
  const categoriasCobertas = coberturaCategorias.filter((c) => !!c.pte);
  const temRiscoGrave = useMemo(() => riscos.some((r) => (r.probabilidade + r.severidade) >= 5), [riscos]);
  useEffect(() => {
    if ((deteccaoPTE.exige || temRiscoGrave) && !apr.exige_pte) {
      setApr((a) => ({ ...a, exige_pte: true }));
    }
  }, [deteccaoPTE.exige, temRiscoGrave]); // eslint-disable-line react-hooks/exhaustive-deps

  // carregar APR existente
  useEffect(() => {
    if (!aprId) return;
    (async () => {
      const [{ data: a }, { data: rs }, { data: ass }] = await Promise.all([
        supabase.from("aprs").select("*").eq("id", aprId).maybeSingle(),
        supabase.from("apr_riscos").select("*").eq("apr_id", aprId).order("ordem"),
        supabase.from("apr_assinaturas").select("*").eq("apr_id", aprId).order("papel").order("ordem"),
      ]);
      if (a) setApr(a as any);
      if (rs) setRiscos(rs as any);
      if (ass) setAssinaturas(ass as any);
    })();
  }, [aprId]);

  // Pré-visualiza próximo número da APR para nova APR (apenas display; reservado no save)
  useEffect(() => {
    if (aprId || apr.numero) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("peek_proximo_numero_apr" as any);
        if (error) {
          console.warn("[APR] Não foi possível pré-visualizar o próximo número:", error.message);
          return;
        }
        if (data && !apr.numero) setApr((a) => ({ ...a, numero: String(data) }));
      } catch (error) {
        console.warn("[APR] Falha ao pré-visualizar o próximo número:", error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aprId]);

  // Auto-calcula data_validade a partir de data_emissao + validade_dias
  useEffect(() => {
    if (!apr.data_emissao) return;
    const d = new Date(apr.data_emissao + "T00:00:00");
    d.setDate(d.getDate() + (apr.validade_dias || 0));
    const iso = d.toISOString().slice(0, 10);
    if (iso !== apr.data_validade) setApr((a) => ({ ...a, data_validade: iso }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apr.data_emissao, apr.validade_dias]);

  // sincroniza encarregado/TST nas assinaturas
  useEffect(() => {
    setAssinaturas((arr) => {
      const others = arr.filter((a) => a.papel !== "ENCARREGADO" && a.papel !== "TST");
      const list: Assin[] = [...others];
      if (enc) {
        const role = roles.find((r: any) => r.id === enc.role_id);
        list.push({ papel: "ENCARREGADO", employee_id: enc.id, nome: enc.nome, cpf: enc.cpf, funcao: role?.name ?? "Encarregado", ordem: 1 });
      }
      if (tst) {
        const role = roles.find((r: any) => r.id === tst.role_id);
        list.push({ papel: "TST", employee_id: tst.id, nome: tst.nome, cpf: tst.cpf, funcao: role?.name ?? "TST", ordem: 1 });
      }
      return list;
    });
  }, [enc, tst, roles]);

  // ao trocar empresa: pré-marca todos os funcionários ativos da empresa como executantes
  // (não duplica se já estiverem; mantém os já marcados manualmente)
  useEffect(() => {
    if (!apr.empresa_id || aprId /* não auto-popula em edição */) return;
    const da = employees.filter((e: any) => e.company_id === apr.empresa_id);
    if (da.length === 0) return;
    setAssinaturas((arr) => {
      // remove executantes anteriores que vieram de auto-popular outra empresa
      const semExecAuto = arr.filter((a) => a.papel !== "EXECUTANTE");
      const novos: Assin[] = da.map((e: any, i: number) => {
        const role = roles.find((r: any) => r.id === e.role_id);
        return {
          papel: "EXECUTANTE", employee_id: e.id, nome: e.nome, cpf: e.cpf,
          funcao: role?.name ?? "", ordem: i + 1,
        };
      });
      return [...semExecAuto, ...novos];
    });
  }, [apr.empresa_id, employees, roles, aprId]);

  /* ---------- ações ---------- */
  function addRiscoFromCatalogo(catId: string) {
    const c = catRiscos.find((x: any) => x.id === catId);
    if (!c) return;
    setRiscos((rs) => [...rs, {
      ordem: rs.length + 1,
      catalogo_risco_id: c.id,
      risco_nome: c.nome,
      risco_categoria: c.categoria,
      efeitos_danos: (c.efeitos_tipicos ?? []).join(", "),
      probabilidade: 2, severidade: 2,
      acoes_preventivas: (c.medidas_controle_padrao ?? []).join("; "),
      epis: c.epis_sugeridos ?? [], nrs: c.nrs_aplicaveis ?? [],
      responsavel_acoes: "",
      passo_a_passo: "",
    }]);
  }
  const addRiscoLivre = () => setRiscos((rs) => [...rs, { ordem: rs.length + 1, risco_nome: "", probabilidade: 1, severidade: 1, epis: [], nrs: [], passo_a_passo: "" }]);
  function setRiscoFromCatalogo(idx: number, catId: string) {
    const c = catRiscos.find((x: any) => x.id === catId);
    if (!c) return;
    updateRisco(idx, {
      catalogo_risco_id: c.id,
      risco_nome: c.nome,
      risco_categoria: c.categoria,
      efeitos_danos: (c.efeitos_tipicos ?? []).join(", "),
      acoes_preventivas: (c.medidas_controle_padrao ?? []).join("; "),
      epis: c.epis_sugeridos ?? [],
      nrs: c.nrs_aplicaveis ?? [],
    });
  }
  const moveRisco = (idx: number, dir: -1 | 1) => setRiscos((rs) => {
    const next = [...rs]; const j = idx + dir;
    if (j < 0 || j >= next.length) return rs;
    [next[idx], next[j]] = [next[j], next[idx]];
    return next.map((r, i) => ({ ...r, ordem: i + 1 }));
  });
  const removeRisco = (idx: number) => setRiscos((rs) => rs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, ordem: i + 1 })));
  const updateRisco = (idx: number, patch: Partial<Risco>) => setRiscos((rs) => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));

  // executantes: lista derivada de empresa + assinaturas atuais
  const execAtuais = assinaturas.filter((a) => a.papel === "EXECUTANTE");
  const empresaFuncs = useMemo(
    () => apr.empresa_id ? employees.filter((e: any) => e.company_id === apr.empresa_id) : [],
    [employees, apr.empresa_id],
  );
  function toggleExecutante(empId: string) {
    const exists = execAtuais.find((a) => a.employee_id === empId);
    if (exists) {
      setAssinaturas((arr) => arr.filter((a) => !(a.papel === "EXECUTANTE" && a.employee_id === empId)));
    } else {
      const e: any = employees.find((x: any) => x.id === empId);
      if (!e) return;
      if (!ossValidIds.has(empId) && !hasOsOverride(empId)) {
        toast.error(`${e.nome} sem OS Assinada válida (NR-01 1.4.1 "c"). Emita a OS ou libere manualmente no cadastro do funcionário.`);
        return;
      }
      const role = roles.find((r: any) => r.id === e.role_id);
      setAssinaturas((arr) => [...arr, {
        papel: "EXECUTANTE", employee_id: e.id, nome: e.nome, cpf: e.cpf,
        funcao: role?.name ?? "", ordem: arr.filter((a) => a.papel === "EXECUTANTE").length + 1,
      }]);
    }
  }

  function marcarTodosExecutantes() {
    const bloqueados = empresaFuncs.filter(
      (e: any) => !ossValidIds.has(e.id) && !hasOsOverride(e.id),
    );
    if (bloqueados.length) {
      toast.error(
        `${bloqueados.length} funcionário(s) sem OS Assinada foram ignorados: ${bloqueados.slice(0, 3).map((e: any) => e.nome).join(", ")}${bloqueados.length > 3 ? "…" : ""}`,
      );
    }
    const elegiveis = empresaFuncs.filter(
      (e: any) => ossValidIds.has(e.id) || hasOsOverride(e.id),
    );
    setAssinaturas((arr) => {
      const semExec = arr.filter((a) => a.papel !== "EXECUTANTE");
      const novos = elegiveis.map((e: any, i: number) => {
        const role = roles.find((r: any) => r.id === e.role_id);
        return {
          papel: "EXECUTANTE" as const,
          employee_id: e.id,
          nome: e.nome,
          cpf: e.cpf,
          funcao: role?.name ?? "",
          ordem: i + 1,
        };
      });
      return [...semExec, ...novos];
    });
  }

  function desmarcarTodosExecutantes() {
    setAssinaturas((arr) => arr.filter((a) => a.papel !== "EXECUTANTE"));
  }

  /* ---------- salvar ---------- */
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!apr.atividade_descricao.trim()) throw new Error("Descreva a atividade");
      if (riscos.length === 0) throw new Error("Adicione ao menos 1 risco");
      if (riscos.some((r) => !r.risco_nome.trim())) throw new Error("Todo risco precisa de nome");

      const numero = apr.numero ?? (await supabase.rpc("gerar_numero_apr")).data as string;

      // Valida pte_id: se a PTE referenciada não existir mais, limpa para evitar violação de FK
      let safePteId: string | null = apr.pte_id || null;
      if (safePteId) {
        const { data: pteRow } = await supabase.from("ptes").select("id").eq("id", safePteId).maybeSingle();
        if (!pteRow) safePteId = null;
      }

      const payload: any = {
        numero,
        casco_id: apr.casco_id || null,
        pte_id: safePteId,
        empresa_id: apr.empresa_id || null,
        encarregado_id: apr.encarregado_id || null,
        tst_id: apr.tst_id || null,
        local: apr.local || null,
        setor: null,
        atividade_descricao: apr.atividade_descricao,
        data_emissao: apr.data_emissao,
        hora_inicio: apr.hora_inicio || null,
        hora_fim: apr.hora_fim || null,
        hora_inicio_sexta: apr.hora_inicio_sexta || null,
        hora_fim_sexta: apr.hora_fim_sexta || null,
        validade_dias: apr.validade_dias,
        data_validade: apr.data_validade || null,
        dias_semana: apr.dias_semana ?? null,
        condicoes_climaticas: apr.condicoes_climaticas || null,
        observacoes_gerais: apr.observacoes_gerais || null,
        status: publish ? "ATIVA" : (apr.status || "RASCUNHO"),
        exige_pte: apr.exige_pte,
        texto_gerais: apr.texto_gerais ?? null,
        signature_tst: (apr as any).signature_tst ?? null,
        signature_tst_height: (apr as any).signature_tst ? ((apr as any).signature_tst_height ?? 80) : null,
        signature_enc: (apr as any).signature_enc ?? null,
        signature_enc_height: (apr as any).signature_enc ? ((apr as any).signature_enc_height ?? 80) : null,
        modelo_id: (apr as any).modelo_id ?? null,
      };

      let id = apr.id;
      if (id) {
        console.log("[APR save] update", id, "casco_id=", payload.casco_id);
        const { data: updated, error } = await supabase
          .from("aprs")
          .update(payload)
          .eq("id", id)
          .select("id,casco_id");
        if (error) throw error;
        if (!updated || updated.length === 0) {
          throw new Error("Update bloqueado (sem permissão ou sessão expirada). Faça login novamente.");
        }
        if (updated[0].casco_id !== payload.casco_id) {
          throw new Error(`Casco não foi persistido. Esperado ${payload.casco_id}, salvo ${updated[0].casco_id}.`);
        }
      } else {
        const { data, error } = await supabase.from("aprs").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      await supabase.from("apr_riscos").delete().eq("apr_id", id);
      if (riscos.length > 0) {
        const { error: e2 } = await supabase.from("apr_riscos").insert(
          riscos.map((r) => ({
            apr_id: id, ordem: r.ordem,
            catalogo_risco_id: r.catalogo_risco_id || null,
            risco_nome: r.risco_nome, risco_categoria: r.risco_categoria || null,
            efeitos_danos: r.efeitos_danos || null,
            probabilidade: r.probabilidade, severidade: r.severidade,
            acoes_preventivas: r.acoes_preventivas || null,
            epis: r.epis ?? [], nrs: r.nrs ?? [],
            responsavel_acoes: r.responsavel_acoes || null,
            passo_a_passo: r.passo_a_passo || null,
          })),
        );
        if (e2) throw e2;
      }

      await supabase.from("apr_assinaturas").delete().eq("apr_id", id);
      if (assinaturas.length > 0) {
        const { error: e3 } = await supabase.from("apr_assinaturas").insert(
          assinaturas.map((a) => ({
            apr_id: id, papel: a.papel,
            employee_id: a.employee_id || null,
            nome: a.nome, cpf: a.cpf || null, funcao: a.funcao || null,
            ordem: a.ordem, assinou_em: a.assinou_em || null,
          })),
        );
        if (e3) throw e3;
      }

      // Persiste apr_id em PTEs vinculadas durante o rascunho (antes do save).
      if (draftPteIds.length > 0 && id) {
        await supabase
          .from("ptes")
          .update({ apr_id: id })
          .in("id", draftPteIds)
          .is("apr_id", null);
      }

      // Sincroniza ponteiro reverso: a PTE escolhida no dropdown (apr.pte_id)
      // precisa ter seu próprio apr_id apontando para esta APR. Sem isso, a
      // lista de APRs mostra "Pendente" mesmo com PTE vinculada.
      if (safePteId && id) {
        await supabase
          .from("ptes")
          .update({ apr_id: id })
          .eq("id", safePteId);
      }

      return id!;
    },
    onSuccess: (id, publish) => {
      qc.invalidateQueries({ queryKey: ["aprs"] });
      qc.invalidateQueries({ queryKey: ["ptes-by-apr"] });
      qc.invalidateQueries({ queryKey: ["ptes-linked-apr", id] });
      qc.invalidateQueries({ queryKey: ["ptes-light"] });
      toast.success(publish ? "APR emitida" : "APR salva");
      setApr((a) => ({ ...a, id }));
      if (publish) onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function buildPdf() {
    return await gerarAPR({
      logoUrl: dmnLogo,
      matrizNome: "J C S CONSTRUÇÃO NAVAL LTDA",
      matrizCnpj: "13.378.697/0001-80",
      numero: apr.numero ?? "APR-RASCUNHO",
      data_emissao: formatDateBR(apr.data_emissao),
      data_inicio: apr.data_emissao ? formatDateBR(apr.data_emissao) : null,
      data_fim: apr.data_validade ? formatDateBR(apr.data_validade) : null,
      hora_inicio: apr.hora_inicio, hora_fim: apr.hora_fim,
      hora_inicio_sexta: apr.hora_inicio_sexta, hora_fim_sexta: apr.hora_fim_sexta,
      dias_semana: apr.dias_semana ?? null,
      validade_dias: apr.validade_dias,
      data_validade: apr.data_validade ? formatDateBR(apr.data_validade) : null,
      empresa_nome: empresa?.name ?? null,
      empresa_cnpj: empresa?.cnpj ?? null,
      casco_numero: casco?.numero ?? null, casco_nome: casco?.nome ?? null,
      local: apr.local, setor: apr.setor,
      atividade: apr.atividade_descricao,
      servico_detalhado: apr.observacoes_gerais ?? null,
      elaborado_por: tst?.nome ?? null,
      encarregado: empresa?.name ?? enc?.nome,
      tst: tst?.nome,
      pte_numero: pte?.numero ?? null,
      condicoes_climaticas: apr.condicoes_climaticas,
      observacoes: apr.observacoes_gerais,
      texto_gerais: apr.texto_gerais ?? null,
      riscos: riscos.map((r) => ({
        ordem: r.ordem,
        passo: r.passo_a_passo ?? null,
        risco_nome: r.risco_nome,
        risco_categoria: r.risco_categoria,
        efeitos_danos: r.efeitos_danos, probabilidade: r.probabilidade, severidade: r.severidade,
        nivel_risco: r.probabilidade + r.severidade,
        acoes_preventivas: r.acoes_preventivas,
        epis: r.epis ?? [], nrs: r.nrs ?? [],
        responsavel_acoes: r.responsavel_acoes,
      } as APRPdfRisco)),
      assinaturas: assinaturas.map((a) => ({
        papel: a.papel, nome: a.nome, cpf: a.cpf, funcao: a.funcao,
      } as APRPdfAssinatura)),
      encSig: (apr as any).signature_enc ?? null,
      tstSig: (apr as any).signature_tst ?? null,
      encSigHeight: (apr as any).signature_enc_height ?? null,
      tstSigHeight: (apr as any).signature_tst_height ?? null,
    });
  }

  async function handleAbrir() {
    if (!apr.id) { toast.error("Salve a APR antes"); return; }
    const doc = await buildPdf();
    setPreviewDoc(doc);
  }
  async function handleImprimir() {
    if (!apr.id) { toast.error("Salve a APR antes"); return; }
    const doc = await buildPdf();
    await printPdf(doc.output("arraybuffer") as ArrayBuffer, `${apr.numero ?? "apr"}.pdf`);
  }

  /* ---------- render ---------- */
  const STEPS = [
    { key: "p1", label: "Identificação & Riscos" },
    { key: "p2", label: "Gerais" },
    { key: "p3", label: "Avaliação & Assinaturas" },
    { key: "p4", label: "Anexo I (Executantes)" },
  ] as const;
  const currentStepIdx = STEPS.findIndex((s) => s.key === tab);

  function validateStep(idx: number): string | null {
    if (idx === 0) {
      if (!apr.atividade_descricao.trim()) return "Descreva a Atividade Principal";
      if (!apr.tst_id) return "Selecione o TST (Elaborado por)";
      if (!apr.empresa_id) return "Selecione a Empresa (Responsável pelo Serviço)";
      if (riscos.length === 0) return "Adicione ao menos 1 risco";
      if (riscos.some((r) => !r.risco_nome.trim())) return "Todo risco precisa de um nome";
      if (categoriasPendentes.length > 0) return `Existem ${categoriasPendentes.length} categoria(s) de PTE pendente(s). Resolva antes de avançar.`;
      return null;
    }
    if (idx === 1) {
      if (!(apr.texto_gerais ?? "").trim()) return "O texto Gerais não pode ficar em branco";
      return null;
    }
    if (idx === 2) {
      return null;
    }
    if (idx === 3) {
      if (execAtuais.length === 0) return "Selecione ao menos 1 executante";
      return null;
    }
    return null;
  }

  const [stepError, setStepError] = useState<string | null>(null);
  const [riscoEditIdx, setRiscoEditIdx] = useState<number | null>(null);
  const [execFilter, setExecFilter] = useState("");

  function goNext() {
    const err = validateStep(currentStepIdx);
    if (err) { setStepError(err); toast.error(err); return; }
    setStepError(null);
    if (currentStepIdx < STEPS.length - 1) setTab(STEPS[currentStepIdx + 1].key as any);
  }
  function goBack() {
    setStepError(null);
    if (currentStepIdx > 0) setTab(STEPS[currentStepIdx - 1].key as any);
  }

  function emitirDireto() {
    for (let i = 0; i < STEPS.length; i++) {
      const err = validateStep(i);
      if (err) {
        setTab(STEPS[i].key as any);
        setStepError(err);
        toast.error(`Passo ${i + 1}: ${err}`);
        return;
      }
    }
    setStepError(null);
    save.mutate(true);
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* ═══════════ HEADER COMPACTO ═══════════ */}
      <div className="border-b border-border bg-card/40 backdrop-blur-sm shrink-0">
        <div className="px-5 pt-3 pb-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-700 to-rose-950 flex items-center justify-center shadow-[0_0_14px_-4px_rgba(220,38,70,0.6)]">
              <ShieldAlert className="h-4 w-4 text-red-50" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">FOR-SEG-07 · APR</div>
              <div className="text-sm font-black text-foreground leading-tight truncate">
                {apr.numero ?? "Nova APR"}
                {apr.atividade_descricao && <span className="ml-2 font-medium text-muted-foreground">· {apr.atividade_descricao.slice(0, 40)}{apr.atividade_descricao.length > 40 ? "…" : ""}</span>}
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {categoriasPendentes.length > 0 && (
              <Button
                size="sm"
                onClick={() => { setPteSheetRiscoSugerido(categoriasPendentes[0]?.riscoLabel ?? null); setPteSheetOpen(true); }}
                className="h-8 px-3 text-[11px] font-black uppercase tracking-wider bg-gradient-to-br from-rose-600 to-rose-900 hover:from-rose-500 hover:to-rose-800 text-rose-50 border border-rose-400/40 shadow-[0_0_12px_-4px_rgba(220,38,70,0.5)]"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Resolver {categoriasPendentes.length} PTE{categoriasPendentes.length > 1 ? "s" : ""}
              </Button>
            )}
            {categoriasPendentes.length === 0 && todasPtesVinculadas.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setPteSheetOpen(true)} className="h-8 px-2.5 text-[11px]">
                <FileText className="h-3.5 w-3.5 mr-1" /> Gerenciar PTEs
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={handleAbrir} disabled={!apr.id} className="h-8 w-8 p-0"><FileText className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Abrir PDF</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={handleImprimir} disabled={!apr.id} className="h-8 w-8 p-0"><Printer className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Imprimir</TooltipContent>
            </Tooltip>
            <Button size="sm" variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending} className="h-8 px-2.5 text-[11px]">
              <Save className="h-3.5 w-3.5 mr-1" /> Rascunho
            </Button>
            <Button
              size="sm"
              onClick={emitirDireto}
              disabled={save.isPending}
              className="h-8 px-3 text-[11px] font-black uppercase tracking-wider bg-red-700 hover:bg-red-800 text-white shadow-[0_0_12px_-4px_rgba(220,38,70,0.6)]"
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Salvar e Emitir
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stepper compacto */}
        <div className="px-5 pb-3 flex items-center gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => {
            const done = i < currentStepIdx;
            const active = i === currentStepIdx;
            const locked = i > currentStepIdx;
            return (
              <div key={s.key} className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => { if (!locked) { setStepError(null); setTab(s.key as any); } }}
                  className={cn(
                    "flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition border",
                    active && "bg-red-700/15 border-red-500/40 text-red-100",
                    done && "bg-emerald-500/10 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/15",
                    locked && "bg-muted/40 border-border text-muted-foreground/60 cursor-not-allowed",
                    !active && !done && !locked && "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <span className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                    active && "bg-red-600 text-white",
                    done && "bg-emerald-500 text-white",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wide">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px w-6", i < currentStepIdx ? "bg-emerald-500/50" : "bg-border")} />
                )}
              </div>
            );
          })}
          {stepError && (
            <span className="ml-auto text-[11px] font-bold text-red-300 flex items-center gap-1 shrink-0">
              <AlertTriangle className="h-3 w-3" /> {stepError}
            </span>
          )}
        </div>
      </div>

      {/* ═══════════ CONTEÚDO ═══════════ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-5 space-y-4">

          {/* ══════ PASSO 1 ══════ */}
          {tab === "p1" && <>
            {/* Card Identificação */}
            <section className="rounded-xl border border-border bg-card/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card/40">
                <div className="h-6 w-6 rounded-md bg-red-700/20 border border-red-500/40 flex items-center justify-center text-[10px] font-black text-red-200">1</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Identificação</h3>
                <span className="ml-auto text-[10px] font-bold text-muted-foreground">APR Nº {apr.numero ?? "—"} · Página 1 de 4</span>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Início</label>
                  <Input type="date" className="h-9 mt-1" value={apr.data_emissao} onChange={(e) => setApr({ ...apr, data_emissao: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Fim</label>
                  <Input type="date" className="h-9 mt-1" value={apr.data_validade ?? ""} onChange={(e) => setApr({ ...apr, data_validade: e.target.value || null })} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Validade</label>
                  <Select value={String(apr.validade_dias)} onValueChange={(v) => setApr({ ...apr, validade_dias: parseInt(v) })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 7, 15, 30].map((n) => <SelectItem key={n} value={String(n)}>{n} dia{n > 1 ? "s" : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Casco / Embarcação</label>
                  <Select value={apr.casco_id ?? "none"} onValueChange={(v) => setApr({ ...apr, casco_id: v === "none" ? null : v })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {cascos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.numero}{c.nome ? ` · ${c.nome}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-6">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Elaborado por (TST)</label>
                  <Select value={apr.tst_id ?? "none"} onValueChange={(v) => setApr({ ...apr, tst_id: v === "none" ? null : v })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar TST..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {(employees ?? []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-6">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Responsável / Empresa</label>
                  <Select value={apr.empresa_id ?? "none"} onValueChange={(v) => setApr({ ...apr, empresa_id: v === "none" ? null : v })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhuma —</SelectItem>
                      {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-12">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Local da Atividade</label>
                  <Input className="h-9 mt-1" value={apr.local ?? ""} onChange={(e) => setApr({ ...apr, local: e.target.value })} placeholder="Ex.: Casco 133, deck superior" />
                </div>

                <div className="md:col-span-8">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Atividade Principal *</label>
                  <Textarea rows={2} className="mt-1 resize-none" value={apr.atividade_descricao} onChange={(e) => setApr({ ...apr, atividade_descricao: e.target.value })} placeholder="Ex.: Pintura e jateamento em altura no costado do casco…" />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Serviço Detalhado</label>
                  <Textarea rows={2} className="mt-1 resize-none" value={apr.observacoes_gerais ?? ""} onChange={(e) => setApr({ ...apr, observacoes_gerais: e.target.value || null })} />
                </div>

                {/* Dias + horários */}
                <div className="md:col-span-12">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Horário da Atividade</label>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <div className="flex gap-1">
                      {DIAS.map((d) => {
                        const active = (apr.dias_semana ?? []).includes(d);
                        return (
                          <button key={d} type="button"
                            onClick={() => {
                              const cur = new Set(apr.dias_semana ?? []);
                              if (cur.has(d)) cur.delete(d); else cur.add(d);
                              setApr({ ...apr, dias_semana: Array.from(cur) });
                            }}
                            className={cn(
                              "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border transition",
                              active
                                ? "bg-red-700/25 border-red-500/50 text-red-100"
                                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Seg-Qui</span>
                      <Input type="time" className="h-8 w-24 text-xs" value={apr.hora_inicio ?? ""} onChange={(e) => setApr({ ...apr, hora_inicio: e.target.value })} />
                      <span className="text-[10px] text-muted-foreground">às</span>
                      <Input type="time" className="h-8 w-24 text-xs" value={apr.hora_fim ?? ""} onChange={(e) => setApr({ ...apr, hora_fim: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Sexta</span>
                      <Input type="time" className="h-8 w-24 text-xs" value={apr.hora_inicio_sexta ?? ""} onChange={(e) => setApr({ ...apr, hora_inicio_sexta: e.target.value })} />
                      <span className="text-[10px] text-muted-foreground">às</span>
                      <Input type="time" className="h-8 w-24 text-xs" value={apr.hora_fim_sexta ?? ""} onChange={(e) => setApr({ ...apr, hora_fim_sexta: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Alerta PTE — slim */}
            {coberturaCategorias.length > 0 && (() => {
              const hasPendente = categoriasPendentes.length > 0;
              return (
                <section className={cn(
                  "rounded-xl border overflow-hidden",
                  hasPendente
                    ? "border-red-500/40 bg-gradient-to-br from-red-950/60 to-rose-950/30 shadow-[0_0_20px_-8px_rgba(220,38,70,0.4)]"
                    : "border-emerald-500/30 bg-emerald-950/20"
                )}>
                  <div className="px-4 py-2 flex items-center gap-2">
                    {hasPendente
                      ? <AlertTriangle className="h-4 w-4 text-red-300 shrink-0" />
                      : <Check className="h-4 w-4 text-emerald-300 shrink-0" />}
                    <div className={cn("text-[11px] font-black uppercase tracking-wider", hasPendente ? "text-red-100" : "text-emerald-100")}>
                      {hasPendente ? "PTE obrigatória — cobertura incompleta" : "PTE — todas categorias cobertas"}
                    </div>
                    <Badge variant="outline" className={cn(
                      "ml-auto text-[10px] font-black",
                      hasPendente ? "border-red-500/50 text-red-200 bg-red-500/15" : "border-emerald-500/40 text-emerald-200 bg-emerald-500/15"
                    )}>
                      {categoriasCobertas.length}/{coberturaCategorias.length} cobertas
                    </Badge>
                  </div>
                  <div className="divide-y divide-white/5 border-t border-white/5">
                    {coberturaCategorias.map((c) => {
                      if (c.pte) {
                        const pte: any = c.pte;
                        return (
                          <div key={c.categoria} className="flex items-center gap-3 px-4 py-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span className="text-[11px] font-bold text-emerald-100">{c.categoria}</span>
                            <span className="text-[10px] text-emerald-200/70 truncate">PTE Nº <b>{pte.numero ?? String(pte.id).slice(0, 8)}</b> · {formatDateBR(pte.data_emissao)}</span>
                          </div>
                        );
                      }
                      if (c.riscoLabel) {
                        return (
                          <div key={c.categoria} className="flex items-center gap-3 px-4 py-1.5">
                            <span className="h-4 w-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">!</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-red-100">{c.categoria}</div>
                              <div className="text-[10px] text-red-200/70 truncate">{c.motivo}</div>
                            </div>
                            <Button size="sm" onClick={() => { setPteSheetRiscoSugerido(c.riscoLabel); setPteSheetOpen(true); }}
                              className="h-6 px-2 text-[10px] font-bold uppercase bg-red-700 hover:bg-red-800 text-white shrink-0">
                              Resolver
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <div key={c.categoria} className="flex items-center gap-3 px-4 py-1.5">
                          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[11px] font-bold text-muted-foreground">{c.categoria}</span>
                          <span className="text-[10px] text-muted-foreground/70">{c.motivo} (informativo)</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {/* Card Riscos — cards clicáveis */}
            <section className="rounded-xl border border-border bg-card/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card/40 flex-wrap">
                <div className="h-6 w-6 rounded-md bg-red-700/20 border border-red-500/40 flex items-center justify-center text-[10px] font-black text-red-200">2</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Riscos Identificados</h3>
                <Badge variant="outline" className="text-[10px] font-black">{riscos.length} risco{riscos.length !== 1 ? "s" : ""}</Badge>
                {temRiscoGrave && (
                  <Badge className="text-[10px] font-black bg-red-500/20 text-red-200 border border-red-500/40">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Alto/Crítico — PTE obrigatória
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <Select onValueChange={(v) => { addRiscoFromCatalogo(v); setRiscoEditIdx(riscos.length); }}>
                    <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue placeholder="+ Do catálogo…" /></SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                      {catRiscos.map((c: any) => <SelectItem key={c.id} value={c.id}>[{c.categoria}] {c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { addRiscoLivre(); setRiscoEditIdx(riscos.length); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Manual
                  </Button>
                </div>
              </div>

              {riscos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  Nenhum risco adicionado. Use os botões acima para começar.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {riscos.map((r, idx) => {
                    const nivel = r.probabilidade + r.severidade;
                    const meta = nivelMeta(nivel);
                    return (
                      <div key={idx} className="group px-4 py-2.5 hover:bg-accent/30 transition flex items-start gap-3">
                        <div className="h-6 w-6 rounded-md bg-muted text-muted-foreground text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          {String(r.ordem).padStart(2, "0")}
                        </div>
                        <button
                          type="button"
                          onClick={() => setRiscoEditIdx(idx)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground truncate">{r.risco_nome || <span className="italic text-muted-foreground">Sem nome — clique para editar</span>}</span>
                            {r.risco_categoria && <Badge variant="outline" className="text-[9px] font-black">{r.risco_categoria}</Badge>}
                          </div>
                          {r.passo_a_passo && (
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">{r.passo_a_passo}</div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {(r.epis ?? []).slice(0, 3).map((e, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] font-medium">{e}</Badge>
                            ))}
                            {(r.epis ?? []).length > 3 && <span className="text-[9px] text-muted-foreground">+{r.epis.length - 3} EPIs</span>}
                            {(r.nrs ?? []).slice(0, 3).map((n, i) => (
                              <Badge key={i} className="text-[9px] font-black bg-red-700/15 text-red-200 border-red-500/40">{n}</Badge>
                            ))}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className={cn("h-9 w-9 rounded-md flex items-center justify-center font-black text-white text-sm shrink-0", meta.cls)} title={`P${r.probabilidade}×S${r.severidade}=${nivel} · ${meta.label}`}>
                            {nivel}
                          </div>
                          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => moveRisco(idx, -1)} className="p-0.5 hover:bg-accent rounded"><ChevronUp className="h-3 w-3" /></button>
                            <button onClick={() => moveRisco(idx, 1)} className="p-0.5 hover:bg-accent rounded"><ChevronDown className="h-3 w-3" /></button>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setRiscoEditIdx(idx)} className="h-8 w-8 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => removeRisco(idx)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="px-4 py-2 border-t border-border bg-card/40 text-center text-[10px] font-black uppercase tracking-widest text-red-300/80 italic">
                "Nenhum trabalho é tão urgente ou importante que não possa ser planejado e executado com segurança"
              </div>
            </section>
          </>}

          {/* ══════ PASSO 2 GERAIS ══════ */}
          {tab === "p2" && (
            <section className="rounded-xl border border-border bg-card/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card/40">
                <div className="h-6 w-6 rounded-md bg-red-700/20 border border-red-500/40 flex items-center justify-center text-[10px] font-black text-red-200">2</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Gerais</h3>
                <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs"
                  onClick={() => setApr({ ...apr, texto_gerais: DEFAULT_TEXTO_GERAIS })}>
                  Restaurar padrão DMN
                </Button>
              </div>
              <div className="p-4">
                <Textarea rows={22} value={apr.texto_gerais ?? ""} onChange={(e) => setApr({ ...apr, texto_gerais: e.target.value })} className="font-mono text-xs leading-relaxed resize-none" />
              </div>
            </section>
          )}

          {/* ══════ PASSO 3 AVALIAÇÃO & ASSINATURAS ══════ */}
          {tab === "p3" && (
            <>
              <section className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-300 shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-wider text-red-100">
                  Ao observar outro risco não previsto — paralisar imediatamente e comunicar ao SESMT
                </span>
              </section>

              <section className="rounded-xl border border-border bg-card/60 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card/40">
                  <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Matriz de Avaliação</h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Probabilidade (frequência)</div>
                    <div className="grid grid-cols-3 gap-1.5 text-white font-black text-[11px] text-center">
                      <div className="bg-emerald-600 rounded-md py-2">BAIXA (1)</div>
                      <div className="bg-amber-500 rounded-md py-2">MÉDIA (2)</div>
                      <div className="bg-red-600 rounded-md py-2">ALTA (3)</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Severidade (impacto)</div>
                    <div className="grid grid-cols-3 gap-1.5 text-white font-black text-[11px] text-center">
                      <div className="bg-emerald-600 rounded-md py-2">BAIXA (1)</div>
                      <div className="bg-amber-500 rounded-md py-2">MÉDIA (2)</div>
                      <div className="bg-red-600 rounded-md py-2">ALTA (3)</div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Grau do Risco (P + S)</div>
                    <div className="grid grid-cols-5 gap-1.5 text-white font-black text-[11px] text-center">
                      <div className="bg-emerald-600 rounded-md py-2">2 · TRIVIAL</div>
                      <div className="bg-lime-500 rounded-md py-2">3 · TOLERÁVEL</div>
                      <div className="bg-amber-500 rounded-md py-2 text-black">4 · MODERADO</div>
                      <div className="bg-orange-500 rounded-md py-2">5 · SUBSTANCIAL</div>
                      <div className="bg-red-600 rounded-md py-2">6 · INACEITÁVEL</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card/60 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-card/40">
                  <h3 className="text-xs font-black uppercase tracking-widest text-foreground text-center tracking-[0.5em]">A S S I N A T U R A S</h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SignatureBox title="Técnico em Segurança do Trabalho" nome={tst?.nome ?? "—"}
                    value={(apr as any).signature_tst ?? null}
                    height={(apr as any).signature_tst_height ?? 80}
                    onChange={(v, h) => setApr({ ...apr, ...({ signature_tst: v, signature_tst_height: h } as any) })} />
                  <SignatureBox title="Responsável pelo Serviço" nome={empresa?.name ?? enc?.nome ?? "—"}
                    value={(apr as any).signature_enc ?? null}
                    height={(apr as any).signature_enc_height ?? 80}
                    onChange={(v, h) => setApr({ ...apr, ...({ signature_enc: v, signature_enc_height: h } as any) })} />
                </div>
                <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Encarregado Responsável (interno)</label>
                    <Select value={apr.encarregado_id ?? "none"} onValueChange={(v) => setApr({ ...apr, encarregado_id: v === "none" ? null : v })}>
                      <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhum —</SelectItem>
                        {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Condições Climáticas</label>
                    <Input className="h-9 mt-1" value={apr.condicoes_climaticas ?? ""} onChange={(e) => setApr({ ...apr, condicoes_climaticas: e.target.value })} />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ══════ PASSO 4 ANEXO I — EXECUTANTES ══════ */}
          {tab === "p4" && (
            <section className="rounded-xl border border-border bg-card/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card/40 flex-wrap">
                <div className="h-6 w-6 rounded-md bg-red-700/20 border border-red-500/40 flex items-center justify-center text-[10px] font-black text-red-200">4</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Anexo I — Executantes</h3>
                <Badge variant="outline" className="text-[10px] font-black">
                  {execAtuais.length}/{empresaFuncs.length} selecionados
                </Badge>
                {apr.empresa_id && empresaFuncs.length > 0 && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={execFilter} onChange={(e) => setExecFilter(e.target.value)}
                        placeholder="Buscar nome…" className="h-8 pl-7 w-48 text-xs" />
                    </div>
                    <Button size="sm" variant="outline" onClick={marcarTodosExecutantes} className="h-8 text-[10px] font-bold">
                      Marcar todos
                    </Button>
                    <Button size="sm" variant="outline" onClick={desmarcarTodosExecutantes} disabled={execAtuais.length === 0} className="h-8 text-[10px] font-bold">
                      Desmarcar
                    </Button>
                  </div>
                )}
              </div>

              {!apr.empresa_id && (
                <div className="p-6 text-center text-xs text-red-200 bg-red-950/30 border-b border-red-500/30">
                  Selecione a Empresa (Responsável pelo Serviço) no Passo 1 para listar os funcionários.
                </div>
              )}
              {apr.empresa_id && empresaFuncs.length === 0 && (
                <div className="p-6 text-center text-xs text-amber-200 bg-amber-950/20">
                  Nenhum funcionário ATIVO encontrado para esta empresa.
                </div>
              )}

              {apr.empresa_id && empresaFuncs.length > 0 && (
                <div className="divide-y divide-border">
                  {empresaFuncs
                    .filter((e: any) => !execFilter.trim() || String(e.nome).toLowerCase().includes(execFilter.toLowerCase()))
                    .map((e: any, i: number) => {
                      const checked = !!execAtuais.find((a) => a.employee_id === e.id);
                      const role = roles.find((r: any) => r.id === e.role_id);
                      const osOk = ossValidIds.has(e.id) || hasOsOverride(e.id);
                      return (
                        <div key={e.id} className={cn(
                          "flex items-center gap-3 px-4 py-2 hover:bg-accent/30 transition",
                          !osOk && "bg-red-950/20"
                        )}>
                          <span className="text-[10px] font-black text-muted-foreground w-6 text-center shrink-0">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <Checkbox checked={checked} disabled={!checked && !osOk} onCheckedChange={() => toggleExecutante(e.id)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-sm font-medium truncate", checked ? "text-foreground" : "text-muted-foreground")}>{e.nome}</span>
                              {!osOk && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="text-[9px] font-black bg-red-500/20 text-red-200 border border-red-500/40 shrink-0">
                                      <ShieldAlert className="h-2.5 w-2.5 mr-0.5" /> SEM OS
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>OS Assinada vencida ou ausente (NR-01 1.4.1 "c")</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">{role?.name ?? "—"}</div>
                          </div>
                          {!osOk && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" disabled={liberarOs.isPending}
                                  onClick={() => liberarOs.mutate({ empId: e.id, nome: e.nome })}
                                  className="h-7 px-2 text-[10px] font-black uppercase border-amber-500/50 text-amber-200 hover:bg-amber-500/15 shrink-0">
                                  <Unlock className="h-3 w-3 mr-1" /> Liberar OS
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Cria liberação ITEM:OS por 30 dias com justificativa</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ═══════════ FOOTER NAV ═══════════ */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 bg-card/40 border-t border-border shrink-0">
        <Button type="button" variant="outline" onClick={goBack} disabled={currentStepIdx === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Passo {currentStepIdx + 1} de {STEPS.length} · {STEPS[currentStepIdx].label}
        </div>
        {currentStepIdx < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext} className="bg-red-700 hover:bg-red-800 text-white font-black uppercase tracking-widest text-[11px]">
            Avançar <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => {
              const err = validateStep(currentStepIdx);
              if (err) { setStepError(err); toast.error(err); return; }
              setStepError(null);
              save.mutate(true);
            }}
            disabled={save.isPending}
            className="bg-red-700 hover:bg-red-800 text-white font-black uppercase tracking-widest text-[11px]"
          >
            <Check className="h-4 w-4 mr-1" /> Emitir APR
          </Button>
        )}
      </div>

      {/* ═══════════ MODAL EDITOR DE RISCO ═══════════ */}
      <Dialog open={riscoEditIdx !== null} onOpenChange={(o) => !o && setRiscoEditIdx(null)}>
        <DialogContent className="max-w-2xl bg-popover text-popover-foreground border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-red-700/20 border border-red-500/40 flex items-center justify-center text-[11px] font-black text-red-200">
                {riscoEditIdx !== null ? String((riscos[riscoEditIdx]?.ordem ?? riscoEditIdx + 1)).padStart(2, "0") : ""}
              </div>
              Editar Risco
            </DialogTitle>
            <DialogDescription>Todos os campos do risco em uma tela só — sem scroll horizontal.</DialogDescription>
          </DialogHeader>

          {riscoEditIdx !== null && (() => {
            const r = riscos[riscoEditIdx];
            if (!r) return null;
            const nivel = r.probabilidade + r.severidade;
            const meta = nivelMeta(nivel);
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Passo a Passo da Atividade</label>
                  <Textarea rows={2} className="mt-1 resize-none" value={r.passo_a_passo ?? ""} onChange={(e) => updateRisco(riscoEditIdx, { passo_a_passo: e.target.value })} placeholder={`${r.ordem}. Descreva o passo…`} />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Risco (catálogo)</label>
                  <Select value={r.catalogo_risco_id ?? undefined} onValueChange={(v) => setRiscoFromCatalogo(riscoEditIdx, v)}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={r.risco_nome || "Selecionar risco…"} /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {catRiscos.map((c: any) => <SelectItem key={c.id} value={c.id}>[{c.categoria}] {c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="h-8 mt-1.5 text-xs" placeholder="Ou digite um nome livre…" value={r.risco_nome} onChange={(e) => updateRisco(riscoEditIdx, { risco_nome: e.target.value })} />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Efeitos / Danos</label>
                  <Textarea rows={2} className="mt-1 resize-none" value={r.efeitos_danos ?? ""} onChange={(e) => updateRisco(riscoEditIdx, { efeitos_danos: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Probabilidade</label>
                  <Select value={String(r.probabilidade)} onValueChange={(v) => updateRisco(riscoEditIdx, { probabilidade: parseInt(v) })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 · Baixa</SelectItem>
                      <SelectItem value="2">2 · Média</SelectItem>
                      <SelectItem value="3">3 · Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Severidade</label>
                  <Select value={String(r.severidade)} onValueChange={(v) => updateRisco(riscoEditIdx, { severidade: parseInt(v) })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 · Baixa</SelectItem>
                      <SelectItem value="2">2 · Média</SelectItem>
                      <SelectItem value="3">3 · Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3">
                  <div className={cn("h-14 w-14 rounded-lg flex items-center justify-center font-black text-white text-2xl shrink-0", meta.cls)}>
                    {nivel}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Grau resultante</div>
                    <div className="text-lg font-black">{meta.label}</div>
                    <div className="text-[11px] text-muted-foreground">P{r.probabilidade} × S{r.severidade} = {nivel}</div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ações Preventivas</label>
                  <Textarea rows={3} className="mt-1 resize-none" value={r.acoes_preventivas ?? ""} onChange={(e) => updateRisco(riscoEditIdx, { acoes_preventivas: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">EPIs (separados por vírgula)</label>
                  <Input className="h-9 mt-1" value={(r.epis ?? []).join(", ")} onChange={(e) => updateRisco(riscoEditIdx, { epis: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">NRs (separadas por vírgula)</label>
                  <Input className="h-9 mt-1" value={(r.nrs ?? []).join(",")} onChange={(e) => updateRisco(riscoEditIdx, { nrs: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Responsável pelas Ações</label>
                  <Input className="h-9 mt-1" value={r.responsavel_acoes ?? ""} onChange={(e) => updateRisco(riscoEditIdx, { responsavel_acoes: e.target.value })} />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            {riscoEditIdx !== null && (
              <Button variant="ghost" onClick={() => { removeRisco(riscoEditIdx); setRiscoEditIdx(null); }} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 mr-auto">
                <Trash2 className="h-4 w-4 mr-1" /> Remover risco
              </Button>
            )}
            <Button variant="outline" onClick={() => setRiscoEditIdx(null)}>Fechar</Button>
            <Button onClick={() => setRiscoEditIdx(null)} className="bg-red-700 hover:bg-red-800 text-white">
              <Check className="h-4 w-4 mr-1" /> Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PteLookupSheet
        open={pteSheetOpen}
        onOpenChange={setPteSheetOpen}
        aprId={currentAprId}
        aprNumero={apr.numero ?? null}
        aprLocal={apr.local ?? null}
        empresaId={apr.empresa_id ?? null}
        riscoSugerido={
          pteSheetRiscoSugerido ??
          (deteccaoPTE.categoriaPrincipal
            ? CATEGORIA_PTE_TO_RISCO_LABEL[deteccaoPTE.categoriaPrincipal] ?? null
            : null)
        }
        onPick={(pteId) => {
          setApr((a) => ({ ...a, pte_id: a.pte_id ?? pteId, exige_pte: true }));
          setDraftPteIds((ids) => (ids.includes(pteId) ? ids : [...ids, pteId]));
          (async () => {
            if (currentAprId && apr.pte_id && apr.pte_id !== pteId) {
              await supabase.from("ptes").update({ apr_id: currentAprId }).eq("id", apr.pte_id).is("apr_id", null);
            }
            if (currentAprId) {
              await supabase.from("ptes").update({ apr_id: currentAprId }).eq("id", pteId).is("apr_id", null);
            }
            qc.invalidateQueries({ queryKey: ["ptes-light"] });
            qc.invalidateQueries({ queryKey: ["ptes-linked-apr", currentAprId] });
          })();
        }}
      />
    </div>
    </TooltipProvider>
  );
}
