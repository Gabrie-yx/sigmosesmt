import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { addMonthsToDate } from "@/lib/utils-date";
import { NRS_LIST, UFS, TIPOS_EXAME, NATUREZAS_EXAME, DOC_TYPES } from "@/lib/constants";
import {
  ArrowLeft,
  HeartPulse,
  Award,
  FolderOpen,
  HardHat,
  IdCard,
  MapPin,
  Phone,
  Building2,
  Camera,
  ShieldAlert,
  Save,
  Trash2,
  CheckCircle2,
  Stethoscope,
  PlusCircle,
  Lock,
  CheckCircle,
  Printer,
  Upload,
} from "lucide-react";

export const Route = createFileRoute("/app/employees/")({
  component: EmployeeDetail,
});

type TabKey = "PROFILE" | "SAUDE" | "NRS" | "DOCS" | "EPI";

function EmployeeDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>("PROFILE");

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
    queryFn: async () => (await supabase.from("companies").select("id,name,type").order("name")).data ?? [],
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

  const role = (roles ?? []).find((r: any) => r.id === emp?.role_id) ?? null;
  const company = (companies ?? []).find((c: any) => c.id === emp?.company_id) ?? null;
  const status = useMemo(
    () => (emp ? calculateSafetyStatus(emp as any, role as any, (exams ?? []) as any) : null),
    [emp, role, exams],
  );

  if (!emp) {
    return (
      <div className="p-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
        Carregando ficha…
      </div>
    );
  }

  const initials = (emp.nome || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <Link
        to="/app/employees"
        className="inline-flex items-center gap-1.5 mb-5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#0369a1] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a lista
      </Link>

      {/* HEADER CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-5 flex items-center justify-between gap-6 relative overflow-hidden">
        <div className={`absolute right-0 top-0 bottom-0 w-2 ${status?.colorClass ?? "bg-slate-200"}`} />
        <div className="flex items-center gap-5 min-w-0">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-300 border border-slate-100 overflow-hidden bg-slate-50 shrink-0">
            {emp.foto_url
              ? <img src={emp.foto_url} alt={emp.nome} className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {company && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[8px] font-black uppercase tracking-widest">
                  {company.name}
                </span>
              )}
              <span className="text-[9px] font-bold text-slate-400">MAT: {emp.matricula || "---"}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 uppercase truncate font-outfit tracking-tight">
              {emp.nome}
            </h2>
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Cargo Atual: {role?.name ?? "Não Definido"}
            </div>
          </div>
        </div>
        <div className="text-right pr-6 flex flex-col items-end shrink-0">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Status GSI</div>
          {status && (
            <>
              <div className="flex items-center gap-2 justify-end">
                <span className={`h-2.5 w-2.5 rounded-full ${status.colorClass}`} />
                <span className="text-sm font-black uppercase">{status.label}</span>
              </div>
              <div className={`mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm text-white flex items-center gap-1 ${status.acessoPermitido ? "bg-emerald-500" : "bg-red-600"}`}>
                {status.acessoPermitido ? <CheckCircle className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                ACESSO CATRACA: {status.acessoPermitido ? "SIM" : "NÃO"}
              </div>
              <div className="text-[9px] font-bold text-slate-500 uppercase mt-2 max-w-[220px] truncate" title={status.msgs.join(", ")}>
                {status.msgs.length > 0 ? status.msgs.join(", ") : "Conformidade 100%"}
              </div>
            </>
          )}
          {isAdmin && <DeleteEmpButton empId={emp.id} />}
        </div>
      </div>

      {/* TAB BUTTONS */}
      <div className="flex flex-wrap gap-2 mb-5">
        <TabBtn active={tab === "PROFILE"} onClick={() => setTab("PROFILE")} activeColor="bg-[#0369a1]">
          Cadastro Base
        </TabBtn>
        <TabBtn active={tab === "SAUDE"} onClick={() => setTab("SAUDE")} activeColor="bg-red-600">
          <HeartPulse className="h-3.5 w-3.5" /> Saúde (ASOs)
        </TabBtn>
        <TabBtn active={tab === "NRS"} onClick={() => setTab("NRS")} activeColor="bg-orange-600">
          <Award className="h-3.5 w-3.5" /> Treinamentos (NRs)
        </TabBtn>
        <TabBtn active={tab === "DOCS"} onClick={() => setTab("DOCS")} activeColor="bg-[#0369a1]">
          <FolderOpen className="h-3.5 w-3.5" /> Pasta Digital
        </TabBtn>
        <TabBtn active={tab === "EPI"} onClick={() => setTab("EPI")} activeColor="bg-[#0369a1]">
          <HardHat className="h-3.5 w-3.5" /> Controle de EPIs
        </TabBtn>
      </div>

      {tab === "PROFILE" && (
        <ProfileTab emp={emp} companies={companies ?? []} roles={roles ?? []} canEdit={isEditor} qc={qc} />
      )}
      {tab === "SAUDE" && <HealthTab empId={id} exams={exams ?? []} canEdit={isEditor} canDelete={isAdmin} qc={qc} />}
      {tab === "NRS" && <NrsTab emp={emp} role={role} canEdit={isEditor} qc={qc} />}
      {tab === "DOCS" && <DocsTab empId={id} isMei={emp.tipo_cadastro === "MEI"} />}
      {tab === "EPI" && <EpiTab empId={id} epis={epis ?? []} canEdit={isEditor} canDelete={isAdmin} qc={qc} />}
    </div>
  );
}

