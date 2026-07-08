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
import { toast } from "sonner";
import { parseCalPlanilha, mapStatusIusToCal, type CalRequisitoImportado } from "@/lib/cal-parser";
import { CAL_STATUS_LABEL, CAL_STATUS_COLOR, CAL_STATUS_ORDER, CAL_CRITICIDADE_LABEL, CAL_CRITICIDADE_COLOR, daysUntil, type CalStatus } from "@/lib/cal-utils";
import { Upload, Plus, Scale, AlertTriangle, CheckCircle2, Clock, Search, FileText, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/cal/")({
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
  const [deltaResult, setDeltaResult] = useState<null | {
    novos: number;
    atualizados: number;
    revogados: number;
    inalterados: number;
    planosImportados: number;
  }>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);

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
      const { requisitos, total_linhas } = await parseCalPlanilha(file);
      if (!requisitos.length) throw new Error("Planilha sem requisitos reconhecíveis. Confirme se é a exportação de 'Requisito de CAL' do Ius Natura.");

      // 1) Cria lote
      const { data: lote, error: eLote } = await supabase
        .from("cal_lote_importacao")
        .insert({ nome_arquivo: file.name, total_linhas, created_by: user?.id ?? null })
        .select()
        .single();
      if (eLote) throw eLote;

      // 2) Busca hash+id existentes p/ delta
      const { data: existentes, error: eExist } = await supabase
        .from("cal_requisitos")
        .select("id, numero_cal, content_hash")
        .not("numero_cal", "is", null);
      if (eExist) throw eExist;
      const existMap = new Map((existentes ?? []).map((r) => [r.numero_cal, r]));
      const plGroup: { novos: CalRequisitoImportado[]; atualizados: CalRequisitoImportado[]; inalterados: CalRequisitoImportado[] } = {
        novos: [], atualizados: [], inalterados: [],
      };
      for (const r of requisitos) {
        const ex = existMap.get(r.numero_cal);
        if (!ex) plGroup.novos.push(r);
        else if (ex.content_hash !== r.content_hash) plGroup.atualizados.push(r);
        else plGroup.inalterados.push(r);
      }
      const planilhaCodes = new Set(requisitos.map((r) => r.numero_cal));
      const revogar = (existentes ?? []).filter((e) => !planilhaCodes.has(e.numero_cal));

      const toRow = (l: CalRequisitoImportado) => ({
        numero_cal: l.numero_cal,
        codigo_requisito_generico: l.codigo_requisito_generico ?? null,
        norma: l.norma,
        ementa: l.ementa,
        texto_legal: l.texto_legal ?? null,
        temas: l.temas,
        tipo_evidencia: l.tipo_evidencia ?? null,
        evidencia_texto: l.evidencia_texto ?? null,
        justificativa: l.justificativa ?? null,
        area: l.area ?? null,
        area_incidencia: l.area_incidencia ?? null,
        status: mapStatusIusToCal(l.status_ius) as any,
        status_vcl: l.status_vcl ?? null,
        data_vcl: l.data_vcl ?? null,
        data_ultima_alteracao_ius: l.data_ultima_alteracao_ius ?? null,
        data_inclusao_cal: l.data_inclusao_cal ?? null,
        criticidade: l.criticidade,
        cliente: l.cliente ?? null,
        origem: "planilha",
        raw_data: l.raw as any,
        lote_importacao_id: lote.id,
        ultima_importacao_id: lote.id,
        content_hash: l.content_hash,
        created_by: user?.id ?? null,
      });

      // 3) Upsert em chunks (novos + atualizados)
      const paraUpsert = [...plGroup.novos, ...plGroup.atualizados].map(toRow);
      const chunk = 300;
      for (let i = 0; i < paraUpsert.length; i += chunk) {
        const { error } = await supabase
          .from("cal_requisitos")
          .upsert(paraUpsert.slice(i, i + chunk), { onConflict: "numero_cal" });
        if (error) throw error;
      }

      // 4) Marcar precisa_revalidacao nos atualizados + gravar histórico
      if (plGroup.atualizados.length) {
        const codesAtualizados = plGroup.atualizados.map((r) => r.numero_cal);
        await supabase
          .from("cal_requisitos")
          .update({ precisa_revalidacao: true })
          .in("numero_cal", codesAtualizados);
        // Histórico (opcional / best-effort)
        const historico = plGroup.atualizados.map((r) => ({
          requisito_id: existMap.get(r.numero_cal)!.id,
          acao: "reimportacao_alterado",
          descricao: `Conteúdo alterado no Ius Natura (data ${r.data_ultima_alteracao_ius ?? "?"}). Marcado para revalidação.`,
          created_by: user?.id ?? null,
        }));
        await supabase.from("cal_historico").insert(historico as any);
      }

      // 5) Revogar os que sumiram
      if (revogar.length) {
        await supabase
          .from("cal_requisitos")
          .update({ status: "revogado" as any, revogado_em: new Date().toISOString() })
          .in("id", revogar.map((r) => r.id));
        const hist = revogar.map((r) => ({
          requisito_id: r.id,
          acao: "revogado_por_reimportacao",
          descricao: "Requisito não presente na planilha reimportada — marcado como revogado.",
          created_by: user?.id ?? null,
        }));
        await supabase.from("cal_historico").insert(hist as any);
      }

      // 6) Inserir normas vinculadas + planos de ação (novos e atualizados)
      // pega ids atualizados
      const codesAffected = [...plGroup.novos, ...plGroup.atualizados].map((r) => r.numero_cal);
      let planosImportados = 0;
      if (codesAffected.length) {
        const { data: ids } = await supabase
          .from("cal_requisitos")
          .select("id, numero_cal")
          .in("numero_cal", codesAffected);
        const idMap = new Map((ids ?? []).map((x) => [x.numero_cal, x.id]));
        // limpa e reinsere normas/planos dos afetados
        await supabase.from("cal_normas_vinculadas").delete().in("requisito_id", Array.from(idMap.values()));
        await supabase.from("cal_planos_acao").delete().in("requisito_id", Array.from(idMap.values()));

        const normasRows: any[] = [];
        const planosRows: any[] = [];
        for (const r of [...plGroup.novos, ...plGroup.atualizados]) {
          const rid = idMap.get(r.numero_cal);
          if (!rid) continue;
          for (const n of r.normas) {
            normasRows.push({ requisito_id: rid, codigo_norma: n.codigo_norma, descricao_norma: n.descricao_norma ?? null, data_inclusao: n.data_inclusao ?? null });
          }
          for (const p of r.planos_acao) {
            planosRows.push({
              requisito_id: rid,
              codigo_pa: p.codigo_pa ?? null,
              texto: p.texto,
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
            });
          }
        }
        for (let i = 0; i < normasRows.length; i += chunk) {
          await supabase.from("cal_normas_vinculadas").insert(normasRows.slice(i, i + chunk));
        }
        for (let i = 0; i < planosRows.length; i += chunk) {
          await supabase.from("cal_planos_acao").insert(planosRows.slice(i, i + chunk));
        }
        planosImportados = planosRows.length;
      }

      // 7) Atualizar lote com contadores
      await supabase.from("cal_lote_importacao").update({
        total_importados: plGroup.novos.length + plGroup.atualizados.length,
        total_duplicados: plGroup.inalterados.length,
        total_novos: plGroup.novos.length,
        total_atualizados: plGroup.atualizados.length,
        total_revogados: revogar.length,
        total_inalterados: plGroup.inalterados.length,
      } as any).eq("id", lote.id);

      return {
        novos: plGroup.novos.length,
        atualizados: plGroup.atualizados.length,
        revogados: revogar.length,
        inalterados: plGroup.inalterados.length,
        planosImportados,
      };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cal_requisitos"] });
      setImportOpen(false);
      setDeltaResult(r);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao importar"),
  });

  const limparBase = useMutation({
    mutationFn: async () => {
      // Trunca em ordem (FKs cascade)
      const { error } = await supabase.from("cal_requisitos").delete().not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Base do CAL limpa. Pronta pra importar do zero.");
      qc.invalidateQueries({ queryKey: ["cal_requisitos"] });
      setPurgeOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao limpar"),
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
          <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4 mr-2" />Limpar base</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Limpar toda a base de CALs?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Apaga <strong>todos os requisitos, normas vinculadas e planos de ação do CAL</strong>. Use apenas antes de reimportar a planilha correta. Essa ação não pode ser desfeita.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPurgeOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => limparBase.mutate()} disabled={limparBase.isPending}>{limparBase.isPending ? "Limpando..." : "Sim, limpar tudo"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Importar planilha</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Importar planilha do CAL (Ius Natura)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Envie o <strong>Requisito_de_CAL.xlsx</strong> exportado do Ius Natura. O sistema agrupa por requisito, importa as normas vinculadas + planos de ação, e detecta automaticamente novos / alterados / revogados.</p>
                <Input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importar.mutate(f);
                  }}
                  disabled={importar.isPending}
                />
                {importar.isPending && <p className="text-xs text-muted-foreground">Processando 2.000+ requisitos, aguarde ~30s...</p>}
              </div>
            </DialogContent>
          </Dialog>
          <ManualDialog open={manualOpen} onOpenChange={setManualOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["cal_requisitos"] })} userId={user?.id ?? null} />
        </div>
      </div>

      {/* Delta pós-importação */}
      <Dialog open={!!deltaResult} onOpenChange={(o) => !o && setDeltaResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-400" />Importação concluída</DialogTitle>
          </DialogHeader>
          {deltaResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded border p-3 bg-emerald-500/10"><div className="text-xs text-muted-foreground">Novos</div><div className="text-2xl font-bold text-emerald-300">{deltaResult.novos}</div></div>
                <div className="rounded border p-3 bg-amber-500/10"><div className="text-xs text-muted-foreground">Alterados</div><div className="text-2xl font-bold text-amber-300">{deltaResult.atualizados}</div></div>
                <div className="rounded border p-3 bg-red-500/10"><div className="text-xs text-muted-foreground">Revogados</div><div className="text-2xl font-bold text-red-300">{deltaResult.revogados}</div></div>
                <div className="rounded border p-3 bg-slate-500/10"><div className="text-xs text-muted-foreground">Inalterados</div><div className="text-2xl font-bold">{deltaResult.inalterados}</div></div>
              </div>
              <p className="text-sm text-muted-foreground">Também importei <strong>{deltaResult.planosImportados}</strong> planos de ação vinculados. Requisitos alterados foram marcados para <strong>revalidação</strong>.</p>
            </div>
          )}
          <DialogFooter><Button onClick={() => setDeltaResult(null)}>Ok</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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
