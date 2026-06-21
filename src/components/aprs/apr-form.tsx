import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, Save, FileText, Printer, Check, ChevronLeft, ChevronRight } from "lucide-react";
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
    window.open(doc.output("bloburl"), "_blank");
  }
  async function handleImprimir() {
    if (!apr.id) { toast.error("Salve a APR antes"); return; }
    const doc = await buildPdf();
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
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
    <div className="light-paper flex flex-col h-full bg-slate-100">
      {/* Toolbar com stepper linear */}
      <div className="p-3 bg-white border-b border-slate-300 space-y-2">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = i < currentStepIdx;
            const active = i === currentStepIdx;
            const locked = i > currentStepIdx;
            return (
              <div key={s.key} className="flex items-center flex-1 min-w-0">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => { if (!locked) { setStepError(null); setTab(s.key as any); } }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded transition",
                    locked && "opacity-50 cursor-not-allowed",
                    !locked && "hover:bg-slate-50",
                  )}
                  title={locked ? "Conclua os passos anteriores" : s.label}
                >
                  <span
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                      done && "bg-emerald-600 text-white",
                      active && "text-white",
                      !done && !active && "bg-slate-200 text-slate-500",
                    )}
                    style={active ? { background: APR_RED } : {}}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={cn("text-[11px] font-bold truncate", active ? "text-slate-900" : "text-slate-500")}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-0.5 mx-1", i < currentStepIdx ? "bg-emerald-600" : "bg-slate-200")} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Passo {currentStepIdx + 1} de {STEPS.length}
          </span>
          {stepError && <span className="text-[11px] font-bold text-rose-600">⚠ {stepError}</span>}
          <div className="ml-auto flex gap-2">
          <Button
            variant={categoriasPendentes.length > 0 ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setPteSheetRiscoSugerido(categoriasPendentes[0]?.riscoLabel ?? null);
              setPteSheetOpen(true);
            }}
            className={
              categoriasPendentes.length > 0
                ? "h-8 px-2.5 text-[11px] bg-gradient-to-br from-rose-700 to-rose-950 hover:from-rose-600 hover:to-rose-900 text-rose-50 border border-rose-400/30 shadow-[0_0_12px_-4px_rgba(220,38,70,0.5)]"
                : ""
            }
            title="Vincular ou criar PTE sem sair da APR"
          >
            <FileText className="h-4 w-4 mr-1" />
            {categoriasPendentes.length > 0
              ? `Resolver ${categoriasPendentes.length} PTE${categoriasPendentes.length > 1 ? "s" : ""}`
              : todasPtesVinculadas.length > 0
              ? "Gerenciar PTEs"
              : "Vincular/Nova PTE"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleAbrir} disabled={!apr.id}><FileText className="h-4 w-4 mr-1" /> Abrir PDF</Button>
          <Button variant="outline" size="sm" onClick={handleImprimir} disabled={!apr.id}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
          <Button variant="outline" size="sm" onClick={() => save.mutate(false)} disabled={save.isPending}><Save className="h-4 w-4 mr-1" /> Salvar Rascunho</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ============ PÁGINA 1 ============ */}
        {tab === "p1" && (
          <div className="bg-white max-w-[1400px] mx-auto shadow border border-slate-300">
            <PaperFullHeader apr={apr} setApr={setApr} empresa={empresa} casco={casco} enc={enc} tst={tst}
              employees={employees} companies={companies} pagina={1} />

            {/* Painel de cobertura de PTE — design dark/vinho coeso com o sistema */}
            {coberturaCategorias.length > 0 && (() => {
              const hasPendente = categoriasPendentes.length > 0;
              const accent = hasPendente
                ? { border: "border-rose-500/50", glow: "shadow-[0_0_24px_-8px_rgba(220,38,70,0.55)]", chipBg: "bg-rose-500/20", chipText: "text-rose-100", icon: "text-rose-300", title: "text-rose-100" }
                : { border: "border-emerald-400/30", glow: "shadow-[0_0_24px_-10px_rgba(16,185,129,0.45)]", chipBg: "bg-emerald-500/15", chipText: "text-emerald-200", icon: "text-emerald-300", title: "text-emerald-100" };
              return (
                <div
                  className={`relative border-x border-b border-[#7f1d1d]/50 ${accent.glow}`}
                  style={{ background: "linear-gradient(135deg, rgba(60,10,20,0.92) 0%, rgba(20,5,10,0.96) 100%)" }}
                >
                  {/* Faixa de status */}
                  <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/5 ${accent.border} border-l-2`}>
                    {hasPendente ? (
                      <AlertTriangle className={`h-4 w-4 ${accent.icon} shrink-0`} />
                    ) : (
                      <FileText className={`h-4 w-4 ${accent.icon} shrink-0`} />
                    )}
                    <div className={`text-[11px] font-black uppercase tracking-wider ${accent.title}`}>
                      {hasPendente
                        ? "PTE obrigatória — cobertura incompleta"
                        : "PTE — Todas as categorias cobertas"}
                    </div>
                    <span className={`ml-auto text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${accent.chipBg} ${accent.chipText} border border-current/20`}>
                      {categoriasCobertas.length}/{coberturaCategorias.length} cobertas
                    </span>
                  </div>

                  {/* Lista de categorias */}
                  <div className="divide-y divide-white/5">
                    {coberturaCategorias.map((c) => {
                      if (c.pte) {
                        const pte: any = c.pte;
                        return (
                          <div key={c.categoria} className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.03]">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/90 text-white font-black text-[10px] shrink-0">✓</span>
                            <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-100">{c.categoria}</span>
                              <span className="text-[10px] text-emerald-200/70">
                                PTE Nº <b className="text-emerald-100">{pte.numero ?? String(pte.id).slice(0, 8)}</b>
                                <span className="mx-1 text-emerald-200/40">·</span>
                                {formatDateBR(pte.data_emissao)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      if (c.riscoLabel) {
                        return (
                          <div key={c.categoria} className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.03]">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] shrink-0">!</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-rose-100">{c.categoria}</div>
                              <div className="text-[10px] text-rose-200/70 truncate">{c.motivo}</div>
                            </div>
                            <Button
                              size="sm"
                              className="h-6 px-2 text-[10px] font-bold uppercase tracking-wide bg-gradient-to-br from-rose-600 to-rose-900 hover:from-rose-500 hover:to-rose-800 text-rose-50 border border-rose-400/30 shadow-[0_0_10px_-3px_rgba(220,38,70,0.5)] shrink-0"
                              onClick={() => {
                                setPteSheetRiscoSugerido(c.riscoLabel);
                                setPteSheetOpen(true);
                              }}
                            >
                              Resolver
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <div key={c.categoria} className="flex items-center gap-3 px-4 py-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-white/70 font-black text-[10px] shrink-0">i</span>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-white/80">{c.categoria}</span>
                            <span className="text-[10px] text-white/50 ml-2">{c.motivo} (informativo)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Casco | PTE — Validade subiu para o cabeçalho */}
            <div className="grid grid-cols-2">
              <PaperCell label="Casco / Embarcação">
                <Select value={apr.casco_id ?? "none"} onValueChange={(v) => setApr({ ...apr, casco_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-7 text-xs border-0 p-0"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {cascos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.numero}{c.nome ? ` · ${c.nome}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </PaperCell>
              <PaperCell label={`PTE Vinculada${apr.exige_pte ? " *" : ""}`}>
                <Select value={apr.pte_id ?? "none"} onValueChange={(v) => setApr({ ...apr, pte_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-7 text-xs border-0 p-0"><SelectValue placeholder="— Sem PTE —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem PTE —</SelectItem>
                    {ptes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.numero ?? p.id.slice(0, 8)} · {formatDateBR(p.data_emissao)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </PaperCell>
            </div>

            {/* Tabela de riscos com cabeçalho LARANJA */}
            <div className="border-t-2 border-black">
              {/* Cabeçalho duplo: super-header AVALIAÇÃO DO RISCO sobre P/S/G */}
              <div className="grid text-black text-[11px] font-bold text-center" style={{ background: APR_ORANGE, gridTemplateColumns: "1.6fr 1.4fr 1.4fr 1.3fr 2fr 1.2fr 1.2fr 0.7fr" }}>
                <div className="border border-black px-1 py-1.5 row-span-2 flex items-center justify-center">PASSO A PASSO DA ATIVIDADE</div>
                <div className="border border-black px-1 py-1.5 row-span-2 flex items-center justify-center">RISCOS IDENTIFICADOS</div>
                <div className="border border-black px-1 py-1.5 row-span-2 flex items-center justify-center">EFEITOS / DANOS</div>
                <div className="border border-black px-1 py-1 col-start-4">AVALIAÇÃO DO RISCO</div>
                <div className="border border-black px-1 py-1.5 row-span-2 flex items-center justify-center col-start-5 row-start-1">AÇÕES PREVENTIVAS DOS RISCOS</div>
                <div className="border border-black px-1 py-1.5 row-span-2 flex items-center justify-center col-start-6 row-start-1">EPI</div>
                <div className="border border-black px-1 py-1.5 row-span-2 flex items-center justify-center col-start-7 row-start-1">RESPONSÁVEIS PELAS AÇÕES</div>
                <div className="border border-black px-1 py-1.5 row-span-2 flex items-center justify-center col-start-8 row-start-1">NRs</div>
                {/* Sub-cabeçalho P/S/G dentro da coluna AVALIAÇÃO */}
                <div className="border border-black col-start-4 row-start-2 grid grid-cols-3">
                  <div className="border-r border-black py-1">P</div>
                  <div className="border-r border-black py-1">S</div>
                  <div className="py-1">G</div>
                </div>
              </div>

              {riscos.length === 0 ? (
                <div className="text-center text-slate-400 py-6 text-xs border border-black">Nenhum risco. Use o botão abaixo para adicionar.</div>
              ) : riscos.map((r, idx) => {
                const nivel = r.probabilidade + r.severidade;
                const meta = nivelMeta(nivel);
                return (
                  <div key={idx} className="grid text-[11px] items-stretch"
                    style={{ gridTemplateColumns: "1.6fr 1.4fr 1.4fr 0.4fr 0.4fr 0.5fr 2fr 1.2fr 1.2fr 0.7fr" }}>
                    <div className="border border-black p-1">
                      <Textarea rows={2} placeholder={`${r.ordem}. Descreva o passo...`}
                        className="text-[11px] border-0 p-0 resize-none focus-visible:ring-0"
                        value={r.passo_a_passo ?? ""} onChange={(e) => updateRisco(idx, { passo_a_passo: e.target.value })} />
                    </div>
                    <div className="border border-black p-1">
                      <Select value={r.catalogo_risco_id ?? undefined} onValueChange={(v) => setRiscoFromCatalogo(idx, v)}>
                        <SelectTrigger className="h-6 text-[11px] border-0 p-0 font-bold"><SelectValue placeholder={r.risco_nome || "Selecionar risco..."} /></SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {catRiscos.map((c: any) => <SelectItem key={c.id} value={c.id}>[{c.categoria}] {c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="border border-black p-1">
                      <Textarea rows={2} className="text-[11px] border-0 p-0 resize-none focus-visible:ring-0" value={r.efeitos_danos ?? ""} onChange={(e) => updateRisco(idx, { efeitos_danos: e.target.value })} />
                    </div>
                    <div className="border border-black p-0.5">
                      <Select value={String(r.probabilidade)} onValueChange={(v) => updateRisco(idx, { probabilidade: parseInt(v) })}>
                        <SelectTrigger className="h-6 text-[11px] border-0 p-0 justify-center"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1,2,3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="border border-black p-0.5">
                      <Select value={String(r.severidade)} onValueChange={(v) => updateRisco(idx, { severidade: parseInt(v) })}>
                        <SelectTrigger className="h-6 text-[11px] border-0 p-0 justify-center"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1,2,3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className={`border border-black flex items-center justify-center font-black text-white ${meta.cls}`}>{nivel}</div>
                    <div className="border border-black p-1">
                      <Textarea rows={2} className="text-[11px] border-0 p-0 resize-none focus-visible:ring-0" value={r.acoes_preventivas ?? ""} onChange={(e) => updateRisco(idx, { acoes_preventivas: e.target.value })} />
                    </div>
                    <div className="border border-black p-1">
                      <Input className="h-6 text-[11px] border-0 p-0" value={(r.epis ?? []).join(", ")} onChange={(e) => updateRisco(idx, { epis: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                    </div>
                    <div className="border border-black p-1">
                      <Input className="h-6 text-[11px] border-0 p-0" value={r.responsavel_acoes ?? ""} onChange={(e) => updateRisco(idx, { responsavel_acoes: e.target.value })} />
                    </div>
                    <div className="border border-black p-1 flex items-center justify-between gap-0.5">
                      <Input className="h-6 text-[10px] border-0 p-0 w-12" value={(r.nrs ?? []).join(",")} onChange={(e) => updateRisco(idx, { nrs: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                      <div className="flex flex-col">
                        <button onClick={() => moveRisco(idx, -1)} className="hover:bg-slate-200 rounded"><ChevronUp className="h-3 w-3" /></button>
                        <button onClick={() => moveRisco(idx, 1)} className="hover:bg-slate-200 rounded"><ChevronDown className="h-3 w-3" /></button>
                      </div>
                      <button onClick={() => removeRisco(idx)} className="text-rose-600 hover:bg-rose-50 rounded p-0.5"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                );
              })}

              <div className="bg-slate-50 p-2 flex flex-wrap gap-2 items-center border border-black border-t-0">
                <Select onValueChange={addRiscoFromCatalogo}>
                  <SelectTrigger className="w-[280px] h-8 text-xs"><SelectValue placeholder="+ Adicionar do catálogo..." /></SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {catRiscos.map((c: any) => <SelectItem key={c.id} value={c.id}>[{c.categoria}] {c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={addRiscoLivre}><Plus className="h-3.5 w-3.5 mr-1" /> Risco manual</Button>
                {temRiscoGrave && (
                  <span className="ml-auto text-xs font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                    <AlertTriangle className="h-3 w-3" /> Risco ALTO/CRÍTICO — PTE obrigatória
                  </span>
                )}
              </div>
            </div>

            <div className="text-center font-bold text-[11px] text-rose-600 p-2 italic">
              "NENHUM TRABALHO É TÃO URGENTE OU IMPORTANTE QUE NÃO POSSA SER PLANEJADO E EXECUTADO COM SEGURANÇA"
            </div>
          </div>
        )}

        {/* ============ PÁGINA 2 — GERAIS ============ */}
        {tab === "p2" && (
          <div className="bg-white max-w-[1100px] mx-auto shadow border border-slate-300">
            <PaperFullHeader apr={apr} empresa={empresa} casco={casco} enc={enc} tst={tst} pagina={2} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-black text-base">GERAIS:</h2>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => setApr({ ...apr, texto_gerais: DEFAULT_TEXTO_GERAIS })}>Restaurar padrão DMN</Button>
              </div>
              <Textarea rows={26} value={apr.texto_gerais ?? ""} onChange={(e) => setApr({ ...apr, texto_gerais: e.target.value })} className="font-mono text-xs leading-relaxed" />
            </div>
          </div>
        )}

        {/* ============ PÁGINA 3 — Avaliação & Assinaturas ============ */}
        {tab === "p3" && (
          <div className="bg-white max-w-[1100px] mx-auto shadow border border-slate-300">
            <PaperFullHeader apr={apr} empresa={empresa} casco={casco} enc={enc} tst={tst} pagina={3} />
            <div className="p-4 space-y-3">
              <div className="text-center text-[11px] font-bold text-rose-600 border border-rose-300 bg-rose-50 p-2">
                ATENÇÃO: AO OBSERVAR OUTRO RISCO NÃO PREVISTO NESTA APR, PARALISAR O TRABALHO IMEDIATAMENTE E COMUNICAR AO SESMT
              </div>

              <div className="grid grid-cols-2 gap-0">
                <div className="border border-black p-2 text-xs">
                  <div className="font-bold mb-1">Riscos Ambientais — Classificar:</div>
                  <div>1 – Físico   2 – Químico   3 – Biológico   4 – Ergonômico   5 – Mecânico/Acidentes</div>
                </div>
                <div className="border border-black p-2 text-xs">
                  <div className="font-bold mb-1">Atender a Hierarquia:</div>
                  <div>CA – Controles Administrativos / EPC – Equip. de Proteção Coletiva / EPI – Equip. de Proteção Individual</div>
                </div>
              </div>

              {/* Avaliação do Risco */}
              <div className="border border-black">
                <div className="grid grid-cols-[160px_1fr_1fr]">
                  <div className="border-r border-black p-2 font-black text-xs flex items-center justify-center text-center">AVALIAÇÃO DO RISCO</div>
                  <div className="border-r border-black">
                    <div className="border-b border-black p-1 text-center font-bold text-[11px]">PROBABILIDADE (FREQUÊNCIA)</div>
                    <div className="grid grid-cols-3 text-white font-bold text-[11px]">
                      <div className="bg-emerald-500 p-2 text-center">BAIXA (1)</div>
                      <div className="bg-yellow-500 p-2 text-center">MÉDIA (2)</div>
                      <div className="bg-red-600 p-2 text-center">ALTA (3)</div>
                    </div>
                  </div>
                  <div>
                    <div className="border-b border-black p-1 text-center font-bold text-[11px]">SEVERIDADE (IMPACTO)</div>
                    <div className="grid grid-cols-3 text-white font-bold text-[11px]">
                      <div className="bg-emerald-500 p-2 text-center">BAIXA (1)</div>
                      <div className="bg-yellow-500 p-2 text-center">MÉDIA (2)</div>
                      <div className="bg-red-600 p-2 text-center">ALTA (3)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-black">
                <div className="bg-slate-100 text-center font-bold text-xs p-1 border-b border-black">
                  GRAU DO RISCO (SOMATÓRIO DA PROBABILIDADE + SEVERIDADE)
                </div>
                <div className="grid grid-cols-5 text-white font-black text-xs">
                  <div className="bg-emerald-500 p-2 text-center">2 = TRIVIAL</div>
                  <div className="bg-lime-500 p-2 text-center">3 = TOLERÁVEL</div>
                  <div className="bg-yellow-500 p-2 text-center text-black">4 = MODERADO</div>
                  <div className="bg-orange-500 p-2 text-center">5 = SUBSTANCIAL</div>
                  <div className="bg-red-600 p-2 text-center">6 = INACEITÁVEL</div>
                </div>
              </div>

              <h3 className="text-center font-black text-base tracking-widest mt-4">A S S I N A T U R A S</h3>
              <div className="grid grid-cols-2 gap-3">
                <SignatureBox
                  title="Técnico em Segurança do Trabalho"
                  nome={tst?.nome ?? "—"}
                  value={(apr as any).signature_tst ?? null}
                  height={(apr as any).signature_tst_height ?? 80}
                  onChange={(v, h) => setApr({ ...apr, ...({ signature_tst: v, signature_tst_height: h } as any) })}
                />
                <SignatureBox
                  title="Responsável pelo Serviço"
                  nome={empresa?.name ?? enc?.nome ?? "—"}
                  value={(apr as any).signature_enc ?? null}
                  height={(apr as any).signature_enc_height ?? 80}
                  onChange={(v, h) => setApr({ ...apr, ...({ signature_enc: v, signature_enc_height: h } as any) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-bold">Encarregado Responsável (interno)</label>
                  <Select value={apr.encarregado_id ?? "none"} onValueChange={(v) => setApr({ ...apr, encarregado_id: v === "none" ? null : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold">Condições climáticas</label>
                  <Input className="h-8 text-xs" value={apr.condicoes_climaticas ?? ""} onChange={(e) => setApr({ ...apr, condicoes_climaticas: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ PÁGINA 4 — ANEXO I EXECUTANTES ============ */}
        {tab === "p4" && (
          <div className="bg-white max-w-[1100px] mx-auto shadow border border-slate-300">
            <PaperFullHeader apr={apr} empresa={empresa} casco={casco} enc={enc} tst={tst} pagina={4} />
            <div className="p-4 space-y-3">
              <h2 className="text-center font-black text-base">ANEXO I – ASSINATURA DOS EXECUTANTES DO SERVIÇO</h2>
              {!apr.empresa_id && (
                <div className="text-center text-rose-700 bg-rose-50 border border-rose-200 p-2 text-xs font-bold rounded">
                  Selecione a Empresa em <em>"Responsável pelo Serviço"</em> na Página 1 para listar os funcionários.
                </div>
              )}
              {apr.empresa_id && empresaFuncs.length === 0 && (
                <div className="text-center text-amber-700 bg-amber-50 border border-amber-200 p-2 text-xs font-bold rounded">
                  Nenhum funcionário ATIVO encontrado para esta empresa.
                </div>
              )}

              <div className="text-xs text-slate-600">
                Marque/desmarque quem realmente vai executar este serviço. Por padrão, todos os funcionários ativos da empresa vêm marcados.
              </div>

              {apr.empresa_id && empresaFuncs.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={marcarTodosExecutantes}
                    className="h-8 text-xs font-bold"
                  >
                    ✓ Marcar todos ({empresaFuncs.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={desmarcarTodosExecutantes}
                    className="h-8 text-xs font-bold"
                    disabled={execAtuais.length === 0}
                  >
                    ✕ Desmarcar todos
                  </Button>
                </div>
              )}

              <div className="border-2 border-black">
                <div className="grid grid-cols-[50px_60px_1fr_120px] bg-slate-100 font-bold text-xs border-b border-black">
                  <div className="border-r border-black p-1.5 text-center">Nº</div>
                  <div className="border-r border-black p-1.5 text-center">Inclui?</div>
                  <div className="border-r border-black p-1.5">NOME</div>
                  <div className="p-1.5">FUNÇÃO</div>
                </div>
                {empresaFuncs.map((e: any, i: number) => {
                  const checked = !!execAtuais.find((a) => a.employee_id === e.id);
                  const role = roles.find((r: any) => r.id === e.role_id);
                  const osOk = ossValidIds.has(e.id) || hasOsOverride(e.id);
                  return (
                    <div key={e.id} className={`grid grid-cols-[50px_60px_1fr_120px] text-xs border-b border-black ${checked ? "" : osOk ? "bg-slate-50 text-slate-400" : "bg-red-50 text-red-700"}`}>
                      <div className="border-r border-black p-1.5 text-center font-bold">{String(i + 1).padStart(2, "0")}</div>
                      <div className="border-r border-black p-1.5 flex items-center justify-center">
                        <Checkbox checked={checked} disabled={!checked && !osOk} onCheckedChange={() => toggleExecutante(e.id)} />
                      </div>
                      <div className="border-r border-black p-1.5 flex items-center gap-2 flex-wrap">
                        <span>{e.nome}</span>
                        {!osOk && (
                          <>
                            <span className="text-[10px] font-bold uppercase">🚫 Sem OS Assinada</span>
                            <button
                              type="button"
                              disabled={liberarOs.isPending}
                              onClick={() => liberarOs.mutate({ empId: e.id, nome: e.nome })}
                              className="ml-auto text-[9px] font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded shadow-sm disabled:opacity-50"
                              title="Cria uma liberação ITEM:OS por 30 dias com justificativa"
                            >
                              🔓 Liberar OS agora
                            </button>
                          </>
                        )}
                      </div>
                      <div className="p-1.5">{role?.name ?? "—"}</div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-slate-600 mt-2">
                <strong>{execAtuais.length}</strong> executante(s) selecionado(s) — aparecerão na página 5 do PDF.
              </div>
            </div>
          </div>
        )}
      </div>

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
          // NÃO sobrescrever apr.pte_id se já houver uma PTE legada vinculada —
          // ela é a única referência da PTE anterior (que não tem apr_id próprio).
          // Sobrescrever causa a PTE antiga "sumir" da cobertura e gerar loop.
          setApr((a) => ({ ...a, pte_id: a.pte_id ?? pteId, exige_pte: true }));
          // Mantém o registro de TODAS as PTEs vinculadas no rascunho — assim a
          // cobertura por categoria funciona mesmo antes de salvar a APR.
          setDraftPteIds((ids) => (ids.includes(pteId) ? ids : [...ids, pteId]));
          // Migra a PTE legada para o modelo moderno (apr_id na própria linha),
          // garantindo que apareça em linkedPtes e a cobertura seja estável.
          (async () => {
            if (currentAprId && apr.pte_id && apr.pte_id !== pteId) {
              await supabase
                .from("ptes")
                .update({ apr_id: currentAprId })
                .eq("id", apr.pte_id)
                .is("apr_id", null);
            }
            // Se a APR já existe, vincula imediatamente a nova PTE também.
            if (currentAprId) {
              await supabase
                .from("ptes")
                .update({ apr_id: currentAprId })
                .eq("id", pteId)
                .is("apr_id", null);
            }
            qc.invalidateQueries({ queryKey: ["ptes-light"] });
            qc.invalidateQueries({ queryKey: ["ptes-linked-apr", currentAprId] });
          })();
        }}
      />

      {/* Rodapé do wizard */}
      <div className="flex items-center justify-between gap-2 p-3 bg-white border-t border-slate-300 shrink-0">
        <Button type="button" variant="outline" onClick={goBack} disabled={currentStepIdx === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="text-[11px] text-slate-500">
          {STEPS[currentStepIdx].label}
        </div>
        {currentStepIdx < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext} className="bg-[#0f172a] hover:bg-[#7B1E2B] text-white font-black uppercase tracking-widest text-[11px]">
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
            style={{ background: APR_RED }}
            className="text-white font-black uppercase tracking-widest text-[11px]"
          >
            <Check className="h-4 w-4 mr-1" /> Emitir APR
          </Button>
        )}
      </div>
    </div>
  );
}
