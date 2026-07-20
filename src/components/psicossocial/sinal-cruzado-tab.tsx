import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cruzarSinaisPsico } from "@/lib/psico-actions.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

export function SinalCruzadoTab() {
  const [campanhaId, setCampanhaId] = useState("");
  const [resultado, setResultado] = useState<any>(null);
  const fn = useServerFn(cruzarSinaisPsico);

  const { data: campanhas } = useQuery({
    queryKey: ["psico-camp-sinal"],
    queryFn: async () => (await sb.from("psico_campanhas").select("id, titulo").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: ghes } = useQuery({
    queryKey: ["pgr-ghe-sinal"],
    queryFn: async () => (await sb.from("pgr_ghe").select("id, numero, setor")).data ?? [],
  });

  const cruzar = useMutation({
    mutationFn: () => fn({ data: { campanhaId } }),
    onSuccess: (r) => { setResultado(r); toast.success("Cruzamento executado"); },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  return (
    <div className="space-y-3">
      <Card className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="text-xs font-bold text-rose-100">Campanha psicossocial</label>
            <Select value={campanhaId} onValueChange={setCampanhaId}>
              <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>
                {(campanhas ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white"
            disabled={!campanhaId || cruzar.isPending}
            onClick={() => cruzar.mutate()}
          >
            {cruzar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Activity className="h-4 w-4 mr-1" />}
            Cruzar sinais
          </Button>
        </div>
        <p className="text-[11px] text-rose-100/60 mt-2">
          Cruza a campanha psicossocial com <b>atestados CID F (180d)</b>, <b>acidentes de trabalho (180d)</b> e <b>horas extras (30d)</b> por GHE. Score composto de 0 a 100.
        </p>
      </Card>

      {resultado && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="Atestados CID F (180d)" value={resultado.resumo.atestados_cid_f_180d} />
            <KpiCard label="Acidentes (180d)" value={resultado.resumo.acidentes_180d} />
            <KpiCard label="Horas extras (30d)" value={`${resultado.resumo.he_horas_30d}h`} />
          </div>

          <Card className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
            <h3 className="text-sm font-bold text-rose-50 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Score cruzado por GHE
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-rose-100/60">
                  <th className="text-left p-2">GHE</th>
                  <th className="text-center p-2">Média psico</th>
                  <th className="text-center p-2">Dimensões críticas</th>
                  <th className="text-center p-2">Score</th>
                  <th className="text-center p-2">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {resultado.linhas.map((l: any) => {
                  const g = (ghes ?? []).find((x: any) => x.id === l.ghe_id);
                  return (
                    <tr key={l.ghe_id} className="border-t border-rose-500/10">
                      <td className="p-2 text-rose-100 font-semibold">{g ? `GHE ${g.numero} — ${g.setor}` : l.ghe_id.slice(0, 8)}</td>
                      <td className="text-center p-2 text-rose-100/80">{l.media_psico}</td>
                      <td className="text-center p-2 text-rose-100/80">{l.criticas}</td>
                      <td className="text-center p-2 font-black text-rose-300">{l.score_cruzado}</td>
                      <td className="text-center p-2">
                        <Badge className={
                          l.classificacao === "CRITICO" ? "bg-rose-600 text-white" :
                          l.classificacao === "ALTO" ? "bg-orange-500 text-white" :
                          l.classificacao === "MODERADO" ? "bg-amber-500 text-slate-900" :
                          "bg-emerald-600 text-white"
                        }>{l.classificacao}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {resultado.linhas.length === 0 && (
                  <tr><td colSpan={5} className="text-center p-6 text-rose-100/50">Sem dados suficientes para cruzamento.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60 text-center">
      <p className="text-[10px] uppercase tracking-wide text-rose-100/60 font-bold">{label}</p>
      <p className="text-2xl font-black text-rose-300 mt-1">{value}</p>
    </Card>
  );
}
