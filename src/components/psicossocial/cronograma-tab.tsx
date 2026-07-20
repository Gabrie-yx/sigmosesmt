import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { criarCronogramaPsico } from "@/lib/psico-actions.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

export function CronogramaTab() {
  const qc = useQueryClient();
  const [campanhaId, setCampanhaId] = useState("");
  const [freq, setFreq] = useState(12);
  const criarFn = useServerFn(criarCronogramaPsico);

  const { data: campanhas } = useQuery({
    queryKey: ["psico-camp-cron"],
    queryFn: async () => (await sb.from("psico_campanhas").select("id, titulo").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: agenda } = useQuery({
    queryKey: ["psico-cronograma"],
    queryFn: async () => {
      const { data } = await sb
        .from("psico_cronograma")
        .select("*, psico_campanhas(titulo)")
        .order("proxima_avaliacao", { ascending: true });
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: () => criarFn({ data: { campanhaId, frequenciaMeses: freq } }),
    onSuccess: (r: any) => {
      toast.success(`Cronograma criado — próxima reavaliação em ${r.proxima_avaliacao}`);
      qc.invalidateQueries({ queryKey: ["psico-cronograma"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const hoje = new Date();

  return (
    <div className="space-y-3">
      <Card className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="text-xs font-bold text-rose-100">Campanha base</label>
            <Select value={campanhaId} onValueChange={setCampanhaId}>
              <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>
                {(campanhas ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <label className="text-xs font-bold text-rose-100">Frequência</label>
            <Select value={String(freq)} onValueChange={(v) => setFreq(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses (anual)</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white"
            disabled={!campanhaId || criar.isPending}
            onClick={() => criar.mutate()}
          >
            {criar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calendar className="h-4 w-4 mr-1" />}
            Agendar reavaliação
          </Button>
        </div>
        <p className="text-[11px] text-rose-100/60 mt-2">
          NR-01 exige reavaliação periódica dos riscos. Default: anual, com alerta 30 dias antes. Cada GHE da campanha ganha uma entrada.
        </p>
      </Card>

      <div className="grid gap-2">
        {(agenda ?? []).map((a: any) => {
          const prox = new Date(a.proxima_avaliacao);
          const dias = Math.round((prox.getTime() - hoje.getTime()) / 86400_000);
          const alerta = dias <= a.alerta_dias;
          const atrasado = dias < 0;
          return (
            <Card key={a.id} className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${atrasado ? "bg-rose-600" : alerta ? "bg-amber-500" : "bg-emerald-600"}`}>
                {atrasado ? <AlertTriangle className="h-5 w-5 text-white" /> : <Calendar className="h-5 w-5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-rose-50">{a.psico_campanhas?.titulo ?? "Campanha"}</p>
                <p className="text-xs text-rose-100/70">
                  Próxima reavaliação: <b>{new Date(a.proxima_avaliacao).toLocaleDateString("pt-BR")}</b> · a cada {a.frequencia_meses} meses
                </p>
              </div>
              <Badge className={atrasado ? "bg-rose-600 text-white" : alerta ? "bg-amber-500 text-slate-900" : "bg-emerald-600 text-white"}>
                {atrasado ? `${Math.abs(dias)}d ATRASADO` : `em ${dias}d`}
              </Badge>
            </Card>
          );
        })}
        {agenda && agenda.length === 0 && (
          <Card className="p-6 text-center border-rose-500/20 bg-rose-950/30">
            <p className="text-sm text-rose-100/60">Nenhum agendamento. Escolha uma campanha e agende a próxima reavaliação.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
