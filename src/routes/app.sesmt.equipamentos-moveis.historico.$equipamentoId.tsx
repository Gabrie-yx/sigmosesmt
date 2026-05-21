import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, History, Printer, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArquivosLegadosPanel } from "@/components/equipamentos/ArquivosLegadosPanel";

export const Route = createFileRoute("/app/sesmt/equipamentos-moveis/historico/$equipamentoId")({
  component: HistoricoPage,
  head: () => ({ meta: [{ title: "Histórico de Checklist · SIGMO" }] }),
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function HistoricoPage() {
  const { equipamentoId } = Route.useParams();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1..12

  const equip = useQuery({
    queryKey: ["equip", equipamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_moveis").select("*").eq("id", equipamentoId).single();
      if (error) throw error;
      return data;
    },
  });

  const modelo = useQuery({
    enabled: !!equip.data?.modelo_checklist_id,
    queryKey: ["modelo-completo-h", equip.data?.modelo_checklist_id],
    queryFn: async () => {
      const modId = equip.data!.modelo_checklist_id as string;
      const [{ data: m }, { data: secoes }, { data: itens }] = await Promise.all([
        supabase.from("checklist_modelos").select("*").eq("id", modId).single(),
        supabase.from("checklist_modelo_secoes").select("*").eq("modelo_id", modId).order("ordem"),
        supabase.from("checklist_modelo_itens").select("*, secao:checklist_modelo_secoes!inner(modelo_id)")
          .eq("secao.modelo_id", modId).order("ordem"),
      ]);
      return { modelo: m, secoes: secoes ?? [], itens: itens ?? [] };
    },
  });

  const inicioMes = `${year}-${String(month).padStart(2, "0")}-01`;
  const fimMes = new Date(year, month, 0).toISOString().slice(0, 10);
  const diasNoMes = new Date(year, month, 0).getDate();

  const execucoes = useQuery({
    queryKey: ["execucoes", equipamentoId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_execucoes")
        .select("*, respostas:checklist_respostas(*)")
        .eq("equipamento_id", equipamentoId)
        .gte("data", inicioMes).lte("data", fimMes)
        .order("data");
      if (error) throw error;
      return data ?? [];
    },
  });

  // matriz[itemId][dia] = "OK" | "NC" | "NA" | undefined
  const matriz = useMemo(() => {
    const m: Record<string, Record<number, string>> = {};
    for (const exec of execucoes.data ?? []) {
      const dia = parseInt((exec.data as string).slice(8, 10));
      for (const r of (exec as any).respostas ?? []) {
        if (!m[r.item_id]) m[r.item_id] = {};
        m[r.item_id][dia] = r.resposta;
      }
    }
    return m;
  }, [execucoes.data]);

  const horimInicial = execucoes.data?.[0]?.horimetro_inicial;
  const horimFinal = execucoes.data?.[execucoes.data.length - 1]?.horimetro_final;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  if (equip.isLoading || modelo.isLoading) {
    return <div className="p-8 text-center text-slate-400">Carregando…</div>;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/sesmt/equipamentos-moveis" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {modelo.data?.modelo?.codigo ?? "—"} · DMN ISO 9001 · Visão mensal
          </p>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <History className="h-5 w-5 text-red-700" />
            {equip.data?.tag} — {equip.data?.nome}
          </h1>
        </div>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button asChild size="sm" className="bg-[#7B1E2B] hover:bg-[#5a1620] text-white" disabled={!equip.data?.modelo_checklist_id}>
            <Link to="/app/sesmt/equipamentos-moveis/checklist/$equipamentoId" params={{ equipamentoId }}>
              <ClipboardCheck className="h-4 w-4 mr-1" /> Novo Checklist
            </Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Info label="Equipamento" v={equip.data?.nome ?? "—"} />
          <Info label="TAG" v={equip.data?.tag ?? "—"} />
          <Info label="Horímetro Inicial" v={horimInicial != null ? `${horimInicial} h` : "—"} />
          <Info label="Horímetro Final" v={horimFinal != null ? `${horimFinal} h` : "—"} />
        </CardContent>
      </Card>

      <Tabs defaultValue="matriz" className="w-full">
        <TabsList>
          <TabsTrigger value="matriz">Matriz Diária</TabsTrigger>
          <TabsTrigger value="arquivos">Arquivos Mensais</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="space-y-4 mt-3">
          <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="text-left px-2 py-2 font-black uppercase tracking-widest sticky left-0 bg-slate-100 z-10 min-w-[260px]">Item</th>
                {Array.from({ length: diasNoMes }, (_, i) => i + 1).map((d) => (
                  <th key={d} className="px-1 py-2 font-black border-l border-slate-200 w-7 text-center tabular-nums">{d}</th>
                ))}
                <th className="px-2 py-2 font-black border-l border-slate-300 bg-amber-50 min-w-[120px]">O.S. emitidas</th>
              </tr>
            </thead>
            <tbody>
              {(modelo.data?.secoes ?? []).map((sec) => {
                const secItens = (modelo.data!.itens as any[]).filter((i) => i.secao_id === sec.id);
                return (
                  <>
                    <tr key={`s-${sec.id}`} className="bg-red-50">
                      <td colSpan={diasNoMes + 2} className="px-2 py-1 font-black uppercase tracking-widest text-red-800 text-[10px]">
                        {sec.numero}. {sec.titulo}
                      </td>
                    </tr>
                    {secItens.map((it) => {
                      const linha = matriz[it.id] ?? {};
                      const osList = (execucoes.data ?? [])
                        .flatMap((e: any) => (e.respostas ?? []).filter((r: any) => r.item_id === it.id && r.resposta === "NC"))
                        .map((r: any) => r.os_numero).filter(Boolean);
                      return (
                        <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-1 sticky left-0 bg-white hover:bg-slate-50 z-10">
                            <span className="tabular-nums text-slate-400 mr-1">{it.numero}</span>
                            {it.descricao}
                          </td>
                          {Array.from({ length: diasNoMes }, (_, i) => i + 1).map((d) => {
                            const v = linha[d];
                            return (
                              <td key={d} className={cn(
                                "border-l border-slate-100 text-center text-[10px] font-black tabular-nums",
                                v === "OK" && "bg-emerald-100 text-emerald-700",
                                v === "NC" && "bg-red-100 text-red-700",
                                v === "NA" && "bg-slate-100 text-slate-400",
                              )}>{v ?? ""}</td>
                            );
                          })}
                          <td className="border-l border-slate-200 bg-amber-50/40 px-2 text-[10px]">
                            {osList.length > 0 ? osList.join(", ") : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
              {(modelo.data?.itens?.length ?? 0) === 0 && (
                <tr><td colSpan={diasNoMes + 2} className="text-center text-slate-400 py-8">Equipamento sem modelo de checklist vinculado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Info label="Total execuções" v={String(execucoes.data?.length ?? 0)} />
          <Info label="Dias com NC" v={String((execucoes.data ?? []).filter((e: any) => e.status === "COM_NC").length)} />
          <Info label="Última execução" v={execucoes.data?.length ? (execucoes.data[execucoes.data.length - 1].data as string).split("-").reverse().join("/") : "—"} />
          <Info label="Status atual" v={equip.data?.status ?? "—"} />
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="arquivos" className="mt-3">
          <ArquivosLegadosPanel equipamentoId={equipamentoId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-900">{v}</p>
    </div>
  );
}