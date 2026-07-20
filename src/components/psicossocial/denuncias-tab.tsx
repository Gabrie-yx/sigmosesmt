import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldAlert, Copy, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

const CATEGORIA_LABEL: Record<string, string> = {
  ASSEDIO_MORAL: "Assédio moral",
  ASSEDIO_SEXUAL: "Assédio sexual",
  DISCRIMINACAO: "Discriminação",
  VIOLENCIA: "Violência",
  OUTRO: "Outro",
};

export function DenunciasTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<string>("TODAS");
  const [ativa, setAtiva] = useState<any | null>(null);
  const [parecer, setParecer] = useState("");
  const [novoStatus, setNovoStatus] = useState("");

  const { data: denuncias, isLoading } = useQuery({
    queryKey: ["psico-denuncias", filtro],
    queryFn: async () => {
      let q = sb.from("psico_denuncias").select("*").order("created_at", { ascending: false });
      if (filtro !== "TODAS") q = q.eq("status", filtro);
      const { data } = await q;
      return data ?? [];
    },
  });

  const atualizar = useMutation({
    mutationFn: async () => {
      const patch: any = { status: novoStatus };
      if (parecer) patch.parecer_final = parecer;
      if (novoStatus === "CONCLUIDA") patch.concluida_em = new Date().toISOString();
      const { error } = await sb.from("psico_denuncias").update(patch).eq("id", ativa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Denúncia atualizada");
      qc.invalidateQueries({ queryKey: ["psico-denuncias"] });
      setAtiva(null);
      setParecer("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const linkPublico = typeof window !== "undefined" ? `${window.location.origin}/denuncia` : "";

  return (
    <div className="space-y-3">
      <Card className="p-4 border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-slate-950/60">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-emerald-600 text-white shrink-0"><Lock className="h-4 w-4" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-50">Canal público de denúncia (Lei 14.457/2022)</p>
            <p className="text-xs text-emerald-100/70 mt-1">Compartilhe este link com todos os colaboradores. Não exige login, é 100% anônimo.</p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-slate-900 rounded px-2 py-1.5 text-emerald-200 break-all">{linkPublico}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(linkPublico); toast.success("Link copiado"); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-rose-50 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-rose-400" /> Denúncias recebidas
        </h2>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            <SelectItem value="RECEBIDA">Recebida</SelectItem>
            <SelectItem value="EM_APURACAO">Em apuração</SelectItem>
            <SelectItem value="CONCLUIDA">Concluída</SelectItem>
            <SelectItem value="ARQUIVADA">Arquivada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-rose-400" /></div>}

      <div className="space-y-2">
        {(denuncias ?? []).map((d: any) => (
          <Card key={d.id} className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60 cursor-pointer hover:bg-rose-950/50"
            onClick={() => { setAtiva(d); setNovoStatus(d.status); setParecer(d.parecer_final ?? ""); }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-[11px] font-mono font-bold text-rose-300">{d.protocolo}</code>
                  <Badge className="bg-rose-600 text-white text-[10px]">{CATEGORIA_LABEL[d.categoria] ?? d.categoria}</Badge>
                  <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-200">{d.status}</Badge>
                  {d.quer_retorno && <Badge className="bg-amber-500 text-slate-900 text-[10px]">Quer retorno</Badge>}
                </div>
                <p className="text-sm text-rose-50 mt-2 line-clamp-2">{d.relato}</p>
                <p className="text-[10px] text-rose-100/50 mt-1">
                  {new Date(d.created_at).toLocaleString("pt-BR")}
                  {d.local_ocorrencia && ` · ${d.local_ocorrencia}`}
                </p>
              </div>
            </div>
          </Card>
        ))}
        {denuncias && denuncias.length === 0 && (
          <Card className="p-6 text-center border-rose-500/20 bg-rose-950/30">
            <p className="text-sm text-rose-100/60">Nenhuma denúncia neste filtro.</p>
          </Card>
        )}
      </div>

      <Dialog open={!!ativa} onOpenChange={(o) => !o && setAtiva(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Denúncia {ativa?.protocolo}
            </DialogTitle>
          </DialogHeader>
          {ativa && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-rose-600 text-white">{CATEGORIA_LABEL[ativa.categoria] ?? ativa.categoria}</Badge>
                {ativa.local_ocorrencia && <Badge variant="outline">Local: {ativa.local_ocorrencia}</Badge>}
                {ativa.data_aproximada && <Badge variant="outline">Data: {new Date(ativa.data_aproximada).toLocaleDateString("pt-BR")}</Badge>}
              </div>
              <div className="p-3 rounded bg-slate-900 border border-slate-700">
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Relato</p>
                <p className="text-sm text-slate-100 whitespace-pre-wrap">{ativa.relato}</p>
              </div>
              {ativa.quer_retorno && ativa.contato_retorno && (
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs">
                  <b className="text-amber-200">Denunciante quer retorno · </b>
                  <span className="text-amber-100">Contato: {ativa.contato_retorno}</span>
                </div>
              )}
              <div>
                <label className="text-xs font-bold">Status</label>
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEBIDA">Recebida</SelectItem>
                    <SelectItem value="EM_APURACAO">Em apuração</SelectItem>
                    <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                    <SelectItem value="ARQUIVADA">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold">Parecer / decisão da comissão</label>
                <Textarea rows={4} value={parecer} onChange={(e) => setParecer(e.target.value)} placeholder="Registre a apuração, medidas tomadas e conclusão." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtiva(null)}>Fechar</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" disabled={atualizar.isPending} onClick={() => atualizar.mutate()}>
              {atualizar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
