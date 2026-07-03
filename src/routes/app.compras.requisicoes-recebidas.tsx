import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Package, ShoppingCart, Upload, Trash2, Eye, Trophy, Send, Filter, Search, FileText, DollarSign,
  ShieldAlert, XCircle, Award, ChevronDown, ChevronUp, Truck, Clock, CreditCard, Sparkles,
} from "lucide-react";
import { Layers, PackageCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { openStorageFile } from "@/components/file-viewer";
import { SupplierPicker, type SupplierLite } from "@/components/compras/supplier-picker";
import { StarRating } from "@/components/compras/star-rating";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/compras/requisicoes-recebidas")({
  component: ComprasRecebidasPage,
});

const SETORES = [
  "Produção",
  "Manutenção Elétrica",
  "Manutenção Mecânica",
  "Administrativo",
  "Almoxarifado",
  "SESMT",
] as const;

type Req = {
  id: string;
  numero: string;
  titulo: string | null;
  data_requisicao: string;
  classificacao: "MATERIAL" | "SERVICO" | "MEDICAMENTOS";
  solicitante: string;
  setor: string | null;
  status: "PENDENTE" | "EM_COTACAO" | "COTADA" | "APROVADA" | "INDEFERIDA";
  observacoes: string | null;
  created_at: string;
  titulo_display?: string | null;
  dispensa_cotacao?: boolean | null;
  dispensa_motivo?: string | null;
  dispensa_justificativa?: string | null;
};

type Cotacao = {
  id: string;
  rc_id: string;
  fornecedor: string;
  fornecedor_id: string | null;
  cnpj: string | null;
  valor: number;
  arquivo_url: string;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  is_vencedora: boolean;
  observacao: string | null;
  created_at: string;
  prazo_entrega_dias: number | null;
  condicao_pagamento: string | null;
  frete: string | null;
  validade: string | null;
  score_total: number | null;
  score_breakdown: any;
  ranking: number | null;
  is_melhor_oferta: boolean;
  fornecedores?: { estrelas: number | null } | null;
  cobertura_pct?: number | null;
  itens_cotados?: number | null;
  itens_totais_rc?: number | null;
  tem_divergencias?: boolean | null;
};

type ComboItem = {
  rc_item_id: string;
  item_numero: number | null;
  descricao: string;
  quantidade: number | null;
  melhor_cotacao_id: string | null;
  melhor_fornecedor_id: string | null;
  fornecedor_nome: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  prazo_entrega_dias: number | null;
  conformidade: string | null;
  estrelas: number | null;
  total_ofertas: number | null;
};

type Item = {
  id: string;
  item_numero: number;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  observacao: string | null;
};

const STATUS_BADGE: Record<Req["status"], string> = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-300",
  EM_COTACAO: "bg-violet-100 text-violet-800 border-violet-300",
  COTADA: "bg-blue-100 text-blue-800 border-blue-300",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-300",
  INDEFERIDA: "bg-rose-100 text-rose-800 border-rose-300",
};

const STATUS_LABEL: Record<Req["status"], string> = {
  PENDENTE: "Aguardando cotação",
  EM_COTACAO: "Em cotação",
  COTADA: "Enviada ao supervisor",
  APROVADA: "Deferida",
  INDEFERIDA: "Indeferida",
};

const MOTIVOS_DISPENSA = [
  { value: "FORNECEDOR_EXCLUSIVO", label: "Fornecedor exclusivo / representante único" },
  { value: "CONTRATO_GUARDA_CHUVA", label: "Contrato guarda-chuva vigente" },
  { value: "URGENCIA_OPERACIONAL", label: "Urgência operacional (parada / emergência SST)" },
  { value: "PADRONIZACAO_TECNICA", label: "Padronização técnica (peça OEM / reposição)" },
  { value: "OUTRO", label: "Outro (detalhar na justificativa)" },
] as const;

