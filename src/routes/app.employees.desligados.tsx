import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, UserRoundX, RotateCcw, Building2, Briefcase, CalendarClock } from "lucide-react";
import { DesligamentoDialog } from "@/components/employees/desligamento-dialog";

export const Route = createFileRoute("/app/employees/desligados")({
  component: DesligadosPage,
});

function DesligadosPage() {
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<any | null>(null);

  const { data: emps, isLoading } = useQuery({
    queryKey: ["employees-desligados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("status", "DESLIGADO")
        .order("data_desligamento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-min-desligados"],
    queryFn: async () => (await supabase.from("companies").select("id,name,type").order("name")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["roles-min-desligados"],
    queryFn: async () => (await supabase.from("roles").select("id,name").order("name")).data ?? [],
  });

  const cMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]));
  const rMap = new Map((roles ?? []).map((r: any) => [r.id, r.name]));

  const filtered = useMemo(() => {
    const norm = (v: string) => (v ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const s = norm(q.trim());
    return (emps ?? []).filter((e: any) => {
      if (!s) return true;
      return (
        norm(e.nome ?? "").includes(s) ||
        norm(e.matricula ?? "").includes(s) ||
        norm(e.cpf ?? "").includes(s) ||
        norm(e.motivo_desligamento ?? "").includes(s) ||
        norm(cMap.get(e.company_id) ?? "").includes(s)
      );
    });
  }, [emps, q, cMap]);

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/employees" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-[#7B1E2B]">
            <ArrowLeft className="h-3.5 w-3.5" /> Funcionários
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="h-11 w-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow">
          <UserRoundX className="h-5 w-5" />
        </div>
        <div>
          <h2 className="heading-display text-3xl md:text-4xl text-brand">Painel de Desligados</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
            Histórico preservado · Reative a qualquer momento se o funcionário voltar
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-slate-400 mb-5">
        Funcionários desligados são preservados por exigência legal (NR-07 ASOs 20 anos · PPP permanente · NR-06 EPIs 5 anos · NR-33/34/35 treinamentos 5 anos · OSs até 5 anos pós-contrato).
        Eles ficam ocultos de listagens, seleções e geração de OS/EPI/PTE. Reativar restaura tudo.
      </div>

      <div className="relative mb-4 max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-11 h-12 rounded-2xl border-slate-200 bg-white shadow-sm text-sm"
          placeholder="Buscar por nome, CPF, motivo, empresa…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <UserRoundX className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhum funcionário desligado</p>
          <p className="text-xs text-slate-400 mt-1">Quando registrar um desligamento, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((e: any) => (
            <div key={e.id} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-slate-400" />
              <div className="flex items-start gap-3">
                {e.foto_url ? (
                  <img src={e.foto_url} alt={e.nome} className="h-12 w-12 rounded-full object-cover grayscale ring-2 ring-white shadow" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-slate-300 text-white font-black text-sm flex items-center justify-center shadow ring-2 ring-white">
                    {e.nome?.split(/\s+/).map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Link to="/app/employees/$id" params={{ id: e.id }} className="block">
                    <h3 className="font-black text-sm text-slate-900 uppercase leading-tight truncate hover:text-[#7B1E2B]">{e.nome}</h3>
                  </Link>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-200 text-slate-700 ring-1 ring-slate-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                    DESLIGADO
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-slate-400" /><span className="truncate">{cMap.get(e.company_id) ?? "—"}</span></div>
                <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-slate-400" /><span className="truncate">{rMap.get(e.role_id) ?? "—"}</span></div>
                <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{e.data_desligamento ? new Date(e.data_desligamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                </div>
                {e.motivo_desligamento && (
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 mt-2 line-clamp-2">
                    <strong>Motivo:</strong> {e.motivo_desligamento}
                  </div>
                )}
              </div>
              <Button
                onClick={() => setTarget(e)}
                className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reativar
              </Button>
            </div>
          ))}
        </div>
      )}

      {target && (
        <DesligamentoDialog
          emp={target}
          open={!!target}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}