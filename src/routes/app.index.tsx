import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, AlertTriangle, Building2, Ban } from "lucide-react";
import { calculateSafetyStatus } from "@/lib/safety-engine";

export const Route = createFileRoute("/app/")({
  component: TstPanel,
});

function TstPanel() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filterCompany, setFilterCompany] = useState("ALL");

  const { data } = useQuery({
    queryKey: ["tst-panel"],
    queryFn: async () => {
      const [emps, comps, roles, exams] = await Promise.all([
        supabase.from("employees").select("*").order("nome"),
        supabase.from("companies").select("id,name").order("name"),
        supabase.from("roles").select("*"),
        supabase.from("employee_exams").select("*"),
      ]);
      return {
        employees: emps.data ?? [],
        companies: comps.data ?? [],
        roles: roles.data ?? [],
        exams: exams.data ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const cMap = new Map(data.companies.map((c: any) => [c.id, c.name]));
    const rMap = new Map(data.roles.map((r: any) => [r.id, r]));
    const exMap = new Map<string, any[]>();
    data.exams.forEach((ex: any) => {
      const arr = exMap.get(ex.employee_id) ?? [];
      arr.push(ex);
      exMap.set(ex.employee_id, arr);
    });
    return data.employees.map((e: any) => ({
      emp: e,
      company: e.company_id ? cMap.get(e.company_id) ?? "—" : "—",
      role: e.role_id ? rMap.get(e.role_id) : null,
      status: calculateSafetyStatus(e, e.role_id ? (rMap.get(e.role_id) as any) : null, exMap.get(e.id) ?? []),
    }));
  }, [data]);

  const pendencias = useMemo(() => {
    let list = rows.filter((r) => r.status.label === "ALERTA" || r.status.label === "BLOQUEADO" || r.status.label === "SEM CARGO");
    if (filterCompany !== "ALL") list = list.filter((r) => r.emp.company_id === filterCompany);
    return list;
  }, [rows, filterCompany]);

  const blocklist = useMemo(() => {
    return rows
      .filter((r) => r.status.label === "BLOQUEADO" || r.status.label === "SEM CARGO")
      .sort((a, b) => (a.emp.nome ?? "").localeCompare(b.emp.nome ?? ""));
  }, [rows]);

  const conformity = useMemo(() => {
    if (!data) return [];
    return data.companies.map((c: any) => {
      const compEmps = rows.filter((r) => r.emp.company_id === c.id);
      const total = compEmps.length;
      if (total === 0) return null;
      const oks = compEmps.filter((r) => r.status.label === "APTO").length;
      const perc = Math.round((oks / total) * 100);
      const color = perc === 100 ? "bg-emerald-500" : perc > 80 ? "bg-yellow-400" : "bg-red-500";
      return { name: c.name, perc, color };
    }).filter(Boolean) as { name: string; perc: number; color: string }[];
  }, [data, rows]);

  const search = q.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!search) return [];
    return rows.filter((r) =>
      (r.emp.nome ?? "").toLowerCase().includes(search) ||
      (r.emp.cpf ?? "").toLowerCase().includes(search) ||
      (r.role?.name ?? "").toLowerCase().includes(search) ||
      (r.company ?? "").toLowerCase().includes(search),
    ).slice(0, 8);
  }, [rows, search]);

  return (
    <div className="p-6 md:p-8 animate-fadeIn h-full flex flex-col bg-[#f1f5f9] overflow-y-auto custom-scrollbar">
      <h2 className="heading-display text-3xl md:text-4xl text-[#0369a1] mb-8">Painel do TST / GSI</h2>

      {/* OMNISEARCH */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8 shrink-0">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Search className="h-4 w-4" /> Busca Universal (Omnisearch)
        </h3>
        <input
          type="text"
          placeholder="Digite Nome, CPF, Função Técnica ou Empresa..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-sm font-bold uppercase outline-none focus:ring-2 focus:border-[#0369a1] transition-all placeholder:text-slate-400 placeholder:normal-case"
        />
        {search && (
          <div className="mt-4 space-y-2">
            {searchResults.length === 0 ? (
              <div className="text-center text-slate-400 py-4 text-xs font-bold uppercase">Nenhum resultado</div>
            ) : searchResults.map((r) => (
              <Link
                key={r.emp.id}
                to="/app/employees/$id"
                params={{ id: r.emp.id }}
                className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 hover:border-[#0369a1] transition-all"
              >
                <div>
                  <div className="text-xs font-black uppercase text-slate-900">{r.emp.nome}</div>
                  <div className="text-[9px] font-bold uppercase text-slate-500 mt-0.5">{r.company} · {r.role?.name ?? "Sem cargo"}</div>
                </div>
                <span className={`px-3 py-1 rounded text-[9px] font-black uppercase ${r.status.colorClass} text-white`}>{r.status.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* GRID: Pendências + Conformidade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-[400px]">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-orange-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Relatório de Vencimentos e Bloqueios
            </h3>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase outline-none focus:ring-2 focus:border-[#0369a1] max-w-[200px] truncate"
            >
              <option value="ALL">Todas as Empresas</option>
              {(data?.companies ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
            {pendencias.length === 0 ? (
              <div className="text-center text-slate-400 py-10 font-bold uppercase text-xs">Nenhuma pendência na matriz</div>
            ) : pendencias.map((p) => (
              <div
                key={p.emp.id}
                onClick={() => navigate({ to: "/app/employees/$id", params: { id: p.emp.id } })}
                className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex justify-between items-center cursor-pointer hover:border-[#0369a1] transition-all"
              >
                <div>
                  <div className="text-xs font-black uppercase text-slate-900">{p.emp.nome}</div>
                  <div className="text-[9px] font-bold uppercase text-slate-500 mt-1">{p.status.msgs.join(", ") || p.status.label}</div>
                </div>
                <div className={`px-3 py-1 rounded text-[9px] font-black uppercase ${p.status.colorClass} text-white`}>{p.status.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b border-slate-100 pb-4 text-[#0369a1] flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Conformidade por Empresa
          </h3>
          <div className="space-y-4">
            {conformity.length === 0 && (
              <div className="text-center text-slate-400 py-10 font-bold uppercase text-xs">Sem dados de empresa</div>
            )}
            {conformity.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-600 mb-1">
                  <span>{c.name}</span>
                  <span>{c.perc}% APTO</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${c.color}`} style={{ width: `${c.perc}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LISTA DE BLOQUEIO GSI */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-red-200 mt-8">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
            <Ban className="h-4 w-4" /> Lista de Bloqueio GSI ({blocklist.length})
          </h3>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Acesso ao estaleiro suspenso
          </span>
        </div>
        {blocklist.length === 0 ? (
          <div className="text-center text-emerald-600 py-6 font-black uppercase text-xs">
            ✓ Nenhum colaborador bloqueado
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {blocklist.map((p) => (
              <div
                key={p.emp.id}
                onClick={() => navigate({ to: "/app/employees/$id", params: { id: p.emp.id } })}
                className="p-4 border border-red-100 rounded-xl bg-red-50/50 hover:border-red-400 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-black uppercase text-slate-900 truncate">{p.emp.nome}</div>
                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-red-600 text-white shrink-0 ml-2">
                    {p.status.label}
                  </span>
                </div>
                <div className="text-[9px] font-bold uppercase text-slate-500">
                  {p.company} · {p.role?.name ?? "Sem cargo"}
                </div>
                <div className="text-[9px] font-bold text-red-600 mt-1.5 line-clamp-2">
                  {p.status.msgs.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
