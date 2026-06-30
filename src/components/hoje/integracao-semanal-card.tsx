import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { GraduationCap, ArrowRight } from "lucide-react";

export function IntegracaoSemanalCard() {
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje); seteDiasAtras.setDate(hoje.getDate() - 7);
  const ini = seteDiasAtras.toISOString().slice(0, 10);
  const fim = hoje.toISOString().slice(0, 10);

  const { data } = useQuery({
    queryKey: ["integracao-semanal", ini, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracoes")
        .select("id, integracao_participantes(id)")
        .gte("data_integracao", ini)
        .lte("data_integracao", fim);
      if (error) throw error;
      const sessoes = data?.length ?? 0;
      const pessoas = (data ?? []).reduce((s: number, r: any) => s + (r.integracao_participantes?.length ?? 0), 0);
      return { sessoes, pessoas };
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-14 pt-4">
      <Link to="/app/sesmt/integracoes" className="block group">
        <Card className="p-5 glass-card hover:border-emerald-400/40 transition-colors">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-black">Integrações NR-01 (últimos 7 dias)</div>
              <div className="text-xl font-black text-rose-50">
                {data?.sessoes ?? 0} sessões · {data?.pessoas ?? 0} pessoas integradas
              </div>
              <div className="text-xs text-[rgba(245,225,225,0.6)] mt-0.5">Clique para ver o relatório completo, filtrar por período e empresa, e exportar.</div>
            </div>
            <ArrowRight className="h-5 w-5 text-emerald-300/70 group-hover:translate-x-1 transition-transform" />
          </div>
        </Card>
      </Link>
    </div>
  );
}