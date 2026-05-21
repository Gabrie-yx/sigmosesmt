import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Printer, Search, ClipboardCheck, Flame, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";

export const Route = createFileRoute("/app/extintores")({
  component: ExtintoresPage,
  head: () => ({ meta: [{ title: "Controle de Extintores · SIGMO" }] }),
});

const TIPOS = ["ABC", "BC", "A", "AP", "CO2", "PQS", "PQS_K", "OUTRO"] as const;
const STATUS = ["ATIVO", "EM_MANUTENCAO", "BAIXADO", "VENCIDO"] as const;

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Ativo", EM_MANUTENCAO: "Em manutenção", BAIXADO: "Baixado", VENCIDO: "Vencido",
};
const STATUS_STYLES: Record<string, string> = {
  ATIVO: "bg-emerald-100 text-emerald-700 border-emerald-300",
  EM_MANUTENCAO: "bg-amber-100 text-amber-700 border-amber-300",
  BAIXADO: "bg-slate-100 text-slate-500 border-slate-200",
  VENCIDO: "bg-red-100 text-red-700 border-red-300",
};

/** Checklist FOR-SFG 08 — legenda oficial */
export const CHECKLIST_NC = [
  { id: 1, label: "Pintura" },
  { id: 2, label: "Gatilho" },
  { id: 3, label: "Trava de segurança" },
  { id: 4, label: "Lacre quebrado" },
  { id: 5, label: "Bico quebrado/entupido" },
  { id: 6, label: "Mangote" },
  { id: 7, label: "Difusor (extintor CO₂)" },
  { id: 8, label: "Obstruído por objetos" },
  { id: 9, label: "Sinalização horizontal (piso)" },
  { id: 10, label: "Sinalização vertical (parede)" },
  { id: 11, label: "Carga vencida" },
  { id: 12, label: "Teste hidrostático vencido" },
];

type Extintor = any;
type Inspecao = any;

function ExtintoresPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("TODOS");
  const [fArea, setFArea] = useState<string>("TODAS");
  const [novoOpen, setNovoOpen] = useState(false);
  const [inspecaoExt, setInspecaoExt] = useState<Extintor | null>(null);

  const extintores = useQuery({
    queryKey: ["extintores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("extintores").select("*").order("numero");
      if (error) throw error;
      return (data ?? []) as Extintor[];
    },
  });

  const inspecoes = useQuery({
    queryKey: ["extintor-inspecoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extintor_inspecoes").select("*").order("data_inspecao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Inspecao[];
    },
  });

  const areas = useMemo(() => {
    const set = new Set<string>();
    (extintores.data ?? []).forEach((e) => e.area && set.add(e.area));
    return Array.from(set).sort();
  }, [extintores.data]);

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const inspecoesMesPorExt = useMemo(() => {
    const map = new Map<string, Inspecao>();
    (inspecoes.data ?? []).forEach((i) => {
      const d = new Date(i.data_inspecao + "T00:00");
      if (d >= inicioMes && !map.has(i.extintor_id)) map.set(i.extintor_id, i);
    });
    return map;
  }, [inspecoes.data, inicioMes]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (extintores.data ?? []).filter((e) => {
      if (fStatus !== "TODOS" && e.status !== fStatus) return false;
      if (fArea !== "TODAS" && e.area !== fArea) return false;
      if (!q) return true;
      return [e.numero, e.localizacao, e.area, e.numero_selo_inmetro, e.tipo_agente]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q));
    });
  }, [extintores.data, busca, fStatus, fArea]);

  const stats = useMemo(() => {
    const all = extintores.data ?? [];
    const ativos = all.filter((e) => e.status === "ATIVO");
    const hojeISO = hoje.toISOString().slice(0, 10);
    const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30);
    const em30ISO = em30.toISOString().slice(0, 10);
    const vencidos = ativos.filter((e) => e.proxima_recarga && e.proxima_recarga < hojeISO).length;
    const vencendo = ativos.filter((e) => e.proxima_recarga && e.proxima_recarga >= hojeISO && e.proxima_recarga <= em30ISO).length;
    const semInspecao = ativos.filter((e) => !inspecoesMesPorExt.has(e.id)).length;
    return { total: all.length, ativos: ativos.length, vencidos, vencendo, semInspecao };
  }, [extintores.data, inspecoesMesPorExt]);

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fadeIn">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">SESMT · NR-23 · NBR 12962</div>
          <h1 className="heading-display text-2xl md:text-3xl text-slate-900 flex items-center gap-2">
            <Flame className="h-6 w-6 text-red-600" /> Controle de Extintores
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/extintores/imprimir" target="_blank">
            <Button variant="outline" className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir planilha (FOR-SFG 08)
            </Button>
          </Link>
          <Button onClick={() => setNovoOpen(true)} className="gap-2 bg-red-700 hover:bg-red-800">
            <Plus className="h-4 w-4" /> Novo extintor
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total" value={stats.total} tone="slate" />
        <Kpi label="Ativos" value={stats.ativos} tone="green" />
        <Kpi label="Recarga vencida" value={stats.vencidos} tone="red" />
        <Kpi label="Vencendo 30d" value={stats.vencendo} tone="amber" />
        <Kpi label="Sem inspeção no mês" value={stats.semInspecao} tone={stats.semInspecao > 0 ? "amber" : "green"} />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº, localização, selo INMETRO…" className="pl-8" />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fArea} onValueChange={setFArea}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas áreas</SelectItem>
              {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[80px]">Nº</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead className="w-[80px]">Tipo</TableHead>
                <TableHead className="w-[80px]">Carga</TableHead>
                <TableHead className="w-[120px]">Selo INMETRO</TableHead>
                <TableHead className="w-[110px]">Próx. recarga</TableHead>
                <TableHead className="w-[90px]">Hidrost.</TableHead>
                <TableHead className="w-[110px]">Inspeção mês</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extintores.isLoading && <TableRow><TableCell colSpan={11} className="text-center text-slate-400 py-8">Carregando…</TableCell></TableRow>}
              {!extintores.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-slate-400 py-8">Nenhum extintor encontrado.</TableCell></TableRow>
              )}
              {filtered.map((e) => {
                const insp = inspecoesMesPorExt.get(e.id);
                const vencido = e.proxima_recarga && e.proxima_recarga < hoje.toISOString().slice(0, 10);
                return (
                  <TableRow key={e.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono font-bold">{e.numero}</TableCell>
                    <TableCell className="text-xs">{e.area}</TableCell>
                    <TableCell className="text-xs">{e.localizacao}</TableCell>
                    <TableCell className="text-xs font-semibold">{e.tipo_agente}</TableCell>
                    <TableCell className="text-xs">{e.carga_nominal ? `${e.carga_nominal} ${e.carga_unidade || "kg"}` : "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{e.numero_selo_inmetro || "—"}</TableCell>
                    <TableCell className={`text-xs ${vencido ? "text-red-700 font-bold" : ""}`}>
                      {e.proxima_recarga ? formatDateBR(e.proxima_recarga) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{e.proximo_teste_hidrostatico || "—"}</TableCell>
                    <TableCell>
                      {insp ? (
                        <Badge variant="outline" className={insp.conforme ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-red-50 text-red-700 border-red-300"}>
                          {insp.conforme ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                          {formatDateBR(insp.data_inspecao)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => setInspecaoExt(e)}>
                        <ClipboardCheck className="h-3.5 w-3.5" /> Inspecionar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {novoOpen && <NovoExtintorDialog open={novoOpen} onOpenChange={setNovoOpen} userId={user?.id} onCreated={() => { qc.invalidateQueries({ queryKey: ["extintores"] }); }} />}
      {inspecaoExt && <InspecaoDialog extintor={inspecaoExt} open={!!inspecaoExt} onOpenChange={(v) => !v && setInspecaoExt(null)} userId={user?.id} onCreated={() => { qc.invalidateQueries({ queryKey: ["extintor-inspecoes"] }); }} />}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "green" | "slate" }) {
  const tones = {
    red: "from-red-500 to-red-700",
    amber: "from-amber-400 to-amber-600",
    green: "from-emerald-500 to-emerald-700",
    slate: "from-slate-500 to-slate-700",
  };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} text-white p-3 shadow-sm`}>
      <div className="text-[9px] font-black uppercase tracking-widest opacity-90">{label}</div>
      <div className="text-2xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function NovoExtintorDialog({ open, onOpenChange, onCreated, userId }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; userId?: string }) {
  const [form, setForm] = useState({
    numero: "", area: "", localizacao: "", tipo_agente: "ABC" as any,
    carga_nominal: "", carga_unidade: "kg", capacidade_extintora: "",
    numero_selo_inmetro: "", data_ultima_recarga: "", ano_teste_hidrostatico: "",
    fabricante: "", empresa_responsavel: "", observacoes: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        numero: form.numero || null,
        area: form.area, localizacao: form.localizacao, tipo_agente: form.tipo_agente,
        carga_nominal: form.carga_nominal ? Number(form.carga_nominal) : null,
        carga_unidade: form.carga_unidade || "kg",
        capacidade_extintora: form.capacidade_extintora || null,
        numero_selo_inmetro: form.numero_selo_inmetro || null,
        data_ultima_recarga: form.data_ultima_recarga || null,
        ano_teste_hidrostatico: form.ano_teste_hidrostatico ? Number(form.ano_teste_hidrostatico) : null,
        fabricante: form.fabricante || null,
        empresa_responsavel: form.empresa_responsavel || null,
        observacoes: form.observacoes || null,
        created_by: userId ?? null,
      };
      const { error } = await supabase.from("extintores").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Extintor cadastrado"); onCreated(); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cadastrar"),
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo extintor</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nº do extintor <span className="text-slate-400 font-normal">(opcional)</span></Label><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} placeholder="auto" /></div>
          <div><Label>Tipo agente *</Label>
            <Select value={form.tipo_agente} onValueChange={(v) => set("tipo_agente", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Área *</Label><Input value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="PRODUÇÃO, ALMOXARIFADO…" /></div>
          <div><Label>Localização *</Label><Input value={form.localizacao} onChange={(e) => set("localizacao", e.target.value)} placeholder="Ex.: Em frente ao SESMT" /></div>
          <div><Label>Carga nominal</Label>
            <div className="flex gap-2">
              <Input type="number" step="0.5" value={form.carga_nominal} onChange={(e) => set("carga_nominal", e.target.value)} />
              <Select value={form.carga_unidade} onValueChange={(v) => set("carga_unidade", v)}>
                <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="L">L</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Capacidade extintora</Label><Input value={form.capacidade_extintora} onChange={(e) => set("capacidade_extintora", e.target.value)} placeholder="Ex.: 3-A:20-B:C" /></div>
          <div><Label>Nº selo INMETRO</Label><Input value={form.numero_selo_inmetro} onChange={(e) => set("numero_selo_inmetro", e.target.value)} /></div>
          <div><Label>Fabricante</Label><Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} /></div>
          <div><Label>Data da última recarga</Label><Input type="date" value={form.data_ultima_recarga} onChange={(e) => set("data_ultima_recarga", e.target.value)} /></div>
          <div><Label>Ano teste hidrostático</Label><Input type="number" value={form.ano_teste_hidrostatico} onChange={(e) => set("ano_teste_hidrostatico", e.target.value)} placeholder={String(new Date().getFullYear())} /></div>
          <div className="col-span-2"><Label>Empresa responsável pela manutenção</Label><Input value={form.empresa_responsavel} onChange={(e) => set("empresa_responsavel", e.target.value)} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.area || !form.localizacao} className="bg-red-700 hover:bg-red-800">Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InspecaoDialog({ extintor, open, onOpenChange, onCreated, userId }: { extintor: Extintor; open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; userId?: string }) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [nome, setNome] = useState("");
  const [registro, setRegistro] = useState("");
  const [ncs, setNcs] = useState<number[]>([]);
  const [nc, setNc] = useState("");
  const [obs, setObs] = useState("");

  const toggle = (id: number) => setNcs((arr) => arr.includes(id) ? arr.filter((n) => n !== id) : [...arr, id]);

  const save = useMutation({
    mutationFn: async () => {
      const conforme = ncs.length === 0;
      const { error } = await supabase.from("extintor_inspecoes").insert({
        extintor_id: extintor.id,
        data_inspecao: data,
        responsavel_nome: nome,
        responsavel_registro: registro || null,
        nc_codigos: ncs,
        nao_conformidade: nc || null,
        observacoes: obs || null,
        conforme,
        created_by: userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inspeção registrada"); onCreated(); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inspeção mensal — Extintor {extintor.numero}</DialogTitle>
          <div className="text-xs text-slate-500">{extintor.area} · {extintor.localizacao} · {extintor.tipo_agente}</div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Data *</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div className="col-span-2"><Label>Responsável *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Téc. Segurança — Nome" /></div>
            <div className="col-span-3"><Label>CRP/Registro</Label><Input value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="CRP-0000000/UF-MTE" /></div>
          </div>
          <div>
            <Label>Não conformidades observadas (FOR-SFG 08)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 p-3 rounded-md border bg-slate-50">
              {CHECKLIST_NC.map((it) => (
                <label key={it.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={ncs.includes(it.id)} onCheckedChange={() => toggle(it.id)} />
                  <span className="font-mono font-bold text-slate-400 w-5">{it.id}.</span>
                  <span>{it.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div><Label>Detalhamento da não conformidade</Label><Textarea value={nc} onChange={(e) => setNc(e.target.value)} rows={2} /></div>
          <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !nome} className="bg-red-700 hover:bg-red-800">Registrar inspeção</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}