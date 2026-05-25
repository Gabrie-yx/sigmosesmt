import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Files, Printer, Pencil, Trash2, X, HardHat, Clock, Link2 } from "lucide-react";
import { toast } from "sonner";
import { PTE_RISCOS } from "@/lib/constants";
import { formatDateBR } from "@/lib/utils-date";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { hasGlobalOverride, type SafetyOverride } from "@/lib/safety-overrides";
import { detectarExigenciaPTE } from "@/lib/apr-pte-rules";

export const Route = createFileRoute("/app/ptes")({
  component: PtesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    apr_id: typeof s.apr_id === "string" ? s.apr_id : undefined,
    filter: typeof s.filter === "string" ? (s.filter as "all" | "linked" | "orphan") : undefined,
  }),
});

function PtesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/ptes" });
  const { isEditor, isAdmin } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkedAprId, setLinkedAprId] = useState<string | null>(null);
  const [f, setF] = useState<any>({
    data: today, employee_id: "", risco: PTE_RISCOS[0], local: "", company_id: "", casco_id: "",
  });

  const { data: ptes = [] } = useQuery({
    queryKey: ["ptes"],
    queryFn: async () => (await supabase.from("ptes").select("*").order("data_emissao", { ascending: false })).data ?? [],
  });
  const { data: aprsAll = [] } = useQuery({
    queryKey: ["aprs-light-for-ptes"],
    queryFn: async () => (await supabase.from("aprs").select("id,numero,atividade_descricao,casco_id,empresa_id,local").order("data_emissao", { ascending: false })).data ?? [],
  });
  const aprsMap = useMemo(() => new Map(aprsAll.map((a: any) => [a.id, a])), [aprsAll]);

  // Pré-preencher PTE a partir de uma APR (vindo do menu "Gerar PTE vinculada")
  useEffect(() => {
    const aprId = search.apr_id;
    if (!aprId || aprsAll.length === 0) return;
    const apr = aprsMap.get(aprId);
    if (!apr) return;
    (async () => {
      const { data: rs } = await supabase.from("apr_riscos").select("risco_nome,nrs").eq("apr_id", aprId);
      const det = detectarExigenciaPTE((rs ?? []) as any);
      const riscoSugerido = det.categoriaPrincipal && PTE_RISCOS.includes(det.categoriaPrincipal as any)
        ? det.categoriaPrincipal
        : (det.categoriaPrincipal ?? PTE_RISCOS[0]);
      setLinkedAprId(aprId);
      setF((cur: any) => ({
        ...cur,
        risco: riscoSugerido,
        local: apr.local ?? cur.local,
        casco_id: apr.casco_id ?? cur.casco_id,
      }));
      toast.info(`Vinculando nova PTE à APR ${apr.numero}`);
      // limpa o search para não repetir ao voltar
      navigate({ to: "/app/ptes", search: {}, replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.apr_id, aprsAll]);
  const { data: emps = [] } = useQuery({
    queryKey: ["employees-light"],
    queryFn: async () => (await supabase.from("employees").select("id,nome,matricula,company_id,role_id,nrs,status,data_aso").order("nome")).data ?? [],
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name")).data ?? [],
  });
  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-light-for-ptes"],
    queryFn: async () => (await supabase.from("cascos").select("id,numero,nome").order("numero")).data ?? [],
  });
  const cascosMap = useMemo(() => new Map((cascos as any[]).map((c: any) => [c.id, c])), [cascos]);
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("*")).data ?? [],
  });
  const { data: exams = [] } = useQuery({
    queryKey: ["exams-all"],
    queryFn: async () => (await supabase.from("employee_exams").select("*")).data ?? [],
  });
  const { data: vaccines = [] } = useQuery({
    queryKey: ["vaccines-all"],
    queryFn: async () => (await supabase.from("employee_vaccinations").select("*")).data ?? [],
  });
  const { data: overridesAll = [] } = useQuery({
    queryKey: ["safety-overrides-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("safety_overrides").select("*").eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as SafetyOverride[];
    },
  });

  const empOptions = useMemo(() => {
    const list = f.company_id ? emps.filter((e: any) => e.company_id === f.company_id) : emps;
    return list.map((e: any) => {
      const role = roles.find((r: any) => r.id === e.role_id) ?? null;
      const empExams = exams.filter((x: any) => x.employee_id === e.id);
      const empVacs = vaccines.filter((x: any) => x.employee_id === e.id);
      const empOv = overridesAll.filter((o) => o.employee_id === e.id);
      const st = calculateSafetyStatus(e, role as any, empExams as any, empVacs as any, empOv);
      const comp = companies.find((c: any) => c.id === e.company_id);
      return { e, st, compName: comp?.name ?? "S/ EMPRESA" };
    });
  }, [emps, roles, exams, vaccines, companies, overridesAll, f.company_id]);

  const save = useMutation({
    mutationFn: async () => {
      const emp = emps.find((x: any) => x.id === f.employee_id);
      // Bloqueio específico para Limpeza de Tanque (Risco Biológico)
      if (f.risco?.toLowerCase().includes("tanque") || f.risco?.toLowerCase().includes("biológic")) {
        const empOv = overridesAll.filter((o) => o.employee_id === emp?.id);
        if (hasGlobalOverride(empOv) || empOv.some((o) => o.item_key === "PTE")) {
          // Override ativo: pula bloqueio de vacinas
        } else {
        const role = roles.find((r: any) => r.id === emp?.role_id);
        const reqVac: string[] = role?.req_vacinas ?? [];
        const empVacs = vaccines.filter((v: any) => v.employee_id === emp?.id);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const missing = reqVac.filter((vac) => {
          const latest = empVacs
            .filter((v: any) => v.tipo_vacina === vac)
            .sort((a: any, b: any) => +new Date(b.data_aplicacao) - +new Date(a.data_aplicacao))[0];
          if (!latest) return true;
          if (!latest.anexo_path) return true;
          if (latest.data_proxima_dose && new Date(latest.data_proxima_dose + "T00:00:00") < today) return true;
          return false;
        });
        if (missing.length) {
          throw new Error(`PTE bloqueada — vacinas obrigatórias pendentes: ${missing.join(", ")}. Admin pode liberar via Override no perfil do funcionário.`);
        }
        }
      }
      if (editingId) {
        const { error } = await supabase.from("ptes").update({
          data: f.data, local: f.local || null, risco: f.risco,
          employee_id: f.employee_id || null, employee_name: emp?.nome ?? null,
          company_id: emp?.company_id ?? null,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const numero = `PTE-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const { error } = await supabase.from("ptes").insert({
          numero, data: f.data, local: f.local || null, risco: f.risco, status: "ATIVA",
          employee_id: f.employee_id || null, employee_name: emp?.nome ?? null,
          company_id: emp?.company_id ?? null, dados: {},
          apr_id: linkedAprId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ptes"] });
      qc.invalidateQueries({ queryKey: ["ptes-by-apr"] });
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return k === "ptes-linked-apr" || k === "ptes-light";
      } });
      setEditingId(null);
      setLinkedAprId(null);
      setF({ data: today, employee_id: "", risco: PTE_RISCOS[0], local: "", company_id: "" });
      toast.success(editingId ? "PTE atualizada" : "PTE emitida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ptes").update({ status: "ENCERRADA" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return k === "ptes" || k === "ptes-by-apr" || k === "ptes-linked-apr" || k === "ptes-light";
      } });
      toast.success("PTE encerrada");
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("ptes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return k === "ptes" || k === "ptes-by-apr" || k === "ptes-linked-apr" || k === "ptes-light";
      } });
      toast.success("Removido");
    },
  });

  function startEdit(p: any) {
    setEditingId(p.id);
    setF({ data: p.data, employee_id: p.employee_id ?? "", risco: p.risco ?? PTE_RISCOS[0], local: p.local ?? "", company_id: p.company_id ?? "" });
  }
  function cancelEdit() {
    setEditingId(null);
    setF({ data: today, employee_id: "", risco: PTE_RISCOS[0], local: "", company_id: "" });
  }

  return (
    <div className="p-6 md:p-8 animate-fadeIn h-full overflow-y-auto custom-scrollbar bg-[#f1f5f9]">
      <h2 className="heading-display text-3xl md:text-4xl text-[#991b1b] mb-8">
        Emissão de PTE (Permissão de Trabalho)
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* FORM */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-4 flex items-center justify-between">
            <span className="flex items-center gap-2"><FileText className="h-5 w-5" />
              {editingId ? "Editar Permissão Especial" : "Nova Permissão Especial"}
            </span>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-200 uppercase font-black">
                Cancelar Edição
              </button>
            )}
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
            {linkedAprId && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2">
                <Link2 className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                <div className="flex-1 text-[10px] font-bold uppercase text-amber-900">
                  Vinculando à APR {(aprsMap.get(linkedAprId) as any)?.numero ?? linkedAprId.slice(0, 8)}
                  <button type="button" onClick={() => setLinkedAprId(null)} className="ml-2 text-amber-700 underline">remover vínculo</button>
                </div>
              </div>
            )}
            <div>
              <Label className="text-[10px] font-black text-slate-500 uppercase">Local do Trabalho / Instalação</Label>
              <Input required value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} placeholder="Ex: Dique Seco, Navio XYZ..." className="bg-slate-50 mt-2 text-xs font-bold uppercase" />
            </div>
            <div>
              <Label className="text-[10px] font-black text-slate-500 uppercase">Classificação de Risco (GSI)</Label>
              <Select value={f.risco} onValueChange={(v) => setF({ ...f, risco: v })}>
                <SelectTrigger className="bg-slate-50 mt-2 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>{PTE_RISCOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black text-slate-500 uppercase">Data</Label>
              <Input type="date" required value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} className="bg-slate-50 mt-2" />
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <Label className="text-[10px] font-black text-slate-800 uppercase flex items-center gap-2 mb-3">
                <HardHat className="h-4 w-4" /> Empresa
              </Label>
              <Select
                value={f.company_id || "none"}
                onValueChange={(v) => setF({ ...f, company_id: v === "none" ? "" : v, employee_id: "" })}
              >
                <SelectTrigger className="bg-white text-xs font-bold uppercase mb-4">
                  <SelectValue placeholder="-- TODAS AS EMPRESAS --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— TODAS AS EMPRESAS —</SelectItem>
                  {companies.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="text-[10px] font-black text-slate-800 uppercase flex items-center gap-2 mb-3">
                <HardHat className="h-4 w-4" /> Selecionar Executante (Apenas Aptos)
              </Label>
              <select
                required
                value={f.employee_id}
                onChange={(e) => setF({ ...f, employee_id: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:border-[#991b1b]"
              >
                <option value="">-- SELECIONE UM COLABORADOR NA BASE --</option>
                {empOptions.map(({ e, st, compName }) => {
                  const blocked = !st.acessoPermitido && (!editingId || f.employee_id !== e.id);
                  return (
                    <option key={e.id} value={e.id} disabled={blocked}>
                      {blocked ? "🚫 BLOQUEADO" : "✅ APTO"}: {e.nome} - [{compName}] (MAT: {e.matricula || "N/A"})
                    </option>
                  );
                })}
              </select>
            </div>

            <Button
              type="submit"
              disabled={save.isPending}
              className={`w-full text-xs font-black uppercase tracking-widest h-auto px-8 py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 ${
                editingId ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"
              } text-white`}
            >
              <Printer className="h-4 w-4" /> {editingId ? "Salvar Alterações" : "Emitir PTE"}
            </Button>
          </form>
        </div>

        {/* HISTORY */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
            <Files className="h-5 w-5" /> Histórico de PTEs Emitidas
          </h3>
          <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            {ptes.length === 0 && (
              <div className="text-center text-slate-400 py-10 font-bold uppercase text-xs border border-dashed border-slate-200 rounded-2xl">
                Nenhuma permissão foi emitida até o momento.
              </div>
            )}
            {ptes.map((p: any) => (
              <div key={p.id} className={`p-5 border rounded-2xl ${p.status === "ATIVA" ? "bg-orange-50 border-orange-200 shadow-sm" : "bg-slate-50 border-slate-200 opacity-70"}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nº {p.numero}</div>
                  <div className="flex gap-2 items-center">
                    <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest ${p.status === "ATIVA" ? "bg-orange-500 text-white" : "bg-slate-300 text-slate-600"}`}>{p.status}</div>
                    {isEditor && (
                      <button onClick={() => startEdit(p)} className="w-6 h-6 rounded bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors" title="Editar">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => { if (confirm("Excluir PTE?")) del.mutate(p.id); }} className="w-6 h-6 rounded bg-red-100 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors" title="Excluir">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <h4 className="text-xs font-black text-[#991b1b] uppercase mb-1">{p.employee_name ?? "—"}</h4>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Risco: <span className="font-black text-slate-700">{p.risco}</span></div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Local: {p.local ?? "—"}</div>
                {p.apr_id && (
                  <div className="text-[10px] font-bold text-emerald-700 uppercase mt-1 flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> APR {(aprsMap.get(p.apr_id) as any)?.numero ?? p.apr_id.slice(0, 8)}
                  </div>
                )}
                <div className="text-[9px] font-black text-slate-400 uppercase mt-3 tracking-widest flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Emitida em: {formatDateBR(p.data_emissao || p.data)}
                </div>
                {p.status === "ATIVA" && isEditor && (
                  <button onClick={() => revoke.mutate(p.id)} className="mt-4 w-full py-2 bg-white border border-red-200 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-1">
                    <X className="h-3 w-3" /> Encerrar / Revogar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
