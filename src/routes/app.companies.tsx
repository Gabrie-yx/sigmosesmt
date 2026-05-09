import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";

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
};

const empty: Partial<Company> = { name: "", type: "CLT", cnpj: "", email: "", encarregado1: "", encarregado2: "" };

const typeStyle: Record<string, string> = {
  CLT: "bg-emerald-100 text-emerald-700",
  TERCEIRIZADO: "bg-indigo-100 text-indigo-700",
  TERCEIRIZADA: "bg-indigo-100 text-indigo-700",
  CONTRATANTE: "bg-sky-100 text-sky-700",
};

function CompaniesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isEditor, isAdmin } = useAuth();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  const [showForm, setShowForm] = useState(true);

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

  const save = useMutation({
    mutationFn: async (v: Partial<Company>) => {
      const payload = {
        name: v.name!, type: v.type ?? "CLT",
        cnpj: v.cnpj || null, email: v.email || null,
        encarregado1: v.encarregado1 || null, encarregado2: v.encarregado2 || null,
        data_entrada: (v as any).data_entrada || null,
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

  const selected = useMemo(() => companies.find((c) => c.id === selectedId) || null, [companies, selectedId]);
  const compEmps = useMemo(
    () => (selected ? employees.filter((e: any) => e.company_id === selected.id) : []),
    [employees, selected],
  );

  function startNew() { setEditing({ ...empty }); setShowForm(true); setSelectedId(null); }
  function startEdit() { if (selected) { setEditing({ ...selected }); setShowForm(true); } }

  // Garante editing inicial para o formulário fixo
  if (showForm && !editing) {
    setEditing({ ...empty });
  }

  return (
    <div className="p-6 md:p-8 flex gap-6 h-full bg-[#f1f5f9] animate-fadeIn">
      {/* LEFT: Company cards */}
      <div className="w-[360px] flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="heading-display text-xl text-slate-900 font-black uppercase tracking-tight">
            Empresas <span className="text-slate-400 font-bold">(Tabela Pai)</span>
          </h2>
          {isEditor && (
            <Button
              size="sm"
              onClick={startNew}
              className="bg-[#0f172a] hover:bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-2 h-auto"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova
            </Button>
          )}
        </div>
        {companies.map((c) => {
          const isSel = selectedId === c.id;
          const empCount = employees.filter((e: any) => e.company_id === c.id).length;
          const ts = typeStyle[c.type] ?? "bg-slate-100 text-slate-700";
          const entrada = (c as any).data_entrada
            ? new Date((c as any).data_entrada + "T00:00:00").toLocaleDateString("pt-BR")
            : "N/A";
          return (
            <div
              key={c.id}
              onClick={() => { setSelectedId(c.id); setShowForm(false); setEditing(null); }}
              className={`p-5 rounded-2xl shadow-sm border cursor-pointer transition-all ${
                isSel ? "bg-[#0369a1] border-[#0369a1] text-white shadow-md" : "bg-white border-slate-200 hover:border-[#0369a1]"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={`text-[9px] font-black px-2 py-1 rounded inline-block ${isSel ? "text-white bg-white/20" : ts}`}>{c.type}</div>
                <div className={`text-[9px] font-black uppercase flex items-center gap-1 ${isSel ? "text-white/80" : "text-slate-400"}`}>
                  <Users className="h-3 w-3" /> {empCount} Vínculos
                </div>
              </div>
              <h3 className={`text-lg font-black uppercase ${isSel ? "text-white" : "text-slate-800"}`}>{c.name}</h3>
              <p className={`text-[10px] font-bold uppercase mt-1 ${isSel ? "text-white/70" : "text-slate-500"}`}>
                CNPJ: {c.cnpj || "Não informado"} <span className="mx-1">|</span> ENTRADA: {entrada}
              </p>
              <div className={`mt-4 pt-4 border-t text-xs font-bold ${isSel ? "border-white/20 text-white/90" : "border-slate-100 text-slate-600"}`}>
                <div className="flex items-center gap-2"><User className={`h-3.5 w-3.5 ${isSel ? "text-white" : "text-[#0369a1]"}`} /> {c.encarregado1 ? `Empreiteiro: ${c.encarregado1}` : "S/ Empreiteiro"}</div>
                <div className="flex items-center gap-2 mt-1"><UserCog className={`h-3.5 w-3.5 ${isSel ? "text-white" : "text-[#0369a1]"}`} /> {c.encarregado2 ? `Encarregado: ${c.encarregado2}` : "S/ Encarregado"}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* RIGHT */}
      {showForm || (!selected && !showForm) ? (
        <CompanyForm
          editing={editing ?? { ...empty }}
          setEditing={setEditing}
          onCancel={selected ? () => { setShowForm(false); setEditing(null); } : undefined}
          onSubmit={() => save.mutate(editing ?? { ...empty })}
          saving={save.isPending}
        />
      ) : selected ? (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col overflow-hidden animate-fadeIn">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
            <div>
              <h3 className="text-2xl font-black uppercase text-[#0369a1] tracking-tighter">{selected.name}</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                Quadro de Colaboradores Catalogados: {compEmps.length}
              </p>
            </div>
            <div className="flex gap-2">
              {isEditor && (
                <Button onClick={() => navigate({ to: "/app/employees" })} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg uppercase tracking-widest h-auto px-4 py-2">
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Novo Colaborador
                </Button>
              )}
              {isEditor && (
                <Button onClick={startEdit} className="bg-[#0f172a] hover:bg-[#0369a1] text-white text-[10px] font-black rounded-lg uppercase tracking-widest h-auto px-4 py-2">
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

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {compEmps.length === 0 && (
              <div className="text-center text-slate-400 py-10 font-bold uppercase text-xs">
                Nenhum colaborador nesta empresa.
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

              const isMEI = emp.tipo_cadastro === "MEI";
              const reqDocs = ["rg", "cpf", "address", ...(isMEI ? ["mei"] : [])];
              const docsOK = reqDocs.every((k) => empDocs.some((d: any) => d.tipo === k));

              const globalOK = asoOK && nrOK && docsOK;
              const badge = (ok: boolean) => ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white";

              return (
                <div
                  key={emp.id}
                  onClick={() => navigate({ to: "/app/employees/$id", params: { id: emp.id } })}
                  className={`p-4 rounded-xl border ${globalOK ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50/30"} hover:border-[#0369a1] cursor-pointer transition-all flex items-center justify-between group`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-lg font-black text-slate-300 group-hover:text-[#0369a1] overflow-hidden shrink-0">
                      {emp.foto_url ? <img src={emp.foto_url} className="w-full h-full object-cover" alt="" /> : (emp.nome?.charAt(0) || "?")}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-slate-900">{emp.nome || "— sem nome —"}</h4>
                      <div className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">MAT: {emp.matricula || "---"} | CPF: {emp.cpf || "---"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm ${badge(asoOK)}`}>
                      <HeartPulse className="h-3.5 w-3.5" /> ASO
                    </span>
                    <span className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm ${reqNRs.length === 0 ? "bg-red-500 text-white" : badge(nrOK)}`}>
                      <Award className="h-3.5 w-3.5" /> NR
                    </span>
                    <span className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm ${badge(docsOK)}`}>
                      <FolderOpen className="h-3.5 w-3.5" /> DOCS
                    </span>
                    <span className="w-9 h-9 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center shadow-sm">
                      <HardHat className="h-4 w-4" />
                    </span>
                    <span className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${globalOK ? "bg-emerald-500" : "bg-red-500"} text-white tracking-widest flex items-center gap-1.5 shadow-md`}>
                      {globalOK ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {globalOK ? "APTO" : "AUDITAR"}
                    </span>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#0369a1]" />
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
    </div>
  );
}

function CompanyForm({
  editing, setEditing, onCancel, onSubmit, saving,
}: {
  editing: Partial<Company>;
  setEditing: (v: Partial<Company>) => void;
  onCancel: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 overflow-y-auto custom-scrollbar animate-fadeIn relative">
      {onCancel && (
        <button onClick={onCancel} className="absolute top-8 right-8 text-slate-400 hover:text-red-500" aria-label="Cancelar">
          <X className="h-6 w-6" />
        </button>
      )}
      <h3 className="text-lg font-black uppercase text-[#0369a1] mb-6 border-b border-slate-100 pb-4">
        {editing?.id ? "Editar Empresa" : "Cadastrar Nova Empresa"}
      </h3>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Razão Social / Nome da Empresa *</Label>
            <Input required value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-slate-50 mt-1" />
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
            <Label className="text-[10px] font-black text-slate-500 uppercase">CNPJ</Label>
            <Input value={editing?.cnpj ?? ""} onChange={(e) => setEditing({ ...editing, cnpj: e.target.value })} placeholder="00.000.000/0001-00" className="bg-slate-50 mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase">Data da Entrada</Label>
            <Input type="date" value={(editing as any)?.data_entrada ?? ""} onChange={(e) => setEditing({ ...editing, data_entrada: e.target.value } as any)} className="bg-slate-50 mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] font-black text-slate-500 uppercase">E-mail Corporativo</Label>
          <Input type="email" placeholder="contato@empresa.com" value={editing?.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="bg-slate-50 mt-1" />
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
        <Button type="submit" disabled={saving} className="mt-4 bg-[#0369a1] hover:bg-[#075985] text-white text-xs font-black uppercase tracking-widest px-8 py-4 h-auto rounded-xl shadow-lg">
          Salvar Dados da Empresa
        </Button>
      </form>
    </div>
  );
}
