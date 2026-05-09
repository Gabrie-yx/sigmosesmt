import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Briefcase, UserCog, ChevronRight, Plus, FileText, Award, ShieldCheck, Save, Trash2, Stethoscope, AlertTriangle, X, Syringe } from "lucide-react";
import { toast } from "sonner";
import { NRS_LIST, TIPOS_EXAME, VACINAS_LIST, VACINAS_RISCO_BIOLOGICO } from "@/lib/constants";

export const Route = createFileRoute("/app/roles")({
  component: RolesPage,
});

type Riscos = { fisicos: string[]; quimicos: string[]; ergonomicos: string[]; descricao: string };
type Role = { id: string; name: string; req_aso: boolean; req_integra: boolean; req_nrs: string[]; req_exames: string[]; req_vacinas: string[]; risco_biologico: boolean; riscos: Riscos };
const emptyRiscos: Riscos = { fisicos: [], quimicos: [], ergonomicos: [], descricao: "" };
const empty: Partial<Role> = { name: "", req_aso: true, req_integra: true, req_nrs: [], req_exames: [], req_vacinas: [], risco_biologico: false, riscos: emptyRiscos };

function RolesPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [editing, setEditing] = useState<Partial<Role>>({ ...empty });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("*").order("name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        req_vacinas: r.req_vacinas ?? [],
        risco_biologico: !!r.risco_biologico,
        riscos: r.riscos && typeof r.riscos === "object" ? { ...emptyRiscos, ...r.riscos } : emptyRiscos,
      })) as Role[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Role>) => {
      const payload = {
        name: v.name!,
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
      } else {
        const { error } = await supabase.from("roles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Diretrizes salvas");
      setEditing({ ...empty });
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
      setEditing({ ...empty });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function toggleNr(nr: string) {
    const cur = editing.req_nrs ?? [];
    setEditing({ ...editing, req_nrs: cur.includes(nr) ? cur.filter((x) => x !== nr) : [...cur, nr] });
  }

  function toggleExame(t: string) {
    const cur = editing.req_exames ?? [];
    setEditing({ ...editing, req_exames: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  }

  function toggleVacina(t: string) {
    const cur = editing.req_vacinas ?? [];
    setEditing({ ...editing, req_vacinas: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  }

  function toggleRiscoBio(v: boolean) {
    // Quando marcado, pré-popula vacinas mínimas do PCMSO (Tétano + Hep. B)
    let vac = editing.req_vacinas ?? [];
    if (v) {
      VACINAS_RISCO_BIOLOGICO.forEach((x) => { if (!vac.includes(x)) vac = [...vac, x]; });
    }
    setEditing({ ...editing, risco_biologico: v, req_vacinas: vac });
  }

  const reqNRsSet = useMemo(() => new Set(editing.req_nrs ?? []), [editing.req_nrs]);
  const reqExamesSet = useMemo(() => new Set(editing.req_exames ?? []), [editing.req_exames]);
  const reqVacinasSet = useMemo(() => new Set(editing.req_vacinas ?? []), [editing.req_vacinas]);

  const riscos: Riscos = editing.riscos ?? emptyRiscos;
  const updateRiscos = (patch: Partial<Riscos>) =>
    setEditing({ ...editing, riscos: { ...riscos, ...patch } });

  return (
    <div className="p-6 md:p-8 flex gap-6 h-full bg-[#f1f5f9] animate-fadeIn">
      {/* LEFT: Cargos Catalogados */}
      <div className="w-[380px] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-black text-[#991b1b] uppercase tracking-tighter mb-1 flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Cargos Catalogados
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Selecione para editar a matriz de risco
          </p>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          {roles.length === 0 && (
            <div className="text-center text-slate-400 py-8 text-xs font-bold uppercase tracking-widest">
              Nenhum cargo cadastrado
            </div>
          )}
          {roles.map((r) => {
            const isSel = editing.id === r.id;
            return (
              <div
                key={r.id}
                onClick={() => setEditing(r)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                  isSel ? "border-[#991b1b] bg-red-50" : "border-slate-100 bg-white hover:border-[#991b1b]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                    isSel ? "bg-[#991b1b] text-white" : "bg-slate-50 text-slate-400 group-hover:bg-[#991b1b] group-hover:text-white"
                  }`}>
                    <UserCog className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase text-slate-800 leading-tight">{r.name}</h3>
                    <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                      Reqs: ASO/INT + {r.req_nrs.length} NRs
                    </div>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 ${isSel ? "text-[#991b1b]" : "text-slate-300 group-hover:text-[#991b1b]"}`} />
              </div>
            );
          })}
        </div>
        {isEditor && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => setEditing({ ...empty })}
              className="w-full py-3 bg-white border border-dashed border-slate-300 text-slate-500 hover:text-[#991b1b] hover:border-[#991b1b] text-[10px] font-black rounded-xl uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Cargo
            </button>
          </div>
        )}
      </div>

      {/* RIGHT: Matriz de Requisitos */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col overflow-y-auto custom-scrollbar">
        <div className="mb-8 border-b border-slate-100 pb-4 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">
              Matriz de Requisitos (ISO 9001)
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Configure as exigências de saúde e segurança para a função
            </p>
          </div>
          <ShieldCheck className="h-10 w-10 text-emerald-500 opacity-20" />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}
          className="flex-1 flex flex-col"
        >
          <div className="mb-8 shrink-0">
            <label className="block text-[10px] font-black text-[#991b1b] uppercase mb-2 tracking-widest">
              Nomenclatura Oficial do Cargo
            </label>
            <input
              type="text"
              required
              value={editing.name ?? ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Digite o nome da Função Técnica..."
              disabled={!isEditor}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm font-black uppercase text-slate-800 focus:border-[#991b1b] focus:ring-4 focus:ring-[#991b1b]/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 flex-1">
            {/* REQUISITOS BASE */}
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="h-5 w-5 text-slate-400" />
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-widest">
                  Requisitos Base (Integração)
                </div>
              </div>
              <div className="space-y-6 bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex-1">
                <ToggleRow
                  label="Exige ASO Válido"
                  checked={!!editing.req_aso}
                  onChange={(v) => setEditing({ ...editing, req_aso: v })}
                  disabled={!isEditor}
                  divider
                />
                <ToggleRow
                  label="Exige Integração de Segurança"
                  checked={!!editing.req_integra}
                  onChange={(v) => setEditing({ ...editing, req_integra: v })}
                  disabled={!isEditor}
                />
              </div>
            </div>

            {/* NRS */}
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <Award className="h-5 w-5 text-slate-400" />
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-widest">
                  Normas Regulamentadoras (NRs)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex-1 content-start">
                {NRS_LIST.map((nr) => (
                  <NRToggle
                    key={nr}
                    label={nr}
                    checked={reqNRsSet.has(nr)}
                    onChange={() => toggleNr(nr)}
                    disabled={!isEditor}
                  />
                ))}
              </div>
            </div>

            {/* EXAMES OBRIGATÓRIOS */}
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <Stethoscope className="h-5 w-5 text-slate-400" />
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-widest">
                  Exames Médicos Obrigatórios (Saúde)
                </div>
                <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Vencido ou sem PDF → Bloqueio GSI
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex-1 content-start">
                {TIPOS_EXAME.map((t) => (
                  <NRToggle
                    key={t}
                    label={t}
                    checked={reqExamesSet.has(t)}
                    onChange={() => toggleExame(t)}
                    disabled={!isEditor}
                  />
                ))}
              </div>
            </div>

            {/* VACINAS / RISCO BIOLÓGICO */}
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <Syringe className="h-5 w-5 text-rose-500" />
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-widest">
                  Controle de Imunização (Risco Biológico)
                </div>
                <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Vencida ou sem carteira → Bloqueio GSI
                </span>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-5">
                <ToggleRow
                  label="Função com Exposição a Risco Biológico (Esgoto / Tanques / Resíduos)"
                  checked={!!editing.risco_biologico}
                  onChange={toggleRiscoBio}
                  disabled={!isEditor}
                />
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-3 border-t border-slate-100">
                  {VACINAS_LIST.map((v) => (
                    <NRToggle
                      key={v}
                      label={v}
                      checked={reqVacinasSet.has(v)}
                      onChange={() => toggleVacina(v)}
                      disabled={!isEditor}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* RISCOS PCMSO */}
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-widest">
                  Riscos Ocupacionais (PCMSO)
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-5">
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#991b1b] disabled:opacity-60"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TagEditor
                    label="Riscos Físicos"
                    color="sky"
                    items={riscos.fisicos}
                    onChange={(v) => updateRiscos({ fisicos: v })}
                    disabled={!isEditor}
                  />
                  <TagEditor
                    label="Riscos Químicos"
                    color="amber"
                    items={riscos.quimicos}
                    onChange={(v) => updateRiscos({ quimicos: v })}
                    disabled={!isEditor}
                  />
                  <TagEditor
                    label="Riscos Ergonómicos"
                    color="emerald"
                    items={riscos.ergonomicos}
                    onChange={(v) => updateRiscos({ ergonomicos: v })}
                    disabled={!isEditor}
                  />
                </div>
              </div>
            </div>
          </div>

          {isEditor && (
            <div className="pt-6 border-t border-slate-100 flex justify-between items-center shrink-0 gap-3">
              {isAdmin && editing.id && (
                <button
                  type="button"
                  onClick={() => { if (confirm("Excluir cargo?")) del.mutate(editing.id!); }}
                  className="px-5 py-3 text-red-500 hover:bg-red-50 text-[11px] font-black rounded-xl uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </button>
              )}
              <Button
                type="submit"
                disabled={save.isPending}
                className="ml-auto bg-[#0f172a] hover:bg-[#991b1b] text-white text-[11px] font-black rounded-xl uppercase tracking-widest shadow-xl px-10 py-4 h-auto flex items-center gap-2"
              >
                <Save className="h-4 w-4" /> Salvar Diretrizes do Cargo
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function ToggleRow({
  label, checked, onChange, disabled, divider,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; divider?: boolean }) {
  return (
    <label className={`flex items-center justify-between cursor-pointer group ${divider ? "pb-4 border-b border-slate-50" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <span className="text-[11px] font-bold uppercase text-slate-600 group-hover:text-slate-900 transition-colors">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-slate-200"}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] bg-white border border-slate-300 rounded-full h-5 w-5 transition-transform ${checked ? "translate-x-5" : ""}`}
        />
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
        className={`relative w-8 h-4 rounded-full transition-colors ${checked ? "bg-[#991b1b]" : "bg-slate-200"}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] bg-white border border-slate-300 rounded-full h-3 w-3 transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </button>
    </label>
  );
}

function TagEditor({
  label, items, onChange, disabled, color,
}: { label: string; items: string[]; onChange: (v: string[]) => void; disabled?: boolean; color: "sky" | "amber" | "emerald" }) {
  const [val, setVal] = useState("");
  const colorMap = {
    sky: "bg-red-100 text-red-800 border-red-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
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
        {items.length === 0 && (
          <span className="text-[10px] text-slate-400 italic px-1">nenhum</span>
        )}
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
