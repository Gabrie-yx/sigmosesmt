import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Clock, Upload, FileText, Users, CheckCircle2, AlertTriangle, CalendarDays, Info, Eye, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/administrativo/gestao-ponto/")({
  component: GestaoPontoPage,
});

type Ciclo = {
  id: string;
  competencia: string;
  status: string;
  prazo_envio_rh: string | null;
  total_paginas: number | null;
  total_funcionarios: number | null;
  pdf_original_nome: string | null;
  observacoes: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  aberto:              { label: "Aberto",               className: "bg-slate-500/20 text-slate-200 border-slate-500/40" },
  em_tratamento:       { label: "Em tratamento",        className: "bg-amber-500/20 text-amber-200 border-amber-500/40" },
  aguardando_anderson: { label: "Aguardando Anderson",  className: "bg-blue-500/30 text-blue-100 border-blue-400/60 shadow-[0_0_18px_-4px_rgba(59,130,246,0.6)] font-semibold px-2.5 py-0.5" },
  aprovado:            { label: "Aprovado",             className: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
  enviado_rh:          { label: "Enviado ao RH",        className: "bg-violet-500/20 text-violet-200 border-violet-500/40" },
  encerrado:           { label: "Encerrado",            className: "bg-neutral-500/20 text-neutral-200 border-neutral-500/40" },
};

function competenciaLabel(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m) return iso;
  return d ? `${d}/${m}/${y}` : `${m}/${y}`;
}

function periodoLabel(iso: string) {
  const [y, m] = iso.split("-");
  if (!y || !m) return iso;
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[Number(m) - 1] ?? m}/${y}`;
}

function GestaoPontoPage() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [competencia, setCompetencia] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [prazo, setPrazo] = useState<string>("");
  const [obs, setObs] = useState("");
  const [editando, setEditando] = useState<Ciclo | null>(null);
  const [excluindo, setExcluindo] = useState<Ciclo | null>(null);
  const [viewOnly, setViewOnly] = useState(false);

  const { data: ciclos = [], isLoading } = useQuery({
    queryKey: ["ponto_ciclos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_ciclos" as any)
        .select("*")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ciclo[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (editando) {
        const { error } = await supabase.from("ponto_ciclos" as any).update({
          competencia,
          prazo_envio_rh: prazo || null,
          observacoes: obs || null,
        }).eq("id", editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ponto_ciclos" as any).insert({
          competencia,
          prazo_envio_rh: prazo || null,
          observacoes: obs || null,
          criado_por: uid,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editando ? "Ciclo atualizado" : "Ciclo criado");
      setNovoOpen(false);
      setEditando(null);
      setViewOnly(false);
      setObs("");
      setPrazo("");
      qc.invalidateQueries({ queryKey: ["ponto_ciclos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar ciclo"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_ciclos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ciclo excluído");
      setExcluindo(null);
      qc.invalidateQueries({ queryKey: ["ponto_ciclos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  function abrirNovo() {
    setEditando(null);
    setViewOnly(false);
    const d = new Date();
    setCompetencia(d.toISOString().slice(0, 10));
    setPrazo("");
    setObs("");
    setNovoOpen(true);
  }

  function abrirEditar(c: Ciclo, somenteLeitura: boolean) {
    setEditando(c);
    setViewOnly(somenteLeitura);
    setCompetencia(c.competencia.slice(0, 10));
    setPrazo(c.prazo_envio_rh ?? "");
    setObs(c.observacoes ?? "");
    setNovoOpen(true);
  }

  const abertos = useMemo(
    () => ciclos.filter(c => c.status !== "encerrado" && c.status !== "enviado_rh").length,
    [ciclos]
  );
  const aprovacao = useMemo(
    () => ciclos.filter(c => c.status === "aguardando_anderson").length,
    [ciclos]
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Gestão de Ponto</h1>
            <p className="text-sm text-muted-foreground">
              Fechamento mensal de cartão-ponto CLT · tratativas · aprovação do Supervisor Geral · envio pro RH
            </p>
          </div>
        </div>
        <Button onClick={abrirNovo} className="gap-2">
          <Upload className="h-4 w-4" /> Novo ciclo mensal
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Ciclos totais</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{ciclos.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Em andamento</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{abertos}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Aguardando Anderson</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{aprovacao}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ciclos</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : ciclos.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum ciclo criado. Clique em <strong>Novo ciclo mensal</strong> pra começar.
            </div>
          ) : (
            <div className="space-y-2">
              {ciclos.map(c => {
                const st = STATUS_LABEL[c.status] ?? { label: c.status, className: "" };
                return (
                  <div key={c.id} className="flex flex-col md:flex-row md:items-center gap-3 border rounded-lg p-3 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{competenciaLabel(c.competencia)}</span>
                        <Badge variant="outline" className={st.className}>{st.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.total_funcionarios ?? 0} funcionários</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {c.total_paginas ?? 0} páginas</span>
                        {c.prazo_envio_rh && <span>Prazo RH: {c.prazo_envio_rh}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to="/app/administrativo/gestao-ponto/$cicloId"
                          params={{ cicloId: c.id }}
                          preload={false}
                        >
                          Abrir
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" title="Visualizar" onClick={() => abrirEditar(c, true)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => abrirEditar(c, false)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => setExcluindo(c)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Próxima entrega: upload do PDF do mês, parser automático por página (1 CLT = 1 folha),
            tela de tratativas com anexo, fila de aprovação do Anderson (assinatura digital + carimbo)
            e download consolidado pra enviar ao RH.
          </p>
        </CardContent>
      </Card>

      <Dialog open={novoOpen} onOpenChange={(o) => { setNovoOpen(o); if (!o) { setEditando(null); setViewOnly(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{viewOnly ? "Visualizar ciclo" : editando ? "Editar ciclo" : "Novo ciclo mensal"}</DialogTitle>
                <DialogDescription>
                  Informe dia, mês e ano — o resto (nomes, matrículas, período, marcações) vem do PDF na próxima etapa.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Competência *</label>
                <Input type="date" value={competencia.slice(0,10)} onChange={e => setCompetencia(e.target.value)} disabled={viewOnly} />
                <p className="text-[11px] text-muted-foreground mt-1">Dia/mês/ano de referência da folha.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prazo p/ envio ao RH</label>
                <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} disabled={viewOnly} />
                <p className="text-[11px] text-muted-foreground mt-1">Opcional — usado só pra alerta.</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Observações</label>
              <Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: fechamento antecipado por feriado" disabled={viewOnly} />
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                Depois de criado, você entra no ciclo e envia o PDF completo do mês.
                O sistema lê <b>página por página</b> (1 folha = 1 funcionário), puxa cabeçalho, período,
                marcações e destaca <b>atrasos, faltas, HE e compensações</b> pra tratar.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>{viewOnly ? "Fechar" : "Cancelar"}</Button>
            {!viewOnly && (
              <Button onClick={() => criar.mutate()} disabled={criar.isPending || !competencia}>
                {criar.isPending ? "Salvando…" : editando ? "Salvar alterações" : "Criar ciclo"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ciclo?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo && <>Ciclo <b>{competenciaLabel(excluindo.competencia)}</b> será removido permanentemente, junto com folhas e tratativas vinculadas. Ação irreversível.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}