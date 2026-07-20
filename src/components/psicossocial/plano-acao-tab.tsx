import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { gerarPlanoAcaoPsico } from "@/lib/psico-actions.functions";
import { DIMENSAO_LABEL } from "@/lib/psico-instrument";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

export function PlanoAcaoTab() {
  const qc = useQueryClient();
  const [campanhaId, setCampanhaId] = useState("");
  const gerarFn = useServerFn(gerarPlanoAcaoPsico);

  const { data: campanhas } = useQuery({
    queryKey: ["psico-camp-plano"],
    queryFn: async () => (await sb.from("psico_campanhas").select("id, titulo").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: planos, isLoading } = useQuery({
    queryKey: ["psico-planos", campanhaId],
    queryFn: async () => {
      if (!campanhaId) return [];
      const { data } = await sb.from("psico_planos_acao").select("*").eq("campanha_id", campanhaId).order("classificacao", { ascending: false });
      return data ?? [];
    },
    enabled: !!campanhaId,
  });

  const gerar = useMutation({
    mutationFn: () => gerarFn({ data: { campanhaId, prazoDias: 90 } }),
    onSuccess: (r: any) => {
      toast.success(`${r.criados} ações geradas`);
      qc.invalidateQueries({ queryKey: ["psico-planos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await sb.from("psico_planos_acao").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psico-planos"] }),
  });

  return (
    <div className="space-y-3">
      <Card className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="text-xs font-bold text-rose-100">Campanha</label>
            <Select value={campanhaId} onValueChange={setCampanhaId}>
              <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>
                {(campanhas ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white"
            disabled={!campanhaId || gerar.isPending}
            onClick={() => gerar.mutate()}
          >
            {gerar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Gerar 5W2H automático
          </Button>
        </div>
        <p className="text-[11px] text-rose-100/60 mt-2">
          Gera ações para todas as dimensões classificadas <b>ALTO</b> ou <b>MUITO_ALTO</b>. Prazo default: 90 dias. Cita o item exato da NR-01 em cada ação. Regenerar substitui apenas as ações automáticas — as editadas manualmente ficam preservadas.
        </p>
      </Card>

      {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-rose-400" /></div>}

      {campanhaId && planos && planos.length === 0 && !isLoading && (
        <Card className="p-6 text-center border-rose-500/20 bg-rose-950/30">
          <ListChecks className="h-10 w-10 text-rose-400/40 mx-auto mb-2" />
          <p className="text-sm text-rose-100/70">Nenhum plano ainda. Clique em "Gerar 5W2H automático".</p>
        </Card>
      )}

      <div className="space-y-2">
        {(planos ?? []).map((p: any) => (
          <Card key={p.id} className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={
                    p.classificacao === "MUITO_ALTO" ? "bg-rose-600 text-white" :
                    p.classificacao === "ALTO" ? "bg-orange-500 text-white" :
                    "bg-amber-500 text-slate-900"
                  }>{p.classificacao}</Badge>
                  <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-200">
                    {DIMENSAO_LABEL[p.dimensao as keyof typeof DIMENSAO_LABEL] ?? p.dimensao}
                  </Badge>
                  {p.nr01_item_ref && (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-200">
                      NR-01 {p.nr01_item_ref}
                    </Badge>
                  )}
                  {p.score_medio != null && (
                    <span className="text-[10px] text-rose-100/60">média {Number(p.score_medio).toFixed(2)}</span>
                  )}
                </div>
                <p className="text-sm font-bold text-rose-50 mt-2">{p.what}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px]">
                  <Info k="Por quê" v={p.why} />
                  <Info k="Onde" v={p.where_} />
                  <Info k="Quem" v={p.who} />
                  <Info k="Quando" v={p.when_} />
                  <div className="col-span-2 md:col-span-4"><Info k="Como" v={p.how} /></div>
                </div>
              </div>
              <Select value={p.status} onValueChange={(v) => atualizarStatus.mutate({ id: p.id, status: v })}>
                <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANEJADO">Planejado</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: any }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-rose-100/50 font-bold">{k}</p>
      <p className="text-rose-100/90">{v || "—"}</p>
    </div>
  );
}
