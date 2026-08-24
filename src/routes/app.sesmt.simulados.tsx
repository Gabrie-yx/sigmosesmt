import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { CronogramaSimuladosDialog } from "@/components/simulados/cronograma-dialog";
import { SimuladoRegistroDialog } from "@/components/simulados/simulado-registro-dialog";
import { buildSimuladoRelatorioPdf } from "@/lib/simulado-relatorio-pdf";
import { MESES_ABREV, type MesMarca } from "@/lib/simulado-cronograma-pdf";
import { CalendarRange, Flame, Plus, FileText, Pencil, CheckCircle2, AlertTriangle, Percent } from "lucide-react";
import type jsPDF from "jspdf";
import { formatDateBR } from "@/lib/utils-date";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;
const EMPRESA_NOME = "DMN ESTALEIRO";

export const Route = createFileRoute("/app/sesmt/simulados")({
  component: SimuladosPage,
  head: () => ({
    meta: [
      { title: "Simulados de Emergência — SIGMO SESMT" },
      { name: "description", content: "Cronograma anual FOR-SEG 12, registro de simulados de emergência e relatório de avaliação (NR-23, NBR 15219, NR-33/34/35)." },
      { property: "og:title", content: "Simulados de Emergência — SIGMO" },
      { property: "og:description", content: "Cronograma, execução e avaliação dos simulados de emergência do estaleiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MARCA_TXT: Record<string, string> = { "": "·", P: "○", R: "●", T: "⊗" };
const MARCA_CLS: Record<string, string> = {
  "": "text-muted-foreground",
  P: "text-slate-300",
  R: "text-emerald-500 font-bold",
  T: "text-amber-500 font-bold",
};

function SimuladosPage() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [cronogramaOpen, setCronogramaOpen] = useState(false);
  const [registroOpen, setRegistroOpen] = useState(false);
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<jsPDF | null>(null);

  const { data: cronograma } = useQuery({
    queryKey: ["simulado-cronogramas", ano],
    queryFn: async () => {
      const { data: cab } = await sb.from("simulado_cronograma").select("*").eq("ano", ano).maybeSingle();
      if (!cab) return null;
      const { data: itens } = await sb.from("simulado_cronograma_itens")
        .select("*").eq("cronograma_id", cab.id).order("ordem");
      return { ...cab, itens: itens ?? [] };
    },
  });

  const { data: execucoes = [] } = useQuery({
    queryKey: ["simulados-lista", ano],
    queryFn: async () =>
      (await sb.from("simulados").select("*").eq("ano", ano).order("data_simulado", { ascending: false })).data ?? [],
  });

  const kpi = useMemo(() => {
    const linhas = cronograma?.itens ?? [];
    let previstos = 0;
    let realizados = 0;
    for (const l of linhas) {
      const meses: MesMarca[] = Array.isArray(l.meses) ? l.meses : [];
      for (const m of meses) {
        if (m === "P" || m === "R" || m === "T") previstos++;
        if (m === "R") realizados++;
      }
    }
    const aderencia = previstos ? Math.round((realizados / previstos) * 100) : 0;
    const insatisf = execucoes.filter((e: any) => e.conceito === "INSATISFATÓRIO").length;
    return { previstos, realizados, aderencia, insatisf };
  }, [cronograma, execucoes]);

  function gerarRelatorio() {
    setPdf(buildSimuladoRelatorioPdf({
      empresa: EMPRESA_NOME,
      ano,
      linhas: (cronograma?.itens ?? []).map((l: any) => ({
        descricao: l.descricao,
        meses: Array.isArray(l.meses) ? l.meses : [],
      })),
      execucoes: execucoes.map((e: any) => ({
        cenario: e.cenario,
        data_simulado: e.data_simulado,
        local: e.local,
        escopo: e.escopo,
        com_aviso: e.com_aviso,
        tempo_abandono_seg: e.tempo_abandono_seg,
        tempo_total_seg: e.tempo_total_seg,
        qtd_participantes: e.qtd_participantes,
        conceito: e.conceito,
        falhas: e.falhas,
        pontos_positivos: e.pontos_positivos,
      })),
      responsavelNome: cronograma?.elaborado_por ?? null,
      assinatura: cronograma?.elaborado_assinatura ?? null,
    }));
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary" />Simulados de Emergência
          </h1>
          <p className="text-sm text-muted-foreground">
            FOR-SEG 12 · NR-23 / NBR 15219 · resgate NR-33 e NR-35
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            className="w-24"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value) || anoAtual)}
          />
          <Button variant="outline" onClick={() => setCronogramaOpen(true)}>
            {cronograma ? <><Pencil className="h-4 w-4 mr-1" />Editar cronograma</> : <><Plus className="h-4 w-4 mr-1" />Criar cronograma</>}
          </Button>
          <Button onClick={() => { setRegistroId(null); setRegistroOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Registrar simulado
          </Button>
          <Button variant="secondary" onClick={gerarRelatorio}>
            <FileText className="h-4 w-4 mr-1" />Relatório de avaliação
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Previstos", value: kpi.previstos, icon: CalendarRange },
          { label: "Realizados", value: kpi.realizados, icon: CheckCircle2 },
          { label: "Aderência", value: `${kpi.aderencia}%`, icon: Percent },
          { label: "Insatisfatórios", value: kpi.insatisf, icon: AlertTriangle },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-bold">{k.value}</p>
              </div>
              <k.icon className="h-6 w-6 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="cronograma">
        <TabsList>
          <TabsTrigger value="cronograma">Cronograma {ano}</TabsTrigger>
          <TabsTrigger value="realizados">Realizados ({execucoes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cronograma" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cronograma anual</CardTitle>
            </CardHeader>
            <CardContent>
              {!cronograma ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum cronograma cadastrado para {ano}. Clique em “Criar cronograma”.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="border p-1 w-8">#</th>
                        <th className="border p-1 text-left">SIMULADO</th>
                        <th className="border p-1">LOCAL</th>
                        {MESES_ABREV.map((m) => <th key={m} className="border p-1 w-9">{m}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {cronograma.itens.map((l: any, idx: number) => (
                        <tr key={l.id}>
                          <td className="border p-1 text-center">{idx + 1}</td>
                          <td className="border p-1">{l.descricao}</td>
                          <td className="border p-1 text-center">{l.local ?? "—"}</td>
                          {MESES_ABREV.map((m, mi) => {
                            const marca = (Array.isArray(l.meses) ? l.meses[mi] : "") ?? "";
                            return (
                              <td key={m} className={`border p-1 text-center ${MARCA_CLS[marca]}`}>
                                {MARCA_TXT[marca]}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    ○ planejado · <span className="text-emerald-500">●</span> realizado · <span className="text-amber-500">⊗</span> transferido
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="realizados" className="mt-4 space-y-3">
          {execucoes.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum simulado registrado em {ano}.</p>
          )}
          {execucoes.map((e: any) => (
            <Card key={e.id} className="cursor-pointer hover:border-primary/50"
              onClick={() => { setRegistroId(e.id); setRegistroOpen(true); }}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{e.cenario}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateBR(e.data_simulado)} · {e.local ?? "—"} · {e.qtd_participantes ?? 0} participantes
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{e.escopo ?? "PARCIAL"}</Badge>
                  <Badge variant={e.conceito === "INSATISFATÓRIO" ? "destructive" : "secondary"}>
                    {e.conceito ?? "—"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <CronogramaSimuladosDialog
        open={cronogramaOpen}
        onClose={() => setCronogramaOpen(false)}
        cronogramaId={cronograma?.id ?? null}
        anoInicial={ano}
      />

      <SimuladoRegistroDialog
        open={registroOpen}
        onClose={() => setRegistroOpen(false)}
        simuladoId={registroId}
        cronogramaId={cronograma?.id ?? null}
      />

      <PDFPreviewDialog
        open={!!pdf}
        onClose={() => setPdf(null)}
        doc={pdf}
        fileName={`Relatorio_Avaliacao_Simulados_${ano}.pdf`}
        title="Relatório de Avaliação dos Simulados"
      />
    </div>
  );
}
