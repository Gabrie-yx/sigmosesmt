import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Eye, Pencil, Trash2,
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
  LineChart, Line, Legend, PieChart, Pie, Cell,
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
  "Dedos da mão","Quadril","Coxa direita","Coxa esquerda","Joelho direito","Joelho esquerdo",
  "Perna direita","Perna esquerda","Pé direito","Pé esquerdo","Dedos do pé","Múltiplas",
];

function AcidentesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("painel");
  const [novoOpen, setNovoOpen] = useState(false);
  const [hhtOpen, setHhtOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

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
    const anoAtual = now.getFullYear();
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
  }, [acidentes, hhtRows]);

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
    const anoAtual = new Date().getFullYear();
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
  }, [acidentes, hhtRows]);

  const partesCorpoData = useMemo(() => {
    const map = new Map<string, number>();
    acidentes.forEach(a => {
      if (a.parte_corpo_atingida) {
        map.set(a.parte_corpo_atingida, (map.get(a.parte_corpo_atingida) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([parte, qtd]) => ({ parte, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [acidentes]);

  const tipoData = useMemo(() => {
    const map: Record<string, number> = {};
    acidentes.forEach(a => { map[a.tipo] = (map[a.tipo] || 0) + 1; });
    return Object.entries(map).map(([k, v]) => ({ name: TIPO_LABEL[k] || k, value: v, key: k }));
  }, [acidentes]);

  const PIE_COLORS: Record<string, string> = {
    COM_AFASTAMENTO: "#ef4444",
    SEM_AFASTAMENTO: "#f59e0b",
    TRAJETO: "#3b82f6",
    FATAL: "#0f172a",
  };

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

          {/* Gráficos */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Evolução mensal — {new Date().getFullYear()}</CardTitle>
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição por tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={tipoData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {tipoData.map((d, i) => (
                        <Cell key={i} fill={PIE_COLORS[d.key] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <CorpoHumanoAcidentes acidentes={acidentes} />
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
  };
  const [form, setForm] = useState<any>(defaults);
  const isEdit = !!initial?.id;

  useMemo(() => {
    if (open) {
      if (initial) {
        const cleaned: any = { ...defaults };
        Object.keys(defaults).forEach(k => {
          cleaned[k] = initial[k] ?? (defaults as any)[k] ?? "";
        });
        if (cleaned.data_acidente) cleaned.data_acidente = String(cleaned.data_acidente).slice(0, 10);
        if (cleaned.data_retorno) cleaned.data_retorno = String(cleaned.data_retorno).slice(0, 10);
        setForm(cleaned);
      } else {
        setForm(defaults);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!isEdit) payload.created_by = userId;
      // Limpa strings vazias para opcionais
      Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
      if (!payload.vitima_nome || !payload.descricao || !payload.data_acidente) {
        throw new Error("Preencha vítima, data e descrição.");
      }
      payload.dias_perdidos = Number(payload.dias_perdidos || 0);
      payload.dias_debitados = Number(payload.dias_debitados || 0);
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
        setForm((f: any) => ({ ...f, vitima_nome: "", descricao: "", numero_cat: "", causa_imediata: "", causa_basica: "" }));
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar."),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

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
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Vítima</div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Nome *"><Input value={form.vitima_nome} onChange={e => set("vitima_nome", e.target.value)} /></Field>
            <Field label="Matrícula"><Input value={form.vitima_matricula} onChange={e => set("vitima_matricula", e.target.value)} /></Field>
            <Field label="Cargo"><Input value={form.vitima_cargo} onChange={e => set("vitima_cargo", e.target.value)} /></Field>
            <Field label="Setor"><Input value={form.vitima_setor} onChange={e => set("vitima_setor", e.target.value)} /></Field>
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
            <Field label="Local do acidente"><Input value={form.local_acidente} onChange={e => set("local_acidente", e.target.value)} /></Field>
            <Field label="Descrição do acidente *">
              <Textarea rows={3} value={form.descricao} onChange={e => set("descricao", e.target.value)} />
            </Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Causa imediata"><Textarea rows={2} value={form.causa_imediata} onChange={e => set("causa_imediata", e.target.value)} /></Field>
              <Field label="Causa básica"><Textarea rows={2} value={form.causa_basica} onChange={e => set("causa_basica", e.target.value)} /></Field>
            </div>
            <Field label="Testemunhas"><Input value={form.testemunhas} onChange={e => set("testemunhas", e.target.value)} /></Field>
            <Field label="Data de retorno (se houver)">
              <Input type="date" value={form.data_retorno} onChange={e => set("data_retorno", e.target.value)} />
            </Field>
          </div>
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