const MOTIVO_LABEL: Record<string, string> = Object.fromEntries(
  MOTIVOS_DISPENSA.map((m) => [m.value, m.label]),
);

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function fmtMoney(v?: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ComprasRecebidasPage() {
  const { user, roles, hasModule } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCompras = isAdmin || roles.includes("compras" as any) || hasModule("compras" as any);

  const [tab, setTab] = useState<"abertas" | "todas" | "enviadas">("abertas");
  const [q, setQ] = useState("");
  const [setorFilter, setSetorFilter] = useState<string>("__all");

  const { data: reqs = [], isLoading, refetch } = useQuery({
    queryKey: ["compras-rcs", tab],
    enabled: !!user && isCompras,
    queryFn: async () => {
      let query = supabase
        .from("purchase_requisitions")
        .select("id,numero,titulo,data_requisicao,classificacao,solicitante,setor,status,observacoes,created_at,dispensa_cotacao,dispensa_motivo,dispensa_justificativa")
        .order("created_at", { ascending: false })
        .limit(200);
      if (tab === "abertas") query = query.in("status", ["PENDENTE", "EM_COTACAO"] as any);
      if (tab === "enviadas") query = query.eq("status", "COTADA" as any);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });

  const filtered = useMemo(() => {
    return reqs.filter((r) => {
      if (setorFilter !== "__all" && (r.setor ?? "") !== setorFilter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.numero.toLowerCase().includes(s) ||
        (r.titulo ?? "").toLowerCase().includes(s) ||
        r.solicitante.toLowerCase().includes(s) ||
        (r.setor ?? "").toLowerCase().includes(s)
      );
    });
  }, [reqs, q, setorFilter]);

  const abertas = reqs.filter((r) => r.status === "PENDENTE" || r.status === "EM_COTACAO").length;
  const enviadas = reqs.filter((r) => r.status === "COTADA").length;

  if (!user) return null;
  if (!isCompras) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Este painel é restrito ao módulo <strong>Compras</strong>. Fale com o admin para liberar seu acesso.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Compras · RC Recebidas</h1>
            <p className="text-xs text-slate-500">
              Fila centralizada de requisições dos setores. Anexe 3 cotações e envie para o Supervisor Geral.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">Abertas: {abertas}</Badge>
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">Enviadas: {enviadas}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nº, solicitante, setor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-slate-400" />
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os setores</SelectItem>
                {SETORES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="abertas">Abertas ({abertas})</TabsTrigger>
          <TabsTrigger value="enviadas">Enviadas ao supervisor</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-3">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-500 border rounded-xl bg-white">
              Nenhuma requisição encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((r) => (
                <RcCard key={r.id} req={r} onChanged={() => refetch()} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RcCard({ req, onChanged }: { req: Req; onChanged: () => void }) {
  const [openDetail, setOpenDetail] = useState(false);
  const pulsing = req.status === "PENDENTE";
  return (
    <Card className={`overflow-hidden ${pulsing ? "animate-pulse-amber" : ""}`}>
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">RC Nº</span>
            <span className="text-sm font-bold">{req.numero}</span>
            <Badge className={STATUS_BADGE[req.status] + " border"}>{STATUS_LABEL[req.status]}</Badge>
          </div>
          <div className="text-sm font-semibold mt-1 line-clamp-1">
            {req.titulo || "(sem título)"}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {req.solicitante} · {req.setor || "sem setor"} · {fmtBR(req.data_requisicao)}
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {req.classificacao === "MATERIAL" ? "Material" : req.classificacao === "SERVICO" ? "Serviço" : "Medicamentos"}
        </Badge>
      </CardHeader>
      <CardContent className="p-3 pt-1 flex items-center justify-end gap-1">
        <Button size="sm" variant="outline" onClick={() => setOpenDetail(true)}>
          <Eye className="h-3.5 w-3.5 mr-1" /> Abrir
        </Button>
      </CardContent>
      {openDetail && (
        <RcDetailDialog req={req} onClose={() => { setOpenDetail(false); onChanged(); }} />
      )}
    </Card>
  );
}

function RcDetailDialog({ req, onClose }: { req: Req; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: itens = [] } = useQuery({
    queryKey: ["rc-items", req.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requisition_items")
        .select("id,item_numero,descricao,quantidade,unidade,observacao")
        .eq("requisition_id", req.id)
        .order("item_numero");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const { data: cotacoes = [], refetch: refetchCot } = useQuery({
    queryKey: ["rc-cotacoes", req.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rc_cotacoes")
        .select("*, fornecedores(estrelas)")
        .eq("rc_id", req.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Cotacao[];
    },
  });

  const totalCot = cotacoes.length;
  const hasWinner = cotacoes.some((c) => c.is_vencedora);
  const dispensa = !!req.dispensa_cotacao;
  const minCot = dispensa ? 1 : 3;
  const canSend = totalCot >= minCot && hasWinner && (req.status === "PENDENTE" || req.status === "EM_COTACAO");
  const missing = Math.max(0, minCot - totalCot);

  const marcarVenc = useMutation({
    mutationFn: async (cotId: string) => {
      const { error } = await supabase.rpc("marcar_cotacao_vencedora", { _cotacao_id: cotId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cotação marcada como vencedora");
      refetchCot();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao marcar vencedora"),
  });

  const excluir = useMutation({
    mutationFn: async (c: Cotacao) => {
      const { error } = await supabase.from("rc_cotacoes").delete().eq("id", c.id);
      if (error) throw error;
      // best-effort: remove do storage
      await supabase.storage.from("rc-cotacoes").remove([c.arquivo_url]).catch(() => {});
    },
    onSuccess: () => {
      toast.success("Cotação removida");
      refetchCot();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao remover"),
  });

  const enviarSup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("enviar_rc_para_supervisor", { _rc_id: req.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("RC enviada para o Supervisor Geral");
      qc.invalidateQueries({ queryKey: ["compras-rcs"] });
      qc.invalidateQueries({ queryKey: ["rc-header-badge"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao enviar"),
  });

  const revogarDispensa = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("revogar_dispensa_rc", { _rc_id: req.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dispensa revogada — voltando à regra de 3 cotações");
      qc.invalidateQueries({ queryKey: ["compras-rcs"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao revogar dispensa"),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-red-700" />
            RC Nº {req.numero} — {req.titulo || "sem título"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs bg-slate-50 border rounded-lg p-3">
          <div><strong>Solicitante:</strong><br />{req.solicitante}</div>
          <div><strong>Setor:</strong><br />{req.setor || "—"}</div>
          <div><strong>Data:</strong><br />{fmtBR(req.data_requisicao)}</div>
          <div><strong>Status:</strong><br />
            <Badge className={STATUS_BADGE[req.status] + " border"}>{STATUS_LABEL[req.status]}</Badge>
          </div>
        </div>

        {dispensa && (
          <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-3 flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-amber-900 uppercase tracking-wide">
                Dispensa de cotação ativa
              </div>
              <div className="text-xs text-amber-900 mt-1">
                <strong>Motivo:</strong> {MOTIVO_LABEL[req.dispensa_motivo as keyof typeof MOTIVO_LABEL] ?? req.dispensa_motivo}
              </div>
              <div className="text-xs text-amber-900 mt-1 whitespace-pre-wrap">
                <strong>Justificativa:</strong> {req.dispensa_justificativa}
              </div>
              <div className="text-[11px] text-amber-800 mt-1">
                Regra reduzida: <strong>mínimo 1 cotação</strong> + vencedora marcada.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => revogarDispensa.mutate()}
              disabled={revogarDispensa.isPending}
              className="border-amber-400 text-amber-800 hover:bg-amber-100"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Revogar dispensa
            </Button>
          </div>
        )}

        {/* Itens */}
        <div>
          <div className="text-sm font-bold mb-1 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Itens solicitados ({itens.length})
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left w-12">#</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-center w-20">Qtde</th>
                  <th className="p-2 text-center w-20">Unid.</th>
                  <th className="p-2 text-left">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr><td colSpan={5} className="p-3 text-center text-slate-500">Sem itens</td></tr>
                ) : itens.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-2 text-center">{String(i.item_numero).padStart(2, "0")}</td>
                    <td className="p-2">{i.descricao}</td>
                    <td className="p-2 text-center">{i.quantidade ?? ""}</td>
                    <td className="p-2 text-center">{i.unidade ?? ""}</td>
                    <td className="p-2 text-slate-600">{i.observacao ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {req.observacoes && (
            <div className="mt-2 text-xs p-2 bg-amber-50 border border-amber-200 rounded">
              <strong>Observações:</strong> {req.observacoes}
            </div>
          )}
        </div>

        {/* Cotações */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Cotações & Matriz de Decisão ({totalCot}/{minCot} mínimo)
            </div>
            <div className="flex items-center gap-2">
              {missing > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
                  Faltam {missing} cotação{missing > 1 ? "ões" : ""}
                </Badge>
              )}
              {totalCot >= 3 && !hasWinner && (
                <Badge className="bg-orange-100 text-orange-800 border border-orange-300">
                  Matriz sugerindo — confirme
                </Badge>
              )}
              <AddCotacaoDialog rcId={req.id} classificacao={req.classificacao} onAdded={refetchCot} />
            </div>
          </div>

          {cotacoes.length === 0 ? (
            <div className="p-6 text-center text-slate-500 border rounded-lg bg-slate-50">
              Nenhuma cotação anexada. Adicione pelo menos <strong>{minCot} cotação{minCot > 1 ? "ões" : ""}</strong> (PDF ou JPG) para a matriz analisar e liberar o envio.
            </div>
          ) : (
            <Tabs defaultValue="fornecedor">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="fornecedor" className="gap-1 text-xs">
                  <Trophy className="h-3.5 w-3.5" /> Vencedor único
                </TabsTrigger>
                <TabsTrigger value="combo" className="gap-1 text-xs">
                  <Layers className="h-3.5 w-3.5" /> Melhor combo (fatia PC)
                </TabsTrigger>
              </TabsList>
              <TabsContent value="fornecedor" className="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[...cotacoes].sort((a, b) => (a.ranking ?? 99) - (b.ranking ?? 99)).map((c) => (
                    <CotacaoCard
                      key={c.id}
                      cot={c}
                      onWin={() => marcarVenc.mutate(c.id)}
                      onDelete={() => {
                        if (confirm(`Excluir cotação de "${c.fornecedor}"?`)) excluir.mutate(c);
                      }}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="combo" className="mt-2">
                <MelhorComboTab rcId={req.id} />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {!dispensa && (req.status === "PENDENTE" || req.status === "EM_COTACAO") && (
            <DispensarCotacoesBtn rcId={req.id} onDone={() => { qc.invalidateQueries({ queryKey: ["compras-rcs"] }); onClose(); }} />
          )}
          <Button
            className="bg-red-700 hover:bg-red-800 text-white"
            disabled={!canSend || enviarSup.isPending}
            onClick={() => enviarSup.mutate()}
          >
            <Send className="h-4 w-4 mr-1" />
            {enviarSup.isPending ? "Enviando…" : "Enviar para o Supervisor Geral"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CotacaoCard({
  cot, onWin, onDelete,
}: {
  cot: Cotacao;
  onWin: () => void;
  onDelete: () => void;
}) {
  const [showScore, setShowScore] = useState(false);
  const isBest = cot.is_melhor_oferta;
  const rank = cot.ranking ?? null;
  const score = cot.score_total ?? null;
  const bd = (cot.score_breakdown ?? {}) as {
    preco?: number; prazo_entrega?: number; estrelas?: number;
    condicao_pagamento?: number; frete?: number; cobertura?: number;
    cobertura_pct?: number;
  };
  const cobertura = cot.cobertura_pct ?? 0;
  const cotados = cot.itens_cotados ?? 0;
  const totalItens = cot.itens_totais_rc ?? 0;
  const coberturaBaixa = totalItens > 0 && cobertura < 100;
  const divergente = !!cot.tem_divergencias;

  // Alerta validade curta
  let validadeCurta = false;
  let diasValidade: number | null = null;
  if (cot.validade) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const val = new Date(cot.validade + "T00:00:00");
    diasValidade = Math.round((val.getTime() - hoje.getTime()) / 86400000);
    validadeCurta = diasValidade >= 0 && diasValidade <= 5;
  }
  return (
    <div
      className={cn(
        "border rounded-lg p-2 flex flex-col gap-1 relative",
        isBest
          ? "border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 ring-2 ring-amber-200 shadow-md"
          : cot.is_vencedora
            ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200"
            : "bg-white",
      )}
    >
      {isBest && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge className="bg-amber-500 text-white border-2 border-white shadow-lg text-[10px] font-black px-2 py-0.5">
            <Award className="h-3 w-3 mr-1" /> MELHOR OFERTA
          </Badge>
        </div>
      )}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {rank && (
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded",
                rank === 1 ? "bg-amber-500 text-white" : rank === 2 ? "bg-slate-400 text-white" : "bg-slate-200 text-slate-700",
              )}>
                #{rank}
              </span>
            )}
            <span className="text-sm font-bold truncate">{cot.fornecedor}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <StarRating value={cot.fornecedores?.estrelas ?? 0} readOnly size="sm" />
          </div>
          {cot.cnpj && <div className="text-[10px] text-slate-500 truncate">CNPJ: {cot.cnpj}</div>}
        </div>
        {score != null && (
          <div className="text-right shrink-0">
            <div className={cn(
              "text-2xl font-black leading-none",
              score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-slate-500",
            )}>{score}</div>
            <div className="text-[9px] text-slate-500 font-semibold">SCORE</div>
          </div>
        )}
      </div>
      <div className="text-lg font-black text-red-800">{fmtMoney(cot.valor)}</div>

      {/* Alertas críticos */}
      <div className="flex flex-wrap gap-1">
        {totalItens > 0 && (
          <Badge className={cn(
            "text-[10px] border font-bold gap-0.5",
            cobertura >= 100 ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : cobertura >= 80 ? "bg-amber-100 text-amber-800 border-amber-300"
              : "bg-rose-100 text-rose-800 border-rose-300"
          )}>
            <PackageCheck className="h-2.5 w-2.5" />
            Cobertura {cotados}/{totalItens} ({cobertura.toFixed(0)}%)
          </Badge>
        )}
        {divergente && (
          <Badge className="text-[10px] bg-orange-100 text-orange-800 border border-orange-300 gap-0.5">
            <AlertTriangle className="h-2.5 w-2.5" /> Divergências
          </Badge>
        )}
        {validadeCurta && (
          <Badge className="text-[10px] bg-rose-100 text-rose-800 border border-rose-300 gap-0.5 animate-pulse">
            <Clock className="h-2.5 w-2.5" /> Vence em {diasValidade}d
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1 text-[10px] text-slate-600">
        {cot.prazo_entrega_dias != null && (
          <span className="inline-flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.5 rounded">
            <Clock className="h-2.5 w-2.5" />{cot.prazo_entrega_dias}d
          </span>
        )}
        {cot.condicao_pagamento && (
          <span className="inline-flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.5 rounded">
            <CreditCard className="h-2.5 w-2.5" />{cot.condicao_pagamento}
          </span>
        )}
        {cot.frete && (
          <span className="inline-flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.5 rounded">
            <Truck className="h-2.5 w-2.5" />{cot.frete}
          </span>
        )}
      </div>

      {cot.observacao && <div className="text-[11px] text-slate-600 line-clamp-2">{cot.observacao}</div>}

      {score != null && (
        <button
          type="button"
          onClick={() => setShowScore((s) => !s)}
          className="text-[10px] text-slate-600 hover:text-slate-900 flex items-center gap-1 mt-1 font-semibold"
        >
          {showScore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Como a matriz calculou
        </button>
      )}
      {showScore && score != null && (
        <div className="text-[10px] bg-slate-50 border rounded p-1.5 space-y-0.5">
          <ScoreLine label="Preço (25%)" val={bd.preco} max={25} />
          <ScoreLine label="Prazo (15%)" val={bd.prazo_entrega} max={15} />
          <ScoreLine label="Estrelas (20%)" val={bd.estrelas} max={20} />
          <ScoreLine label="Pagamento (10%)" val={bd.condicao_pagamento} max={10} />
          <ScoreLine label="Frete (5%)" val={bd.frete} max={5} />
          <ScoreLine label="Cobertura (25%)" val={bd.cobertura} max={25} />
          {divergente && (
            <div className="text-[10px] text-orange-700 pt-1 border-t border-orange-200">
              ⚠️ Penalidade de 10% aplicada por itens divergentes
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={() => openStorageFile("rc-cotacoes", cot.arquivo_url, cot.arquivo_nome ?? undefined)}
        >
          <Eye className="h-3 w-3 mr-1" /> Ver PDF
        </Button>
        {!cot.is_vencedora && (
          <Button
            size="sm"
            variant={isBest ? "default" : "outline"}
            onClick={onWin}
            className={isBest
              ? "bg-amber-500 hover:bg-amber-600 text-white"
              : "border-emerald-400 text-emerald-800 hover:bg-emerald-50"}
          >
            <Trophy className="h-3 w-3 mr-1" /> {isBest ? "Confirmar" : "Escolher"}
          </Button>
        )}
        {cot.is_vencedora && (
          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Trophy className="h-3 w-3 mr-1" /> Vencedora
          </Badge>
        )}
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-rose-700 hover:bg-rose-50 ml-auto">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function ScoreLine({ label, val, max = 100 }: { label: string; val?: number; max?: number }) {
  const v = Math.round(val ?? 0);
  const pct = Math.min(100, (v / max) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-24 shrink-0 text-slate-600">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-200 rounded overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-slate-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right font-semibold text-slate-700">{v}/{max}</span>
    </div>
  );
}

function AddCotacaoDialog({
  rcId, classificacao, onAdded,
}: {
  rcId: string;
  classificacao: Req["classificacao"];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState<SupplierLite | null>(null);
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [pgto, setPgto] = useState("");
  const [frete, setFrete] = useState<"CIF" | "FOB" | "">("");
  const [validade, setValidade] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const val = Number(String(valor).replace(",", "."));
    if (!supplier) return toast.error("Selecione um fornecedor");
    if (!Number.isFinite(val) || val < 0) return toast.error("Valor inválido");
    if (!file) return toast.error("Anexe o arquivo da cotação (PDF ou JPG)");
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) return toast.error("Arquivo deve ser PDF ou imagem (JPG/PNG/WEBP)");

    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${rcId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("rc-cotacoes").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (up.error) throw up.error;

      const ins = await supabase.from("rc_cotacoes").insert({
        rc_id: rcId,
        fornecedor_id: supplier.id,
        fornecedor: supplier.nome_fantasia,
        cnpj: supplier.cnpj,
        valor: val,
        prazo_entrega_dias: prazo ? Math.max(0, parseInt(prazo, 10)) : null,
        condicao_pagamento: pgto.trim() || null,
        frete: frete || null,
        validade: validade || null,
        arquivo_url: path,
        arquivo_nome: file.name,
        arquivo_tipo: file.type,
        observacao: obs.trim() || null,
      } as any);
      if (ins.error) throw ins.error;

      // Move RC pro EM_COTACAO se ainda estiver PENDENTE
      await supabase
        .from("purchase_requisitions")
        .update({ status: "EM_COTACAO" } as any)
        .eq("id", rcId)
        .eq("status", "PENDENTE" as any);

      toast.success("Cotação anexada — matriz recalculando…");
      setOpen(false);
      setSupplier(null); setValor(""); setPrazo(""); setPgto("");
      setFrete(""); setValidade(""); setObs(""); setFile(null);
      onAdded();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao anexar cotação");
    } finally {
      setBusy(false);
    }
  }

  const tipo = classificacao === "SERVICO" ? "SERVICO" : "MATERIAL";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-red-700 hover:bg-red-800 text-white">
          <Upload className="h-3.5 w-3.5 mr-1" /> Nova cotação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Nova cotação para a matriz
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <SupplierPicker value={supplier} onChange={setSupplier} tipo={tipo} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor total (R$) *</Label>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Prazo entrega (dias)</Label>
              <Input
                inputMode="numeric"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                placeholder="Ex: 7"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Condição pagamento</Label>
              <Input
                value={pgto}
                onChange={(e) => setPgto(e.target.value)}
                placeholder="Ex: 30/60/90 dias"
              />
            </div>
            <div>
              <Label>Frete</Label>
              <Select value={frete} onValueChange={(v) => setFrete(v as any)}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CIF">CIF (por conta do fornecedor)</SelectItem>
                  <SelectItem value="FOB">FOB (por nossa conta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Validade da proposta</Label>
            <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Prazo de entrega, condições…" />
          </div>
          <div>
            <Label>Arquivo (PDF ou JPG/PNG) *</Label>
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div className="text-[11px] text-slate-500 mt-1">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </div>
            )}
          </div>

          <div className="text-[11px] bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
            💡 Quanto mais campos preenchidos, mais precisa fica a análise da matriz. Só preço e valor faz um score fraco — inclua prazo, pagamento e frete sempre que possível.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-red-700 hover:bg-red-800 text-white">
            {busy ? "Enviando…" : "Anexar cotação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DispensarCotacoesBtn({ rcId, onDone }: { rcId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState<string>("");
  const [just, setJust] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!motivo) return toast.error("Selecione o motivo");
    if (just.trim().length < 30) return toast.error("Justificativa mínima de 30 caracteres");
    setBusy(true);
    const { error } = await supabase.rpc("dispensar_cotacoes_rc", {
      _rc_id: rcId, _motivo: motivo, _justificativa: just.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dispensa registrada — a RC agora aceita ser enviada com 1 cotação");
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-50">
          <ShieldAlert className="h-4 w-4 mr-1" /> Dispensar cotações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-700" /> Dispensa de cotação
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
            Use apenas quando a regra das 3 cotações não se aplica (exclusividade, contrato,
            urgência, padronização). Toda dispensa fica registrada em auditoria e o Supervisor Geral
            pode devolver a RC pedindo as 3 cotações completas.
          </div>
          <div>
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_DISPENSA.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Justificativa detalhada * <span className="text-[10px] text-slate-500">(mín. 30 caracteres — {just.trim().length})</span></Label>
            <Textarea
              rows={4}
              value={just}
              onChange={(e) => setJust(e.target.value)}
              placeholder="Explique por que 3 cotações não são viáveis (fornecedor único, número de contrato, natureza da urgência, etc.)"
            />
          </div>
          <div className="text-[11px] text-slate-500">
            ⚠️ Antes de confirmar, anexe ao menos <strong>1 cotação</strong> do fornecedor escolhido.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={submit}
            disabled={busy || !motivo || just.trim().length < 30}
          >
            {busy ? "Registrando…" : "Confirmar dispensa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}