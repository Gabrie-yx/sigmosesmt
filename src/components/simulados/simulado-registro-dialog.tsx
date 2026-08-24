import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeePicker, type EmployeeOption } from "@/components/employee-picker";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { Save, PenLine, X, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

const CONCEITOS = ["SATISFATÓRIO", "PARCIALMENTE SATISFATÓRIO", "INSATISFATÓRIO"];

export function SimuladoRegistroDialog({
  open,
  onClose,
  simuladoId,
  cronogramaId,
}: {
  open: boolean;
  onClose: () => void;
  simuladoId?: string | null;
  cronogramaId?: string | null;
}) {
  const qc = useQueryClient();
  const [cenario, setCenario] = useState("");
  const [itemId, setItemId] = useState<string>("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horaAlarme, setHoraAlarme] = useState("");
  const [local, setLocal] = useState("Produção");
  const [escopo, setEscopo] = useState("PARCIAL");
  const [comAviso, setComAviso] = useState(false);
  const [tAband, setTAband] = useState("");
  const [tResg, setTResg] = useState("");
  const [tTotal, setTTotal] = useState("");
  const [brigadistas, setBrigadistas] = useState("");
  const [recursos, setRecursos] = useState("");
  const [positivos, setPositivos] = useState("");
  const [falhas, setFalhas] = useState("");
  const [conceito, setConceito] = useState("SATISFATÓRIO");
  const [obs, setObs] = useState("");
  const [participantes, setParticipantes] = useState<Array<{ id: string; nome: string; funcao?: string | null }>>([]);
  const [respNome, setRespNome] = useState("");
  const [assTst, setAssTst] = useState<string | null>(null);
  const [assinando, setAssinando] = useState(false);

  const { data: itens = [] } = useQuery({
    queryKey: ["simulado-itens-registro", cronogramaId],
    enabled: open && !!cronogramaId,
    queryFn: async () =>
      (await sb.from("simulado_cronograma_itens").select("id,descricao,local").eq("cronograma_id", cronogramaId).order("ordem")).data ?? [],
  });

  const { data: existente } = useQuery({
    queryKey: ["simulado-registro", simuladoId],
    enabled: open && !!simuladoId,
    queryFn: async () => (await sb.from("simulados").select("*").eq("id", simuladoId).maybeSingle()).data,
  });

  useEffect(() => {
    if (!open || !existente) return;
    const s = existente;
    setCenario(s.cenario ?? "");
    setItemId(s.cronograma_item_id ?? "");
    setData((s.data_simulado ?? "").slice(0, 10));
    setHoraAlarme(s.hora_alarme ?? "");
    setLocal(s.local ?? "");
    setEscopo(s.escopo ?? "PARCIAL");
    setComAviso(!!s.com_aviso);
    setTAband(s.tempo_abandono_seg != null ? String(s.tempo_abandono_seg) : "");
    setTResg(s.tempo_resgate_seg != null ? String(s.tempo_resgate_seg) : "");
    setTTotal(s.tempo_total_seg != null ? String(s.tempo_total_seg) : "");
    setBrigadistas(s.qtd_brigadistas != null ? String(s.qtd_brigadistas) : "");
    setRecursos(s.recursos_acionados ?? "");
    setPositivos(s.pontos_positivos ?? "");
    setFalhas(s.falhas ?? "");
    setConceito(s.conceito ?? "SATISFATÓRIO");
    setObs(s.observacoes ?? "");
    setParticipantes(Array.isArray(s.participantes) ? s.participantes : []);
    setRespNome(s.responsavel_nome ?? "");
    setAssTst(s.assinatura_tst ?? null);
  }, [open, existente]);

  const totalCalc = useMemo(() => {
    if (tTotal) return Number(tTotal);
    const a = Number(tAband || 0);
    const r = Number(tResg || 0);
    return a + r || null;
  }, [tAband, tResg, tTotal]);

  function addParticipante(e: EmployeeOption) {
    setParticipantes((prev) => (prev.some((p) => p.id === e.id) ? prev : [...prev, { id: e.id, nome: e.nome, funcao: e.funcao }]));
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!cenario.trim()) throw new Error("Informe o cenário do simulado.");
      const payload = {
        cronograma_item_id: itemId || null,
        ano: Number((data || "").slice(0, 4)) || new Date().getFullYear(),
        mes: Number((data || "").slice(5, 7)) || null,
        cenario,
        data_simulado: data,
        hora_alarme: horaAlarme || null,
        local: local || null,
        escopo,
        com_aviso: comAviso,
        tempo_abandono_seg: tAband ? Number(tAband) : null,
        tempo_resgate_seg: tResg ? Number(tResg) : null,
        tempo_total_seg: totalCalc,
        qtd_participantes: participantes.length,
        qtd_brigadistas: brigadistas ? Number(brigadistas) : null,
        recursos_acionados: recursos || null,
        pontos_positivos: positivos || null,
        falhas: falhas || null,
        conceito,
        observacoes: obs || null,
        participantes,
        responsavel_nome: respNome || null,
        assinatura_tst: assTst,
        updated_at: new Date().toISOString(),
      };
      if (simuladoId) {
        const { error } = await sb.from("simulados").update(payload).eq("id", simuladoId);
        if (error) throw error;
      } else {
        const { error } = await sb.from("simulados").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Simulado registrado.");
      qc.invalidateQueries({ queryKey: ["simulados-lista"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl w-[95vw] h-[92vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Registro de Simulado Realizado</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto space-y-4 pr-1">
            <section className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">1 · Identificação</p>
              {itens.length > 0 && (
                <div>
                  <Label className="text-xs">Vincular ao item do cronograma</Label>
                  <Select value={itemId} onValueChange={(v) => {
                    setItemId(v);
                    const it = itens.find((x: any) => x.id === v);
                    if (it) { setCenario(it.descricao); if (it.local) setLocal(it.local); }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Escolha o simulado planejado…" /></SelectTrigger>
                    <SelectContent>
                      {itens.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.descricao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Cenário</Label>
                  <Input value={cenario} onChange={(e) => setCenario(e.target.value)} placeholder="Ex.: Simulado de evacuação" />
                </div>
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Hora do alarme</Label>
                  <Input type="time" value={horaAlarme} onChange={(e) => setHoraAlarme(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Local</Label>
                  <Input value={local} onChange={(e) => setLocal(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Escopo</Label>
                  <Select value={escopo} onValueChange={setEscopo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARCIAL">Parcial (setor/área)</SelectItem>
                      <SelectItem value="COMPLETO">Completo (toda a planta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <Switch checked={comAviso} onCheckedChange={setComAviso} id="aviso" />
                  <Label htmlFor="aviso" className="text-xs">Com aviso prévio aos trabalhadores</Label>
                </div>
              </div>
            </section>

            <section className="rounded-lg border p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">2 · Cronometragem (segundos)</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Abandono concluído</Label>
                  <Input type="number" value={tAband} onChange={(e) => setTAband(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Resgate</Label>
                  <Input type="number" value={tResg} onChange={(e) => setTResg(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Total (auto)</Label>
                  <Input type="number" value={tTotal} placeholder={totalCalc ? String(totalCalc) : ""} onChange={(e) => setTTotal(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Brigadistas</Label>
                  <Input type="number" value={brigadistas} onChange={(e) => setBrigadistas(e.target.value)} />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Recursos acionados</Label>
                <Textarea rows={2} value={recursos} onChange={(e) => setRecursos(e.target.value)}
                  placeholder="Brigada, ambulância, extintores, maca, tripé de resgate…" />
              </div>
            </section>

            <section className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">3 · Participantes</p>
                <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{participantes.length}</Badge>
              </div>
              <EmployeePicker value="" onSelect={addParticipante} placeholder="Buscar funcionário ativo..." />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {participantes.map((p) => (
                  <Badge key={p.id} variant="secondary" className="gap-1">
                    {p.nome}
                    <button type="button" onClick={() => setParticipantes((prev) => prev.filter((x) => x.id !== p.id))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </section>

            <section className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">4 · Avaliação</p>
              <div>
                <Label className="text-xs">Pontos positivos</Label>
                <Textarea rows={3} value={positivos} onChange={(e) => setPositivos(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Falhas observadas</Label>
                <Textarea rows={3} value={falhas} onChange={(e) => setFalhas(e.target.value)}
                  placeholder="Toda falha aqui entra no relatório de avaliação como oportunidade de melhoria." />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Conceito</Label>
                  <Select value={conceito} onValueChange={setConceito}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONCEITOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Input value={obs} onChange={(e) => setObs(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="rounded-lg border p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">5 · Responsável</p>
              <div className="grid gap-3 sm:grid-cols-2 items-end">
                <div>
                  <Label className="text-xs">Responsável (TST)</Label>
                  <EmployeePicker value={respNome} onSelect={(e) => setRespNome(e.nome)} onClear={() => setRespNome("")} />
                </div>
                <div className="flex items-center gap-2">
                  {assTst ? (
                    <>
                      <img src={assTst} alt="Assinatura" className="h-10 rounded border bg-white object-contain px-1" />
                      <Button size="sm" variant="ghost" onClick={() => setAssTst(null)}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setAssinando(true)}>
                      <PenLine className="h-3.5 w-3.5 mr-1" />Assinar
                    </Button>
                  )}
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignaturePadDialog
        open={assinando}
        onClose={() => setAssinando(false)}
        onConfirm={(r) => { setAssTst(r.dataUrl); setAssinando(false); }}
        title="Assinatura do responsável"
      />
    </>
  );
}
