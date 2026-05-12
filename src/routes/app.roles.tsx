import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Briefcase, UserCog, Plus, FileText, Award, ShieldCheck, Save, Trash2,
  Stethoscope, AlertTriangle, X, Syringe, Search, Copy, Power, PowerOff,
  Sparkles, MoreVertical, FilePlus2,
} from "lucide-react";
import { toast } from "sonner";
import { NRS_LIST, TIPOS_EXAME, VACINAS_LIST, VACINAS_RISCO_BIOLOGICO } from "@/lib/constants";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/app/roles")({
  component: RolesPage,
});

type Riscos = { fisicos: string[]; quimicos: string[]; ergonomicos: string[]; descricao: string };
type Role = {
  id: string; name: string; ativo: boolean;
  req_aso: boolean; req_integra: boolean;
  req_nrs: string[]; req_exames: string[]; req_vacinas: string[];
  risco_biologico: boolean; riscos: Riscos;
};
const emptyRiscos: Riscos = { fisicos: [], quimicos: [], ergonomicos: [], descricao: "" };
const empty: Partial<Role> = {
  name: "", ativo: true, req_aso: true, req_integra: true,
  req_nrs: [], req_exames: [], req_vacinas: [], risco_biologico: false, riscos: emptyRiscos,
};

function RolesPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [editing, setEditing] = useState<Partial<Role> | null>(null);
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
        req_vacinas: r.req_vacinas ?? [],
        risco_biologico: !!r.risco_biologico,
        riscos: r.riscos && typeof r.riscos === "object" ? { ...emptyRiscos, ...r.riscos } : emptyRiscos,
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
        req_aso: !!v.req_aso,
        req_integra: !!v.req_integra,
        req_nrs: v.req_nrs ?? [],
        req_exames: v.req_exames ?? [],
        req_vacinas: v.req_vacinas ?? [],
        risco_biologico: !!v.risco_biologico,
        riscos: v.riscos ?? emptyRiscos,
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

  const reqNRsSet = useMemo(() => new Set(editing?.req_nrs ?? []), [editing?.req_nrs]);
  const reqExamesSet = useMemo(() => new Set(editing?.req_exames ?? []), [editing?.req_exames]);
  const reqVacinasSet = useMemo(() => new Set(editing?.req_vacinas ?? []), [editing?.req_vacinas]);

  const riscos: Riscos = editing?.riscos ?? emptyRiscos;
  const updateRiscos = (patch: Partial<Riscos>) =>
    editing && setEditing({ ...editing, riscos: { ...riscos, ...patch } });

  return (
    <div className="p-4 md:p-6 flex gap-4 md:gap-6 h-full bg-gradient-to-br from-slate-50 via-white to-slate-100 animate-fadeIn">
      {/* LEFT: Cargos Catalogados */}
      <aside className="w-[340px] flex flex-col bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-200/80 overflow-hidden shrink-0">
        {/* Header */}
        <div className="p-5 bg-gradient-to-br from-[#991b1b] to-[#7f1d1d] text-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Cargos / Funções
            </h2>
            <span className="text-[10px] font-bold bg-white/15 px-2 py-1 rounded-full">
              {stats.ativos}/{stats.total}
            </span>
          </div>
          {isEditor && (
            <button
              onClick={startNew}
              className="w-full py-2.5 bg-white text-[#991b1b] hover:bg-amber-50 text-[11px] font-black rounded-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              <FilePlus2 className="h-4 w-4" /> Novo Cargo
            </button>
          )}
        </div>

        {/* Search & filter */}
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cargo..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-[#991b1b] focus:bg-white transition-all"
            />
          </div>
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Mostrar inativos ({stats.inativos})
          </label>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
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
                onClick={() => setEditing(r)}
                className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  isSel
                    ? "border-[#991b1b] bg-gradient-to-r from-red-50 to-white shadow-md"
                    : !r.ativo
                    ? "border-slate-100 bg-slate-50/50 opacity-70 hover:opacity-100 hover:border-slate-300"
                    : "border-slate-100 bg-white hover:border-[#991b1b] hover:shadow-md"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    isSel ? "bg-[#991b1b] text-white shadow-md" : "bg-slate-100 text-slate-500 group-hover:bg-[#991b1b] group-hover:text-white"
                  }`}>
                    <UserCog className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="text-[12px] font-black uppercase text-slate-800 leading-tight truncate">{r.name}</h3>
                      {!r.ativo && (
                        <span className="text-[8px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase shrink-0">Inativo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {r.req_aso && <Pill icon={<Stethoscope className="h-2.5 w-2.5" />} label="ASO" tone="emerald" />}
                      {r.req_integra && <Pill icon={<ShieldCheck className="h-2.5 w-2.5" />} label="INT" tone="sky" />}
                      {r.req_nrs.length > 0 && <Pill icon={<Award className="h-2.5 w-2.5" />} label={`${r.req_nrs.length} NR`} tone="red" />}
                      {r.risco_biologico && <Pill icon={<Syringe className="h-2.5 w-2.5" />} label="BIO" tone="rose" />}
                    </div>
                  </div>
                  {isEditor && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-slate-100 transition-all">
                          <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
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
      <main className="flex-1 bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-200/80 overflow-hidden flex flex-col">
        {!editing ? (
          <EmptyState canEdit={isEditor} onNew={startNew} />
        ) : (
          <>
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#991b1b] to-[#7f1d1d] text-white flex items-center justify-center shadow-md">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
                    {editing.id ? "Matriz de Requisitos" : (
                      <><Sparkles className="h-5 w-5 text-amber-500" /> Novo Cargo</>
                    )}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {editing.id ? "Configure exigências de saúde e segurança · ISO 9001" : "Preencha os dados para catalogar a função"}
                  </p>
                </div>
              </div>
              {editing.id && (
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${
                    editing.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                  }`}>
                    {editing.ativo ? "● Ativo" : "○ Inativo"}
                  </span>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                {/* Nome */}
                <div className="mb-6">
                  <label className="block text-[10px] font-black text-[#991b1b] uppercase mb-2 tracking-widest">
                    Nomenclatura Oficial do Cargo
                  </label>
                  <input
                    type="text"
                    required
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Ex: Eletricista, Soldador, Operador de Empilhadeira..."
                    disabled={!isEditor}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-5 py-3.5 text-sm font-black uppercase text-slate-800 focus:border-[#991b1b] focus:bg-white focus:ring-4 focus:ring-[#991b1b]/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:normal-case disabled:opacity-60"
                  />
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
                    title="Exames Médicos (Saúde)"
                    hint="Vencido ou sem PDF → Bloqueio GSI"
                    full
                  >
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                      {TIPOS_EXAME.map((t) => (
                        <NRToggle key={t} label={t} checked={reqExamesSet.has(t)} onChange={() => toggleExame(t)} disabled={!isEditor} />
                      ))}
                    </div>
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

                  <Section icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} title="Riscos Ocupacionais (PCMSO)" full>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
                          Descrição da Função
                        </label>
                        <textarea
                          value={riscos.descricao}
                          onChange={(e) => updateRiscos({ descricao: e.target.value })}
                          disabled={!isEditor}
                          rows={2}
                          placeholder="Descreva a atividade do cargo..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#991b1b] focus:bg-white disabled:opacity-60 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <TagEditor label="Riscos Físicos" color="sky" items={riscos.fisicos}
                          onChange={(v) => updateRiscos({ fisicos: v })} disabled={!isEditor} />
                        <TagEditor label="Riscos Químicos" color="amber" items={riscos.quimicos}
                          onChange={(v) => updateRiscos({ quimicos: v })} disabled={!isEditor} />
                        <TagEditor label="Riscos Ergonómicos" color="emerald" items={riscos.ergonomicos}
                          onChange={(v) => updateRiscos({ ergonomicos: v })} disabled={!isEditor} />
                      </div>
                    </div>
                  </Section>
                </div>
              </div>

              {/* Footer Actions */}
              {isEditor && (
                <div className="px-8 py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                    className="text-slate-600 hover:text-slate-900 text-[11px] font-black uppercase tracking-wider"
                  >
                    Cancelar
                  </Button>
                  {editing.id && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggleAtivo.mutate({ id: editing.id!, ativo: !editing.ativo })}
                      className="text-[11px] font-black uppercase tracking-wider"
                    >
                      {editing.ativo ? <><PowerOff className="h-4 w-4 mr-1.5" /> Desativar</> : <><Power className="h-4 w-4 mr-1.5" /> Reativar</>}
                    </Button>
                  )}
                  {isAdmin && editing.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { if (confirm(`Excluir "${editing.name}"? Essa ação não pode ser desfeita.`)) del.mutate(editing.id!); }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] font-black uppercase tracking-wider"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={save.isPending}
                    className="ml-auto bg-gradient-to-r from-[#0f172a] to-[#1e293b] hover:from-[#991b1b] hover:to-[#7f1d1d] text-white text-[11px] font-black rounded-xl uppercase tracking-wider shadow-lg hover:shadow-xl px-8 py-3 h-auto flex items-center gap-2 transition-all"
                  >
                    <Save className="h-4 w-4" /> {save.isPending ? "Salvando..." : "Salvar Diretrizes"}
                  </Button>
                </div>
              )}
            </form>
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
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
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
            className="bg-gradient-to-r from-[#991b1b] to-[#7f1d1d] hover:from-[#7f1d1d] hover:to-[#991b1b] text-white text-[11px] font-black uppercase tracking-wider px-6 py-3 h-auto shadow-lg"
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
    <div className={`p-5 border border-slate-200 rounded-2xl bg-gradient-to-br from-slate-50/80 to-white ${full ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="text-slate-500">{icon}</div>
        <div className="text-[11px] font-black uppercase text-slate-800 tracking-widest">{title}</div>
        {hint && (
          <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-widest">{hint}</span>
        )}
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
        {children}
      </div>
    </div>
  );
}

function Pill({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "emerald" | "sky" | "red" | "rose" }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    red: "bg-red-50 text-red-700 border-red-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  } as const;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${map[tone]}`}>
      {icon}{label}
    </span>
  );
}

