import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, AlertTriangle, Trophy, CalendarClock, Activity, ShieldAlert, Skull,
  TrendingDown, TrendingUp, Clock, Hash, Users, Calculator, FileDown,
  Eye, Pencil, Trash2, Upload, X, Image as ImageIcon, User as UserIcon,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import { CorpoHumanoAcidentes } from "@/components/corpo-humano-acidentes";
import { gerarForSeg09, gerarForSeg10 } from "@/lib/pdf-acidentes";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Line, Legend, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/app/acidentes")({
  component: AcidentesPage,
  head: () => ({ meta: [{ title: "Acidentes de Trabalho · SIGMO" }] }),
});

const TIPO_LABEL: Record<string, string> = {
  COM_AFASTAMENTO: "Com afastamento",
  SEM_AFASTAMENTO: "Sem afastamento",
  TRAJETO: "Trajeto",
  FATAL: "Fatal",
};
const TIPO_STYLE: Record<string, string> = {
  COM_AFASTAMENTO: "bg-red-100 text-red-700 border-red-300",
  SEM_AFASTAMENTO: "bg-amber-100 text-amber-700 border-amber-300",
  TRAJETO: "bg-blue-100 text-blue-700 border-blue-300",
  FATAL: "bg-slate-900 text-white border-slate-900",
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const PARTES_CORPO = [
  "Cabeça","Olho direito","Olho esquerdo","Face","Pescoço","Ombro direito","Ombro esquerdo",
  "Tórax","Abdômen","Coluna","Braço direito","Braço esquerdo","Mão direita","Mão esquerda",
  "Dedos da mão direita","Dedos da mão esquerda",
  "Quadril","Coxa direita","Coxa esquerda","Joelho direito","Joelho esquerdo",
  "Perna direita","Perna esquerda","Pé direito","Pé esquerdo",
  "Dedos do pé direito","Dedos do pé esquerdo","Múltiplas",
];

const TIPO_ICONS: Record<string, string> = {
  SEM_AFASTAMENTO: "🩹",
  COM_AFASTAMENTO: "🤕",
  TRAJETO: "🚗",
  FATAL: "💀",
};
const TIPO_COLOR: Record<string, string> = {
  SEM_AFASTAMENTO: "#f59e0b",
  COM_AFASTAMENTO: "#ef4444",
  TRAJETO: "#3b82f6",
  FATAL: "#0f172a",
};

function AcidentesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("painel");
  const [novoOpen, setNovoOpen] = useState(false);
  const [hhtOpen, setHhtOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [anoFiltro, setAnoFiltro] = useState<number>(new Date().getFullYear());

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("acidentes_trabalho").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acidente excluído.");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["acidentes"] });
      qc.invalidateQueries({ queryKey: ["dias-sem-acidente"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir."),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-acidentes"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id,name").order("name");
      return data ?? [];
    },
  });

  const { data: acidentes = [] } = useQuery({
    queryKey: ["acidentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acidentes_trabalho")
        .select("*")
        .order("data_acidente", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: hhtRows = [] } = useQuery({
    queryKey: ["hht-mensal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hht_mensal")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      return data ?? [];
    },
  });

  const { data: dias = [] } = useQuery({
    queryKey: ["dias-sem-acidente"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_dias_sem_acidente", { _company_id: undefined as unknown as string });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const now = new Date();
    const anoAtual = anoFiltro;
    const mesAtual = now.getMonth() + 1;
    const noAno = acidentes.filter(a => new Date(a.data_acidente).getFullYear() === anoAtual);
    const noMes = noAno.filter(a => new Date(a.data_acidente).getMonth() + 1 === mesAtual);
    const comAfastAno = noAno.filter(a => a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL");
    const diasPerdidosAno = noAno.reduce((s, a) => s + (a.dias_perdidos || 0) + (a.dias_debitados || 0), 0);
    const hhtAno = hhtRows
      .filter(h => h.ano === anoAtual)
      .reduce((s, h) => s + Number(h.hht || 0), 0);
    const tf = hhtAno > 0 ? (comAfastAno.length * 1_000_000) / hhtAno : 0;
    const tg = hhtAno > 0 ? (diasPerdidosAno * 1_000_000) / hhtAno : 0;
    return {
      totalAno: noAno.length,
      totalMes: noMes.length,
      comAfastAno: comAfastAno.length,
      diasPerdidosAno,
      tf: tf.toFixed(2),
      tg: tg.toFixed(2),
    };
  }, [acidentes, hhtRows, anoFiltro]);

  const placarPrincipal = useMemo(() => {
    if (!dias.length) return { dias_sem_com_afast: null, recorde_com_afast: 0, ultimo_acidente_com_afast: null };
    // Pega o maior atual e o maior recorde
    const max = dias.reduce(
      (acc, d) => ({
        dias_sem_com_afast: Math.max(acc.dias_sem_com_afast ?? -1, d.dias_sem_com_afast ?? 0),
        recorde_com_afast: Math.max(acc.recorde_com_afast, d.recorde_com_afast ?? 0),
        ultimo_acidente_com_afast: d.ultimo_acidente_com_afast ?? acc.ultimo_acidente_com_afast,
      }),
      { dias_sem_com_afast: null as number | null, recorde_com_afast: 0, ultimo_acidente_com_afast: undefined as string | undefined }
    );
    return max;
  }, [dias]);

  const serieMensal = useMemo(() => {
    const anoAtual = anoFiltro;
    return MESES.map((m, i) => {
      const acidsMes = acidentes.filter(a => {
        const d = new Date(a.data_acidente);
        return d.getFullYear() === anoAtual && d.getMonth() === i;
      });
      const hhtMes = hhtRows
        .filter(h => h.ano === anoAtual && h.mes === i + 1)
        .reduce((s, h) => s + Number(h.hht || 0), 0);
      const comAfast = acidsMes.filter(a => a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL").length;
      const tf = hhtMes > 0 ? Number(((comAfast * 1_000_000) / hhtMes).toFixed(2)) : 0;
      return {
        mes: m,
        Acidentes: acidsMes.length,
        "Com Afast.": comAfast,
        TF: tf,
      };
    });
  }, [acidentes, hhtRows, anoFiltro]);

  // Acidentes do ano selecionado — alimenta o corpo humano + total por tipo
  const acidentesAno = useMemo(
    () => acidentes.filter(a => new Date(a.data_acidente).getFullYear() === anoFiltro),
    [acidentes, anoFiltro],
  );

  // Anos disponíveis (com base nos registros + ano atual)
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    acidentes.forEach(a => set.add(new Date(a.data_acidente).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [acidentes]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-red-600" />
            Acidentes de Trabalho
          </h1>
          <p className="text-sm text-muted-foreground">
            FOR-SEG 09 · Quadro Estatístico · FOR-SEG 10 · Dias sem Acidente — NBR 14280
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHhtOpen(true)} className="gap-2">
            <Calculator className="h-4 w-4" /> Lançar HHT
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              gerarForSeg09({
                ano: new Date().getFullYear(),
                acidentes: acidentes as any,
                hht: hhtRows as any,
              });
              toast.success("FOR-SEG 09 gerado");
            }}
          >
            <FileDown className="h-4 w-4" /> FOR-SEG 09
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              gerarForSeg10({
                empresas: companies as any,
                dias: dias as any,
              });
              toast.success("FOR-SEG 10 gerado");
            }}
          >
            <FileDown className="h-4 w-4" /> FOR-SEG 10
          </Button>
          <Button onClick={() => setNovoOpen(true)} className="gap-2 bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4" /> Registrar acidente
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({acidentes.length})</TabsTrigger>
          <TabsTrigger value="hht">HHT mensal ({hhtRows.length})</TabsTrigger>
        </TabsList>

        {/* ============ PAINEL ============ */}
        <TabsContent value="painel" className="space-y-4 mt-4">
          {/* Filtro de ano */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Ano
            </span>
            <Select value={String(anoFiltro)} onValueChange={(v) => setAnoFiltro(Number(v))}>
              <SelectTrigger className="w-[110px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Placar gigante - estilo Toyota */}
          <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 text-white border-0 overflow-hidden relative">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }} />
            <CardContent className="p-8 relative">
              <div className="grid md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 text-center md:text-left">
                  <div className="text-sm uppercase tracking-widest text-red-200/80 font-semibold mb-2">
                    Dias sem acidente com afastamento
                  </div>
                  <div className="text-8xl md:text-9xl font-black tracking-tighter leading-none">
                    {placarPrincipal.dias_sem_com_afast ?? "—"}
                  </div>
                  <div className="text-sm text-slate-300 mt-3 flex items-center gap-2 justify-center md:justify-start">
                    <CalendarClock className="h-4 w-4" />
                    {placarPrincipal.ultimo_acidente_com_afast
                      ? `Último: ${formatDateBR(placarPrincipal.ultimo_acidente_com_afast)}`
                      : "Sem registros — bom trabalho!"}
                  </div>
                </div>
                <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                  <Trophy className="h-8 w-8 text-amber-400 mb-2 inline-block" />
                  <div className="text-xs uppercase tracking-wider text-amber-200/80 font-semibold">
                    Recorde a bater
                  </div>
                  <div className="text-5xl font-bold text-amber-300 mt-1">
                    {placarPrincipal.recorde_com_afast}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">dias</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Acidentes (ano)" value={kpis.totalAno} color="red" />
            <KpiCard icon={<Clock className="h-5 w-5" />} label="No mês" value={kpis.totalMes} color="amber" />
            <KpiCard icon={<TrendingDown className="h-5 w-5" />} label="C/ afast. (ano)" value={kpis.comAfastAno} color="red" />
            <KpiCard icon={<CalendarClock className="h-5 w-5" />} label="Dias perdidos" value={kpis.diasPerdidosAno} color="slate" />
            <KpiCard icon={<Activity className="h-5 w-5" />} label="Taxa Frequência" value={kpis.tf} color="indigo" hint="× 10⁶ HHT" />
            <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Taxa Gravidade" value={kpis.tg} color="purple" hint="× 10⁶ HHT" />
          </div>

          {/* Evolução mensal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução mensal — {anoFiltro}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={serieMensal}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Acidentes" fill="#f59e0b" radius={[4,4,0,0]} />
                  <Bar yAxisId="left" dataKey="Com Afast." fill="#ef4444" radius={[4,4,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="TF" stroke="#6366f1" strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Corpo humano (esq) + Total por tipo (dir) */}
          <div className="grid lg:grid-cols-2 gap-4">
            <CorpoHumanoAcidentes acidentes={acidentesAno} />
            <TotalPorTipoCard acidentes={acidentesAno} />
          </div>
        </TabsContent>

        {/* ============ HISTÓRICO ============ */}
        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Vítima</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Dias perd.</TableHead>
                    <TableHead>Parte atingida</TableHead>
                    <TableHead>CAT</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acidentes.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum acidente registrado.</TableCell></TableRow>
                  ) : acidentes.map(a => {
                    const emp = companies.find(c => c.id === a.company_id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">{formatDateBR(a.data_acidente)}</TableCell>
                        <TableCell className="font-medium">{a.vitima_nome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge className={TIPO_STYLE[a.tipo]} variant="outline">
                            {a.tipo === "FATAL" && <Skull className="h-3 w-3 mr-1" />}
                            {TIPO_LABEL[a.tipo]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{a.dias_perdidos || 0}</TableCell>
                        <TableCell className="text-sm">{a.parte_corpo_atingida || "—"}</TableCell>
                        <TableCell className="text-sm font-mono">{a.numero_cat || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewing(a)} title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(a)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleting(a)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ HHT ============ */}
        <TabsContent value="hht" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">HHT</TableHead>
                    <TableHead className="text-right">Empregados</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hhtRows.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum HHT lançado. Clique em "Lançar HHT" no topo.</TableCell></TableRow>
                  ) : hhtRows.map(h => {
                    const emp = companies.find(c => c.id === h.company_id);
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="whitespace-nowrap font-medium">{MESES[h.mes-1]}/{h.ano}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp?.name || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(h.hht).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right tabular-nums">{h.empregados_medio}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{h.observacoes || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NovoAcidenteDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        companies={companies}
        userId={user?.id}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["acidentes"] });
          qc.invalidateQueries({ queryKey: ["dias-sem-acidente"] });
        }}
      />
      <NovoAcidenteDialog
        open={!!editing}
        onOpenChange={(o: boolean) => { if (!o) setEditing(null); }}
        companies={companies}
        userId={user?.id}
        initial={editing}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["acidentes"] });
          qc.invalidateQueries({ queryKey: ["dias-sem-acidente"] });
        }}
      />
      <VerAcidenteDialog
        acidente={viewing}
        companies={companies}
        onOpenChange={(o: boolean) => { if (!o) setViewing(null); }}
        onEdit={() => { setEditing(viewing); setViewing(null); }}
      />
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acidente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  Esta ação é permanente. O acidente de <strong>{deleting.vitima_nome}</strong> em{" "}
                  <strong>{formatDateBR(deleting.data_acidente)}</strong> será removido.
                  {(deleting.tipo === "COM_AFASTAMENTO" || deleting.tipo === "FATAL") && (
                    <span className="block mt-2 text-amber-700">
                      ⚠ A NC gerada automaticamente <em>não</em> será excluída — remova manualmente em Não Conformidades se necessário.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => { e.preventDefault(); if (deleting) delMut.mutate(deleting.id); }}
              disabled={delMut.isPending}
            >
              {delMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <HhtDialog
        open={hhtOpen}
        onOpenChange={setHhtOpen}
        companies={companies}
        userId={user?.id}
        onSaved={() => qc.invalidateQueries({ queryKey: ["hht-mensal"] })}
      />
    </div>
  );
}

