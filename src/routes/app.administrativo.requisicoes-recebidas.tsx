import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Briefcase, Search, Filter, Eye, CheckCircle2, XCircle, ShieldAlert, FileText, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { decidirRc } from "@/lib/rc-public.functions";

export const Route = createFileRoute("/app/administrativo/requisicoes-recebidas")({
  component: AdministrativoRecebidasPage,
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
  status_token: string;
  cotacao_fornecedor: string | null;
  cotacao_valor: number | null;
  cotador_nome: string | null;
  pego_por_compras_nome: string | null;
  motivo_indeferimento: string | null;
  decidido_por_nome: string | null;
  decidido_em: string | null;
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
  COTADA: "Aguardando meu parecer",
  APROVADA: "Deferida",
  INDEFERIDA: "Indeferida",
};

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function fmtMoney(v?: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdministrativoRecebidasPage() {
  const { user, roles, hasModule } = useAuth();
  const isAdmin = roles.includes("admin");
  const canAcesso = isAdmin || hasModule("administrativo" as any);

  const [tab, setTab] = useState<"parecer" | "decididas" | "todas">("parecer");
  const [q, setQ] = useState("");
  const [setorFilter, setSetorFilter] = useState<string>("__all");

  const { data: reqs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-rcs", tab],
    enabled: !!user && canAcesso,
    queryFn: async () => {
      // Anderson só vê RCs que JÁ passaram pelo Compras (COTADA/APROVADA/INDEFERIDA).
      // PENDENTE e EM_COTACAO ficam ocultas — ainda estão na mesa do Compras.
      let query = supabase
        .from("purchase_requisitions")
        .select("id,numero,titulo,data_requisicao,classificacao,solicitante,setor,status,observacoes,created_at,status_token,cotacao_fornecedor,cotacao_valor,cotador_nome,pego_por_compras_nome,motivo_indeferimento,decidido_por_nome,decidido_em")
        .order("created_at", { ascending: false })
        .limit(300);
      if (tab === "parecer") query = query.eq("status", "COTADA" as any);
      if (tab === "decididas") query = query.in("status", ["APROVADA", "INDEFERIDA"] as any);
      if (tab === "todas") query = query.in("status", ["COTADA", "APROVADA", "INDEFERIDA"] as any);
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

  // Contadores globais (independem da tab atual)
  const { data: counts } = useQuery({
    queryKey: ["admin-rcs-counts"],
    enabled: !!user && canAcesso,
    queryFn: async () => {
      const [parecer, decididas] = await Promise.all([
        supabase.from("purchase_requisitions").select("id", { count: "exact", head: true }).eq("status", "COTADA" as any),
        supabase.from("purchase_requisitions").select("id", { count: "exact", head: true }).in("status", ["APROVADA", "INDEFERIDA"] as any),
      ]);
      return {
        parecer: parecer.count ?? 0,
        decididas: decididas.count ?? 0,
      };
    },
  });

  if (!user) return null;
  if (!canAcesso) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Este painel é restrito ao módulo <strong>Administrativo</strong>. Fale com o admin para liberar seu acesso.
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
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Administrativo · Requisições Recebidas</h1>
            <p className="text-xs text-slate-500">
              Fila do Supervisor Geral. Avalie a cotação enviada pelo Compras e dê o parecer (Deferido / Indeferido).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">Aguardando parecer: {counts?.parecer ?? 0}</Badge>
          <Badge className="bg-slate-100 text-slate-800 border-slate-300">Decididas: {counts?.decididas ?? 0}</Badge>
          <ManualSupervisorButton />
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nº, título, solicitante, setor…"
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
          <TabsTrigger value="parecer">Aguardando meu parecer ({counts?.parecer ?? 0})</TabsTrigger>
          <TabsTrigger value="decididas">Decididas</TabsTrigger>
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
  const pulsing = req.status === "COTADA";
  return (
    <Card className={`overflow-hidden ${pulsing ? "ring-2 ring-blue-300" : ""}`}>
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
          {req.status === "COTADA" && (
            <div className="text-[11px] text-blue-800 mt-1">
              Cotação: <strong>{req.cotacao_fornecedor ?? "—"}</strong> — {fmtMoney(req.cotacao_valor)}
              {req.cotador_nome ? <> · por {req.cotador_nome}</> : null}
            </div>
          )}
          {req.status === "INDEFERIDA" && req.motivo_indeferimento && (
            <div className="text-[11px] text-rose-700 mt-1 line-clamp-2">
              Motivo: {req.motivo_indeferimento}
            </div>
          )}
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
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
  const { user, roles } = useAuth();
  const { data: isSupervisor = false } = useQuery({
    queryKey: ["is-supervisor-geral", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (roles.includes("admin")) return true;
      const { data } = await supabase.rpc("is_supervisor_geral", { _user_id: user!.id });
      return !!data;
    },
  });
  const podeDecidir = isSupervisor && req.status === "COTADA";

  const [showIndeferir, setShowIndeferir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const decidir = useServerFn(decidirRc);

  const { data: itens = [] } = useQuery({
    queryKey: ["admin-rc-items", req.id],
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

  const deferir = useMutation({
    mutationFn: async () => {
      await decidir({ data: { token: req.status_token, decisao: "APROVADA" } });
    },
    onSuccess: () => {
      toast.success("RC deferida");
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao deferir"),
  });

  const indeferir = useMutation({
    mutationFn: async () => {
      if (!motivo.trim()) throw new Error("Informe o motivo do indeferimento.");
      await decidir({ data: { token: req.status_token, decisao: "INDEFERIDA", motivo: motivo.trim() } });
    },
    onSuccess: () => {
      toast.success("RC indeferida");
      setShowIndeferir(false);
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao indeferir"),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-red-700" />
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

        {(req.status === "COTADA" || req.status === "APROVADA" || req.status === "INDEFERIDA") && (
          <div className="border rounded-lg p-3 bg-blue-50/50">
            <div className="text-xs font-bold text-slate-700 mb-1">Resumo da cotação</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div><strong>Fornecedor vencedor:</strong><br />{req.cotacao_fornecedor ?? "—"}</div>
              <div><strong>Valor:</strong><br />{fmtMoney(req.cotacao_valor)}</div>
              <div><strong>Cotador:</strong><br />{req.cotador_nome ?? req.pego_por_compras_nome ?? "—"}</div>
            </div>
          </div>
        )}

        <div>
          <div className="text-sm font-bold mb-1 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Itens solicitados ({itens.length})
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left w-10">#</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-right w-20">Qtd</th>
                  <th className="p-2 text-left w-16">Un</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr><td colSpan={4} className="p-3 text-center text-slate-500">Sem itens.</td></tr>
                ) : itens.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-2">{i.item_numero}</td>
                    <td className="p-2">
                      {i.descricao}
                      {i.observacao && <div className="text-[10px] text-slate-500">{i.observacao}</div>}
                    </td>
                    <td className="p-2 text-right">{i.quantidade ?? "—"}</td>
                    <td className="p-2">{i.unidade ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {req.observacoes && (
          <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
            <strong>Observações do solicitante:</strong>
            <div className="whitespace-pre-wrap mt-1">{req.observacoes}</div>
          </div>
        )}

        {req.status === "INDEFERIDA" && req.motivo_indeferimento && (
          <div className="border-2 border-rose-300 bg-rose-50 rounded-lg p-3 flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900">
              <div className="font-bold uppercase tracking-wide">Motivo do indeferimento</div>
              <div className="mt-1 whitespace-pre-wrap">{req.motivo_indeferimento}</div>
              {req.decidido_por_nome && (
                <div className="text-[11px] text-rose-800 mt-1">
                  Decidido por {req.decidido_por_nome} · {fmtBR(req.decidido_em)}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {podeDecidir ? (
            <>
              <Button
                variant="outline"
                className="border-rose-400 text-rose-700 hover:bg-rose-50"
                onClick={() => setShowIndeferir(true)}
                disabled={deferir.isPending || indeferir.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" /> Indeferir
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => deferir.mutate()}
                disabled={deferir.isPending || indeferir.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> {deferir.isPending ? "Deferindo…" : "Deferir"}
              </Button>
            </>
          ) : req.status === "COTADA" ? (
            <div className="text-xs text-slate-500">
              Somente o Supervisor Geral pode dar parecer nesta RC.
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Esta RC não está aguardando parecer.
            </div>
          )}
        </DialogFooter>

        {showIndeferir && (
          <Dialog open onOpenChange={(o) => !o && setShowIndeferir(false)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Indeferir RC {req.numero}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <div className="text-xs text-slate-600">
                  Informe o motivo. Ele será registrado e visível para o Compras e o solicitante.
                </div>
                <Textarea
                  autoFocus
                  rows={4}
                  placeholder="Ex.: valor acima do orçamento aprovado, especificação divergente…"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowIndeferir(false)} disabled={indeferir.isPending}>
                  Cancelar
                </Button>
                <Button
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => indeferir.mutate()}
                  disabled={indeferir.isPending || !motivo.trim()}
                >
                  {indeferir.isPending ? "Indeferindo…" : "Confirmar indeferimento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualSupervisorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-red-300 text-red-800 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        <BookOpen className="h-4 w-4" />
        Manual do Supervisor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-red-700" />
              Manual do Supervisor Geral — Requisições de Compra (RC)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm leading-relaxed text-slate-700">
            <section>
              <h3 className="font-bold text-slate-900 text-base">1. Para que serve este painel</h3>
              <p className="mt-1">
                Aqui você acompanha <strong>todas as Requisições de Compra (RC)</strong> abertas
                pelos setores da empresa e dá o <strong>parecer final</strong> (Deferido ou
                Indeferido) sobre as cotações fechadas pelo Compras. Você é o último passo
                antes da compra ser efetivada.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 text-base">2. O fluxo completo da RC</h3>
              <ol className="list-decimal pl-5 mt-1 space-y-1">
                <li><strong>Solicitante abre a RC</strong> (SESMT, Produção, Manutenção etc.) descrevendo os itens.</li>
                <li>A RC entra na fila do <strong>Compras</strong> como <em>Pendente</em>.</li>
                <li>Um comprador <strong>"pega"</strong> a RC — ela passa a <em>Em cotação</em>.</li>
                <li>O comprador cota com fornecedores e fecha a melhor proposta — a RC vira <em>Cotada</em>.</li>
                <li>A RC aparece <strong>aqui na sua fila</strong> aguardando seu parecer.</li>
                <li>Você <strong>Defere</strong> (autoriza a compra) ou <strong>Indefere</strong> (bloqueia com motivo).</li>
              </ol>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 text-base">3. O que cada status significa</h3>
              <ul className="mt-1 space-y-2">
                <li>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 border mr-2">Aguardando cotação</Badge>
                  RC recém-aberta pelo solicitante. Nenhum comprador pegou ainda.
                  <span className="text-slate-500"> Você só acompanha, ainda não age.</span>
                </li>
                <li>
                  <Badge className="bg-violet-100 text-violet-800 border-violet-300 border mr-2">Em cotação</Badge>
                  Um comprador está cotando com fornecedores.
                  <span className="text-slate-500"> Ainda não é o momento de decidir.</span>
                </li>
                <li>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 border mr-2">Cotada</Badge>
                  <strong>É a sua vez.</strong> O Compras fechou a melhor proposta e está aguardando seu parecer.
                  Estas RCs aparecem com <strong>borda azul destacada</strong> na aba "Aguardando meu parecer".
                </li>
                <li>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 border mr-2">Aprovada</Badge>
                  Você já deferiu. Compras pode efetivar a compra com o fornecedor escolhido.
                </li>
                <li>
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 border mr-2">Indeferida</Badge>
                  Você bloqueou a compra com um motivo registrado. O Compras não pode dar prosseguimento.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 text-base">4. As abas do painel</h3>
              <ul className="mt-1 space-y-1">
                <li><strong>Aguardando meu parecer:</strong> só as <em>Cotadas</em>, esperando sua decisão. Comece por aqui.</li>
                <li><strong>Em fluxo:</strong> RCs ainda em <em>Pendente</em> ou <em>Em cotação</em>. Serve para acompanhar o que o Compras está fazendo.</li>
                <li><strong>Decididas:</strong> histórico do que você já deferiu ou indeferiu.</li>
                <li><strong>Todas:</strong> visão completa da empresa.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 text-base">5. Passo a passo para dar o parecer</h3>
              <ol className="list-decimal pl-5 mt-1 space-y-1">
                <li>Abra a aba <strong>"Aguardando meu parecer"</strong>.</li>
                <li>No card, confira: <em>solicitante</em>, <em>setor</em>, <em>fornecedor cotado</em>, <em>valor total</em> e <em>quem cotou</em>.</li>
                <li>Clique em <strong>Ver detalhes</strong> para inspecionar os <em>itens</em> da RC (descrição, quantidade, unidade e observações).</li>
                <li>Avalie se: a compra é realmente necessária, se o valor está compatível e se o fornecedor faz sentido.</li>
                <li>Escolha:
                  <ul className="list-disc pl-5 mt-1">
                    <li><strong className="text-emerald-700">Deferir</strong> — libera a compra. Não precisa justificar.</li>
                    <li><strong className="text-rose-700">Indeferir</strong> — bloqueia. É <strong>obrigatório escrever o motivo</strong> (o solicitante e o Compras verão essa mensagem).</li>
                  </ul>
                </li>
                <li>Depois de confirmado, o parecer é registrado com <strong>seu nome e data/hora</strong> e não pode ser desfeito no painel.</li>
              </ol>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 text-base">6. Boas práticas ao indeferir</h3>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Seja <strong>claro e objetivo</strong> — o solicitante lerá o motivo.</li>
                <li>Se for questão de <strong>valor</strong>, oriente a cotar outros fornecedores.</li>
                <li>Se for questão de <strong>necessidade</strong>, explique o critério (ex.: "Aguardar próximo orçamento", "Item já disponível no almoxarifado").</li>
                <li>Evite motivos vagos como "não autorizado" — dificulta a correção pelo Compras.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 text-base">7. Filtros e busca</h3>
              <p className="mt-1">
                Use a <strong>busca</strong> para localizar por número da RC, título, solicitante ou setor.
                Use o filtro de <strong>setor</strong> para ver só as RCs de uma área específica
                (útil quando há muitos pedidos ao mesmo tempo).
              </p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 text-base">8. Dúvidas frequentes</h3>
              <div className="mt-1 space-y-2">
                <p><strong>Posso deferir uma RC que ainda está "Em cotação"?</strong> Não. Só é possível decidir quando a RC estiver <em>Cotada</em>.</p>
                <p><strong>E se eu indeferir por engano?</strong> Fale com o Compras — o solicitante pode abrir uma nova RC corrigida.</p>
                <p><strong>Vejo RCs de todos os setores?</strong> Sim. Como Supervisor Geral, você tem visão total da empresa.</p>
                <p><strong>Quem mais vê minhas decisões?</strong> O solicitante da RC, o Compras e ficam registradas no histórico com seu nome.</p>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Entendi, fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}