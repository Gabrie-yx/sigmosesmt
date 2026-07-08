import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, Scale, AlertTriangle, CheckCircle2, Clock, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { parseCalPlanilha } from "@/lib/cal-parser";
import { CAL_STATUS_LABEL, CAL_STATUS_COLOR, CAL_STATUS_ORDER, CAL_CRITICIDADE_LABEL, CAL_CRITICIDADE_COLOR, daysUntil, type CalStatus } from "@/lib/cal-utils";

export const Route = createFileRoute("/app/cal")({
  component: CalDashboardPage,
  head: () => ({ meta: [{ title: "Requisitos Legais (CAL) · SIGMO" }, { name: "description", content: "Gestão de Requisitos Legais — CALs, aplicabilidade, planos de ação e evidências." }] }),
});

function CalDashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const { data: requisitos = [], isLoading } = useQuery({
    queryKey: ["cal_requisitos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cal_requisitos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const total = requisitos.length;
    const semAnalise = requisitos.filter((r) => r.status === "recebido").length;
    const aplicaveis = requisitos.filter((r) => ["aplicavel", "em_tratativa", "atendido", "monitoramento"].includes(r.status)).length;
    const atendidos = requisitos.filter((r) => r.status === "atendido").length;
    const emAtraso = requisitos.filter((r) => {
      const d = daysUntil(r.prazo_atendimento);
      return d !== null && d < 0 && !["atendido", "nao_aplicavel", "monitoramento"].includes(r.status);
    }).length;
    const vencendo7 = requisitos.filter((r) => {
      const d = daysUntil(r.prazo_atendimento);
      return d !== null && d >= 0 && d <= 7 && !["atendido", "nao_aplicavel"].includes(r.status);
    }).length;
    return { total, semAnalise, aplicaveis, atendidos, emAtraso, vencendo7 };
  }, [requisitos]);

  const filtrados = useMemo(() => {
    const b = busca.toLowerCase();
    return requisitos.filter((r) => {
      if (filtroStatus !== "todos" && r.status !== filtroStatus) return false;
      if (!b) return true;
      return [r.numero_cal, r.norma, r.ementa, r.orgao, r.area].some((v) => (v ?? "").toLowerCase().includes(b));
    });
  }, [requisitos, busca, filtroStatus]);

  const importar = useMutation({
    mutationFn: async (file: File) => {
      const linhas = await parseCalPlanilha(file);
      if (!linhas.length) throw new Error("Planilha sem CALs reconhecíveis");
      const { data: lote, error: eLote } = await supabase
        .from("cal_lote_importacao")
        .insert({ nome_arquivo: file.name, total_linhas: linhas.length, created_by: user?.id ?? null })
        .select()
        .single();
      if (eLote) throw eLote;
      const rows = linhas.map((l) => ({
        numero_cal: l.numero_cal,
        norma: l.norma,
        titulo: l.titulo ?? null,
        ementa: l.ementa,
        texto_legal: l.texto_legal ?? null,
        orgao: l.orgao ?? null,
        esfera: l.esfera ?? null,
        data_publicacao: l.data_publicacao ?? null,
        area: l.area ?? null,
        criticidade: l.criticidade,
        prazo_atendimento: l.prazo_atendimento ?? null,
        cliente: l.cliente ?? undefined,
        origem: "planilha",
        raw_data: l.raw as any,
        lote_importacao_id: lote.id,
        created_by: user?.id ?? null,
      }));
      const { error: eIns, count } = await supabase
        .from("cal_requisitos")
        .upsert(rows, { onConflict: "numero_cal", ignoreDuplicates: true, count: "exact" });
      if (eIns) throw eIns;
      const importados = count ?? 0;
      await supabase
        .from("cal_lote_importacao")
        .update({ total_importados: importados, total_duplicados: linhas.length - importados })
        .eq("id", lote.id);
      return { importados, duplicados: linhas.length - importados };
    },
    onSuccess: (r) => {
      toast.success(`${r.importados} CALs importados · ${r.duplicados} duplicados ignorados`);
      qc.invalidateQueries({ queryKey: ["cal_requisitos"] });
      setImportOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao importar"),
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Scale className="h-7 w-7 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold">Requisitos Legais (CAL)</h1>
            <p className="text-sm text-muted-foreground">Gestão de Comunicações de Atualização Legal integrada ao SIGMO</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Importar planilha</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Importar planilha do CAL (Ius Natura)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Envie o .xlsx exportado do sistemacal.com.br. O sistema detecta as colunas automaticamente e deduplica pelo número do CAL.</p>
                <Input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importar.mutate(f);
                  }}
                  disabled={importar.isPending}
                />
                {importar.isPending && <p className="text-xs text-muted-foreground">Processando...</p>}
              </div>
            </DialogContent>
          </Dialog>
          <ManualDialog open={manualOpen} onOpenChange={setManualOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["cal_requisitos"] })} userId={user?.id ?? null} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total" value={kpis.total} icon={<FileText className="h-4 w-4" />} />
        <KpiCard label="Sem análise" value={kpis.semAnalise} icon={<Clock className="h-4 w-4" />} tone="warning" />
        <KpiCard label="Aplicáveis" value={kpis.aplicaveis} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <KpiCard label="Atendidos" value={kpis.atendidos} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <KpiCard label="Vencendo 7d" value={kpis.vencendo7} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
        <KpiCard label="Em atraso" value={kpis.emAtraso} icon={<AlertTriangle className="h-4 w-4" />} tone="danger" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nº CAL, norma, ementa, órgão, área..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {CAL_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{CAL_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tabela">
            <TabsList>
              <TabsTrigger value="tabela">Tabela</TabsTrigger>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
            </TabsList>
            <TabsContent value="tabela" className="mt-4">
              {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº CAL</TableHead>
                        <TableHead>Norma</TableHead>
                        <TableHead>Ementa</TableHead>
                        <TableHead>Área</TableHead>
                        <TableHead>Criticidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Prazo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtrados.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum CAL encontrado</TableCell></TableRow>
                      )}
                      {filtrados.map((r) => {
                        const d = daysUntil(r.prazo_atendimento);
                        return (
                          <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
                            <TableCell className="font-mono text-xs"><Link to="/app/cal/$id" params={{ id: r.id }} className="hover:underline">{r.numero_cal}</Link></TableCell>
                            <TableCell><Link to="/app/cal/$id" params={{ id: r.id }} className="block">{r.norma}</Link></TableCell>
                            <TableCell className="max-w-[380px] truncate"><Link to="/app/cal/$id" params={{ id: r.id }} className="block">{r.ementa}</Link></TableCell>
                            <TableCell className="text-xs">{r.area ?? "—"}</TableCell>
                            <TableCell><Badge variant="outline" className={CAL_CRITICIDADE_COLOR[r.criticidade]}>{CAL_CRITICIDADE_LABEL[r.criticidade]}</Badge></TableCell>
                            <TableCell><Badge variant="outline" className={CAL_STATUS_COLOR[r.status]}>{CAL_STATUS_LABEL[r.status]}</Badge></TableCell>
                            <TableCell className={d !== null && d < 0 ? "text-red-400 text-xs" : "text-xs"}>
                              {r.prazo_atendimento ? (
                                <>{new Date(r.prazo_atendimento + "T00:00:00").toLocaleDateString("pt-BR")} {d !== null && <span className="ml-1 opacity-70">({d < 0 ? `${-d}d atraso` : `${d}d`})</span>}</>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="kanban" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {CAL_STATUS_ORDER.map((s) => {
                  const cards = filtrados.filter((r) => r.status === s);
                  return (
                    <div key={s} className="rounded-md border bg-muted/20 p-2 min-h-[200px]">
                      <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                        <span>{CAL_STATUS_LABEL[s]}</span>
                        <Badge variant="outline">{cards.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {cards.map((r) => (
                          <Link key={r.id} to="/app/cal/$id" params={{ id: r.id }} className="block">
                            <div className="rounded border bg-background p-2 text-xs hover:border-primary/40 transition">
                              <div className="font-mono text-[10px] text-muted-foreground">{r.numero_cal}</div>
                              <div className="font-medium truncate">{r.norma}</div>
                              <div className="text-muted-foreground line-clamp-2">{r.ementa}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "success" | "warning" | "danger" }) {
  const color =
    tone === "success" ? "text-emerald-300"
    : tone === "warning" ? "text-amber-300"
    : tone === "danger" ? "text-red-300"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={color}>{icon}</span>
        </div>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ManualDialog({ open, onOpenChange, onCreated, userId }: { open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void; userId: string | null }) {
  const [form, setForm] = useState({ numero_cal: "", norma: "", ementa: "", orgao: "", area: "", criticidade: "media", prazo_atendimento: "" });
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!form.numero_cal || !form.norma || !form.ementa) {
      toast.error("Preencha nº CAL, norma e ementa");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("cal_requisitos").insert({
      numero_cal: form.numero_cal,
      norma: form.norma,
      ementa: form.ementa,
      orgao: form.orgao || null,
      area: form.area || null,
      criticidade: form.criticidade as any,
      prazo_atendimento: form.prazo_atendimento || null,
      origem: "manual",
      created_by: userId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("CAL cadastrado");
    onCreated();
    onOpenChange(false);
    setForm({ numero_cal: "", norma: "", ementa: "", orgao: "", area: "", criticidade: "media", prazo_atendimento: "" });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Novo CAL manual</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo requisito legal (manual)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nº CAL *</Label><Input value={form.numero_cal} onChange={(e) => setForm({ ...form, numero_cal: e.target.value })} /></div>
            <div><Label>Norma *</Label><Input value={form.norma} onChange={(e) => setForm({ ...form, norma: e.target.value })} placeholder="Ex: NR-35" /></div>
          </div>
          <div><Label>Ementa *</Label><Textarea rows={3} value={form.ementa} onChange={(e) => setForm({ ...form, ementa: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Órgão</Label><Input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} /></div>
            <div><Label>Área</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Criticidade</Label>
              <Select value={form.criticidade} onValueChange={(v) => setForm({ ...form, criticidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Prazo</Label><Input type="date" value={form.prazo_atendimento} onChange={(e) => setForm({ ...form, prazo_atendimento: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