/* ===================== shared ===================== */

function TabBtn({ active, activeColor, onClick, children }: { active: boolean; activeColor: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
        active ? `${activeColor} text-white shadow-md` : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#0369a1]/20 focus:border-[#0369a1] transition-all";
const labelCls = "block text-[9px] font-black text-slate-500 uppercase mb-1";
const sectionTitle = (color: string) =>
  `text-[11px] font-black ${color} uppercase tracking-widest mb-4 border-b border-slate-100 pb-3 flex items-center gap-2`;

function DeleteEmpButton({ empId }: { empId: string }) {
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").delete().eq("id", empId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); window.location.href = "/app/employees"; },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <button
      onClick={() => { if (confirm("Excluir colaborador? Esta ação é permanente.")) del.mutate(); }}
      className="mt-3 px-3 py-1.5 bg-red-50 border border-red-200 text-red-500 text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center gap-1"
    >
      <Trash2 className="h-3 w-3" /> Excluir Colaborador
    </button>
  );
}

/* ===================== PROFILE ===================== */
function ProfileTab({ emp, companies, roles, canEdit, qc }: any) {
  const [f, setF] = useState<any>(emp);
  useEffect(() => setF(emp), [emp]);

  const save = useMutation({
    mutationFn: async () => {
      const { id: _id, created_at, updated_at, ...rest } = f;
      const { error } = await supabase.from("employees").update(rest).eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Salvo / Recalculado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 animate-fadeIn">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* COL 1 */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* IDENTIFICAÇÃO */}
          <div>
            <h3 className={sectionTitle("text-[#0369a1]")}>
              <IdCard className="h-3.5 w-3.5" /> Identificação Pessoal
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Tipo de Cadastro</label>
                <select className={inputCls} value={f.tipo_cadastro ?? "NAO_MEI"} onChange={(e) => set("tipo_cadastro", e.target.value)} disabled={!canEdit}>
                  <option value="NAO_MEI">Não MEI (CLT/Terceiro)</option>
                  <option value="MEI">MEI</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Nome Completo</label>
                <input className={inputCls} value={f.nome ?? ""} onChange={(e) => set("nome", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>CPF (Chave Única)</label>
                <input className={inputCls} placeholder="000.000.000-00" value={f.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>CNPJ (Se MEI)</label>
                <input className={inputCls} placeholder="00.000.000/0001-00" value={f.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} disabled={!canEdit} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelCls}>RG</label>
                  <input className={inputCls} value={f.rg ?? ""} onChange={(e) => set("rg", e.target.value)} disabled={!canEdit} />
                </div>
                <div className="w-[120px]">
                  <label className={labelCls}>Órgão</label>
                  <input className={inputCls} placeholder="SSP/AM" value={f.rg_orgao ?? ""} onChange={(e) => set("rg_orgao", e.target.value)} disabled={!canEdit} />
                </div>
              </div>
              <div>
                <label className={labelCls}>E-mail</label>
                <input type="email" className={inputCls} placeholder="email@exemplo.com" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} disabled={!canEdit} />
              </div>
            </div>
          </div>

          {/* ENDEREÇO */}
          <div>
            <h3 className={sectionTitle("text-slate-800")}>
              <MapPin className="h-3.5 w-3.5" /> Endereço Residencial
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-4">
                <label className={labelCls}>Endereço (Rua, Nº, Complemento)</label>
                <input className={inputCls} value={f.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Bairro</label>
                <input className={inputCls} value={f.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Cidade</label>
                <input className={inputCls} value={f.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>UF</label>
                <select className={inputCls} value={f.uf ?? ""} onChange={(e) => set("uf", e.target.value)} disabled={!canEdit}>
                  <option value="">--</option>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>CEP</label>
                <input className={inputCls} placeholder="00000-000" value={f.cep ?? ""} onChange={(e) => set("cep", e.target.value)} disabled={!canEdit} />
              </div>
            </div>
          </div>

          {/* CONTATO */}
          <div>
            <h3 className={sectionTitle("text-red-600")}>
              <Phone className="h-3.5 w-3.5" /> Contato / Emergência
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>WhatsApp</label>
                <input className={inputCls} placeholder="(92) 99999-0000" value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>WhatsApp Emergência</label>
                <input className={inputCls} placeholder="(92) 99999-0000" value={f.whatsapp_emergencia ?? ""} onChange={(e) => set("whatsapp_emergencia", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Nome do Contato</label>
                <input className={inputCls} placeholder="Nome do parente/contato" value={f.nome_contato ?? ""} onChange={(e) => set("nome_contato", e.target.value)} disabled={!canEdit} />
              </div>
            </div>
          </div>

          {/* VÍNCULO */}
          <div>
            <h3 className={sectionTitle("text-slate-800")}>
              <Building2 className="h-3.5 w-3.5" /> Vínculo Empregatício
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Empresa Contratada</label>
                <select className={inputCls} value={f.company_id ?? ""} onChange={(e) => set("company_id", e.target.value || null)} disabled={!canEdit}>
                  <option value="">—</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Função no Estaleiro</label>
                <select className={inputCls} value={f.role_id ?? ""} onChange={(e) => set("role_id", e.target.value || null)} disabled={!canEdit}>
                  <option value="">—</option>
                  {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Matrícula</label>
                <input className={inputCls} value={f.matricula ?? ""} onChange={(e) => set("matricula", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={f.status ?? "ATIVO"} onChange={(e) => set("status", e.target.value)} disabled={!canEdit}>
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                  <option value="AFASTADO">AFASTADO</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Data de Admissão</label>
                <input type="date" className={inputCls} value={f.admissao ?? ""} onChange={(e) => set("admissao", e.target.value || null)} disabled={!canEdit} />
              </div>
            </div>
          </div>
        </div>

        {/* COL 2 */}
        <div className="lg:w-[300px] lg:border-l lg:border-slate-100 lg:pl-8 flex flex-col">
          <div className="mb-6">
            <h3 className={sectionTitle("text-emerald-700")}>
              <Camera className="h-3.5 w-3.5" /> Foto (Controle GSI)
            </h3>
            <div className="flex flex-col items-center gap-4">
              <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden bg-slate-50 flex items-center justify-center text-5xl text-slate-300">
                {f.foto_url ? <img src={f.foto_url} alt="Foto" className="w-full h-full object-cover" /> : "👤"}
              </div>
              <button
                type="button"
                onClick={() => toast.info("Upload de foto: em breve")}
                className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-black rounded-lg uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <Upload className="h-3 w-3" /> Enviar Foto
              </button>
            </div>
          </div>

          <div>
            <h3 className={sectionTitle("text-orange-600")}>
              <ShieldAlert className="h-3.5 w-3.5" /> Requisitos Base
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Validade ASO</label>
                <input type="date" className={inputCls} value={f.data_aso ?? ""} onChange={(e) => set("data_aso", e.target.value || null)} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Validade Integração</label>
                <input type="date" className={inputCls} value={f.data_integracao ?? ""} onChange={(e) => set("data_integracao", e.target.value || null)} disabled={!canEdit} />
              </div>
            </div>
          </div>

          {canEdit && (
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="w-full mt-8 px-8 py-4 bg-[#0369a1] text-white text-[11px] font-black rounded-xl uppercase tracking-widest shadow-lg hover:bg-[#075985] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Salvar / Recalcular
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== NRs ===================== */
function NrsTab({ emp, role, canEdit, qc }: any) {
  const [nrs, setNrs] = useState<Record<string, string>>(emp.nrs ?? {});
  const reqNrs: string[] = role?.req_nrs ?? [];
  const allNrs = Array.from(new Set([...reqNrs, ...NRS_LIST])).sort();

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").update({ nrs }).eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee", emp.id] }); toast.success("Treinamentos salvos"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 animate-fadeIn">
      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2 border-b border-slate-100 pb-4 flex items-center gap-2">
        <Award className="h-4 w-4" /> Gestão de Treinamentos (NRs)
      </h3>
      <p className="text-[10px] font-bold text-slate-500 uppercase mb-6">
        Insira a data do treinamento. Itens em destaque vermelho são exigidos pela matriz para o cargo de {role?.name ?? "—"}.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {allNrs.map((nr) => {
          const isReq = reqNrs.includes(nr);
          return (
            <div key={nr} className={`p-4 rounded-xl border ${isReq ? "border-red-200 bg-red-50/30" : "border-slate-100 bg-slate-50"}`}>
              <label className={`block text-[10px] font-black uppercase mb-2 ${isReq ? "text-red-700" : "text-slate-500"}`}>
                {nr} {isReq ? "*" : ""}
              </label>
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[#0369a1]"
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
      {canEdit && (
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="mt-8 px-8 py-4 bg-[#0369a1] text-white text-[11px] font-black rounded-xl uppercase tracking-widest shadow-lg hover:bg-[#075985] transition-all disabled:opacity-50"
        >
          Salvar Treinamentos
        </button>
      )}
    </div>
  );
}

/* ===================== HEALTH (ASO) ===================== */
function HealthTab({ empId, exams, canEdit, canDelete, qc }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<any>({
    tipo_exame: "ASO Clínico",
    natureza: "Periódico",
    data_realizacao: today,
    periodicidade_meses: 12,
    aptidao: "SIM",
  });
  const venc = f.data_realizacao ? addMonthsToDate(f.data_realizacao, Number(f.periodicidade_meses) || 12) : "";

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employee_exams").insert({
        employee_id: empId,
        tipo_exame: f.tipo_exame,
        natureza: f.natureza,
        data_realizacao: f.data_realizacao,
        data_vencimento: venc,
        periodicidade_meses: Number(f.periodicidade_meses) || 12,
        aptidao: f.aptidao,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", empId] }); toast.success("Exame lançado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("employee_exams").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", empId] }); toast.success("Removido"); },
  });

  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-fadeIn">
      <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
        <div>
          <h4 className="text-sm font-black text-[#0369a1] uppercase tracking-widest flex items-center gap-2">
            <HeartPulse className="h-4 w-4" /> Controle de ASOs e Exames
          </h4>
          <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">
            Gestão médica e histórico clínico para auditoria ISO 9001
          </p>
        </div>
      </div>

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="bg-slate-50 rounded-2xl p-6 border border-slate-200 mb-8"
        >
          <h5 className="text-[10px] font-black text-[#0369a1] uppercase mb-4 tracking-widest flex items-center gap-1.5">
            <PlusCircle className="h-3.5 w-3.5" /> Registrar Novo Laudo Médico
          </h5>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className={labelCls}>Tipo de Exame</label>
              <select className={inputCls} value={f.tipo_exame} onChange={(e) => set("tipo_exame", e.target.value)} required>
                {TIPOS_EXAME.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Natureza</label>
              <select className={inputCls} value={f.natureza} onChange={(e) => set("natureza", e.target.value)} required>
                {NATUREZAS_EXAME.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Realização</label>
              <input type="date" className={inputCls} value={f.data_realizacao} onChange={(e) => set("data_realizacao", e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Periodicidade</label>
              <select className={inputCls} value={f.periodicidade_meses} onChange={(e) => set("periodicidade_meses", e.target.value)} required>
                <option value="6">6 Meses</option>
                <option value="12">1 Ano</option>
                <option value="24">2 Anos</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Vencimento (Auto)</label>
              <input
                type="text"
                readOnly
                value={venc ? venc.split("-").reverse().join("/") : "Aguardando..."}
                className={`${inputCls} bg-slate-100 text-[#0369a1] cursor-not-allowed`}
              />
            </div>
            <div>
              <label className={labelCls}>Aptidão (Médico)</label>
              <select className={inputCls} value={f.aptidao} onChange={(e) => set("aptidao", e.target.value)} required>
                <option value="SIM">Apto</option>
                <option value="NÃO">Inapto</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={`${labelCls} opacity-0`}>.</label>
              <button
                type="submit"
                disabled={create.isPending}
                className="w-full px-6 py-3.5 bg-[#0369a1] text-white text-[11px] font-black rounded-xl hover:bg-[#075985] uppercase tracking-widest shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Lançar
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Histórico Clínico Registrado</h5>
        {exams.length === 0 && (
          <div className="text-center text-slate-400 py-10 font-bold uppercase text-xs border border-dashed border-slate-200 rounded-2xl">
            Nenhum exame clínico registrado no prontuário.
          </div>
        )}
        {exams.map((ex: any) => {
          const today2 = new Date(); today2.setHours(0, 0, 0, 0);
          const expDate = new Date(ex.data_vencimento + "T00:00:00");
          const diffDays = Math.ceil((+expDate - +today2) / (1000 * 60 * 60 * 24));
          let bColor = "bg-emerald-500", bLabel = "VÁLIDO";
          if (ex.aptidao === "NÃO") { bColor = "bg-red-500"; bLabel = "INAPTO"; }
          else if (diffDays < 0) { bColor = "bg-red-500"; bLabel = "VENCIDO"; }
          else if (diffDays <= 30) { bColor = "bg-orange-500"; bLabel = "A VENCER"; }
          return (
            <div key={ex.id} className="p-5 border border-slate-200 bg-slate-50 rounded-2xl flex items-center justify-between hover:border-[#0369a1] transition-all">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl text-[#0369a1] shadow-sm">
                  <Stethoscope className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h5 className="text-xs font-black uppercase text-slate-900">{ex.tipo_exame}</h5>
                    <span className="text-[9px] font-black uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded tracking-widest">{ex.natureza}</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                    Realizado: {ex.data_realizacao.split("-").reverse().join("/")} • Período: {ex.periodicidade_meses}m • Vencimento: <span className={`font-black ${diffDays < 0 ? "text-red-500" : "text-slate-800"}`}>{ex.data_vencimento.split("-").reverse().join("/")}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-white ${bColor} shadow-sm tracking-widest`}>{bLabel}</div>
                {canDelete && (
                  <button
                    onClick={() => del.mutate(ex.id)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-red-500 hover:border-red-500 hover:text-white flex items-center justify-center transition-colors shadow-sm"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== DOCS ===================== */
function DocsTab({ empId, isMei }: { empId: string; isMei: boolean }) {
  const { data: docs } = useQuery({
    queryKey: ["docs", empId],
    queryFn: async () => (await supabase.from("employee_docs").select("*").eq("employee_id", empId)).data ?? [],
  });

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-fadeIn">
      <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
        <div>
          <h4 className="text-sm font-black text-[#0369a1] uppercase tracking-widest flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Pasta Digital / Documentos Obrigatórios
          </h4>
          <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">
            Anexe os documentos exigidos para liberação de acesso e auditoria ISO 9001
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DOC_TYPES.map((doc) => {
          const has = (docs ?? []).find((d: any) => d.tipo === doc.key);
          const required = doc.required || (doc.key === "mei" && isMei);
          const stateClass = has
            ? "border-emerald-300 bg-emerald-50/50"
            : required
              ? "border-red-300 bg-red-50/30"
              : "border-slate-200 bg-slate-50";
          const badge = has
            ? <span className="px-2 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase rounded tracking-widest">ANEXADO</span>
            : required
              ? <span className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded tracking-widest">PENDENTE</span>
              : <span className="px-2 py-1 bg-slate-200 text-slate-500 text-[8px] font-black uppercase rounded tracking-widest">OPCIONAL</span>;
          return (
            <div key={doc.key} className={`p-5 rounded-2xl border-2 ${stateClass} transition-all`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${has ? "bg-emerald-100 text-emerald-600" : required ? "bg-red-100 text-red-500" : "bg-slate-100 text-slate-400"}`}>
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase text-slate-800">{doc.label}</h5>
                    <p className={`text-[9px] font-bold uppercase ${required ? "text-red-500" : "text-slate-400"}`}>
                      {required ? "Obrigatório" : "Condicional (MEI)"}
                    </p>
                  </div>
                </div>
                {badge}
              </div>
              <button
                type="button"
                onClick={() => toast.info("Upload de documentos: em breve")}
                className={`w-full px-4 py-2.5 border-2 border-dashed text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 hover:bg-white ${required ? "border-red-300 hover:border-red-400 text-red-500" : "border-slate-300 hover:border-slate-400 text-slate-500"}`}
              >
                <Upload className="h-3.5 w-3.5" /> {has ? "Substituir Arquivo" : "Selecionar Arquivo (PDF/Imagem)"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== EPI ===================== */
function EpiTab({ empId, epis, canEdit, canDelete, qc }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<any>({ item: "", ca: "", qtd: 1, data_entrega: today });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("epi_deliveries").insert({
        employee_id: empId,
        item: f.item,
        ca: f.ca || null,
        qtd: Number(f.qtd) || 1,
        data_entrega: f.data_entrega,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epis", empId] }); setF({ item: "", ca: "", qtd: 1, data_entrega: today }); toast.success("EPI registrado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("epi_deliveries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epis", empId] }); toast.success("Removido"); },
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-fadeIn">
      <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
        <div>
          <h4 className="text-sm font-black text-[#0369a1] uppercase tracking-widest flex items-center gap-2">
            <HardHat className="h-4 w-4" /> Controle de EPIs
          </h4>
          <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">
            Gestão de entregas e impressão da ficha de EPI
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 bg-orange-600 text-white text-[10px] font-black rounded-xl hover:bg-orange-700 uppercase tracking-widest shadow-md flex items-center gap-2 transition-all"
        >
          <Printer className="h-3.5 w-3.5" /> Ficha em PDF
        </button>
      </div>

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="bg-slate-50 rounded-2xl p-6 border border-slate-200 mb-8"
        >
          <h5 className="text-[10px] font-black text-[#0369a1] uppercase mb-4 tracking-widest flex items-center gap-1.5">
            <PlusCircle className="h-3.5 w-3.5" /> Registrar Entrega de EPI
          </h5>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="col-span-2">
              <label className={labelCls}>Descrição do EPI</label>
              <input className={inputCls} placeholder="Ex: Capacete, Luva de Vaqueta..." value={f.item} onChange={(e) => set("item", e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>C.A. (Certificado)</label>
              <input className={inputCls} placeholder="Apenas Números" value={f.ca} onChange={(e) => set("ca", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Entrega</label>
              <input type="date" className={inputCls} value={f.data_entrega} onChange={(e) => set("data_entrega", e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <div className="w-1/3">
                <label className={labelCls}>Qtd</label>
                <input type="number" min={1} className={`${inputCls} text-center`} value={f.qtd} onChange={(e) => set("qtd", e.target.value)} required />
              </div>
              <div className="w-2/3">
                <label className={`${labelCls} opacity-0`}>.</label>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="w-full h-[46px] bg-[#0369a1] text-white text-[10px] font-black rounded-xl hover:bg-[#075985] uppercase tracking-widest shadow-md flex items-center justify-center transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Histórico de EPIs Recebidos</h5>
        {epis.length === 0 && (
          <div className="text-center text-slate-400 py-10 font-bold uppercase text-xs border border-dashed border-slate-200 rounded-2xl">
            Nenhum EPI registrado para este colaborador.
          </div>
        )}
        {epis.map((epi: any) => (
          <div key={epi.id} className="p-4 border border-slate-200 bg-slate-50 rounded-2xl flex items-center justify-between hover:border-[#0369a1] transition-all">
            <div className="flex items-center gap-5">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl text-[#0369a1] shadow-sm">
                <HardHat className="h-5 w-5" />
              </div>
              <div>
                <h5 className="text-xs font-black uppercase text-slate-900">{epi.item}</h5>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                  {epi.ca ? `C.A. ${epi.ca} • ` : ""}Qtd: {epi.qtd} • Entrega: {epi.data_entrega.split("-").reverse().join("/")}
                </div>
              </div>
            </div>
            {canDelete && (
              <button
                onClick={() => del.mutate(epi.id)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-red-500 hover:border-red-500 hover:text-white flex items-center justify-center transition-colors shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
