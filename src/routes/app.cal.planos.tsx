import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListChecks, Search, AlertTriangle, Clock, CheckCircle2, CircleDashed, Repeat, ArrowRight, ChevronLeft, ChevronRight, Upload } from "lucide-react";

export const Route = createFileRoute("/app/cal/planos")({
  component: PlanosCalPage,
  head: () => ({ meta: [
    { title: "Planos de Ação (CAL) · SIGMO" },
    { name: "description", content: "Painel principal de Planos de Ação vinculados aos Requisitos Legais (CAL)." },
  ] }),
});

type PlanoRow = {
  id: string;
  requisito_id: string;
  codigo_pa: string | null;
  texto: string | null;
  tipo: string | null;
  status: string | null;
  data_prevista: string | null;
  data_conclusao: string | null;
  recorrente: boolean | null;
  usuario_execucao: string | null;
  usuario_gestao: string | null;
  cal_requisitos: {
    id: string;
    numero_cal: string | null;
    norma: string | null;
    ementa: string | null;
    area: string | null;
    area_incidencia: string | null;
    temas: string[] | null;
    criticidade: string | null;
  } | null;
};

type VencStatus = "concluido" | "vencido" | "vencendo" | "em_dia" | "sem_prazo";

function calcVenc(p: PlanoRow): { key: VencStatus; label: string; dias: number | null } {
  if (p.data_conclusao) return { key: "concluido", label: "Concluído", dias: null };
  if (!p.data_prevista) return { key: "sem_prazo", label: "Sem prazo", dias: null };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(p.data_prevista + "T00:00:00");
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return { key: "vencido", label: `Vencido ${-dias}d`, dias };
  if (dias <= 30) return { key: "vencendo", label: `Vence em ${dias}d`, dias };
  return { key: "em_dia", label: `Em dia`, dias };
}

const VENC_COLOR: Record<VencStatus, string> = {
  concluido: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  vencido: "bg-red-500/20 text-red-300 border-red-500/50",
  vencendo: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  em_dia: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  sem_prazo: "bg-muted/40 text-muted-foreground border-border",
};

const PAGE_SIZE = 50;