// ============================================================
// KPI Card
// ============================================================
function KpiCard({ icon, label, value, color, hint }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; hint?: string;
}) {
  const colorMap: Record<string, string> = {
    red: "from-red-500/10 to-red-500/5 text-red-700 border-red-200",
    amber: "from-amber-500/10 to-amber-500/5 text-amber-700 border-amber-200",
    slate: "from-slate-500/10 to-slate-500/5 text-slate-700 border-slate-200",
    indigo: "from-indigo-500/10 to-indigo-500/5 text-indigo-700 border-indigo-200",
    purple: "from-purple-500/10 to-purple-500/5 text-purple-700 border-purple-200",
  };
  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</div>
          {icon}
        </div>
        <div className="text-3xl font-bold mt-2 tabular-nums">{value}</div>
        {hint && <div className="text-[10px] opacity-60 mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Novo Acidente Dialog
// ============================================================
function NovoAcidenteDialog({ open, onOpenChange, companies, userId, onSaved, initial }: any) {
  const defaults = {
    data_acidente: new Date().toISOString().slice(0, 10),
    hora_acidente: "",
    turno: "",
    company_id: "",
    employee_id: "",
    vitima_nome: "",
    vitima_matricula: "",
    vitima_cargo: "",
    vitima_setor: "",
    tipo: "SEM_AFASTAMENTO",
    dias_perdidos: 0,
    dias_debitados: 0,
    numero_cat: "",
    local_acidente: "",
    descricao: "",
    agente_causador: "",
    parte_corpo_atingida: "",
    natureza_lesao: "",
    cid: "",
    causa_imediata: "",
    causa_basica: "",
    testemunhas: "",
    data_retorno: "",
    evidencias_urls: [] as string[],
    // ===== Campos CAT / eSocial S-2210 =====
    tipo_cat: "INICIAL",
    iniciativa_cat: "EMPREGADOR",
    cat_data_emissao: "",
    houve_afastamento: false,
    houve_internacao: false,
    houve_obito: false,
    data_obito: "",
    ultima_refeicao_hora: "",
    registro_policial: false,
    numero_bo: "",
    lateralidade: "NAO_APLICA",
    situacao_geradora: "",
    duracao_tratamento_dias: 0,
    atestado_data: "",
    atestado_medico_nome: "",
    atestado_medico_crm: "",
    atestado_medico_uf: "",
    local_tipo: "ESTAB_EMPREGADOR",
    local_cep: "",
    local_municipio: "",
    local_uf: "",
    // ===== Snapshot do acidentado (CAT oficial) =====
    vitima_nome_mae: "",
    vitima_data_nascimento: "",
    vitima_sexo: "",
    vitima_estado_civil: "",
    vitima_grau_instrucao: "",
    vitima_remuneracao: "",
    vitima_ctps: "",
    vitima_rg: "",
    vitima_pis: "",
    vitima_telefone: "",
    vitima_cbo: "",
    vitima_aposentado: false,
    vitima_area: "URBANA",
    vitima_filiacao: "EMPREGADO",
    // ===== Acidente extra =====
    horas_trabalhadas_antes: "",
    cnpj_prestadora: "",
    ultimo_dia_trabalhado: "",
    // ===== Atestado extra =====
    atestado_unidade: "",
    atestado_hora: "",
    atestado_observacoes: "",
    sera_afastado: false,
    // ===== Emitente =====
    emitente_email: "",
  };
  const [form, setForm] = useState<any>(defaults);
  const [uploading, setUploading] = useState(false);
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (open) {
      if (initial) {
        const cleaned: any = { ...defaults };
        Object.keys(defaults).forEach(k => {
          cleaned[k] = initial[k] ?? (defaults as any)[k] ?? "";
        });
        if (cleaned.data_acidente) cleaned.data_acidente = String(cleaned.data_acidente).slice(0, 10);
        if (cleaned.data_retorno) cleaned.data_retorno = String(cleaned.data_retorno).slice(0, 10);
        cleaned.evidencias_urls = Array.isArray(initial.evidencias_urls) ? initial.evidencias_urls : [];
        setForm(cleaned);
      } else {
        setForm(defaults);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  // Funcionários da empresa selecionada
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-by-company", form.company_id],
    queryFn: async () => {
      if (!form.company_id) return [];
      const { data } = await supabase
        .from("employees")
        .select("id, nome, matricula, setor, rg, whatsapp, cep, endereco, bairro, cidade, uf, role_id, roles(name)")
        .eq("company_id", form.company_id)
        .eq("status", "ATIVO")
        .order("nome");
      return data ?? [];
    },
    enabled: !!form.company_id,
  });

  const mut = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!isEdit) payload.created_by = userId;
      const evid = Array.isArray(payload.evidencias_urls) ? payload.evidencias_urls : [];
      // Limpa strings vazias para opcionais
      Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
      payload.evidencias_urls = evid;
      if (!payload.vitima_nome || !payload.descricao || !payload.data_acidente) {
        throw new Error("Preencha vítima, data e descrição.");
      }
      payload.dias_perdidos = Number(payload.dias_perdidos || 0);
      payload.dias_debitados = Number(payload.dias_debitados || 0);
      payload.duracao_tratamento_dias = Number(payload.duracao_tratamento_dias || 0) || null;
      payload.horas_trabalhadas_antes = payload.horas_trabalhadas_antes ? Number(payload.horas_trabalhadas_antes) : null;
      payload.vitima_remuneracao = payload.vitima_remuneracao ? Number(payload.vitima_remuneracao) : null;
      // Coerência mínima da CAT (S-2210):
      // - Tipo FATAL => obriga indicador de óbito e tipo de CAT "OBITO"
      // - Tipo COM_AFASTAMENTO => obriga indicador de afastamento
      if (payload.tipo === "FATAL") {
        payload.houve_obito = true;
        payload.tipo_cat = payload.tipo_cat === "REABERTURA" ? "REABERTURA" : "OBITO";
        if (!payload.data_obito) payload.data_obito = payload.data_acidente;
      }
      if (payload.tipo === "COM_AFASTAMENTO") {
        payload.houve_afastamento = true;
      }
      if (isEdit) {
        const { error } = await supabase.from("acidentes_trabalho").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("acidentes_trabalho").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Acidente atualizado." : "Acidente registrado.");
      onOpenChange(false);
      onSaved?.();
      if (!isEdit) {
        setForm((f: any) => ({ ...f, vitima_nome: "", descricao: "", numero_cat: "", causa_imediata: "", causa_basica: "", evidencias_urls: [] }));
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar."),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  function pickEmployee(id: string) {
    const emp: any = employees.find((e: any) => e.id === id);
    if (!emp) return;
    setForm((f: any) => ({
      ...f,
      employee_id: emp.id,
      vitima_nome: emp.nome || "",
      vitima_matricula: emp.matricula || "",
      vitima_cargo: emp.roles?.name || "",
      vitima_setor: emp.setor || "",
      vitima_rg: emp.rg || f.vitima_rg,
      vitima_telefone: emp.whatsapp || f.vitima_telefone,
    }));
  }

  function clearEmployee() {
    setForm((f: any) => ({
      ...f,
      employee_id: "",
      vitima_nome: "",
      vitima_matricula: "",
      vitima_cargo: "",
      vitima_setor: "",
    }));
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    const atuais: string[] = Array.isArray(form.evidencias_urls) ? form.evidencias_urls : [];
    const restante = 4 - atuais.length;
    if (restante <= 0) {
      toast.error("Máximo de 4 evidências.");
      return;
    }
    setUploading(true);
    try {
      const novas: string[] = [];
      for (const file of Array.from(files).slice(0, restante)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: máx. 10MB.`);
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `acidentes/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from("incident-photos").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw error;
        novas.push(path);
      }
      set("evidencias_urls", [...atuais, ...novas]);
      if (novas.length) toast.success(`${novas.length} evidência(s) enviada(s).`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar.");
    } finally {
      setUploading(false);
    }
  }

  async function removeEvidencia(path: string) {
    await supabase.storage.from("incident-photos").remove([path]).catch(() => {});
    set("evidencias_urls", (form.evidencias_urls || []).filter((p: string) => p !== path));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            {isEdit ? "Editar acidente de trabalho" : "Registrar acidente de trabalho"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Data *">
            <Input type="date" value={form.data_acidente} onChange={e => set("data_acidente", e.target.value)} />
          </Field>
          <Field label="Hora">
            <Input type="time" value={form.hora_acidente} onChange={e => set("hora_acidente", e.target.value)} />
          </Field>
          <Field label="Turno">
            <Select value={form.turno || undefined} onValueChange={v => set("turno", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MANHA">Manhã</SelectItem>
                <SelectItem value="TARDE">Tarde</SelectItem>
                <SelectItem value="NOITE">Noite</SelectItem>
                <SelectItem value="MADRUGADA">Madrugada</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Empresa">
            <Select value={form.company_id || undefined} onValueChange={v => set("company_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="border-t pt-3 mt-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5" /> Vítima
          </div>

          {form.company_id && (
            <div className="mb-3 p-3 rounded-md bg-slate-50 border border-slate-200">
              <Label className="text-xs font-medium">Selecionar funcionário da empresa</Label>
              <div className="flex gap-2 mt-1">
                <Select value={form.employee_id || undefined} onValueChange={pickEmployee}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={employees.length ? `Escolha entre ${employees.length} funcionário(s)…` : "Nenhum funcionário ativo nesta empresa"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                        {e.matricula ? ` · ${e.matricula}` : ""}
                        {e.roles?.name ? ` · ${e.roles.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.employee_id && (
                  <Button type="button" variant="outline" size="sm" onClick={clearEmployee} className="gap-1">
                    <X className="h-3.5 w-3.5" /> Trocar
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Ao selecionar, os campos abaixo são preenchidos. Use "Trocar" se errou a pessoa, ou edite manualmente.
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Nome *"><Input value={form.vitima_nome} onChange={e => set("vitima_nome", e.target.value)} /></Field>
            <Field label="Matrícula"><Input value={form.vitima_matricula} onChange={e => set("vitima_matricula", e.target.value)} /></Field>
            <Field label="Cargo"><Input value={form.vitima_cargo} onChange={e => set("vitima_cargo", e.target.value)} /></Field>
            <Field label="Setor"><Input value={form.vitima_setor} onChange={e => set("vitima_setor", e.target.value)} /></Field>
          </div>

          <div className="mt-3 pt-3 border-t border-dashed">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">Dados pessoais (CAT)</div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Nome da mãe"><Input value={form.vitima_nome_mae} onChange={e => set("vitima_nome_mae", e.target.value)} /></Field>
              <Field label="Data de nascimento"><Input type="date" value={form.vitima_data_nascimento} onChange={e => set("vitima_data_nascimento", e.target.value)} /></Field>
              <Field label="Sexo">
                <Select value={form.vitima_sexo || undefined} onValueChange={v => set("vitima_sexo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estado civil">
                <Select value={form.vitima_estado_civil || undefined} onValueChange={v => set("vitima_estado_civil", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOLTEIRO">Solteiro(a)</SelectItem>
                    <SelectItem value="CASADO">Casado(a)</SelectItem>
                    <SelectItem value="DIVORCIADO">Divorciado(a)</SelectItem>
                    <SelectItem value="VIUVO">Viúvo(a)</SelectItem>
                    <SelectItem value="UNIAO_ESTAVEL">União estável</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Grau de instrução">
                <Select value={form.vitima_grau_instrucao || undefined} onValueChange={v => set("vitima_grau_instrucao", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANALFABETO">Analfabeto</SelectItem>
                    <SelectItem value="FUND_INC">Fundamental incompleto</SelectItem>
                    <SelectItem value="FUND_COMP">Fundamental completo</SelectItem>
                    <SelectItem value="MEDIO_INC">Médio incompleto</SelectItem>
                    <SelectItem value="MEDIO_COMP">Médio completo</SelectItem>
                    <SelectItem value="SUPERIOR_INC">Superior incompleto</SelectItem>
                    <SelectItem value="SUPERIOR_COMP">Superior completo</SelectItem>
                    <SelectItem value="POS">Pós-graduação</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Remuneração mensal (R$)"><Input type="number" step="0.01" min={0} value={form.vitima_remuneracao} onChange={e => set("vitima_remuneracao", e.target.value)} /></Field>
              <Field label="CTPS (nº/série/UF)"><Input value={form.vitima_ctps} onChange={e => set("vitima_ctps", e.target.value)} placeholder="123456 / 001 / AM" /></Field>
              <Field label="RG"><Input value={form.vitima_rg} onChange={e => set("vitima_rg", e.target.value)} /></Field>
              <Field label="PIS / PASEP / NIT"><Input value={form.vitima_pis} onChange={e => set("vitima_pis", e.target.value)} /></Field>
              <Field label="Telefone"><Input value={form.vitima_telefone} onChange={e => set("vitima_telefone", e.target.value)} placeholder="(00) 00000-0000" /></Field>
              <Field label="CBO"><Input value={form.vitima_cbo} onChange={e => set("vitima_cbo", e.target.value)} placeholder="Ex.: 7152-10" /></Field>
              <Field label="Filiação previdenciária">
                <Select value={form.vitima_filiacao || undefined} onValueChange={v => set("vitima_filiacao", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPREGADO">Empregado</SelectItem>
                    <SelectItem value="TRAB_AVULSO">Trabalhador avulso</SelectItem>
                    <SelectItem value="SEGURADO_ESPECIAL">Segurado especial</SelectItem>
                    <SelectItem value="MEDICO_RESIDENTE">Médico residente</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Área">
                <Select value={form.vitima_area || undefined} onValueChange={v => set("vitima_area", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="URBANA">Urbana</SelectItem>
                    <SelectItem value="RURAL">Rural</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Aposentado?">
                <div className="flex items-center gap-2 h-9">
                  <input id="apos-check" type="checkbox" checked={!!form.vitima_aposentado} onChange={e => set("vitima_aposentado", e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="apos-check" className="text-sm font-normal cursor-pointer">Sim</Label>
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="border-t pt-3 mt-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Classificação</div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Tipo *">
              <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEM_AFASTAMENTO">Sem afastamento</SelectItem>
                  <SelectItem value="COM_AFASTAMENTO">Com afastamento</SelectItem>
                  <SelectItem value="TRAJETO">Trajeto</SelectItem>
                  <SelectItem value="FATAL">Fatal</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nº CAT"><Input value={form.numero_cat} onChange={e => set("numero_cat", e.target.value)} placeholder="Ex.: 2026.000123" /></Field>
            <Field label="Dias perdidos"><Input type="number" min={0} value={form.dias_perdidos} onChange={e => set("dias_perdidos", e.target.value)} /></Field>
            <Field label="Dias debitados (NBR 14280)"><Input type="number" min={0} value={form.dias_debitados} onChange={e => set("dias_debitados", e.target.value)} /></Field>
            <Field label="Parte do corpo atingida">
              <Select value={form.parte_corpo_atingida || undefined} onValueChange={v => set("parte_corpo_atingida", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PARTES_CORPO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Natureza da lesão"><Input value={form.natureza_lesao} onChange={e => set("natureza_lesao", e.target.value)} placeholder="Contusão, fratura, corte..." /></Field>
            <Field label="Agente causador"><Input value={form.agente_causador} onChange={e => set("agente_causador", e.target.value)} placeholder="Ferramenta, queda, produto químico..." /></Field>
            <Field label="CID"><Input value={form.cid} onChange={e => set("cid", e.target.value)} placeholder="Ex.: S62.5" /></Field>
          </div>
        </div>

        <div className="border-t pt-3 mt-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Ocorrência e investigação</div>
          <div className="grid gap-3">
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Tipo do local (CAT)">
                <Select value={form.local_tipo || undefined} onValueChange={v => set("local_tipo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESTAB_EMPREGADOR">Estabelecimento do empregador</SelectItem>
                    <SelectItem value="ESTAB_TERCEIRO">Estabelecimento de terceiros</SelectItem>
                    <SelectItem value="VIA_PUBLICA">Via pública</SelectItem>
                    <SelectItem value="AREA_RURAL">Área rural</SelectItem>
                    <SelectItem value="OUTROS">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Local do acidente (descrição)">
                <Input value={form.local_acidente} onChange={e => set("local_acidente", e.target.value)} placeholder="Ex.: dique seco nº 2 — costado de bombordo" />
              </Field>
              <Field label="CEP do local">
                <Input value={form.local_cep} onChange={e => set("local_cep", e.target.value)} placeholder="00000-000" />
              </Field>
              <Field label="Município">
                <Input value={form.local_municipio} onChange={e => set("local_municipio", e.target.value)} placeholder="Ex.: Manaus" />
              </Field>
              <Field label="UF">
                <Input value={form.local_uf} onChange={e => set("local_uf", e.target.value)} maxLength={2} placeholder="AM" />
              </Field>
              <Field label="Última refeição (hora)">
                <Input type="time" value={form.ultima_refeicao_hora} onChange={e => set("ultima_refeicao_hora", e.target.value)} />
              </Field>
              <Field label="Horas trabalhadas antes do acidente">
                <Input type="number" step="0.5" min={0} max={24} value={form.horas_trabalhadas_antes} onChange={e => set("horas_trabalhadas_antes", e.target.value)} placeholder="Ex.: 4.5" />
              </Field>
              <Field label="Último dia trabalhado">
                <Input type="date" value={form.ultimo_dia_trabalhado} onChange={e => set("ultimo_dia_trabalhado", e.target.value)} />
              </Field>
              {form.local_tipo === "ESTAB_TERCEIRO" && (
                <Field label="CNPJ da prestadora (local de terceiros)">
                  <Input value={form.cnpj_prestadora} onChange={e => set("cnpj_prestadora", e.target.value)} placeholder="00.000.000/0000-00" />
                </Field>
              )}
            </div>
            <Field label="Descrição do acidente *">
              <Textarea rows={3} value={form.descricao} onChange={e => set("descricao", e.target.value)} />
            </Field>
            <Field label="Situação geradora (relato técnico para a CAT)">
              <Textarea rows={2} value={form.situacao_geradora} onChange={e => set("situacao_geradora", e.target.value)} placeholder="O que o trabalhador estava fazendo no momento e o que deu errado." />
            </Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Causa imediata"><Textarea rows={2} value={form.causa_imediata} onChange={e => set("causa_imediata", e.target.value)} /></Field>
              <Field label="Causa básica"><Textarea rows={2} value={form.causa_basica} onChange={e => set("causa_basica", e.target.value)} /></Field>
            </div>
            <Field label="Testemunhas"><Input value={form.testemunhas} onChange={e => set("testemunhas", e.target.value)} /></Field>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Data de retorno (se houver)">
                <Input type="date" value={form.data_retorno} onChange={e => set("data_retorno", e.target.value)} />
              </Field>
              <Field label="Registro policial?">
                <div className="flex items-center gap-2 h-9">
                  <input id="bo-check" type="checkbox" checked={!!form.registro_policial} onChange={e => set("registro_policial", e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="bo-check" className="text-sm font-normal cursor-pointer">Houve B.O.</Label>
                </div>
              </Field>
              <Field label="Nº do Boletim de Ocorrência">
                <Input value={form.numero_bo} onChange={e => set("numero_bo", e.target.value)} disabled={!form.registro_policial} placeholder="Ex.: 2026/123456" />
              </Field>
            </div>
          </div>
        </div>

        {/* ============= CAT / eSocial S-2210 ============= */}
        <div className="border-t pt-3 mt-1">
          <div className="text-xs font-semibold text-red-700 uppercase mb-2 flex items-center gap-2">
            <FileDown className="h-3.5 w-3.5" /> CAT — Comunicação de Acidente de Trabalho (eSocial S-2210)
          </div>
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 mb-3 text-[11px] text-amber-900">
            A CAT deve ser emitida até o <strong>1º dia útil seguinte</strong> ao acidente (ou imediatamente em caso de óbito), mesmo sem afastamento — Lei 8.213/91 art. 22. Estes campos alimentam o evento <strong>S-2210</strong>.
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Tipo de CAT *">
              <Select value={form.tipo_cat} onValueChange={v => set("tipo_cat", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INICIAL">Inicial (1ª comunicação)</SelectItem>
                  <SelectItem value="REABERTURA">Reabertura (reinício do tratamento/afastamento)</SelectItem>
                  <SelectItem value="OBITO">Comunicação de óbito</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Iniciativa da CAT">
              <Select value={form.iniciativa_cat} onValueChange={v => set("iniciativa_cat", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPREGADOR">Empregador</SelectItem>
                  <SelectItem value="SEGURADO">Próprio acidentado/dependente</SelectItem>
                  <SelectItem value="SINDICATO">Sindicato</SelectItem>
                  <SelectItem value="MEDICO">Médico assistente</SelectItem>
                  <SelectItem value="AUTORIDADE_PUBLICA">Autoridade pública</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data de emissão da CAT">
              <Input type="date" value={form.cat_data_emissao} onChange={e => set("cat_data_emissao", e.target.value)} />
            </Field>

            <Field label="Nº da CAT (gerado pelo INSS)">
              <Input value={form.numero_cat} onChange={e => set("numero_cat", e.target.value)} placeholder="Ex.: 2026.000123" />
            </Field>
            <Field label="Lateralidade da lesão">
              <Select value={form.lateralidade} onValueChange={v => set("lateralidade", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_APLICA">Não se aplica</SelectItem>
                  <SelectItem value="ESQUERDA">Esquerda</SelectItem>
                  <SelectItem value="DIREITA">Direita</SelectItem>
                  <SelectItem value="AMBAS">Ambas</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Duração estimada do tratamento (dias)">
              <Input type="number" min={0} value={form.duracao_tratamento_dias} onChange={e => set("duracao_tratamento_dias", e.target.value)} />
            </Field>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-3">
            <Field label="Houve afastamento?">
              <div className="flex items-center gap-2 h-9">
                <input id="afast-check" type="checkbox" checked={!!form.houve_afastamento} onChange={e => set("houve_afastamento", e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="afast-check" className="text-sm font-normal cursor-pointer">Sim, gerou afastamento</Label>
              </div>
            </Field>
            <Field label="Houve internação?">
              <div className="flex items-center gap-2 h-9">
                <input id="intern-check" type="checkbox" checked={!!form.houve_internacao} onChange={e => set("houve_internacao", e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="intern-check" className="text-sm font-normal cursor-pointer">Sim, ficou internado</Label>
              </div>
            </Field>
            <Field label="Houve óbito?">
              <div className="flex items-center gap-2 h-9">
                <input id="obito-check" type="checkbox" checked={!!form.houve_obito} onChange={e => set("houve_obito", e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="obito-check" className="text-sm font-normal cursor-pointer">Sim, fatal</Label>
              </div>
            </Field>
            {form.houve_obito && (
              <Field label="Data do óbito">
                <Input type="date" value={form.data_obito} onChange={e => set("data_obito", e.target.value)} />
              </Field>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-dashed">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">Atestado médico</div>
            <div className="grid md:grid-cols-4 gap-3">
              <Field label="Data do atendimento">
                <Input type="date" value={form.atestado_data} onChange={e => set("atestado_data", e.target.value)} />
              </Field>
              <Field label="Hora do atendimento">
                <Input type="time" value={form.atestado_hora} onChange={e => set("atestado_hora", e.target.value)} />
              </Field>
              <Field label="Unidade de atendimento">
                <Input value={form.atestado_unidade} onChange={e => set("atestado_unidade", e.target.value)} placeholder="Hospital / pronto-socorro" />
              </Field>
              <Field label="Será afastado?">
                <div className="flex items-center gap-2 h-9">
                  <input id="afast2-check" type="checkbox" checked={!!form.sera_afastado} onChange={e => set("sera_afastado", e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="afast2-check" className="text-sm font-normal cursor-pointer">Sim, há indicação</Label>
                </div>
              </Field>
              <Field label="Médico responsável">
                <Input value={form.atestado_medico_nome} onChange={e => set("atestado_medico_nome", e.target.value)} placeholder="Dr(a). ..." />
              </Field>
              <Field label="CRM">
                <Input value={form.atestado_medico_crm} onChange={e => set("atestado_medico_crm", e.target.value)} placeholder="Ex.: 12345" />
              </Field>
              <Field label="UF do CRM">
                <Input value={form.atestado_medico_uf} onChange={e => set("atestado_medico_uf", e.target.value)} maxLength={2} placeholder="AM" />
              </Field>
              <Field label="E-mail do emitente">
                <Input type="email" value={form.emitente_email} onChange={e => set("emitente_email", e.target.value)} placeholder="sesmt@empresa.com" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Observações médicas">
                <Textarea rows={2} value={form.atestado_observacoes} onChange={e => set("atestado_observacoes", e.target.value)} placeholder="Diagnóstico, conduta, recomendações..." />
              </Field>
            </div>
          </div>
        </div>

        <div className="border-t pt-3 mt-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5" /> Evidências fotográficas
            <span className="font-normal normal-case text-[11px] text-muted-foreground">
              ({(form.evidencias_urls || []).length}/4)
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {(form.evidencias_urls || []).map((p: string) => (
              <EvidenciaThumb key={p} path={p} onRemove={() => removeEvidencia(p)} />
            ))}
            {(form.evidencias_urls || []).length < 4 && (
              <label className={`w-24 h-24 border-2 border-dashed rounded flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-slate-50 hover:border-slate-400 transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="h-5 w-5 mb-1" />
                {uploading ? "Enviando..." : "Adicionar"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
                />
              </label>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Até 4 fotos (10MB cada). Clique em uma evidência para abrir em tamanho real.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : (isEdit ? "Salvar alterações" : "Registrar acidente")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Ver Acidente Dialog (read-only)
// ============================================================
function VerAcidenteDialog({ acidente, companies, onOpenChange, onEdit }: any) {
  if (!acidente) return null;
  const emp = companies.find((c: any) => c.id === acidente.company_id);
  const Row = ({ label, value }: { label: string; value: any }) => (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-dashed last:border-0">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="col-span-2 text-sm">{value ?? "—"}</div>
    </div>
  );
  return (
    <Dialog open={!!acidente} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            Acidente — {acidente.vitima_nome}
            <Badge className={TIPO_STYLE[acidente.tipo]} variant="outline">
              {TIPO_LABEL[acidente.tipo]}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Row label="Data" value={formatDateBR(acidente.data_acidente)} />
          <Row label="Hora" value={acidente.hora_acidente} />
          <Row label="Turno" value={acidente.turno} />
          <Row label="Empresa" value={emp?.name} />
          <Row label="Matrícula" value={acidente.vitima_matricula} />
          <Row label="Cargo" value={acidente.vitima_cargo} />
          <Row label="Setor" value={acidente.vitima_setor} />
          <Row label="Nº CAT" value={acidente.numero_cat} />
          <Row label="Dias perdidos" value={acidente.dias_perdidos} />
          <Row label="Dias debitados" value={acidente.dias_debitados} />
          <Row label="Parte atingida" value={acidente.parte_corpo_atingida} />
          <Row label="Natureza lesão" value={acidente.natureza_lesao} />
          <Row label="Agente causador" value={acidente.agente_causador} />
          <Row label="CID" value={acidente.cid} />
          <Row label="Local" value={acidente.local_acidente} />
          <Row label="Descrição" value={<span className="whitespace-pre-wrap">{acidente.descricao}</span>} />
          <Row label="Causa imediata" value={<span className="whitespace-pre-wrap">{acidente.causa_imediata}</span>} />
          <Row label="Causa básica" value={<span className="whitespace-pre-wrap">{acidente.causa_basica}</span>} />
          <Row label="Testemunhas" value={acidente.testemunhas} />
          <Row label="Data retorno" value={acidente.data_retorno ? formatDateBR(acidente.data_retorno) : null} />
        </div>
        {Array.isArray(acidente.evidencias_urls) && acidente.evidencias_urls.length > 0 && (
          <div className="border-t pt-3 mt-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5" />
              Evidências ({acidente.evidencias_urls.length})
            </div>
            <div className="flex flex-wrap gap-3">
              {acidente.evidencias_urls.map((p: string) => (
                <EvidenciaThumb key={p} path={p} />
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={onEdit} className="gap-2"><Pencil className="h-4 w-4" /> Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// HHT Dialog
// ============================================================
function HhtDialog({ open, onOpenChange, companies, userId, onSaved }: any) {
  const now = new Date();
  const [form, setForm] = useState<any>({
    company_id: "",
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
    hht: "",
    empregados_medio: "",
    observacoes: "",
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.company_id) throw new Error("Selecione a empresa.");
      if (!form.hht || Number(form.hht) <= 0) throw new Error("Informe o HHT.");
      const payload = {
        company_id: form.company_id,
        ano: Number(form.ano),
        mes: Number(form.mes),
        hht: Number(form.hht),
        empregados_medio: Number(form.empregados_medio || 0),
        observacoes: form.observacoes || null,
        created_by: userId,
      };
      const { error } = await supabase
        .from("hht_mensal")
        .upsert(payload, { onConflict: "company_id,ano,mes" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("HHT lançado.");
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar."),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Lançar HHT mensal
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Horas Homem Trabalhadas (HHT) — base da Taxa de Frequência (NBR 14280). Vem da folha do RH.
        </p>
        <div className="space-y-3">
          <Field label="Empresa *">
            <Select value={form.company_id || undefined} onValueChange={v => set("company_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mês *">
              <Select value={String(form.mes)} onValueChange={v => set("mes", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ano *"><Input type="number" value={form.ano} onChange={e => set("ano", e.target.value)} /></Field>
          </div>
          <Field label="HHT (horas) *">
            <Input type="number" step="0.01" value={form.hht} onChange={e => set("hht", e.target.value)} placeholder="Ex.: 35200" />
          </Field>
          <Field label="Nº médio de empregados">
            <Input type="number" value={form.empregados_medio} onChange={e => set("empregados_medio", e.target.value)} />
          </Field>
          <Field label="Observações">
            <Textarea rows={2} value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar HHT"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

// ============================================================
// Evidência (thumbnail com signed URL)
// ============================================================
function EvidenciaThumb({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("incident-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [path]);

  return (
    <div className="relative group">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
          <img
            src={url}
            alt="Evidência"
            className="w-24 h-24 object-cover rounded border border-slate-200 hover:border-slate-400 transition"
          />
        </a>
      ) : (
        <div className="w-24 h-24 bg-muted animate-pulse rounded border" />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition"
          title="Remover"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// Total por tipo — donuts estilo placar
// ============================================================
function TotalPorTipoCard({ acidentes }: { acidentes: any[] }) {
  const total = acidentes.length;
  const buckets = [
    { key: "SEM_AFASTAMENTO", label: "Sem afast." },
    { key: "COM_AFASTAMENTO", label: "Com afast." },
    { key: "TRAJETO",         label: "Trajeto" },
    { key: "FATAL",           label: "Fatal" },
  ].map(b => {
    const qtd = acidentes.filter(a => a.tipo === b.key).length;
    const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
    return { ...b, qtd, pct };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Total de Acidentes por Tipo</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhum acidente registrado.
          </div>
        ) : (
          <div className="space-y-3">
            {buckets.map(b => {
              const color = TIPO_COLOR[b.key];
              const data = [
                { name: "v", value: b.qtd },
                { name: "r", value: Math.max(total - b.qtd, 0.0001) },
              ];
              return (
                <div key={b.key} className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-50 transition">
                  <div className="text-2xl w-8 text-center">{TIPO_ICONS[b.key]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{b.label}</div>
                    <div className="text-3xl font-black tabular-nums leading-none mt-0.5" style={{ color }}>
                      {b.qtd}
                    </div>
                  </div>
                  <div className="relative w-[78px] h-[78px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          dataKey="value"
                          innerRadius={26}
                          outerRadius={36}
                          startAngle={90}
                          endAngle={-270}
                          stroke="none"
                        >
                          <Cell fill={color} />
                          <Cell fill="#e2e8f0" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                      style={{ color }}
                    >
                      {b.pct}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}