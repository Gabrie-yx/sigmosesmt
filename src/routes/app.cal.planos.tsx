import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { parseCalPlanoAcaoPlanilha } from "@/lib/cal-parser";
import { ListChecks, Search, AlertTriangle, Clock, CheckCircle2, CircleDashed, Repeat, ArrowRight, ChevronLeft, ChevronRight, Upload, Paperclip, FileText, Trash2, ExternalLink } from "lucide-react";

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
  requisito_legal_texto: string | null;
  area_pa: string | null;
  observacoes: string | null;
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

type EvidenciaPA = {
  id: string;
  arquivo_nome: string | null;
  arquivo_url: string;
  mime: string | null;
  tamanho_bytes: number | null;
  descricao: string | null;
  created_at: string;
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
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [vencSel, setVencSel] = useState<"todos" | VencStatus>("todos");
  const [statusSel, setStatusSel] = useState<string>("todos");
  const [areaSel, setAreaSel] = useState<string>("todas");
  const [respSel, setRespSel] = useState<string>("todos");
  const [gestSel, setGestSel] = useState<string>("todos");
  const [tipoSel, setTipoSel] = useState<string>("todos");
  const [pagina, setPagina] = useState(1);
  const [tratando, setTratando] = useState<PlanoRow | null>(null);
  const [tStatus, setTStatus] = useState<string>("");
  const [tConclusao, setTConclusao] = useState<string>("");
  const [tObs, setTObs] = useState<string>("");

  function abrirTratativa(p: PlanoRow) {
    setTratando(p);
    setTStatus(p.status ?? "Pendente");
    setTConclusao(p.data_conclusao ?? "");
    setTObs(p.observacoes ?? "");
  }

  const salvarTratativa = useMutation({
    mutationFn: async () => {
      if (!tratando) return;
      const payload: any = { status: tStatus || null, data_conclusao: tConclusao || null, observacoes: tObs || null };
      if (tStatus === "Concluído" && !tConclusao) payload.data_conclusao = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("cal_planos_acao").update(payload).eq("id", tratando.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cal_planos_acao_all"] });
      toast.success("Tratativa registrada");
      setTratando(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar tratativa"),
  });

  const importarPAs = useMutation({
    mutationFn: async (file: File) => {
      const { planos, total_linhas } = await parseCalPlanoAcaoPlanilha(file);
      if (!planos.length) throw new Error("Nenhum Plano de Ação encontrado na planilha.");

      // Pré-carrega requisitos: por numero_cal (RQTCL...) E por codigo_requisito_generico (RL...)
      const numerosCal = [...new Set(planos.map((p) => p.numero_cal).filter(Boolean))] as string[];
      const reqIdByNumero = new Map<string, string>();
      if (numerosCal.length) {
        const chunkR = 500;
        for (let i = 0; i < numerosCal.length; i += chunkR) {
          const { data } = await supabase
            .from("cal_requisitos")
            .select("id, numero_cal")
            .in("numero_cal", numerosCal.slice(i, i + chunkR));
          for (const r of data ?? []) if (r.numero_cal) reqIdByNumero.set(r.numero_cal, r.id);
        }
      }

      const codigosRl = [
        ...new Set(planos.flatMap((p) => p.codigos_rl ?? []).filter(Boolean)),
      ] as string[];
      const reqIdByRl = new Map<string, string>();
      if (codigosRl.length) {
        const chunkR = 500;
        for (let i = 0; i < codigosRl.length; i += chunkR) {
          const { data } = await supabase
            .from("cal_requisitos")
            .select("id, codigo_requisito_generico")
            .in("codigo_requisito_generico", codigosRl.slice(i, i + chunkR));
          for (const r of data ?? []) {
            if (r.codigo_requisito_generico) reqIdByRl.set(r.codigo_requisito_generico.toUpperCase(), r.id);
          }
        }
      }

      // Pré-carrega PAs existentes por codigo_pa (uma PA pode ter várias linhas, uma por requisito)
      const codigos = [...new Set(planos.map((p) => p.codigo_pa).filter(Boolean))] as string[];
      const paRowsByCodigo = new Map<string, Array<{ id: string; requisito_id: string }>>();
      if (codigos.length) {
        const chunkP = 500;
        for (let i = 0; i < codigos.length; i += chunkP) {
          const { data } = await supabase
            .from("cal_planos_acao")
            .select("id, codigo_pa, requisito_id")
            .in("codigo_pa", codigos.slice(i, i + chunkP));
          for (const p of data ?? []) {
            if (!p.codigo_pa) continue;
            const arr = paRowsByCodigo.get(p.codigo_pa) ?? [];
            arr.push({ id: p.id, requisito_id: p.requisito_id });
            paRowsByCodigo.set(p.codigo_pa, arr);
          }
        }
      }

      let atualizados = 0;
      let inseridos = 0;
      let semRequisito = 0;
      const novos: any[] = [];

      for (const p of planos) {
        const payload = {
          codigo_pa: p.codigo_pa ?? null,
          texto: p.texto,
          requisito_legal_texto: p.requisito_legal_texto ?? null,
          area_pa: p.area_pa ?? null,
          tipo: p.tipo ?? null,
          status: p.status ?? null,
          data_prevista: p.data_prevista ?? null,
          data_conclusao: p.data_conclusao ?? null,
          recorrente: p.recorrente,
          intervalo_recorrencia_dias: p.intervalo_recorrencia_dias ?? null,
          custo: p.custo ?? null,
          natureza_custo: p.natureza_custo ?? null,
          usuario_execucao: p.usuario_execucao ?? null,
          usuario_gestao: p.usuario_gestao ?? null,
        };

        // resolve TODOS os requisitos vinculados (por RL + fallback por RQTCL)
        const requisitoIds = new Set<string>();
        for (const rl of p.codigos_rl ?? []) {
          const id = reqIdByRl.get(rl.toUpperCase());
          if (id) requisitoIds.add(id);
        }
        if (!requisitoIds.size && p.numero_cal) {
          const id = reqIdByNumero.get(p.numero_cal);
          if (id) requisitoIds.add(id);
        }

        const existentes = p.codigo_pa ? paRowsByCodigo.get(p.codigo_pa) ?? [] : [];

        // Se já existir(em) linha(s) desse codigo_pa, atualiza todas (mantém vínculo original)
        if (existentes.length) {
          for (const ex of existentes) {
            const { error } = await supabase.from("cal_planos_acao").update(payload).eq("id", ex.id);
            if (error) throw error;
            atualizados++;
          }
          // além de atualizar, insere novos vínculos que ainda não existem
          const jaVinculados = new Set(existentes.map((e) => e.requisito_id));
          for (const rid of requisitoIds) {
            if (!jaVinculados.has(rid)) novos.push({ requisito_id: rid, ...payload });
          }
        } else if (requisitoIds.size) {
          for (const rid of requisitoIds) novos.push({ requisito_id: rid, ...payload });
        } else {
          semRequisito++;
        }
      }

      const chunk = 300;
      for (let i = 0; i < novos.length; i += chunk) {
        const { error } = await supabase.from("cal_planos_acao").insert(novos.slice(i, i + chunk));
        if (error) throw error;
        inseridos += Math.min(chunk, novos.length - i);
      }

      return { total_linhas, atualizados, inseridos, semRequisito };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cal_planos_acao_all"] });
      setImportOpen(false);
      toast.success(
        `Importação concluída: ${r.inseridos} novo(s), ${r.atualizados} atualizado(s)` +
          (r.semRequisito ? ` · ${r.semRequisito} sem requisito vinculado (ignorados)` : ""),
      );
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao importar Planos de Ação"),
  });

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ["cal_planos_acao_all"],
    queryFn: async () => {
      const PAGE = 1000;
      let from = 0;
      const all: PlanoRow[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("cal_planos_acao")
          .select("id, requisito_id, codigo_pa, texto, requisito_legal_texto, area_pa, observacoes, tipo, status, data_prevista, data_conclusao, recorrente, usuario_execucao, usuario_gestao, cal_requisitos(id, numero_cal, norma, ementa, area, area_incidencia, temas, criticidade)")
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
      const a = p.area_pa ?? p.cal_requisitos?.area_incidencia ?? p.cal_requisitos?.area;
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
        const a = String(p.area_pa ?? p.cal_requisitos?.area_incidencia ?? p.cal_requisitos?.area ?? "").toLowerCase();
        if (!a.includes(areaSel.toLowerCase())) return false;
      }
      if (needle) {
        const hay = [
          p.codigo_pa, p.texto, p.requisito_legal_texto, p.area_pa, p.tipo, p.status, p.usuario_execucao, p.usuario_gestao,
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
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Planos de Ação
          </Button>
          <Link to="/app/cal" search={{ import: "1" }}>
            <Button size="sm" variant="outline"><Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Requisitos</Button>
          </Link>
          <Link to="/app/cal"><Button variant="outline" size="sm">Ver Requisitos <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Button></Link>
        </div>
      </div>

      {/* Dialog de importação de Planos de Ação */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Planos de Ação (Ius Natura)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Envie a exportação <strong>"Plano de Ação"</strong> do Ius Natura (.xlsx). O sistema atualiza os PAs
              existentes por <strong>Código</strong> e insere os novos, vinculando ao requisito pelo <strong>Requisito Legal (RQTCL...)</strong>.
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarPAs.mutate(f);
              }}
              disabled={importarPAs.isPending}
            />
            {importarPAs.isPending && (
              <p className="text-xs text-muted-foreground">Processando planilha, aguarde...</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Planos cujo "Requisito Legal" não estiver cadastrado no CAL serão ignorados — importe primeiro a planilha
              de Requisitos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importarPAs.isPending}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              ? "A base de PAs está vazia. Clique em \"Importar planilha\" no topo e envie o export do Ius Natura com a coluna \"Código de Requisito de Plano de Açao\" — os PAs entram automaticamente."
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
                const area = p.area_pa ?? p.cal_requisitos?.area_incidencia ?? p.cal_requisitos?.area ?? "—";
                const temas = (p.cal_requisitos?.temas ?? []).slice(0, 3);
                const descricao = p.requisito_legal_texto ?? p.texto ?? "—";
                return (
                  <TableRow key={p.id} className="align-top hover:bg-muted/30 cursor-pointer" onClick={() => abrirTratativa(p)}>
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
                      <p className="text-sm leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={descricao}>
                        {descricao}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 text-xs">
                      {p.cal_requisitos ? (
                        <Link to="/app/cal/$id" params={{ id: p.cal_requisitos.id }} className="hover:underline block" onClick={(e) => e.stopPropagation()}>
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

      {/* Modal de Tratativa */}
      <Dialog open={!!tratando} onOpenChange={(o) => !o && setTratando(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tratativa do Plano {tratando?.codigo_pa}</DialogTitle>
          </DialogHeader>
          {tratando && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Descrição</div>
                <p className="leading-snug">{tratando.texto ?? "—"}</p>
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div><span className="text-muted-foreground">CAL:</span> <span className="font-mono">{tratando.cal_requisitos?.numero_cal ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Norma:</span> {tratando.cal_requisitos?.norma ?? "—"}</div>
                  <div><span className="text-muted-foreground">Prazo:</span> {tratando.data_prevista ? new Date(tratando.data_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
                  <div><span className="text-muted-foreground">Tipo:</span> {tratando.tipo ?? "—"}</div>
                  <div><span className="text-muted-foreground">Responsável:</span> {tratando.usuario_execucao ?? "—"}</div>
                  <div><span className="text-muted-foreground">Gestão:</span> {tratando.usuario_gestao ?? "—"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={tStatus} onValueChange={setTStatus}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data de conclusão</Label>
                  <Input type="date" value={tConclusao} onChange={(e) => setTConclusao(e.target.value)} className="h-9" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Observações / Evidência (opcional)</Label>
                <Textarea value={tObs} onChange={(e) => setTObs(e.target.value)} rows={3} placeholder="Registre a tratativa, ação executada, evidência..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTratando(null)}>Cancelar</Button>
            <Button onClick={() => salvarTratativa.mutate()} disabled={salvarTratativa.isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {salvarTratativa.isPending ? "Salvando..." : "Salvar tratativa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