function PlanosCalPage() {
  const [busca, setBusca] = useState("");
  const [vencSel, setVencSel] = useState<"todos" | VencStatus>("todos");
  const [statusSel, setStatusSel] = useState<string>("todos");
  const [areaSel, setAreaSel] = useState<string>("todas");
  const [respSel, setRespSel] = useState<string>("todos");
  const [gestSel, setGestSel] = useState<string>("todos");
  const [tipoSel, setTipoSel] = useState<string>("todos");
  const [pagina, setPagina] = useState(1);

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ["cal_planos_acao_all"],
    queryFn: async () => {
      const PAGE = 1000;
      let from = 0;
      const all: PlanoRow[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("cal_planos_acao")
          .select("id, requisito_id, codigo_pa, texto, tipo, status, data_prevista, data_conclusao, recorrente, usuario_execucao, usuario_gestao, cal_requisitos(id, numero_cal, norma, ementa, area, area_incidencia, temas, criticidade)")
          .order("data_prevista", { ascending: true, nullsFirst: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as PlanoRow[];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  const opcoes = useMemo(() => {
    const areas = new Set<string>();
    const resps = new Set<string>();
    const gests = new Set<string>();
    const tipos = new Set<string>();
    const statuses = new Set<string>();
    for (const p of planos) {
      const a = p.cal_requisitos?.area_incidencia ?? p.cal_requisitos?.area;
      if (a) String(a).split(/[;,]/).map((s) => s.trim()).filter(Boolean).forEach((x) => areas.add(x));
      if (p.usuario_execucao) resps.add(p.usuario_execucao);
      if (p.usuario_gestao) gests.add(p.usuario_gestao);
      if (p.tipo) tipos.add(p.tipo);
      if (p.status) statuses.add(p.status);
    }
    return {
      areas: [...areas].sort(),
      resps: [...resps].sort(),
      gests: [...gests].sort(),
      tipos: [...tipos].sort(),
      statuses: [...statuses].sort(),
    };
  }, [planos]);

  const filtrados = useMemo(() => {
    const needle = busca.trim().toLowerCase();
    return planos.filter((p) => {
      const venc = calcVenc(p).key;
      if (vencSel !== "todos" && venc !== vencSel) return false;
      if (statusSel !== "todos" && p.status !== statusSel) return false;
      if (tipoSel !== "todos" && p.tipo !== tipoSel) return false;
      if (respSel !== "todos" && p.usuario_execucao !== respSel) return false;
      if (gestSel !== "todos" && p.usuario_gestao !== gestSel) return false;
      if (areaSel !== "todas") {
        const a = String(p.cal_requisitos?.area_incidencia ?? p.cal_requisitos?.area ?? "").toLowerCase();
        if (!a.includes(areaSel.toLowerCase())) return false;
      }
      if (needle) {
        const hay = [
          p.codigo_pa, p.texto, p.tipo, p.status, p.usuario_execucao, p.usuario_gestao,
          p.cal_requisitos?.numero_cal, p.cal_requisitos?.norma, p.cal_requisitos?.ementa,
          p.cal_requisitos?.area, p.cal_requisitos?.area_incidencia,
          (p.cal_requisitos?.temas ?? []).join(" "),
        ].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [planos, busca, vencSel, statusSel, tipoSel, respSel, gestSel, areaSel]);

  const kpi = useMemo(() => {
    let vencidos = 0, vencendo = 0, emDia = 0, concluidos = 0, semPrazo = 0, recorrentes = 0;
    for (const p of planos) {
      const v = calcVenc(p).key;
      if (v === "vencido") vencidos++;
      else if (v === "vencendo") vencendo++;
      else if (v === "em_dia") emDia++;
      else if (v === "concluido") concluidos++;
      else semPrazo++;
      if (p.recorrente) recorrentes++;
    }
    return { total: planos.length, vencidos, vencendo, emDia, concluidos, semPrazo, recorrentes };
  }, [planos]);

  const totalPag = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pagAtual = Math.min(pagina, totalPag);
  const pageRows = filtrados.slice((pagAtual - 1) * PAGE_SIZE, pagAtual * PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ListChecks className="h-7 w-7 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold">Planos de Ação (CAL)</h1>
            <p className="text-sm text-muted-foreground">Painel principal — todos os PAs vinculados aos requisitos legais</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/app/cal" search={{ import: "1" }}>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"><Upload className="h-3.5 w-3.5 mr-1.5" /> Importar planilha</Button>
          </Link>
          <Link to="/app/cal"><Button variant="outline" size="sm">Ver Requisitos <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Button></Link>
        </div>
      </div>

      {/* KPIs — clicáveis pra filtrar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <Kpi label="Total" value={kpi.total} icon={<ListChecks className="h-4 w-4" />} active={vencSel === "todos"} onClick={() => { setVencSel("todos"); setPagina(1); }} tone="slate" />
        <Kpi label="Vencidos" value={kpi.vencidos} icon={<AlertTriangle className="h-4 w-4" />} active={vencSel === "vencido"} onClick={() => { setVencSel("vencido"); setPagina(1); }} tone="red" />
        <Kpi label="Vencendo (30d)" value={kpi.vencendo} icon={<Clock className="h-4 w-4" />} active={vencSel === "vencendo"} onClick={() => { setVencSel("vencendo"); setPagina(1); }} tone="amber" />
        <Kpi label="Em dia" value={kpi.emDia} icon={<CheckCircle2 className="h-4 w-4" />} active={vencSel === "em_dia"} onClick={() => { setVencSel("em_dia"); setPagina(1); }} tone="sky" />
        <Kpi label="Concluídos" value={kpi.concluidos} icon={<CheckCircle2 className="h-4 w-4" />} active={vencSel === "concluido"} onClick={() => { setVencSel("concluido"); setPagina(1); }} tone="emerald" />
        <Kpi label="Sem prazo" value={kpi.semPrazo} icon={<CircleDashed className="h-4 w-4" />} active={vencSel === "sem_prazo"} onClick={() => { setVencSel("sem_prazo"); setPagina(1); }} tone="muted" />
        <Kpi label="Recorrentes" value={kpi.recorrentes} icon={<Repeat className="h-4 w-4" />} tone="violet" />
      </div>

      {/* Filtros */}
      <Card className="p-3 md:p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código PA, descrição, CAL, norma, responsável, tema..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} className="pl-9" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Sel value={statusSel} onChange={(v) => { setStatusSel(v); setPagina(1); }} placeholder="Status PA" allLabel="Todos os status" options={opcoes.statuses} />
          <Sel value={tipoSel} onChange={(v) => { setTipoSel(v); setPagina(1); }} placeholder="Tipo" allLabel="Todos os tipos" options={opcoes.tipos} />
          <Sel value={areaSel} onChange={(v) => { setAreaSel(v); setPagina(1); }} placeholder="Área" allLabel="Todas as áreas" options={opcoes.areas} allValue="todas" />
          <Sel value={respSel} onChange={(v) => { setRespSel(v); setPagina(1); }} placeholder="Responsável" allLabel="Todos os responsáveis" options={opcoes.resps} />
          <Sel value={gestSel} onChange={(v) => { setGestSel(v); setPagina(1); }} placeholder="Resp. Gestão" allLabel="Todos os gestores" options={opcoes.gests} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtrados.length} de {planos.length} planos</span>
          {(busca || vencSel !== "todos" || statusSel !== "todos" || tipoSel !== "todos" || areaSel !== "todas" || respSel !== "todos" || gestSel !== "todos") && (
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setBusca(""); setVencSel("todos"); setStatusSel("todos"); setTipoSel("todos"); setAreaSel("todas"); setRespSel("todos"); setGestSel("todos"); setPagina(1); }}>Limpar filtros</Button>
          )}
        </div>
      </Card>

      {/* Tabela */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando planos de ação...</p>
      ) : filtrados.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Nenhum plano de ação encontrado</p>
          <p className="text-sm mt-1">
            {planos.length === 0
              ? "A base de PAs está vazia. Importe uma planilha do Ius Natura contendo a aba de Planos de Ação, ou crie um plano a partir de um requisito."
              : "Nenhum PA corresponde aos filtros atuais."}
          </p>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Código PA</TableHead>
                <TableHead className="w-[120px]">Vencimento</TableHead>
                <TableHead className="w-[90px]">Prazo</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[110px]">Tipo</TableHead>
                <TableHead className="w-[280px]">Descrição</TableHead>
                <TableHead className="w-[160px]">CAL / Norma</TableHead>
                <TableHead className="w-[140px]">Área</TableHead>
                <TableHead className="w-[140px]">Responsável</TableHead>
                <TableHead className="w-[140px]">Resp. Gestão</TableHead>
                <TableHead className="w-[180px]">Tema</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((p) => {
                const v = calcVenc(p);
                const area = p.cal_requisitos?.area_incidencia ?? p.cal_requisitos?.area ?? "—";
                const temas = (p.cal_requisitos?.temas ?? []).slice(0, 3);
                return (
                  <TableRow key={p.id} className="align-top hover:bg-muted/30">
                    <TableCell className="font-mono text-xs py-3">{p.codigo_pa ?? "—"}</TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className={`${VENC_COLOR[v.key]} whitespace-nowrap`}>{v.label}</Badge>
                      {p.recorrente && <div className="text-[10px] text-violet-300 mt-1 flex items-center gap-1"><Repeat className="h-3 w-3" />recorrente</div>}
                    </TableCell>
                    <TableCell className="text-xs py-3">
                      {p.data_prevista ? new Date(p.data_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      {p.data_conclusao && <div className="text-[10px] text-emerald-400">✓ {new Date(p.data_conclusao + "T00:00:00").toLocaleDateString("pt-BR")}</div>}
                    </TableCell>
                    <TableCell className="text-xs py-3">{p.status ?? "—"}</TableCell>
                    <TableCell className="text-xs py-3">{p.tipo ?? "—"}</TableCell>
                    <TableCell className="py-3">
                      <p className="text-sm leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={p.texto ?? ""}>
                        {p.texto ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 text-xs">
                      {p.cal_requisitos ? (
                        <Link to="/app/cal/$id" params={{ id: p.cal_requisitos.id }} className="hover:underline block">
                          <div className="font-semibold">{p.cal_requisitos.norma ?? "—"}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{p.cal_requisitos.numero_cal}</div>
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs py-3 break-words">{area}</TableCell>
                    <TableCell className="text-xs py-3 break-words">{p.usuario_execucao ?? "—"}</TableCell>
                    <TableCell className="text-xs py-3 break-words">{p.usuario_gestao ?? "—"}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {temas.length > 0 ? temas.map((t, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border">{t}</span>
                        )) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paginação */}
      {filtrados.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {pagAtual} de {totalPag} · {filtrados.length} planos filtrados</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={pagAtual === 1} onClick={() => setPagina(pagAtual - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={pagAtual === totalPag} onClick={() => setPagina(pagAtual + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, icon, active, onClick, tone }: {
  label: string; value: number; icon: React.ReactNode; active?: boolean; onClick?: () => void;
  tone: "slate" | "red" | "amber" | "sky" | "emerald" | "muted" | "violet";
}) {
  const tones: Record<string, string> = {
    slate: "border-border",
    red: "border-red-500/40 text-red-300",
    amber: "border-amber-500/40 text-amber-300",
    sky: "border-sky-500/40 text-sky-300",
    emerald: "border-emerald-500/40 text-emerald-300",
    muted: "border-border text-muted-foreground",
    violet: "border-violet-500/40 text-violet-300",
  };
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`text-left p-3 rounded-lg border bg-card transition ${tones[tone]} ${active ? "ring-2 ring-red-500/60" : ""} ${onClick ? "hover:bg-muted/30 cursor-pointer" : ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-80">{icon}{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </Comp>
  );
}

function Sel({ value, onChange, placeholder, allLabel, options, allValue }: {
  value: string; onChange: (v: string) => void; placeholder: string; allLabel: string; options: string[]; allValue?: string;
}) {
  const av = allValue ?? "todos";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={av}>{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
