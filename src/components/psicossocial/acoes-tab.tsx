import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { DIMENSAO_LABEL } from "@/lib/psico-instrument";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

export function AcoesRealizadasTab() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [f, setF] = useState<any>({
    campanha_id: "",
    dimensao_atacada: "",
    titulo: "",
    descricao: "",
    data_realizacao: new Date().toISOString().slice(0, 10),
    responsavel: "",
    publico_alvo: "",
    n_participantes: 0,
    eficacia_percebida: "NAO_AVALIADA",
  });

  const { data: campanhas } = useQuery({
    queryKey: ["psico-camp-acoes"],
    queryFn: async () => (await sb.from("psico_campanhas").select("id, titulo").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: acoes, isLoading } = useQuery({
    queryKey: ["psico-acoes"],
    queryFn: async () => (await sb.from("psico_acoes_realizadas").select("*, psico_campanhas(titulo)").order("data_realizacao", { ascending: false })).data ?? [],
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("psico_acoes_realizadas").insert(f);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação registrada");
      setDialog(false);
      setF({ ...f, titulo: "", descricao: "", responsavel: "", publico_alvo: "", n_participantes: 0 });
      qc.invalidateQueries({ queryKey: ["psico-acoes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-rose-50">Ações realizadas pós-diagnóstico</h2>
          <p className="text-xs text-rose-100/60">Registro de treinamentos, rodas de conversa, capacitações e mudanças efetivamente executadas.</p>
        </div>
        <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Registrar ação
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-rose-400" /></div>}

      <div className="grid gap-2 md:grid-cols-2">
        {(acoes ?? []).map((a: any) => (
          <Card key={a.id} className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-rose-50">{a.titulo}</p>
                <p className="text-[10px] text-rose-100/50">{a.psico_campanhas?.titulo ?? "—"}</p>
              </div>
              {a.eficacia_percebida && a.eficacia_percebida !== "NAO_AVALIADA" && (
                <Badge className={
                  a.eficacia_percebida === "ALTA" ? "bg-emerald-600 text-white" :
                  a.eficacia_percebida === "MEDIA" ? "bg-amber-500 text-slate-900" :
                  "bg-rose-600 text-white"
                }>Eficácia {a.eficacia_percebida}</Badge>
              )}
            </div>
            {a.descricao && <p className="text-xs text-rose-100/80 mt-2 line-clamp-3">{a.descricao}</p>}
            <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-rose-100/60">
              <Badge variant="outline" className="border-rose-500/30 text-rose-200">
                <CheckCheck className="h-3 w-3 mr-1" />
                {new Date(a.data_realizacao).toLocaleDateString("pt-BR")}
              </Badge>
              {a.dimensao_atacada && (
                <Badge variant="outline" className="border-rose-500/30 text-rose-200">
                  {DIMENSAO_LABEL[a.dimensao_atacada as keyof typeof DIMENSAO_LABEL] ?? a.dimensao_atacada}
                </Badge>
              )}
              {a.n_participantes ? (
                <Badge variant="outline" className="border-rose-500/30 text-rose-200">
                  {a.n_participantes} participantes
                </Badge>
              ) : null}
              {a.responsavel && <span>por {a.responsavel}</span>}
            </div>
          </Card>
        ))}
        {acoes && acoes.length === 0 && (
          <Card className="p-6 text-center col-span-full border-rose-500/20 bg-rose-950/30">
            <p className="text-sm text-rose-100/60">Nenhuma ação registrada ainda.</p>
          </Card>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar ação realizada</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Campanha *</Label>
              <Select value={f.campanha_id} onValueChange={(v) => setF({ ...f, campanha_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>
                  {(campanhas ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex: Treinamento de liderança em escuta ativa" />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea rows={3} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data</Label>
                <Input type="date" value={f.data_realizacao} onChange={(e) => setF({ ...f, data_realizacao: e.target.value })} />
              </div>
              <div>
                <Label>Dimensão atacada</Label>
                <Select value={f.dimensao_atacada} onValueChange={(v) => setF({ ...f, dimensao_atacada: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIMENSAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} />
              </div>
              <div>
                <Label>Nº participantes</Label>
                <Input type="number" value={f.n_participantes} onChange={(e) => setF({ ...f, n_participantes: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Eficácia percebida</Label>
              <Select value={f.eficacia_percebida} onValueChange={(v) => setF({ ...f, eficacia_percebida: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_AVALIADA">Não avaliada</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={!f.campanha_id || !f.titulo || !f.descricao || salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
