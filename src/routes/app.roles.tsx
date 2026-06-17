import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Briefcase, UserCog, Plus, FileText, Award, ShieldCheck, Save, Trash2,
  Stethoscope, AlertTriangle, X, Syringe, Search, Copy, Power, PowerOff,
  Sparkles, MoreVertical, FilePlus2, Layers, Activity, Zap, Beaker, Brain,
} from "lucide-react";
import { toast } from "sonner";
import { NRS_LIST, TIPOS_EXAME, VACINAS_LIST, VACINAS_RISCO_BIOLOGICO } from "@/lib/constants";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CatalogoRiscosPanel } from "@/components/catalogo/catalogo-riscos-panel";
import { CatalogoNrsPanel } from "@/components/catalogo/catalogo-nrs-panel";
import { CargoRiscosPanel } from "@/components/cargo-riscos/cargo-riscos-panel";
import { CboPicker } from "@/components/cbo-picker";


export const Route = createFileRoute("/app/roles")({
  component: RolesPageWithTabs,
});

function RolesPageWithTabs() {
  return (
    <div className="h-full flex flex-col bg-transparent">
      <Tabs defaultValue="cargos" className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-5 pb-3 border-b border-border bg-card/60 backdrop-blur-xl shadow-sm">
          <TabsList className="h-14 glass-card p-1.5 rounded-xl gap-1">
            <TabsTrigger
              value="cargos"
              className="px-6 py-2.5 text-sm font-black uppercase tracking-wide rounded-lg data-[state=active]:bg-accent/70 data-[state=active]:text-accent-foreground data-[state=active]:shadow-lg transition-all"
            >
              Cargos
            </TabsTrigger>
            <TabsTrigger
              value="riscos"
              className="px-6 py-2.5 text-sm font-black uppercase tracking-wide rounded-lg data-[state=active]:bg-accent/70 data-[state=active]:text-accent-foreground data-[state=active]:shadow-lg transition-all"
            >
              Catálogo de Riscos
            </TabsTrigger>
            <TabsTrigger
              value="nrs"
              className="px-6 py-2.5 text-sm font-black uppercase tracking-wide rounded-lg data-[state=active]:bg-accent/70 data-[state=active]:text-accent-foreground data-[state=active]:shadow-lg transition-all"
            >
              Catálogo de NRs
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="cargos" className="flex-1 min-h-0 m-0 overflow-hidden">
          <RolesPage />
        </TabsContent>
        <TabsContent value="riscos" className="flex-1 min-h-0 m-0 overflow-y-auto">
          <CatalogoRiscosPanel />
        </TabsContent>
        <TabsContent value="nrs" className="flex-1 min-h-0 m-0 overflow-y-auto">
          <CatalogoNrsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Riscos = {
  acidente_mecanico: string[]; fisicos: string[]; quimicos: string[];
  biologicos: string[]; ergonomicos: string[]; psicossociais: string[];
  descricao: string;
};
type Natureza = "ADMISSIONAL" | "PERIODICO" | "RETORNO_TRABALHO" | "MUDANCA_RISCO" | "DEMISSIONAL" | "SEMESTRAL";
type ExamesPorNatureza = Record<Natureza, string[]>;
type Role = {
  id: string; name: string; ativo: boolean;
  ghe: string | null; setor: string | null; cbo: string | null; cbo_titulo: string | null;
  req_aso: boolean; req_integra: boolean;
  req_nrs: string[]; req_exames: string[]; req_vacinas: string[];
  risco_biologico: boolean; riscos: Riscos;
  exames_por_natureza: ExamesPorNatureza;
};
const emptyRiscos: Riscos = {
  acidente_mecanico: [], fisicos: [], quimicos: [],
  biologicos: [], ergonomicos: [], psicossociais: [], descricao: "",
};
const NATUREZAS: { key: Natureza; label: string; tone: "rose" | "sky" | "amber" | "emerald" | "violet" | "slate" }[] = [
  { key: "ADMISSIONAL", label: "Admissional", tone: "rose" },
  { key: "PERIODICO", label: "Periódico", tone: "sky" },
  { key: "RETORNO_TRABALHO", label: "Retorno ao Trabalho", tone: "emerald" },
  { key: "MUDANCA_RISCO", label: "Mudança de Risco", tone: "amber" },
  { key: "DEMISSIONAL", label: "Demissional", tone: "slate" },
  { key: "SEMESTRAL", label: "Semestral", tone: "violet" },
];
const emptyExames: ExamesPorNatureza = {
  ADMISSIONAL: [], PERIODICO: [], RETORNO_TRABALHO: [],
  MUDANCA_RISCO: [], DEMISSIONAL: [], SEMESTRAL: [],
};
const empty: Partial<Role> = {
  name: "", ativo: true, ghe: "", setor: "", cbo: "", cbo_titulo: "",
  req_aso: true, req_integra: true,
  req_nrs: [], req_exames: [], req_vacinas: [], risco_biologico: false, riscos: emptyRiscos,
  exames_por_natureza: emptyExames,
};

function RolesPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [editing, setEditing] = useState<Partial<Role> | null>(null);
  const [innerTab, setInnerTab] = useState<"diretrizes" | "riscos">("diretrizes");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);


  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("*").order("name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        ativo: r.ativo ?? true,
        ghe: r.ghe ?? "",
        setor: r.setor ?? "",
        cbo: r.cbo ?? "",
        cbo_titulo: r.cbo_titulo ?? "",
        req_vacinas: r.req_vacinas ?? [],
        risco_biologico: !!r.risco_biologico,
        riscos: r.riscos && typeof r.riscos === "object" ? { ...emptyRiscos, ...r.riscos } : emptyRiscos,
        exames_por_natureza: r.exames_por_natureza && typeof r.exames_por_natureza === "object"
          ? { ...emptyExames, ...r.exames_por_natureza }
          : emptyExames,
      })) as Role[];
    },
  });

  const filtered = useMemo(() => {
    return roles.filter((r) => {
      if (!showInactive && !r.ativo) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [roles, search, showInactive]);

  const stats = useMemo(() => ({
    total: roles.length,
    ativos: roles.filter((r) => r.ativo).length,
    inativos: roles.filter((r) => !r.ativo).length,
  }), [roles]);

  const save = useMutation({
    mutationFn: async (v: Partial<Role>) => {
      const payload = {
        name: v.name!,
        ativo: v.ativo ?? true,
        ghe: v.ghe || null,
        setor: v.setor || null,
        cbo: v.cbo || null,
        cbo_titulo: v.cbo_titulo || null,
        req_aso: !!v.req_aso,
        req_integra: !!v.req_integra,
        req_nrs: v.req_nrs ?? [],
        req_exames: v.req_exames ?? [],
        req_vacinas: v.req_vacinas ?? [],
        risco_biologico: !!v.risco_biologico,
        riscos: v.riscos ?? emptyRiscos,
        exames_por_natureza: v.exames_por_natureza ?? emptyExames,
      };
      if (v.id) {
        const { error } = await supabase.from("roles").update(payload).eq("id", v.id);
        if (error) throw error;
        return v.id;
      } else {
        const { data, error } = await supabase.from("roles").insert(payload).select("id").single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Diretrizes salvas com sucesso");
      // mantém o cargo selecionado
      setEditing((cur) => cur ? { ...cur, id } : cur);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Cargo excluído");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("roles").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success(vars.ativo ? "Cargo reativado" : "Cargo desativado");
      setEditing((cur) => cur && cur.id === vars.id ? { ...cur, ativo: vars.ativo } : cur);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function duplicate(r: Role) {
    const { id, ...rest } = r;
    setEditing({ ...rest, name: `${r.name} (cópia)`, ativo: true });
    toast.info("Edite o nome e clique em Salvar para criar a cópia");
  }

  function startNew() {
    setEditing({ ...empty });
  }

  function toggleNr(nr: string) {
    if (!editing) return;
    const cur = editing.req_nrs ?? [];
    setEditing({ ...editing, req_nrs: cur.includes(nr) ? cur.filter((x) => x !== nr) : [...cur, nr] });
  }
  function toggleExame(t: string) {
    if (!editing) return;
    const cur = editing.req_exames ?? [];
    setEditing({ ...editing, req_exames: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  }
  function toggleVacina(t: string) {
    if (!editing) return;
    const cur = editing.req_vacinas ?? [];
    setEditing({ ...editing, req_vacinas: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  }
  function toggleRiscoBio(v: boolean) {
    if (!editing) return;
    let vac = editing.req_vacinas ?? [];
    if (v) VACINAS_RISCO_BIOLOGICO.forEach((x) => { if (!vac.includes(x)) vac = [...vac, x]; });
    setEditing({ ...editing, risco_biologico: v, req_vacinas: vac });
  }
  function toggleExameNatureza(natureza: Natureza, exame: string) {
    if (!editing) return;
    const cur = editing.exames_por_natureza ?? emptyExames;
    const list = cur[natureza] ?? [];
    const next: ExamesPorNatureza = {
      ...cur,
      [natureza]: list.includes(exame) ? list.filter((x) => x !== exame) : [...list, exame],
    };
    setEditing({ ...editing, exames_por_natureza: next });
  }
  function copyExamesNatureza(from: Natureza, to: Natureza) {
    if (!editing) return;
    const cur = editing.exames_por_natureza ?? emptyExames;
    setEditing({ ...editing, exames_por_natureza: { ...cur, [to]: [...(cur[from] ?? [])] } });
    toast.success(`Exames copiados para ${NATUREZAS.find((n) => n.key === to)?.label}`);
  }

  const reqNRsSet = useMemo(() => new Set(editing?.req_nrs ?? []), [editing?.req_nrs]);
  const reqExamesSet = useMemo(() => new Set(editing?.req_exames ?? []), [editing?.req_exames]);
  const reqVacinasSet = useMemo(() => new Set(editing?.req_vacinas ?? []), [editing?.req_vacinas]);

  const riscos: Riscos = editing?.riscos ?? emptyRiscos;
  const updateRiscos = (patch: Partial<Riscos>) =>
    editing && setEditing({ ...editing, riscos: { ...riscos, ...patch } });

  return (
    <div className="p-4 md:p-6 flex gap-4 md:gap-6 h-full bg-transparent animate-fadeIn relative overflow-hidden">
      {/* LEFT: Cargos Catalogados */}
      <aside className="glass-card glass-shine w-[360px] flex flex-col overflow-hidden shrink-0 relative z-10">
        {/* Header */}
        <div className="p-5 bg-accent/55 text-card-foreground relative overflow-hidden border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black uppercase tracking-wider flex items-center gap-2 relative">
              <Briefcase className="h-5 w-5" /> Cargos / Funções
            </h2>
            <span className="text-xs font-bold bg-white/20 backdrop-blur px-2.5 py-1 rounded-full ring-1 ring-white/30 relative">
              {stats.ativos}/{stats.total}
            </span>
          </div>
          {isEditor && (
            <button
              onClick={startNew}
                className="prism-pill accent-amber relative w-full py-3 text-[rgba(255,225,190,0.95)] text-sm font-black rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
            >
              <FilePlus2 className="h-5 w-5" /> Novo Cargo
            </button>
          )}
        </div>

        {/* Search & filter */}
        <div className="p-4 border-b border-border space-y-2.5 bg-card/25">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cargo..."
              className="w-full bg-white border border-rose-100 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#991b1b] focus:ring-2 focus:ring-rose-200 shadow-sm transition-all"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 accent-[#991b1b]"
            />
            Mostrar inativos ({stats.inativos})
          </label>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 px-4">
              <Briefcase className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {roles.length === 0 ? "Nenhum cargo cadastrado" : "Nenhum resultado"}
              </p>
              {roles.length === 0 && isEditor && (
                <p className="text-[10px] text-slate-400 mt-2">Clique em "Novo Cargo" para começar</p>
              )}
            </div>
          )}
          {filtered.map((r) => {
            const isSel = editing?.id === r.id;
            return (
              <div
                key={r.id}
                onClick={() => { setEditing(r); setInnerTab("diretrizes"); }}
                className={`group relative p-3.5 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 backdrop-blur-xl ${
                  isSel
                    ? "border-red-400/40 bg-gradient-to-br from-red-500/15 via-white/[0.04] to-white/[0.02] shadow-[0_0_40px_-12px_rgba(220,38,38,0.45)]"
                    : !r.ativo
                    ? "border-white/[0.06] bg-white/[0.02] opacity-60 hover:opacity-90 hover:border-white/15"
                    : "border-white/10 bg-white/[0.03] hover:border-red-400/30 hover:bg-white/[0.05] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    isSel ? "bg-accent text-accent-foreground shadow-lg" : "bg-secondary text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground group-hover:shadow-md"
                  }`}>
                    <UserCog className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="text-sm font-black uppercase text-slate-800 leading-tight truncate">{r.name}</h3>
                      {!r.ativo && (
                        <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase shrink-0">Inativo</span>
                      )}
                    </div>
                    {(r.ghe || r.setor) && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {r.ghe && <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-black">{r.ghe}</span>}
                        {r.setor && <span className="truncate">{r.setor}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.req_aso && <Pill icon={<Stethoscope className="h-3 w-3" />} label="ASO" tone="emerald" />}
                      {r.req_integra && <Pill icon={<ShieldCheck className="h-3 w-3" />} label="INT" tone="sky" />}
                      {r.req_nrs.length > 0 && <Pill icon={<Award className="h-3 w-3" />} label={`${r.req_nrs.length} NR`} tone="red" />}
                      {r.risco_biologico && <Pill icon={<Syringe className="h-3 w-3" />} label="BIO" tone="rose" />}
                    </div>
                  </div>
                  {isEditor && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 transition-all">
                          <MoreVertical className="h-4 w-4 text-slate-500" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setEditing(r)}>
                          <UserCog className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicate(r)}>
                          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleAtivo.mutate({ id: r.id, ativo: !r.ativo })}>
                          {r.ativo ? <PowerOff className="h-3.5 w-3.5 mr-2" /> : <Power className="h-3.5 w-3.5 mr-2" />}
                          {r.ativo ? "Desativar" : "Reativar"}
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => { if (confirm(`Excluir "${r.name}"? Essa ação não pode ser desfeita.`)) del.mutate(r.id); }}
                              className="text-red-600 focus:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* RIGHT: Matriz de Requisitos */}
      <main className="glass-card glass-shine flex-1 overflow-hidden flex flex-col relative z-10">
        {!editing ? (
          <EmptyState canEdit={isEditor} onNew={startNew} />
        ) : (
          <>
            {/* Sticky Top Action Bar — SALVAR em destaque máximo */}
            {isEditor && (
              <div className="px-6 py-3 border-b border-border bg-card/25 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  {editing.id ? "Editando cargo" : "Novo cargo"}
                  {editing.id && (
                    <span className={`ml-2 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      editing.ativo ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300" : "bg-slate-200 text-slate-600"
                    }`}>
                      {editing.ativo ? "● Ativo" : "○ Inativo"}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => save.mutate(editing)}
                  disabled={save.isPending}
                  className="prism-pill accent-emerald text-emerald-200 text-sm font-black rounded-xl uppercase tracking-wider hover:-translate-y-0.5 px-6 py-2.5 h-auto flex items-center gap-2 transition-all"
                >
                  <Save className="h-5 w-5" /> {save.isPending ? "Salvando..." : "Salvar Diretrizes"}
                </Button>
              </div>
            )}

            {/* Header (banner colorido) */}
            <div className="px-8 py-5 border-b border-border bg-accent/45 text-card-foreground flex items-center gap-4 shrink-0 relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-xl text-white flex items-center justify-center shadow-xl ring-2 ring-white/30 relative shrink-0">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="relative min-w-0">
                <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2 truncate">
                  {editing.id ? "Matriz de Requisitos" : (
                    <><Sparkles className="h-6 w-6 text-amber-300" /> Novo Cargo</>
                  )}
                </h3>
                <p className="text-xs font-bold text-rose-100 uppercase tracking-widest mt-0.5">
                  {editing.id ? "Configure exigências de saúde e segurança · ISO 9001" : "Preencha os dados para catalogar a função"}
                </p>
              </div>
            </div>

            {/* Sub-tabs internas */}
            {editing.id && (
              <div className="shrink-0 flex border-b border-border bg-card/20">
                <button
                  type="button"
                  onClick={() => setInnerTab("diretrizes")}
                  className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                    innerTab === "diretrizes"
                      ? "border-[#991b1b] text-[#991b1b] bg-rose-50/60"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Diretrizes (PCMSO/ISO)
                </button>
                <button
                  type="button"
                  onClick={() => setInnerTab("riscos")}
                  className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                    innerTab === "riscos"
                      ? "border-[#991b1b] text-[#991b1b] bg-rose-50/60"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Riscos Quantitativos (PGR/LTCAT)
                </button>
              </div>
            )}

            {innerTab === "diretrizes" ? (
            <form
              onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                {/* Identificação do Cargo (PCMSO/ISO 9001) */}
                <div className="mb-6 grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-6">
                    <label className="block text-xs font-black text-[#991b1b] uppercase mb-2 tracking-widest">
                      Nomenclatura Oficial do Cargo
                    </label>
                    <input
                      type="text" required
                      value={editing.name ?? ""}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="Ex: Eletricista, Soldador, Operador..."
                      disabled={!isEditor}
                      className="w-full bg-white border-2 border-rose-100 rounded-2xl px-5 py-3.5 text-base font-black uppercase text-slate-800 focus:border-[#991b1b] focus:ring-4 focus:ring-rose-200/40 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:normal-case disabled:opacity-60 shadow-sm"
                    />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block text-xs font-black text-[#991b1b] uppercase mb-2 tracking-widest flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" /> GHE
                    </label>
                    <input
                      type="text"
                      value={editing.ghe ?? ""}
                      onChange={(e) => setEditing({ ...editing, ghe: e.target.value })}
                      placeholder="Ex: GHE 01"
                      disabled={!isEditor}
                      className="w-full bg-white border-2 border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-black uppercase text-slate-800 focus:border-[#991b1b] focus:ring-4 focus:ring-rose-200/40 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:normal-case disabled:opacity-60 shadow-sm"
                    />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block text-xs font-black text-[#991b1b] uppercase mb-2 tracking-widest">CBO</label>
                    <CboPicker
                      codigo={editing.cbo ?? null}
                      titulo={editing.cbo_titulo ?? null}
                      onChange={(cod, tit) => setEditing({ ...editing, cbo: cod ?? "", cbo_titulo: tit ?? "" })}
                      disabled={!isEditor}
                      placeholder="Buscar CBO (código ou nome)…"
                    />
                  </div>
                  <div className="lg:col-span-12">
                    <label className="block text-xs font-black text-[#991b1b] uppercase mb-2 tracking-widest">Setor</label>
                    <input
                      type="text"
                      value={editing.setor ?? ""}
                      onChange={(e) => setEditing({ ...editing, setor: e.target.value })}
                      placeholder="Ex: Administrativo, Produção, Almoxarifado..."
                      disabled={!isEditor}
                      className="w-full bg-white border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:border-[#991b1b] focus:ring-2 focus:ring-rose-200/40 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal disabled:opacity-60 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Section icon={<FileText className="h-4 w-4" />} title="Requisitos Base (Integração)">
                    <ToggleRow label="Exige ASO Válido" checked={!!editing.req_aso}
                      onChange={(v) => setEditing({ ...editing, req_aso: v })} disabled={!isEditor} divider />
                    <ToggleRow label="Exige Integração de Segurança" checked={!!editing.req_integra}
                      onChange={(v) => setEditing({ ...editing, req_integra: v })} disabled={!isEditor} />
                  </Section>

                  <Section icon={<Award className="h-4 w-4" />} title="Normas Regulamentadoras (NRs)">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {NRS_LIST.map((nr) => (
                        <NRToggle key={nr} label={nr} checked={reqNRsSet.has(nr)} onChange={() => toggleNr(nr)} disabled={!isEditor} />
                      ))}
                    </div>
                  </Section>

                  <Section
                    icon={<Stethoscope className="h-4 w-4" />}
                    title="Procedimentos Diagnósticos por Natureza (PCMSO · eSocial Tabela 27)"
                    hint="Vencido ou sem PDF → Bloqueio GSI"
                    full
                  >
                    <ExamesMatrix
                      value={editing.exames_por_natureza ?? emptyExames}
                      onToggle={toggleExameNatureza}
                      onCopy={copyExamesNatureza}
                      disabled={!isEditor}
                    />
                  </Section>

                  <Section
                    icon={<Syringe className="h-4 w-4 text-rose-500" />}
                    title="Imunização (Risco Biológico)"
                    hint="Vencida ou sem carteira → Bloqueio GSI"
                    full
                  >
                    <ToggleRow
                      label="Função com Exposição a Risco Biológico (Esgoto / Tanques / Resíduos)"
                      checked={!!editing.risco_biologico}
                      onChange={toggleRiscoBio}
                      disabled={!isEditor}
                      divider
                    />
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 pt-1">
                      {VACINAS_LIST.map((v) => (
                        <NRToggle key={v} label={v} checked={reqVacinasSet.has(v)} onChange={() => toggleVacina(v)} disabled={!isEditor} />
                      ))}
                    </div>
                  </Section>

                  <Section icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} title="Riscos Ocupacionais (PCMSO · 6 categorias)" full>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                          Descrição da Função
                        </label>
                        <textarea
                          value={riscos.descricao}
                          onChange={(e) => updateRiscos({ descricao: e.target.value })}
                          disabled={!isEditor}
                          rows={2}
                          placeholder="Descreva a atividade do cargo..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#991b1b] focus:bg-white disabled:opacity-60 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <TagEditor label="Acidente / Mecânico" color="red" items={riscos.acidente_mecanico}
                          onChange={(v) => updateRiscos({ acidente_mecanico: v })} disabled={!isEditor} />
                        <TagEditor label="Riscos Físicos" color="sky" items={riscos.fisicos}
                          onChange={(v) => updateRiscos({ fisicos: v })} disabled={!isEditor} />
                        <TagEditor label="Riscos Químicos" color="amber" items={riscos.quimicos}
                          onChange={(v) => updateRiscos({ quimicos: v })} disabled={!isEditor} />
                        <TagEditor label="Riscos Biológicos" color="rose" items={riscos.biologicos}
                          onChange={(v) => updateRiscos({ biologicos: v })} disabled={!isEditor} />
                        <TagEditor label="Riscos Ergonômicos" color="emerald" items={riscos.ergonomicos}
                          onChange={(v) => updateRiscos({ ergonomicos: v })} disabled={!isEditor} />
                        <TagEditor label="Psicossociais" color="violet" items={riscos.psicossociais}
                          onChange={(v) => updateRiscos({ psicossociais: v })} disabled={!isEditor} />
                      </div>
                    </div>
                  </Section>
                </div>
              </div>

              {/* Footer Actions (secondary) */}
              {isEditor && (
                <div className="px-8 py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                    className="text-slate-600 hover:text-slate-900 text-xs font-black uppercase tracking-wider"
                  >
                    Cancelar
                  </Button>
                  {editing.id && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggleAtivo.mutate({ id: editing.id!, ativo: !editing.ativo })}
                      className="text-xs font-black uppercase tracking-wider"
                    >
                      {editing.ativo ? <><PowerOff className="h-4 w-4 mr-1.5" /> Desativar</> : <><Power className="h-4 w-4 mr-1.5" /> Reativar</>}
                    </Button>
                  )}
                  {isAdmin && editing.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { if (confirm(`Excluir "${editing.name}"? Essa ação não pode ser desfeita.`)) del.mutate(editing.id!); }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-black uppercase tracking-wider"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={save.isPending}
                    className="ml-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 px-6 py-2.5 h-auto flex items-center gap-2 transition-all"
                  >
                    <Save className="h-4 w-4" /> {save.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              )}
            </form>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <CargoRiscosPanel roleId={editing.id ?? null} lockRole={true} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ canEdit, onNew }: { canEdit: boolean; onNew: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-6">
          <Briefcase className="h-10 w-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-black uppercase text-slate-800 tracking-tight mb-2">
          Selecione um Cargo
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Escolha um cargo na lista ao lado para visualizar e editar a matriz de requisitos de saúde e segurança.
        </p>
        {canEdit && (
          <Button
            onClick={onNew}
            className="prism-pill accent-wine text-[11px] font-black uppercase tracking-wider px-6 py-3 h-auto"
          >
            <Plus className="h-4 w-4 mr-2" /> Cadastrar Novo Cargo
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({
  icon, title, hint, full, children,
}: { icon: React.ReactNode; title: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`p-5 border border-border rounded-3xl bg-card/25 backdrop-blur-xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] hover:shadow-[0_15px_40px_-12px_rgba(120,18,32,0.35)] transition-all ${full ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-secondary text-accent-foreground flex items-center justify-center shadow-sm">{icon}</div>
        <div className="text-sm font-black uppercase text-slate-800 tracking-wider">{title}</div>
        {hint && (
          <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full uppercase tracking-wider">{hint}</span>
        )}
      </div>
      <div className="bg-card/20 backdrop-blur p-4 rounded-2xl border border-border shadow-inner space-y-4">
        {children}
      </div>
    </div>
  );
}

function Pill({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "emerald" | "sky" | "red" | "rose" }) {
  const map = {
    emerald: "bg-emerald-400/12 text-emerald-200 ring-emerald-300/25",
    sky:     "bg-sky-400/12 text-sky-200 ring-sky-300/25",
    red:     "bg-red-500/15 text-red-200 ring-red-400/30",
    rose:    "bg-pink-400/12 text-pink-200 ring-pink-300/25",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 backdrop-blur-sm ${map[tone]}`}>
      {icon}{label}
    </span>
  );
}

function ToggleRow({
  label, checked, onChange, disabled, divider,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; divider?: boolean }) {
  return (
    <label className={`flex items-center justify-between cursor-pointer group ${divider ? "pb-4 border-b border-slate-100" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <span className="text-xs font-bold uppercase text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-emerald-500" : "bg-slate-200"}`}
      >
        <span className={`absolute top-[2px] left-[2px] bg-white border border-slate-300 rounded-full h-5 w-5 transition-transform shadow-sm ${checked ? "translate-x-5" : ""}`} />
      </button>
    </label>
  );
}

function NRToggle({
  label, checked, onChange, disabled,
}: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between cursor-pointer group ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <span className="text-xs font-bold uppercase text-slate-700 group-hover:text-[#991b1b] transition-colors">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${checked ? "bg-[#991b1b]" : "bg-slate-200"}`}
      >
        <span className={`absolute top-[2px] left-[2px] bg-white border border-slate-300 rounded-full h-3 w-3 transition-transform ${checked ? "translate-x-4" : ""}`} />
      </button>
    </label>
  );
}

function TagEditor({
  label, items, onChange, disabled, color,
}: { label: string; items: string[]; onChange: (v: string[]) => void; disabled?: boolean; color: "sky" | "amber" | "emerald" | "red" | "rose" | "violet" }) {
  const [val, setVal] = useState("");
  const colorMap = {
    sky: "bg-gradient-to-br from-sky-400 to-sky-600 text-white border-sky-300 shadow-sky-400/40",
    amber: "bg-gradient-to-br from-amber-400 to-orange-500 text-white border-amber-300 shadow-amber-400/40",
    emerald: "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white border-emerald-300 shadow-emerald-400/40",
    red: "bg-gradient-to-br from-rose-500 to-red-600 text-white border-red-300 shadow-rose-500/40",
    rose: "bg-gradient-to-br from-pink-400 to-rose-600 text-white border-rose-300 shadow-rose-400/40",
    violet: "bg-gradient-to-br from-violet-400 to-purple-600 text-white border-violet-300 shadow-violet-400/40",
  } as const;
  function add() {
    const t = val.trim();
    if (!t) return;
    if (!items.includes(t)) onChange([...items, t]);
    setVal("");
  }
  return (
    <div>
      <label className="block text-xs font-black text-slate-600 uppercase mb-2 tracking-widest">{label}</label>
      <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2 bg-white border border-slate-200 rounded-xl mb-2 shadow-inner">
        {items.length === 0 && <span className="text-xs text-slate-400 italic px-1">nenhum</span>}
        {items.map((it) => (
          <span key={it} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border shadow-md ${colorMap[color]}`}>
            {it}
            {!disabled && (
              <button type="button" onClick={() => onChange(items.filter((x) => x !== it))} className="hover:text-rose-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-1">
          <input
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Adicionar..."
            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#991b1b]"
          />
          <button type="button" onClick={add} className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-black uppercase">
            +
          </button>
        </div>
      )}
    </div>
  );
}

function ExamesMatrix({
  value, onToggle, onCopy, disabled,
}: {
  value: ExamesPorNatureza;
  onToggle: (n: Natureza, exame: string) => void;
  onCopy: (from: Natureza, to: Natureza) => void;
  disabled?: boolean;
}) {
  const [active, setActive] = useState<Natureza>("ADMISSIONAL");
  const toneMap: Record<string, string> = {
    rose: "from-rose-500 to-rose-600 ring-rose-200",
    sky: "from-sky-500 to-sky-600 ring-sky-200",
    emerald: "from-emerald-500 to-emerald-600 ring-emerald-200",
    amber: "from-amber-500 to-orange-500 ring-amber-200",
    slate: "from-slate-500 to-slate-700 ring-slate-200",
    violet: "from-violet-500 to-purple-600 ring-violet-200",
  };
  return (
    <div className="space-y-3">
      {/* Tabs por natureza */}
      <div className="flex flex-wrap gap-2">
        {NATUREZAS.map((n) => {
          const count = (value[n.key] ?? []).length;
          const isActive = active === n.key;
          return (
            <button
              key={n.key} type="button" onClick={() => setActive(n.key)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                isActive
                  ? `bg-gradient-to-r ${toneMap[n.tone]} text-white shadow-lg ring-2 ring-white -translate-y-0.5`
                  : "bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-300"
              }`}
            >
              {n.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/25" : "bg-slate-100 text-slate-700"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Copiar de outra natureza */}
      {!disabled && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Copiar de:</span>
          {NATUREZAS.filter((n) => n.key !== active).map((n) => (
            <button
              key={n.key} type="button" onClick={() => onCopy(n.key, active)}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] uppercase"
            >
              {n.label}
            </button>
          ))}
        </div>
      )}

      {/* Grade de exames da natureza ativa */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 pt-2">
        {TIPOS_EXAME.map((t) => {
          const checked = (value[active] ?? []).includes(t);
          return (
            <NRToggle key={t} label={t} checked={checked}
              onChange={() => onToggle(active, t)} disabled={disabled} />
          );
        })}
      </div>
    </div>
  );
}