function ToggleRow({
  label, checked, onChange, disabled, divider,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; divider?: boolean }) {
  return (
    <label className={`flex items-center justify-between cursor-pointer group ${divider ? "pb-4 border-b border-slate-100" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <span className="text-[11px] font-bold uppercase text-slate-600 group-hover:text-slate-900 transition-colors">{label}</span>
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
      <span className="text-[10px] font-bold uppercase text-slate-600 group-hover:text-[#991b1b] transition-colors">{label}</span>
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
}: { label: string; items: string[]; onChange: (v: string[]) => void; disabled?: boolean; color: "sky" | "amber" | "emerald" }) {
  const [val, setVal] = useState("");
  const colorMap = {
    sky: "bg-sky-50 text-sky-800 border-sky-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
  } as const;
  function add() {
    const t = val.trim();
    if (!t) return;
    if (!items.includes(t)) onChange([...items, t]);
    setVal("");
  }
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">{label}</label>
      <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-slate-50 border border-slate-200 rounded-lg mb-2">
        {items.length === 0 && <span className="text-[10px] text-slate-400 italic px-1">nenhum</span>}
        {items.map((it) => (
          <span key={it} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${colorMap[color]}`}>
            {it}
            {!disabled && (
              <button type="button" onClick={() => onChange(items.filter((x) => x !== it))} className="hover:text-red-600">
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
