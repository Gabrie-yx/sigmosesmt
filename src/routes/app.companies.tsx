import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserPlus, Pencil, Plus, X, ChevronRight, HardHat,
  HeartPulse, Award, FolderOpen, CheckCircle2, AlertTriangle, Users, User, UserCog,
  Upload, Download, ArrowLeft, Building2, Briefcase, IdCard, Shield, Search,
  Loader2, RefreshCw, FileText, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { EmployeeDetailContent } from "./app.employees.$id";
import { maskCNPJ } from "@/lib/masks";
import { NewEmployeeDialog } from "@/components/employees/new-employee-dialog";
import { CompanyDossieDialog } from "@/components/companies/company-dossie-dialog";
import { FileViewerHost, openFileViewer } from "@/components/file-viewer";
import { consultarCNPJ, extrairCNPJdeTexto, type ReceitaCNPJData } from "@/lib/brasilapi-cnpj";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/app/companies")({
  component: CompaniesPage,
});

type Company = {
  id: string;
  name: string;
  type: string;
  cnpj: string | null;
  email: string | null;
  encarregado1: string | null;
  encarregado2: string | null;
  data_entrada?: string | null;
  matriz_nome?: string | null;
  matriz_cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnae_principal?: string | null;
  cnae_descricao?: string | null;
  grau_risco?: number | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
  situacao_cadastral?: string | null;
  data_situacao?: string | null;
  capital_social?: number | null;
  natureza_juridica?: string | null;
  cnaes_secundarias?: Array<{ codigo: string; descricao: string }> | null;
  cnpj_card_url?: string | null;
  receita_consultada_em?: string | null;
};

const empty: Partial<Company> = {
  name: "", type: "CLT", cnpj: "", email: "", encarregado1: "", encarregado2: "",
  matriz_nome: "", matriz_cnpj: "",
  razao_social: "", nome_fantasia: "",
  cnae_principal: "", cnae_descricao: "", grau_risco: null,
  logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "",
  telefone: "", situacao_cadastral: "", data_situacao: "", capital_social: null, natureza_juridica: "",
  cnaes_secundarias: [], cnpj_card_url: "",
};

const typeStyle: Record<string, string> = {
  CLT: "bg-emerald-100 text-emerald-700",
  TERCEIRIZADO: "bg-indigo-100 text-indigo-700",
  TERCEIRIZADA: "bg-indigo-100 text-indigo-700",
  CONTRATANTE: "bg-red-100 text-red-700",
};

function CompaniesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isEditor, isAdmin } = useAuth();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("profile");
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [empSearch, setEmpSearch] = useState("");
  const [newEmpOpen, setNewEmpOpen] = useState(false);
  const [dossieOpen, setDossieOpen] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return data as Company[];
    },
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-light"],
    queryFn: async () => (await supabase.from("employees").select("id,nome,cpf,matricula,company_id,role_id,foto_url,tipo_cadastro,nrs,status,data_aso").order("nome")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("*")).data ?? [],
  });
  const { data: exams = [] } = useQuery({
    queryKey: ["exams-all"],
    queryFn: async () => (await supabase.from("employee_exams").select("*")).data ?? [],
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["docs-all"],
    queryFn: async () => (await supabase.from("employee_docs").select("*")).data ?? [],
  });
  const { data: dossieStatus = [] } = useQuery({
    queryKey: ["dossie-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_contratada_dossie_status" as any)
        .select("company_id,status_geral,docs_vencidos,acordos_ativos");
      return ((data ?? []) as unknown) as Array<{ company_id: string; status_geral: string; docs_vencidos: number; acordos_ativos: number }>;
    },
  });
  const dossieByCompany = useMemo(() => {
    const m: Record<string, { status: string; docs_vencidos: number; acordos_ativos: number }> = {};
    for (const d of dossieStatus) m[d.company_id] = { status: d.status_geral, docs_vencidos: d.docs_vencidos, acordos_ativos: d.acordos_ativos };
    return m;
  }, [dossieStatus]);

  const save = useMutation({
    mutationFn: async (v: Partial<Company>) => {
      const payload = {
        name: v.name!, type: v.type ?? "CLT",
        cnpj: v.cnpj || null, email: v.email || null,
        encarregado1: v.encarregado1 || null, encarregado2: v.encarregado2 || null,
        data_entrada: (v as any).data_entrada || null,
        matriz_nome: v.matriz_nome || null,
        matriz_cnpj: v.matriz_cnpj || null,
        razao_social: v.razao_social || null,
        nome_fantasia: v.nome_fantasia || null,
        cnae_principal: v.cnae_principal || null,
        cnae_descricao: v.cnae_descricao || null,
        grau_risco: v.grau_risco ?? null,
        logradouro: v.logradouro || null,
        numero: v.numero || null,
        complemento: v.complemento || null,
        bairro: v.bairro || null,
        cidade: v.cidade || null,
        uf: v.uf || null,
        cep: v.cep || null,
        telefone: v.telefone || null,
        situacao_cadastral: v.situacao_cadastral || null,
        data_situacao: v.data_situacao || null,
        capital_social: v.capital_social ?? null,
        natureza_juridica: v.natureza_juridica || null,
        cnaes_secundarias: v.cnaes_secundarias ?? null,
        cnpj_card_url: v.cnpj_card_url || null,
        receita_consultada_em: (v as any).receita_consultada_em || null,
      };
      if (v.id) {
        const { error } = await supabase.from("companies").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      setEditing({ ...empty });
      toast.success("Empresa salva");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Atualização retroativa em lote via Receita Federal
  const atualizarTodasReceita = useMutation({
    mutationFn: async () => {
      const alvos = companies.filter((c) => (c.cnpj || "").replace(/\D/g, "").length === 14);
      let ok = 0, fail = 0;
      for (const c of alvos) {
        try {
          const d = await consultarCNPJ(c.cnpj!);
          const patch: any = {
            razao_social: d.razao_social, nome_fantasia: d.nome_fantasia,
            cnae_principal: d.cnae_principal, cnae_descricao: d.cnae_descricao,
            grau_risco: d.grau_risco,
            logradouro: d.logradouro, numero: d.numero, complemento: d.complemento,
            bairro: d.bairro, cidade: d.cidade, uf: d.uf, cep: d.cep,
            telefone: d.telefone, situacao_cadastral: d.situacao_cadastral,
            data_situacao: d.data_situacao, capital_social: d.capital_social,
            natureza_juridica: d.natureza_juridica,
            cnaes_secundarias: d.cnaes_secundarias ?? [],
            receita_consultada_em: new Date().toISOString(),
          };
          await supabase.from("companies").update(patch).eq("id", c.id);
          ok++;
        } catch { fail++; }
        await new Promise((r) => setTimeout(r, 300)); // rate-limit gentil
      }
      return { ok, fail, total: alvos.length };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success(`Atualização Receita: ${r.ok}/${r.total} OK` + (r.fail ? ` · ${r.fail} falharam` : ""));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selected = useMemo(() => companies.find((c) => c.id === selectedId) || null, [companies, selectedId]);
  const isContratante = (selected?.name ?? "").toUpperCase().includes("DMN");
  const compEmps = useMemo(
    () => {
      if (!selected) return [];
      const base = employees.filter((e: any) => e.company_id === selected.id);
      const q = empSearch.trim().toLowerCase();
      if (!q) return base;
      const digits = q.replace(/\D/g, "");
      return base.filter((e: any) => {
        const nome = (e.nome ?? "").toLowerCase();
        const cpf = (e.cpf ?? "").toLowerCase();
        const cpfDigits = cpf.replace(/\D/g, "");
        const mat = (e.matricula ?? "").toLowerCase();
        return nome.includes(q) || cpf.includes(q) || mat.includes(q) ||
          (digits && (cpfDigits.includes(digits) || mat.replace(/\D/g, "").includes(digits)));
      });
    },
    [employees, selected, empSearch],
  );

  function startNew() { setEditing({ ...empty }); setShowForm(true); setSelectedId(null); }
  function startEdit() { if (selected) { setEditing({ ...selected }); setShowForm(true); } }

  function exportCSV() {
    if (!selected) return;
    const rows = [["nome", "cpf", "matricula", "email", "whatsapp"]];
    compEmps.forEach((e: any) => rows.push([e.nome ?? "", e.cpf ?? "", e.matricula ?? "", e.email ?? "", e.whatsapp ?? ""]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `colaboradores_${selected.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCSV(file: File) {
    if (!selected) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return;
    const header = lines[0].toLowerCase().split(/[,;\t]/).map((h) => h.trim().replace(/^"|"$/g, ""));
    const idx = (k: string) => header.indexOf(k);
    const iNome = idx("nome"); const iCpf = idx("cpf"); const iMat = idx("matricula");
    const iEmail = idx("email"); const iWa = idx("whatsapp");
    if (iNome < 0) { toast.error("CSV precisa ter coluna 'nome'"); return; }
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        company_id: selected.id,
        nome: cols[iNome] || "",
        cpf: iCpf >= 0 ? cols[iCpf] || null : null,
        matricula: iMat >= 0 ? cols[iMat] || null : null,
        email: iEmail >= 0 ? cols[iEmail] || null : null,
        whatsapp: iWa >= 0 ? cols[iWa] || null : null,
      };
    }).filter((r) => r.nome);
    if (!rows.length) { toast.error("Nenhuma linha válida no CSV"); return; }
    const { error } = await supabase.from("employees").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} colaboradores importados`);
    qc.invalidateQueries({ queryKey: ["employees-light"] });
  }

  // Garante editing inicial para o formulário fixo
  if (showForm && !editing) {
    setEditing({ ...empty });
  }

  return (
    <div className="p-6 md:p-8 flex gap-6 h-full page-canvas animate-fadeIn">
      {/* LEFT: Company cards */}
      <div className="w-[360px] flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 shrink-0">
        {selectedEmpId && selected ? (
          <>
            <div
              onClick={() => setSelectedEmpId(null)}
              title={`Voltar para colaboradores de ${selected.name}`}
              className="relative p-5 rounded-2xl border border-white/10 text-white surface-elevated-dark overflow-hidden cursor-pointer hover-lift"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-red-300/20 blur-2xl pointer-events-none" />
              <div className="relative flex justify-between items-start mb-2">
                <div className="text-[9px] font-black px-2 py-1 rounded inline-flex items-center gap-1 text-white bg-white/15 backdrop-blur ring-1 ring-white/20">
                  <Briefcase className="h-3 w-3" /> {selected.type}
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur pl-1 pr-3 py-1 shadow-md shadow-black/20">
                  <span className="h-8 w-8 rounded-full bg-white/25 ring-1 ring-white/40 flex items-center justify-center">
                    <Users className="h-4 w-4 text-white" />
                  </span>
                  <div className="leading-none">
                    <div className="text-base font-black text-white tabular-nums">{compEmps.length}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-white/80">Vínculos</div>
                  </div>
                </div>
              </div>
              <div className="relative flex items-center gap-3">
                <div className="floaty w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center backdrop-blur shrink-0">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-black uppercase text-white leading-tight">{selected.name}</h3>
              </div>
              <p className="relative text-[10px] font-bold uppercase mt-2 text-white/70 flex items-center gap-1">
                <IdCard className="h-3 w-3" /> CNPJ: {selected.cnpj || "Não informado"}
              </p>
              <div className="relative mt-4 pt-4 border-t text-xs font-bold border-white/20 text-white/90">
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-white" /> {selected.encarregado1 ? `Empreiteiro: ${selected.encarregado1}` : "S/ Empreiteiro"}</div>
                <div className="flex items-center gap-2 mt-1"><UserCog className="h-3.5 w-3.5 text-white" /> {selected.encarregado2 ? `Encarregado: ${selected.encarregado2}` : "S/ Encarregado"}</div>
              </div>
              {!isContratante && (
                <div className="relative mt-3">
                  <Button
                    size="sm"
                    onClick={() => setDossieOpen(true)}
                    className="w-full bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur"
                  >
                    <Shield className="h-4 w-4 mr-1.5" /> Dossiê NR-01 (Docs & Acordos)
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {compEmps.map((emp: any) => {
                const role = roles.find((r: any) => r.id === emp.role_id);
                const isSel = selectedEmpId === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`p-3 rounded-xl border cursor-pointer hover-lift flex items-center justify-between ${
                      isSel
                        ? "surface-elevated-dark border-transparent text-white"
                        : "surface-elevated border-slate-200/70 hover:border-[#991b1b]/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`text-[11px] font-black uppercase truncate ${isSel ? "text-white" : "text-slate-900"}`}>
                        {emp.nome || "—"}
                      </div>
                      <div className={`text-[9px] font-bold uppercase mt-0.5 truncate ${isSel ? "text-white/80" : "text-slate-500"}`}>
                        {role?.name || "Sem cargo"}
                      </div>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white/60 ${emp.status === "ATIVO" ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" : "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]"}`} />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
        <>
        <div className="flex items-center justify-between mb-1">
          <h2 className="heading-display text-xl text-slate-900 font-black uppercase tracking-tight flex items-center gap-2">
            <span className="floaty inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-white shadow-md">
              <Building2 className="h-4 w-4" />
            </span>
            Empresas
          </h2>
          {isEditor && (
            <Button
              size="sm"
              onClick={startNew}
              className="bg-[#0f172a] hover:bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-2 h-auto shadow-md hover:shadow-lg transition-shadow"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova
            </Button>
          )}
        </div>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => atualizarTodasReceita.mutate()}
            disabled={atualizarTodasReceita.isPending}
            className="text-[10px] font-black uppercase tracking-widest border-slate-300 mb-1"
            title="Consulta BrasilAPI e atualiza razão social, CNAE, GR e endereço de todas as empresas com CNPJ."
          >
            {atualizarTodasReceita.isPending
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Atualizando…</>
              : <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar todas (Receita)</>}
          </Button>
        )}
        {companies.map((c) => {
          const isSel = selectedId === c.id;
          const empCount = employees.filter((e: any) => e.company_id === c.id).length;
          const ts = typeStyle[c.type] ?? "bg-slate-100 text-slate-700";
          const entrada = (c as any).data_entrada
            ? new Date((c as any).data_entrada + "T00:00:00").toLocaleDateString("pt-BR")
            : "N/A";
          const isContratanteCard = (c.name ?? "").toUpperCase().includes("DMN");
          const ds = dossieByCompany[c.id];
          const dossieBadge = !isContratanteCard && ds ? (() => {
            const map: Record<string, { label: string; cls: string; title: string }> = {
              REGULAR: { label: "REGULAR", cls: "bg-emerald-500/25 text-emerald-100 ring-emerald-300/40", title: "Dossiê NR-01 regular" },
              EM_ADEQUACAO: { label: "EM ACORDO", cls: "bg-amber-500/25 text-amber-100 ring-amber-300/40", title: "Acordo de adequação ativo" },
              IRREGULAR: { label: "IRREGULAR", cls: "bg-rose-600/40 text-rose-50 ring-rose-300/60 shadow-[0_0_12px_-2px_rgba(244,80,110,0.9)]", title: "Documentos vencidos sem acordo" },
              SEM_DOCS: { label: "S/ DOSSIÊ", cls: "bg-slate-600/40 text-slate-100 ring-slate-300/40", title: "Nenhum documento NR-01 cadastrado" },
            };
            const m = map[ds.status] ?? map.SEM_DOCS;
            return (
              <span
                title={m.title}
                className={`text-[8px] font-black px-1.5 py-1 rounded inline-flex items-center gap-1 ring-1 backdrop-blur ${m.cls}`}
              >
                <Shield className="h-3 w-3" /> {m.label}
              </span>
            );
          })() : null;
          return (
            <div
              key={c.id}
              onClick={() => { setSelectedId(c.id); setShowForm(false); setEditing(null); setSelectedEmpId(null); }}
              className={`glass-card glass-shine relative p-5 rounded-2xl cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 ${
                isSel
                  ? "text-white shadow-[0_0_40px_-6px_rgba(220,38,70,0.85),inset_0_1px_0_rgba(255,230,235,0.12)] ring-1 ring-rose-400/40"
                  : "text-rose-50"
              }`}
            >
              {isSel && (
                <>
                  <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-rose-500/30 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-14 -left-10 w-44 h-44 rounded-full bg-rose-600/25 blur-3xl pointer-events-none" />
                </>
              )}
              <div className="relative flex justify-between items-start mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className={`text-[9px] font-black px-2 py-1 rounded inline-flex items-center gap-1 ${isSel ? "text-white bg-white/15 ring-1 ring-white/20 backdrop-blur" : "bg-black/40 text-rose-100 ring-1 ring-rose-500/30 backdrop-blur"}`}>
                    <Briefcase className="h-3 w-3" /> {c.type}
                  </div>
                  {dossieBadge}
                </div>
                <div className="group/pill flex items-center gap-2 rounded-full pl-1 pr-3 py-1 backdrop-blur-xl bg-gradient-to-br from-rose-600/40 via-rose-700/30 to-rose-950/40 ring-1 ring-rose-400/40 shadow-[0_0_24px_-4px_rgba(244,80,110,0.75),inset_0_1px_0_rgba(255,230,235,0.15)] transition-all hover:shadow-[0_0_36px_-2px_rgba(244,80,110,1),inset_0_1px_0_rgba(255,230,235,0.25)]">
                  <span className="h-8 w-8 rounded-full flex items-center justify-center ring-1 ring-rose-300/60 bg-gradient-to-br from-rose-500 to-rose-800 shadow-[0_0_16px_-2px_rgba(244,80,110,0.9)]">
                    <Users className="h-4 w-4 text-white drop-shadow-[0_0_6px_rgba(255,200,210,0.9)]" />
                  </span>
                  <div className="leading-none">
                    <div className="text-base font-black tabular-nums text-rose-50 drop-shadow-[0_0_10px_rgba(244,80,110,0.9)]">{empCount}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-rose-100/80">Vínculos</div>
                  </div>
                </div>
              </div>
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-rose-600/40 to-rose-950/40 ring-1 ring-rose-400/30 backdrop-blur shadow-[0_0_18px_-4px_rgba(244,80,110,0.6),inset_0_1px_0_rgba(255,230,235,0.1)]">
                  <Building2 className="h-5 w-5 text-rose-100 drop-shadow-[0_0_8px_rgba(244,80,110,0.7)]" />
                </div>
                <h3 className={`text-lg font-black uppercase leading-tight ${isSel ? "text-white drop-shadow-[0_0_10px_rgba(244,80,110,0.7)]" : "text-rose-50"}`}>{c.name}</h3>
              </div>
              <p className={`relative text-[10px] font-bold uppercase mt-2 flex items-center gap-1 ${isSel ? "text-white/80" : "text-rose-200/70"}`}>
                <IdCard className="h-3 w-3" /> CNPJ: {c.cnpj || "Não informado"} <span className="mx-1">|</span> ENTRADA: {entrada}
              </p>
              <div className={`relative mt-4 pt-4 border-t text-xs font-bold ${isSel ? "border-white/20 text-white/90" : "border-white/10 text-rose-100/85"}`}>
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-rose-300" /> {c.encarregado1 ? `Empreiteiro: ${c.encarregado1}` : "S/ Empreiteiro"}</div>
                <div className="flex items-center gap-2 mt-1"><UserCog className="h-3.5 w-3.5 text-rose-300" /> {c.encarregado2 ? `Encarregado: ${c.encarregado2}` : "S/ Encarregado"}</div>
              </div>
            </div>
          );
        })}
        </>
        )}
      </div>

      {/* RIGHT */}
      {selectedEmpId && selected ? (
        <div className="flex-1 surface-elevated rounded-2xl border border-slate-200/70 p-6 md:p-8 overflow-y-auto custom-scrollbar animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEmpId(null)}
              className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-[#991b1b]"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para {selected.name}
            </Button>
          </div>
          <EmployeeDetailContent id={selectedEmpId} initialTab={selectedTab} key={selectedEmpId + selectedTab} />
        </div>
      ) : showForm || (!selected && !showForm) ? (
        <CompanyForm
          editing={editing ?? { ...empty }}
          setEditing={setEditing}
          onCancel={selected ? () => { setShowForm(false); setEditing(null); } : undefined}
          onSubmit={() => save.mutate(editing ?? { ...empty })}
          saving={save.isPending}
        />
      ) : selected ? (
        <div className="flex-1 surface-elevated rounded-2xl border border-slate-200/70 p-8 flex flex-col overflow-hidden animate-fadeIn">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="floaty w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase text-[#991b1b] tracking-tighter">{selected.name}</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-[#991b1b]" /> Quadro de Colaboradores Catalogados: {compEmps.length}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isEditor && (
                <Button onClick={() => setNewEmpOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg uppercase tracking-widest h-auto px-4 py-2">
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Novo Colaborador
                </Button>
              )}
              {isEditor && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg uppercase tracking-widest h-auto px-4 py-2">
                  <Upload className="h-3.5 w-3.5" /> Importar CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importCSV(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <Button onClick={exportCSV} className="bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-black rounded-lg uppercase tracking-widest h-auto px-4 py-2">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
              </Button>
              {!isContratante && (
                <Button
                  onClick={() => setDossieOpen(true)}
                  className="bg-gradient-to-br from-rose-600 to-rose-800 hover:from-rose-700 hover:to-rose-900 text-white text-[10px] font-black rounded-lg uppercase tracking-widest h-auto px-4 py-2 shadow-md shadow-rose-500/30"
                >
                  <Shield className="h-3.5 w-3.5 mr-1.5" /> Dossiê NR-01
                </Button>
              )}
              {isEditor && (
                <Button onClick={startEdit} className="bg-[#0f172a] hover:bg-[#991b1b] text-white text-[10px] font-black rounded-lg uppercase tracking-widest h-auto px-4 py-2">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar Empresa
                </Button>
              )}
              {isAdmin && (
                <Button onClick={startNew} variant="secondary" className="text-[10px] font-black rounded-lg uppercase tracking-widest h-auto px-4 py-2">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Empresa
                </Button>
              )}
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="Buscar colaborador por nome, CPF ou matrícula…"
              className="pl-9 h-10 rounded-xl border-slate-200 bg-white shadow-sm text-sm"
            />
            {empSearch && (
              <button
                type="button"
                onClick={() => setEmpSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {compEmps.length === 0 && (
              <div className="text-center text-slate-400 py-10 font-bold uppercase text-xs">
                {empSearch ? "Nenhum colaborador encontrado para a busca." : "Nenhum colaborador nesta empresa."}
              </div>
            )}
            {compEmps.map((emp: any) => {
              const role = roles.find((r: any) => r.id === emp.role_id);
              const empExams = exams.filter((x: any) => x.employee_id === emp.id);
              const empDocs = docs.filter((d: any) => d.employee_id === emp.id);

              const today = new Date(); today.setHours(0, 0, 0, 0);
              const asoArr = empExams.filter((x: any) => x.tipo_exame === "ASO Clínico");
              let asoOK = false;
              if (asoArr.length) {
                const latest = asoArr.sort((a: any, b: any) => +new Date(b.data_realizacao) - +new Date(a.data_realizacao))[0];
                const exp = new Date(latest.data_vencimento + "T00:00:00");
                asoOK = latest.aptidao !== "NÃO" && exp > today;
              }
              const reqNRs: string[] = role?.req_nrs ?? [];
              const empNrs = (emp.nrs || {}) as Record<string, string>;
              const nrsMissing = reqNRs.filter((nr) => !empNrs[nr]).length;
              const nrsExpired = reqNRs.filter((nr) => {
                if (!empNrs[nr]) return false;
                return new Date(empNrs[nr] + "T00:00:00") < today;
              }).length;
              const nrOK = reqNRs.length > 0 && nrsMissing === 0 && nrsExpired === 0;

              const reqDocs = ["RG", "CPF", "Comprovante Residência", "Comprovante MEI", "Cartão de Vacina"];
              const docsOK = reqDocs.every((k) => empDocs.some((d: any) => d.tipo === k));

              const globalOK = asoOK && nrOK && docsOK;
              const badge = (ok: boolean) => ok
                ? "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white"
                : "bg-gradient-to-b from-red-400 to-red-600 text-white";

              const stop = (e: React.MouseEvent) => e.stopPropagation();
              const tabBtn = "chip-3d px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5";
              return (
                <div
                  key={emp.id}
                  onClick={() => { setSelectedTab("profile"); setSelectedEmpId(emp.id); }}
                  className={`p-4 rounded-2xl border hover-lift cursor-pointer flex items-center justify-between group ${globalOK ? "border-slate-200/70 surface-elevated" : "border-red-200 bg-gradient-to-b from-red-50/60 to-white"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="avatar-ring shrink-0">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg font-black text-slate-400 group-hover:text-[#991b1b] overflow-hidden">
                        {emp.foto_url ? <img src={emp.foto_url} className="w-full h-full object-cover" alt="" /> : (emp.nome?.charAt(0) || "?")}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-slate-900">{emp.nome || "— sem nome —"}</h4>
                      <div className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 flex items-center gap-1">
                        <IdCard className="h-3 w-3 text-slate-400" />
                        MAT: {emp.matricula || "---"} | CPF: {emp.cpf || "---"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={stop}>
                    <Link to="/app/employees/$id" params={{ id: emp.id }} search={{ tab: "health" }} onClick={stop} title="Abrir aba Saúde" className={`${tabBtn} ${badge(asoOK)}`}>
                      <HeartPulse className="h-3.5 w-3.5" /> ASO
                    </Link>
                    <Link to="/app/employees/$id" params={{ id: emp.id }} search={{ tab: "nrs" }} onClick={stop} title="Abrir aba NRs" className={`${tabBtn} ${reqNRs.length === 0 ? "bg-red-500 text-white" : badge(nrOK)}`}>
                      <Award className="h-3.5 w-3.5" /> NR
                    </Link>
                    <Link to="/app/employees/$id" params={{ id: emp.id }} search={{ tab: "docs" }} onClick={stop} title="Abrir aba Documentos" className={`${tabBtn} ${badge(docsOK)}`}>
                      <FolderOpen className="h-3.5 w-3.5" /> DOCS
                    </Link>
                    <Link to="/app/employees/$id" params={{ id: emp.id }} search={{ tab: "epi" }} onClick={stop} title="Abrir aba EPI" className="chip-3d w-9 h-9 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center">
                      <HardHat className="h-4 w-4" />
                    </Link>
                    <Link to="/app/employees/$id" params={{ id: emp.id }} search={{ tab: "profile" }} onClick={stop} title="Abrir auditoria do colaborador" className={`chip-3d px-4 py-2 rounded-lg text-[10px] font-black uppercase ${globalOK ? "bg-gradient-to-b from-emerald-400 to-emerald-600" : "bg-gradient-to-b from-red-400 to-red-600"} text-white tracking-widest flex items-center gap-1.5`}>
                      {globalOK ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {globalOK ? "APTO" : "AUDITAR"}
                    </Link>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#991b1b]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Users className="h-16 w-16 mb-4 opacity-40" />
          <p className="text-xs font-bold uppercase tracking-widest">Selecione uma empresa</p>
        </div>
      )}
      <NewEmployeeDialog open={newEmpOpen} onOpenChange={setNewEmpOpen} defaultCompanyId={selected?.id} />
      <CompanyDossieDialog
        open={dossieOpen}
        onOpenChange={setDossieOpen}
        companyId={selected?.id ?? null}
        companyName={selected?.name ?? ""}
      />
      <FileViewerHost />
    </div>
  );
}

function CompanyForm({
  editing, setEditing, onCancel, onSubmit, saving,
}: {
  editing: Partial<Company>;
  setEditing: (v: Partial<Company>) => void;
  onCancel?: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const [consultando, setConsultando] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);

  async function handleConsultar() {
    const digits = (editing.cnpj ?? "").replace(/\D/g, "");
    if (digits.length !== 14) {
      toast.error("Informe o CNPJ completo (14 dígitos)");
      return;
    }
    setConsultando(true);
    try {
      const d: ReceitaCNPJData = await consultarCNPJ(digits);
      setEditing({
        ...editing,
        cnpj: d.cnpj,
        // preserva Nome Fantasia digitado pelo usuário se já houver
        name: editing.name && editing.name.trim() ? editing.name : (d.nome_fantasia || d.razao_social),
        razao_social: d.razao_social,
        nome_fantasia: d.nome_fantasia ?? editing.nome_fantasia ?? "",
        cnae_principal: d.cnae_principal ?? "",
        cnae_descricao: d.cnae_descricao ?? "",
        grau_risco: d.grau_risco,
        logradouro: d.logradouro ?? "",
        numero: d.numero ?? "",
        complemento: d.complemento ?? "",
        bairro: d.bairro ?? "",
        cidade: d.cidade ?? "",
        uf: d.uf ?? "",
        cep: d.cep ?? "",
        telefone: d.telefone ?? "",
        situacao_cadastral: d.situacao_cadastral ?? "",
        data_situacao: d.data_situacao ?? "",
        cnaes_secundarias: d.cnaes_secundarias ?? [],
        capital_social: d.capital_social,
        natureza_juridica: d.natureza_juridica ?? "",
        receita_consultada_em: new Date().toISOString(),
      } as any);
      toast.success("Dados da Receita preenchidos. Ajuste o Nome Fantasia se necessário.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha na consulta");
    } finally {
      setConsultando(false);
    }
  }

  async function handleUploadCard(file: File) {
    setUploadingCard(true);
    try {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const key = `companies/${editing.id ?? "novo"}/cartao-cnpj-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("sesmt-docs").upload(key, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("sesmt-docs").createSignedUrl(key, 60 * 60 * 24 * 365);
      const cardUrl = signed?.signedUrl ?? key;
      let next: any = { ...editing, cnpj_card_url: cardUrl };

      // Se for PDF, extrai o texto, procura o CNPJ e preenche via BrasilAPI.
      if (file.type === "application/pdf" || ext === "pdf") {
        try {
          const buf = new Uint8Array(await file.arrayBuffer());
          const pdfjs: any = await import("pdfjs-dist");
          const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          const pdf = await pdfjs.getDocument({ data: buf }).promise;
          let fullText = "";
          for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += " " + content.items.map((it: any) => it.str ?? "").join(" ");
          }
          let digits = extrairCNPJdeTexto(fullText);

          // Fallback OCR: cartão CNPJ escaneado/gerado como imagem (comum em cópias
          // vindas de scanner ou "Imprimir como PDF" de PDFs achatados).
          if (!digits) {
            try {
              toast.info("PDF sem texto — tentando OCR (pode levar alguns segundos)…");
              const page = await pdf.getPage(1);
              const viewport = page.getViewport({ scale: 2 });
              const canvas = document.createElement("canvas");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext("2d")!;
              await page.render({ canvasContext: ctx, viewport, canvas }).promise;
              const { recognize } = await import("tesseract.js");
              const { data } = await recognize(canvas, "por");
              digits = extrairCNPJdeTexto(data.text ?? "");
            } catch (ocrErr) {
              console.warn("[cartao-cnpj] OCR falhou:", ocrErr);
            }
          }

          if (digits) {
            const cnpjMasked = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`;
            // Pré-preenche o CNPJ já — mesmo que a Receita falhe, o usuário só clica em "Consultar Receita".
            next = { ...next, cnpj: cnpjMasked };
            let d;
            try {
              d = await consultarCNPJ(digits);
            } catch (apiErr: any) {
              // Retry once (rede/preflight)
              try { d = await consultarCNPJ(digits); }
              catch {
                console.warn("[cartao-cnpj] BrasilAPI falhou:", apiErr);
                setEditing(next);
                toast.info(`CNPJ ${cnpjMasked} lido do cartão. Clique em "Consultar Receita" para preencher o resto.`);
                return;
              }
            }
            next = {
              ...next,
              cnpj: d.cnpj,
              razao_social: d.razao_social,
              nome_fantasia: next.nome_fantasia || d.nome_fantasia || "",
              name: next.name && next.name.trim() ? next.name : (d.nome_fantasia || d.razao_social),
              cnae_principal: d.cnae_principal ?? "",
              cnae_descricao: d.cnae_descricao ?? "",
              grau_risco: d.grau_risco,
              logradouro: d.logradouro ?? "",
              numero: d.numero ?? "",
              complemento: d.complemento ?? "",
              bairro: d.bairro ?? "",
              cidade: d.cidade ?? "",
              uf: d.uf ?? "",
              cep: d.cep ?? "",
              telefone: d.telefone ?? "",
              situacao_cadastral: d.situacao_cadastral ?? "",
              data_situacao: d.data_situacao ?? "",
              capital_social: d.capital_social,
              natureza_juridica: d.natureza_juridica ?? "",
              cnaes_secundarias: d.cnaes_secundarias ?? [],
              receita_consultada_em: new Date().toISOString(),
            };
            toast.success("Cartão CNPJ anexado e campos preenchidos pela Receita.");
          } else {
            toast.info("Cartão anexado, mas não achei o CNPJ no PDF. Use 'Consultar Receita'.");
          }
        } catch (parseErr: any) {
          console.warn("[cartao-cnpj] parse falhou:", parseErr);
          toast.info("Cartão anexado. Não consegui ler o PDF — digite/consulte o CNPJ manualmente.");
        }
      } else {
        toast.success("Cartão anexado. Para imagem, use 'Consultar Receita' para preencher os campos.");
      }

      setEditing(next);
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploadingCard(false);
    }
  }

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 overflow-y-auto custom-scrollbar animate-fadeIn relative">
      {onCancel && (
        <button onClick={onCancel} className="absolute top-8 right-8 text-slate-400 hover:text-red-500" aria-label="Cancelar">
          <X className="h-6 w-6" />
        </button>
      )}
      <h3 className="text-lg font-black uppercase text-[#991b1b] mb-6 border-b border-slate-100 pb-4">
        {editing?.id ? "Editar Empresa" : "Cadastrar Nova Empresa"}
      </h3>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
        {/* Bloco 1 — CNPJ + Consulta Receita */}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
          <Label className="text-[10px] font-black text-slate-500 uppercase">CNPJ (consulta automática pela Receita)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={maskCNPJ(editing?.cnpj ?? "")}
              onChange={(e) => setEditing({ ...editing, cnpj: maskCNPJ(e.target.value) })}
              placeholder="00.000.000/0001-00"
              maxLength={18}
              inputMode="numeric"
              className="bg-white flex-1"
            />
            <Button type="button" onClick={handleConsultar} disabled={consultando} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest">
              {consultando ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Consultando…</> : <><Search className="h-3.5 w-3.5 mr-1" /> Consultar Receita</>}
            </Button>
          </div>
          {editing?.receita_consultada_em && (
            <p className="text-[9px] font-bold text-emerald-700 mt-1.5 uppercase">
              ✓ Consultado em {new Date(editing.receita_consultada_em).toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Nome Fantasia (exibido no SIGMO) *</Label>
            <Input required value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: DMN Estaleiro" className="bg-slate-50 mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Tipo de Vínculo</Label>
            <Select value={editing?.type ?? "CLT"} onValueChange={(v) => setEditing({ ...editing, type: v })}>
              <SelectTrigger className="bg-slate-50 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLT">Própria (CLT)</SelectItem>
                <SelectItem value="TERCEIRIZADO">Terceirizada</SelectItem>
                <SelectItem value="CONTRATANTE">Contratante</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Razão Social (Receita)</Label>
            <Input value={editing?.razao_social ?? ""} onChange={(e) => setEditing({ ...editing, razao_social: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Data da Entrada no Contrato</Label>
            <Input type="date" value={(editing as any)?.data_entrada ?? ""} onChange={(e) => setEditing({ ...editing, data_entrada: e.target.value } as any)} className="bg-slate-50 mt-1" />
          </div>
        </div>

        {/* Bloco CNAE + Grau de Risco */}
        <div className="grid grid-cols-12 gap-4 pt-4 border-t border-slate-100">
          <div className="col-span-3">
            <Label className="text-[10px] font-black text-slate-500 uppercase">CNAE Principal</Label>
            <Input value={editing?.cnae_principal ?? ""} onChange={(e) => setEditing({ ...editing, cnae_principal: e.target.value })} placeholder="00.00-0/00" className="bg-slate-50 mt-1" />
          </div>
          <div className="col-span-7">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Descrição CNAE</Label>
            <Input value={editing?.cnae_descricao ?? ""} onChange={(e) => setEditing({ ...editing, cnae_descricao: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px] font-black text-slate-500 uppercase">GR (NR-04)</Label>
            <Select value={editing?.grau_risco != null ? String(editing.grau_risco) : ""} onValueChange={(v) => setEditing({ ...editing, grau_risco: v ? Number(v) : null })}>
              <SelectTrigger className="bg-slate-50 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bloco Endereço */}
        <div className="grid grid-cols-12 gap-4 pt-4 border-t border-slate-100">
          <div className="col-span-8">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Logradouro</Label>
            <Input value={editing?.logradouro ?? ""} onChange={(e) => setEditing({ ...editing, logradouro: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Nº</Label>
            <Input value={editing?.numero ?? ""} onChange={(e) => setEditing({ ...editing, numero: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px] font-black text-slate-500 uppercase">CEP</Label>
            <Input value={editing?.cep ?? ""} onChange={(e) => setEditing({ ...editing, cep: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div className="col-span-4">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Bairro</Label>
            <Input value={editing?.bairro ?? ""} onChange={(e) => setEditing({ ...editing, bairro: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div className="col-span-4">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Complemento</Label>
            <Input value={editing?.complemento ?? ""} onChange={(e) => setEditing({ ...editing, complemento: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div className="col-span-3">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Cidade</Label>
            <Input value={editing?.cidade ?? ""} onChange={(e) => setEditing({ ...editing, cidade: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div className="col-span-1">
            <Label className="text-[10px] font-black text-slate-500 uppercase">UF</Label>
            <Input value={editing?.uf ?? ""} onChange={(e) => setEditing({ ...editing, uf: e.target.value.toUpperCase().slice(0,2) })} className="bg-slate-50 mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Telefone</Label>
            <Input value={editing?.telefone ?? ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Situação Cadastral</Label>
            <Input value={editing?.situacao_cadastral ?? ""} onChange={(e) => setEditing({ ...editing, situacao_cadastral: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Data da Situação</Label>
            <Input type="date" value={editing?.data_situacao ?? ""} onChange={(e) => setEditing({ ...editing, data_situacao: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
        </div>

        <div>
          <Label className="text-[10px] font-black text-slate-500 uppercase">Natureza Jurídica</Label>
          <Input value={editing?.natureza_juridica ?? ""} onChange={(e) => setEditing({ ...editing, natureza_juridica: e.target.value })} className="bg-slate-50 mt-1" />
        </div>

        {editing?.cnaes_secundarias && editing.cnaes_secundarias.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <Label className="text-[10px] font-black text-slate-500 uppercase">CNAEs Secundários ({editing.cnaes_secundarias.length})</Label>
            <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2 max-h-40 overflow-y-auto space-y-1">
              {editing.cnaes_secundarias.map((c, i) => (
                <div key={i} className="text-[11px] text-slate-700 flex gap-2">
                  <span className="font-mono font-bold text-slate-900 shrink-0">{c.codigo}</span>
                  <span className="text-slate-600">{c.descricao}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label className="text-[10px] font-black text-slate-500 uppercase">E-mail Corporativo</Label>
          <Input type="email" placeholder="contato@empresa.com" value={editing?.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="bg-slate-50 mt-1" />
        </div>

        {/* Upload Cartão CNPJ */}
        <div className="pt-4 border-t border-slate-100">
          <Label className="text-[10px] font-black text-slate-500 uppercase">Cartão CNPJ (PDF — evidência documental)</Label>
          <div className="flex items-center gap-2 mt-1">
            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg">
              {uploadingCard ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…</> : <><Upload className="h-3.5 w-3.5" /> Anexar PDF</>}
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadCard(f); e.target.value = ""; }} />
            </label>
            {editing?.cnpj_card_url && (
              <button
                type="button"
                onClick={async () => {
                  const url: string = editing.cnpj_card_url as string;
                  const pathPart = url.split("?")[0];
                  const name = pathPart.split("/").pop() || "cartao-cnpj";
                  const ext = name.split(".").pop()?.toLowerCase();
                  const mime =
                    ext === "pdf" ? "application/pdf" :
                    ext === "png" ? "image/png" :
                    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                    ext === "webp" ? "image/webp" : undefined;
                  try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error("fetch");
                    const blob = await res.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    openFileViewer({ url: objectUrl, name, mime: blob.type || mime, downloadUrl: objectUrl, objectUrl });
                  } catch {
                    openFileViewer({ url, name, mime, downloadUrl: url });
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-900"
              >
                <FileText className="h-3.5 w-3.5" /> Ver anexo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Empreiteiro</Label>
            <Input value={editing?.encarregado1 ?? ""} onChange={(e) => setEditing({ ...editing, encarregado1: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Encarregado</Label>
            <Input value={editing?.encarregado2 ?? ""} onChange={(e) => setEditing({ ...editing, encarregado2: e.target.value })} className="bg-slate-50 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Matriz - Nome (cabeçalho DDS)</Label>
            <Input value={editing?.matriz_nome ?? ""} onChange={(e) => setEditing({ ...editing, matriz_nome: e.target.value })} placeholder="Deixe em branco para usar o nome da empresa" className="bg-slate-50 mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Matriz - CNPJ</Label>
            <Input value={maskCNPJ(editing?.matriz_cnpj ?? "")} onChange={(e) => setEditing({ ...editing, matriz_cnpj: maskCNPJ(e.target.value) })} placeholder="00.000.000/0001-00" maxLength={18} inputMode="numeric" className="bg-slate-50 mt-1" />
          </div>
        </div>
        <Button type="submit" disabled={saving} className="mt-4 bg-[#991b1b] hover:bg-[#7f1d1d] text-white text-xs font-black uppercase tracking-widest px-8 py-4 h-auto rounded-xl shadow-lg">
          Salvar Dados da Empresa
        </Button>
      </form>
    </div>
  );
}
