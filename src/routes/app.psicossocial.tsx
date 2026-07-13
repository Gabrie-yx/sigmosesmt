import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Brain, Plus, Copy, Loader2, AlertTriangle, ShieldCheck, Users, BarChart3, ListChecks, ClipboardList, Pencil, Trash2, Check, ChevronDown, X, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DIMENSAO_LABEL, PSICO_ITEMS } from "@/lib/psico-instrument";

export const Route = createFileRoute("/app/psicossocial")({
  component: PsicossocialPage,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

function PsicossocialPage() {
  const [tab, setTab] = useState("catalogo");

  return (
    <div className="h-full flex flex-col bg-transparent">
      <header className="px-6 pt-5 pb-3 border-b border-rose-500/20 bg-gradient-to-r from-rose-950/60 via-rose-900/30 to-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-rose-600 to-rose-800 text-white shadow">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-rose-50 tracking-tight">Risco Psicossocial (NR-01)</h1>
            <p className="text-xs text-rose-100/60 mt-0.5">
              Portaria MTP 1.419/2024 · ISO 45003 · Instrumento anônimo com blindagem LGPD (n≥5)
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs value={tab} onValueChange={setTab} className="p-4">
          <TabsList className="bg-rose-950/40 border border-rose-500/20">
            <TabsTrigger value="catalogo"><ListChecks className="h-4 w-4 mr-1" />Catálogo</TabsTrigger>
            <TabsTrigger value="campanhas"><Users className="h-4 w-4 mr-1" />Campanhas</TabsTrigger>
            <TabsTrigger value="diagnostico"><BarChart3 className="h-4 w-4 mr-1" />Diagnóstico</TabsTrigger>
            <TabsTrigger value="instrumento"><ClipboardList className="h-4 w-4 mr-1" />Instrumento</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="mt-4"><CatalogoTab /></TabsContent>
          <TabsContent value="campanhas" className="mt-4"><CampanhasTab /></TabsContent>
          <TabsContent value="diagnostico" className="mt-4"><DiagnosticoTab /></TabsContent>
          <TabsContent value="instrumento" className="mt-4"><InstrumentoTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ============ 1. CATÁLOGO ============ */
function CatalogoTab() {
  const qc = useQueryClient();
  const { data: itens, isLoading } = useQuery({
    queryKey: ["catalogo-psico"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("catalogo_perigos_psicossociais")
        .select("*")
        .order("dimensao").order("ordem");
      if (error) throw error;
      return data as any[];
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await sb
        .from("catalogo_perigos_psicossociais")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["catalogo-psico"] });
      toast.success(vars.ativo ? "Perigo reativado" : "Perigo desativado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const grupos = useMemo(() => {
    const g: Record<string, any[]> = {};
    (itens ?? []).forEach((i) => { (g[i.dimensao] ||= []).push(i); });
    return g;
  }, [itens]);

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-rose-400" /></div>;

  return (
    <div className="space-y-3">
      <Card className="p-4 bg-rose-950/30 border-rose-500/20">
        <p className="text-sm text-rose-100/80">
          Biblioteca-mãe de <b>{itens?.length ?? 0} perigos psicossociais</b> em 8 dimensões (ISO 45003 + Guia MTE 2025). Serve
          como base para o inventário do PGR de qualquer empresa/CNAE. Use o <b>toggle</b> em cada card para ativar/desativar
          perigos que não se aplicam à sua operação — o histórico é preservado.
        </p>
      </Card>
      {Object.entries(grupos).map(([dim, lista]) => (
        <Card key={dim} className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
          <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {DIMENSAO_LABEL[dim as keyof typeof DIMENSAO_LABEL] ?? dim}
            <Badge variant="outline" className="ml-auto">
              {lista.filter((x) => x.ativo).length}/{lista.length} ativos
            </Badge>
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {lista.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border p-3 transition ${
                  p.ativo
                    ? "border-rose-500/20 bg-transparent/50"
                    : "border-slate-700/40 bg-slate-900/40 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={`text-sm font-semibold ${p.ativo ? "text-rose-50" : "text-slate-400 line-through"}`}>
                    {p.perigo}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px]">{p.codigo}</Badge>
                    <Switch
                      checked={!!p.ativo}
                      disabled={toggleAtivo.isPending}
                      onCheckedChange={(v) => toggleAtivo.mutate({ id: p.id, ativo: v })}
                      aria-label={p.ativo ? "Desativar perigo" : "Ativar perigo"}
                    />
                  </div>
                </div>
                {p.agravo && <p className="text-xs text-rose-300"><b>Agravo:</b> {p.agravo}</p>}
                {p.controles_sugeridos && <p className="text-xs text-rose-200 mt-1"><b>Controles:</b> {p.controles_sugeridos}</p>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ============ 2. CAMPANHAS ============ */
function CampanhasTab() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(
    new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10),
  );
  const [qtdTokens, setQtdTokens] = useState(20);
  const [gheIds, setGheIds] = useState<string[]>([]);
  const [tokensGerados, setTokensGerados] = useState<{ token: string; url: string }[]>([]);
  const [tokensDialogOpen, setTokensDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: ghes } = useQuery({
    queryKey: ["pgr-ghe-lite"],
    queryFn: async () => {
      const { data } = await sb.from("pgr_ghe").select("id, numero, setor").eq("ativo", true).order("numero");
      return (data ?? []) as any[];
    },
  });

  const { data: campanhas, isLoading } = useQuery({
    queryKey: ["psico-campanhas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("psico_campanhas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb
        .from("psico_campanhas")
        .insert({
          titulo,
          descricao,
          data_inicio: dataInicio,
          data_fim: dataFim,
          ghe_ids: gheIds,
          status: "ATIVA",
          min_respondentes: 5,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (c: any) => {
      toast.success("Campanha criada.");
      // gera tokens — se múltiplos GHEs, qtdTokens por GHE; senão qtdTokens total
      const alvos: (string | null)[] = gheIds.length > 0 ? gheIds : [null];
      const pares: { raw: string; ghe: string | null }[] = [];
      alvos.forEach((g) => {
        for (let i = 0; i < qtdTokens; i++) pares.push({ raw: randomToken(), ghe: g });
      });
      const rows = await Promise.all(
        pares.map(async ({ raw, ghe }) => ({
          campanha_id: c.id,
          ghe_id: ghe,
          token_hash: await sha256Hex(raw),
          expira_em: new Date(dataFim + "T23:59:59").toISOString(),
        })),
      );
      const { error } = await sb.from("psico_tokens").insert(rows);
      if (error) { toast.error("Erro ao gerar tokens: " + error.message); return; }

      const base = getPsicoPublicBase();
      setTokensGerados(pares.map((p) => ({ token: p.raw, url: `${base}/psico/${p.raw}` })));
      setTokensDialogOpen(true);
      setDialog(false);
      setTitulo(""); setDescricao(""); setGheIds([]);
      qc.invalidateQueries({ queryKey: ["psico-campanhas"] });
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const atualizar = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await sb
        .from("psico_campanhas")
        .update({
          titulo: payload.titulo,
          descricao: payload.descricao,
          data_inicio: payload.data_inicio,
          data_fim: payload.data_fim,
          status: payload.status,
          ghe_ids: payload.ghe_ids,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campanha atualizada.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["psico-campanhas"] });
    },
    onError: (e: any) => toast.error("Erro: " + (e?.message ?? "falha")),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      // remove tokens/respostas primeiro (FK)
      await sb.from("psico_respostas").delete().eq("campanha_id", id);
      await sb.from("psico_consentimentos").delete().eq("campanha_id", id);
      await sb.from("psico_tokens").delete().eq("campanha_id", id);
      const { error } = await sb.from("psico_campanhas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campanha excluída.");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["psico-campanhas"] });
    },
    onError: (e: any) => toast.error("Erro ao excluir: " + (e?.message ?? "falha")),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Campanhas de coleta</h2>
          <p className="text-xs text-rose-100/50">Cada campanha gera links descartáveis (single-use) para os colaboradores.</p>
        </div>
        <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />Nova campanha
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-rose-400" /></div>}

      <div className="grid gap-3 md:grid-cols-2">
        {(campanhas ?? []).map((c: any) => {
          const pct = c.total_tokens > 0 ? Math.round((c.total_respostas / c.total_tokens) * 100) : 0;
          return (
            <Card key={c.id} className="p-4 space-y-2 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900">{c.titulo}</h3>
                  <p className="text-xs text-rose-100/50">
                    {new Date(c.data_inicio).toLocaleDateString("pt-BR")} → {new Date(c.data_fim).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge className={statusColor(c.status)}>{c.status}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-200 hover:bg-rose-500/20" onClick={() => setEditing(c)} title="Editar campanha">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-300 hover:bg-rose-500/20" onClick={() => setDeleting(c)} title="Excluir campanha">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {c.descricao && <p className="text-xs text-rose-100/70 line-clamp-2">{c.descricao}</p>}
              {Array.isArray(c.ghe_ids) && c.ghe_ids.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.ghe_ids.slice(0, 4).map((gid: string) => {
                    const g = (ghes ?? []).find((x: any) => x.id === gid);
                    return (
                      <Badge key={gid} variant="outline" className="text-[10px] bg-rose-500/10 text-rose-200 border-rose-500/30">
                        {g ? `GHE ${g.numero}` : gid.slice(0, 6)}
                      </Badge>
                    );
                  })}
                  {c.ghe_ids.length > 4 && <Badge variant="outline" className="text-[10px]">+{c.ghe_ids.length - 4}</Badge>}
                </div>
              )}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-rose-500/10">
                <span className="text-rose-100/50">
                  <b className="text-slate-900">{c.total_respostas}</b> / {c.total_tokens} respostas
                </span>
                <span className="font-bold text-rose-300">{pct}%</span>
              </div>
              <div className="h-1 bg-rose-500/10 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
              </div>
            </Card>
          );
        })}
        {campanhas?.length === 0 && (
          <Card className="p-6 text-center col-span-full border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
            <p className="text-sm text-rose-100/50">Nenhuma campanha ainda. Crie a primeira.</p>
          </Card>
        )}
      </div>

      {/* Dialog nova campanha */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova campanha de avaliação psicossocial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Diagnóstico Psicossocial 2026 — GHE 04 (Solda)" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>GHEs alvo (selecione um, vários ou todos)</Label>
              <MultiGheSelect ghes={ghes ?? []} value={gheIds} onChange={setGheIds} />
              <p className="text-[10px] text-rose-100/50 mt-1">
                Vazio = campanha geral (sem recorte por GHE). Com múltiplos GHEs, a quantidade abaixo é gerada <b>por GHE</b>.
              </p>
            </div>
            <div>
              <Label>Quantidade de tokens (colaboradores esperados)</Label>
              <Input type="number" min={1} max={500} value={qtdTokens} onChange={(e) => setQtdTokens(Number(e.target.value))} />
              <p className="text-[10px] text-rose-100/50 mt-1">
                Cada colaborador recebe 1 link único. Recomenda-se n ≥ 5 por GHE (LGPD).
                {gheIds.length > 1 && <> Total: <b>{qtdTokens * gheIds.length}</b> links ({qtdTokens} × {gheIds.length} GHEs).</>}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={!titulo || criar.isPending}
              onClick={() => criar.mutate()}
            >
              {criar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Criar e gerar links
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog tokens gerados */}
      <Dialog open={tokensDialogOpen} onOpenChange={setTokensDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Links gerados — copie e distribua</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Card className="p-3 bg-amber-500/10 border-amber-500/30">
              <p className="text-xs text-rose-100/80 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
                <span>Esta lista aparece <b>uma única vez</b>. Copie agora — depois do fechamento do modal, os tokens em claro somem (por design de segurança).</span>
              </p>
            </Card>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(tokensGerados.map((t) => t.url).join("\n"));
                toast.success("Todos os links copiados!");
              }}
            >
              <Copy className="h-4 w-4 mr-1" /> Copiar TODOS os links
            </Button>
            <div className="space-y-1">
              {tokensGerados.map((t, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-rose-950/30 border border-rose-500/10 text-xs">
                  <span className="text-rose-100/40 w-8 shrink-0 pt-0.5">#{i + 1}</span>
                  <code className="flex-1 min-w-0 break-all text-rose-100/80 leading-snug">{t.url}</code>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(t.url); toast.success("Copiado"); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar campanha */}
      <EditarCampanhaDialog
        campanha={editing}
        ghes={ghes ?? []}
        onClose={() => setEditing(null)}
        onSave={(p) => atualizar.mutate(p)}
        saving={atualizar.isPending}
      />

      {/* Excluir campanha */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga permanentemente a campanha <b>{deleting?.titulo}</b>, seus tokens e todas as respostas
              coletadas. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => deleting && excluir.mutate(deleting.id)}
            >
              {excluir.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MultiGheSelect({
  ghes, value, onChange,
}: { ghes: any[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const all = ghes.map((g) => g.id);
  const allSelected = value.length > 0 && value.length === all.length;
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">
            {value.length === 0
              ? "— Sem GHE específico (campanha geral) —"
              : allSelected
                ? `Todos os ${value.length} GHEs`
                : `${value.length} GHE${value.length > 1 ? "s" : ""} selecionado${value.length > 1 ? "s" : ""}`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
        <div className="flex gap-1 mb-2">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => onChange(all)}>
            <Check className="h-3 w-3 mr-1" />Todos
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => onChange([])}>
            <X className="h-3 w-3 mr-1" />Limpar
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {ghes.map((g) => {
            const checked = value.includes(g.id);
            return (
              <label
                key={g.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-rose-500/10 cursor-pointer text-sm"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(g.id)} />
                <span>GHE {g.numero} — {g.setor}</span>
              </label>
            );
          })}
          {ghes.length === 0 && (
            <p className="text-xs text-rose-100/50 p-2">Nenhum GHE cadastrado.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditarCampanhaDialog({
  campanha, ghes, onClose, onSave, saving,
}: {
  campanha: any | null; ghes: any[];
  onClose: () => void;
  onSave: (p: any) => void;
  saving: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState("ATIVA");
  const [gheIds, setGheIds] = useState<string[]>([]);

  useEffect(() => {
    if (campanha) {
      setTitulo(campanha.titulo ?? "");
      setDescricao(campanha.descricao ?? "");
      setDataInicio(campanha.data_inicio ?? "");
      setDataFim(campanha.data_fim ?? "");
      setStatus(campanha.status ?? "ATIVA");
      setGheIds(Array.isArray(campanha.ghe_ids) ? campanha.ghe_ids : []);
    }
  }, [campanha]);

  return (
    <Dialog open={!!campanha} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar campanha</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ATIVA">ATIVA</SelectItem>
                <SelectItem value="ENCERRADA">ENCERRADA</SelectItem>
                <SelectItem value="CANCELADA">CANCELADA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>GHEs alvo</Label>
            <MultiGheSelect ghes={ghes} value={gheIds} onChange={setGheIds} />
            <p className="text-[10px] text-rose-100/50 mt-1">
              Alterar GHEs aqui <b>não</b> gera novos tokens — só ajusta o rótulo da campanha.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white"
            disabled={!titulo || saving}
            onClick={() => onSave({
              id: campanha.id, titulo, descricao,
              data_inicio: dataInicio, data_fim: dataFim,
              status, ghe_ids: gheIds,
            })}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ 3. DIAGNÓSTICO ============ */
function DiagnosticoTab() {
  const [campanhaId, setCampanhaId] = useState<string>("");

  const { data: campanhas } = useQuery({
    queryKey: ["psico-campanhas-diag"],
    queryFn: async () => {
      const { data } = await sb.from("psico_campanhas").select("id, titulo, min_respondentes").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: agregado } = useQuery({
    queryKey: ["psico-agregado", campanhaId],
    queryFn: async () => {
      if (!campanhaId) return [];
      const { data } = await sb
        .from("v_psico_agregado_ghe_dim")
        .select("*")
        .eq("campanha_id", campanhaId);
      return (data ?? []) as any[];
    },
    enabled: !!campanhaId,
  });

  return (
    <div className="space-y-3">
      <Card className="p-4 flex items-center gap-3 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
        <ShieldCheck className="h-5 w-5 text-rose-300 shrink-0" />
        <p className="text-xs text-rose-100/70">
          Todos os recortes com <b>menos de 5 respondentes</b> são <b>automaticamente suprimidos</b> (mostrados como "🔒") para
          preservar o anonimato — conforme LGPD e ISO 45003.
        </p>
      </Card>

      <div className="max-w-md">
        <Label>Selecione a campanha</Label>
        <Select value={campanhaId} onValueChange={setCampanhaId}>
          <SelectTrigger><SelectValue placeholder="Escolha uma campanha…" /></SelectTrigger>
          <SelectContent>
            {(campanhas ?? []).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {campanhaId && agregado && agregado.length === 0 && (
        <Card className="p-6 text-center border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
          <p className="text-sm text-rose-100/50">Ainda não há respostas suficientes para gerar diagnóstico.</p>
        </Card>
      )}

      {campanhaId && (agregado ?? []).length > 0 && (
        <MatrizDiagnostico
          linhas={agregado ?? []}
          minRespondentes={(campanhas ?? []).find((c: any) => c.id === campanhaId)?.min_respondentes ?? 5}
        />
      )}
    </div>
  );
}

function MatrizDiagnostico({ linhas, minRespondentes }: { linhas: any[]; minRespondentes?: number }) {
  // agrupa por GHE × dimensão
  const minResp = minRespondentes ?? 5;
  const dimensoes = Object.keys(DIMENSAO_LABEL);
  const ghes = Array.from(new Set(linhas.map((l) => l.ghe_id))).filter(Boolean);

  return (
    <Card className="p-4 overflow-x-auto border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
      <h3 className="font-bold text-slate-900 mb-3">Matriz agregada por GHE × Dimensão</h3>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left p-2 border-b">GHE</th>
            {dimensoes.map((d) => (
              <th key={d} className="text-center p-2 border-b text-[10px]">{DIMENSAO_LABEL[d as keyof typeof DIMENSAO_LABEL]}</th>
            ))}
            <th className="text-center p-2 border-b text-[10px]">Respondentes</th>
          </tr>
        </thead>
        <tbody>
          {ghes.map((ghe) => {
            const linhasGhe = linhas.filter((l) => l.ghe_id === ghe);
            const maxN = Math.max(0, ...linhasGhe.map((l) => Number(l.n_respostas ?? 0)));
            const atingiu = maxN >= minResp;
            return (
              <tr key={ghe as string}>
                <td className="p-2 border-b text-rose-100/80 font-semibold">{(ghe as string).slice(0, 8)}…</td>
                {dimensoes.map((d) => {
                  const cell = linhas.find((l) => l.ghe_id === ghe && l.dimensao === d);
                  if (!cell) return <td key={d} className="p-2 border-b text-center text-rose-100/30">—</td>;
                  if (cell.suprimido)
                    return <td key={d} className="p-2 border-b text-center text-rose-100/40" title="Menos de 5 respondentes (LGPD)">🔒</td>;
                  const cor = corPorMedia(Number(cell.media));
                  return (
                    <td key={d} className={`p-2 border-b text-center font-bold text-white ${cor}`}>
                      {Number(cell.media).toFixed(1)}
                    </td>
                  );
                })}
                <td className="p-2 border-b text-center">
                  <span
                    className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] font-bold ${
                      atingiu
                        ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                    }`}
                    title={atingiu ? "Mínimo atingido" : `Faltam ${minResp - maxN} respondente(s)`}
                  >
                    {Math.min(maxN, minResp)}/{minResp}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/* ============ 4. INSTRUMENTO (preview do questionário) ============ */
function InstrumentoTab() {
  const grupos = useMemo(() => {
    const g: Record<string, typeof PSICO_ITEMS> = {};
    PSICO_ITEMS.forEach((i) => { (g[i.dimensao] ||= []).push(i); });
    return g;
  }, []);

  return (
    <div className="space-y-3">
      <Card className="p-4 bg-transparent">
        <h2 className="font-bold text-rose-50 mb-2">Instrumento HSE-IT BR ({PSICO_ITEMS.length} itens)</h2>
        <p className="text-xs text-rose-100/70">
          Adaptação brasileira do HSE Indicator Tool (Health &amp; Safety Executive/UK, uso livre) + itens ISO 45003
          para assédio, violência e interface trabalho-vida. Escala Likert 1-5.
        </p>
      </Card>
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(grupos).map(([dim, itens]) => (
          <Card key={dim} className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60 flex flex-col">
            <h3 className="font-bold text-rose-50 mb-3 flex items-center gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span className="truncate">{DIMENSAO_LABEL[dim as keyof typeof DIMENSAO_LABEL]}</span>
              <Badge variant="outline" className="ml-auto text-[10px] bg-rose-500/10 text-rose-200 border-rose-500/30 shrink-0">
                {itens.length}
              </Badge>
            </h3>
            <ul className="space-y-2.5 text-[13px] leading-snug text-rose-100/80">
              {itens.map((it) => (
                <li key={it.codigo} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 items-start">
                  <Badge variant="outline" className="text-[9px] font-mono shrink-0 bg-rose-500/10 text-rose-200 border-rose-500/30 mt-0.5">
                    {it.codigo}
                  </Badge>
                  <span className="break-words">
                    {it.texto}
                    {it.invertido && <span className="text-[9px] text-rose-100/40 ml-1">(inv.)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============ Helpers ============ */

function statusColor(s: string) {
  switch (s) {
    case "ATIVA": return "bg-emerald-500/20 text-emerald-200 border-emerald-500/30";
    case "ENCERRADA": return "bg-rose-950/200/20 text-rose-100/30 border-slate-500/30";
    case "CANCELADA": return "bg-rose-500/20 text-rose-200 border-rose-500/30";
    default: return "bg-amber-500/20 text-amber-200 border-amber-500/30";
  }
}

function corPorMedia(m: number) {
  if (m < 2) return "bg-rose-500";
  if (m < 2.75) return "bg-lime-500";
  if (m < 3.5) return "bg-amber-500";
  if (m < 4.25) return "bg-orange-500";
  return "bg-rose-600";
}

function randomToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getPsicoPublicBase() {
  if (typeof window === "undefined") return "https://sigmosesmt.lovable.app";
  const host = window.location.hostname;
  if (host.includes("lovableproject.com") || host.includes("lovable.app") || host === "localhost") {
    return "https://sigmosesmt.lovable.app";
  }
  return window.location.origin;
}

async function sha256Hex(s: string) {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}