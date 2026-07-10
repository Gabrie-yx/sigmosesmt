import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChefHat, Users, Utensils, FileDown, CalendarDays } from "lucide-react";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { buildHoraExtraConsolidadoPdf } from "@/lib/hora-extra-pdf-build";
import { toast } from "sonner";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/app/cozinha")({
  component: CozinhaPage,
});

type Ficha = {
  id: string;
  data: string;
  turno: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  setor: string | null;
  modulo_origem: string | null;
  status: string;
  companies?: { name: string | null } | null;
};

type Func = {
  id: string;
  hora_extra_id: string;
  nome: string;
  externo: boolean | null;
  alimentacao: boolean | null;
  employees?: { companies?: { name: string | null } | null } | null;
};

function fmtBR(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function diaSemana(ymd: string) {
  const d = new Date(ymd + "T12:00:00");
  return ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][d.getDay()];
}

function CozinhaPage() {
  const { user, hasMenu, isAdmin, loading } = useAuth();
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [pdfFile, setPdfFile] = useState("cozinha.pdf");
  const [gerando, setGerando] = useState<string | null>(null);

  const podeAcessar = isAdmin || hasMenu("/app/cozinha");

  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ["cozinha-fichas"],
    enabled: !!user && podeAcessar,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado")
        .select("id,data,turno,horario_inicio,horario_fim,setor,modulo_origem,status,companies(name)")
        .eq("status", "APROVADA")
        .gte("data", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
        .order("data", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Ficha[];
    },
  });

  const ids = fichas.map((f) => f.id);
  const { data: funcs = [] } = useQuery({
    queryKey: ["cozinha-funcs", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado_funcionarios")
        .select("id,hora_extra_id,nome,externo,alimentacao,employees(companies(name))")
        .in("hora_extra_id", ids)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as Func[];
    },
  });

  const porDia = useMemo(() => {
    const map = new Map<string, { fichas: Ficha[]; funcs: Func[] }>();
    for (const f of fichas) {
      if (!map.has(f.data)) map.set(f.data, { fichas: [], funcs: [] });
      map.get(f.data)!.fichas.push(f);
    }
    for (const p of funcs) {
      const f = fichas.find((x) => x.id === p.hora_extra_id);
      if (!f) continue;
      map.get(f.data)?.funcs.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [fichas, funcs]);

  async function baixarPdf(data: string, ids: string[]) {
    setGerando(data);
    try {
      const out = await buildHoraExtraConsolidadoPdf(ids);
      if (!out) { toast.error("Falha ao gerar PDF"); return; }
      setPdfDoc(out.doc);
      setPdfFile(`cozinha-${data}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar PDF");
    } finally {
      setGerando(null);
    }
  }

  if (loading) return null;
  if (!user) return null;
  if (!podeAcessar) {
    return (
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader><CardTitle>Acesso restrito</CardTitle></CardHeader>
          <CardContent className="text-sm">
            Peça ao admin pra liberar o menu <strong>Cozinha</strong> no seu usuário.
          </CardContent>
        </Card>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl prism-pill accent-amber flex items-center justify-center text-amber-100">
          <ChefHat className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Cozinha — Refeições da Hora Extra</h1>
          <p className="text-xs text-muted-foreground">
            Só fichas <strong>aprovadas</strong>. Últimos 7 dias.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando…</div>
      ) : porDia.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhuma hora extra aprovada no período.
          </CardContent>
        </Card>
      ) : (
        porDia.map(([data, { fichas: fs, funcs: ps }]) => {
          const totalPessoas = ps.length;
          const totalRefeicoes = ps.filter((p) => p.alimentacao).length;
          const isHoje = data === hoje;
          return (
            <Card key={data} className={"glass-card " + (isHoje ? "border-amber-400/40 shadow-[0_0_18px_rgba(251,191,36,0.35)]" : "")}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <CalendarDays className="h-4 w-4 text-amber-300" />
                  {fmtBR(data)} · {diaSemana(data)}
                  {isHoje && <span className="prism-pill accent-amber px-2 py-0.5 text-[10px] text-amber-100">HOJE</span>}
                </CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="prism-pill accent-sky px-3 py-1 text-xs text-sky-100 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> {totalPessoas} pessoa{totalPessoas === 1 ? "" : "s"}
                  </span>
                  <span className="prism-pill accent-amber px-3 py-1 text-xs text-amber-100 font-bold flex items-center gap-1.5">
                    <Utensils className="h-3.5 w-3.5" /> {totalRefeicoes} refeiç{totalRefeicoes === 1 ? "ão" : "ões"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <div className="text-xs text-muted-foreground">
                  Turnos: {Array.from(new Set(fs.map((f) => f.turno).filter(Boolean))).join(" · ") || "—"}
                </div>
                <div className="rounded-lg border border-white/10 divide-y divide-white/5 max-h-[320px] overflow-auto">
                  {ps.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">Nenhum funcionário nas fichas.</div>
                  ) : ps.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 p-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.nome}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {p.employees?.companies?.name ?? (p.externo ? "Externo" : "—")}
                        </div>
                      </div>
                      {p.alimentacao ? (
                        <span className="prism-pill accent-amber px-2 py-0.5 text-[10px] text-amber-100 flex items-center gap-1">
                          <Utensils className="h-3 w-3" /> refeição
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">sem refeição</span>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={gerando === data}
                  onClick={() => baixarPdf(data, fs.map((f) => f.id))}
                >
                  <FileDown className="h-4 w-4 mr-1.5" />
                  {gerando === data ? "Gerando…" : "Baixar PDF consolidado do dia"}
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}

      <PDFPreviewDialog
        open={!!pdfDoc}
        onClose={() => setPdfDoc(null)}
        doc={pdfDoc}
        fileName={pdfFile}
        title="PDF — Cozinha"
      />
    </div>
  );
}