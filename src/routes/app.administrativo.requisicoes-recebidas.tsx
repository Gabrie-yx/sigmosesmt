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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Briefcase, Search, Filter, Eye, CheckCircle2, XCircle, ShieldAlert, FileText, BookOpen,
  Building2, Wrench, Cog, Factory, Boxes, ShieldPlus, Package, ChevronDown, ChevronRight, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { decidirRc } from "@/lib/rc-public.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

// Pílulas glass — usam prism-pill + accent-* (definidos em src/styles.css)
const STATUS_BADGE: Record<Req["status"], string> = {
  PENDENTE: "prism-pill accent-amber text-amber-100",
  EM_COTACAO: "prism-pill accent-violet text-violet-100",
  COTADA: "prism-pill accent-sky text-sky-100",
  APROVADA: "prism-pill accent-emerald text-emerald-100",
  INDEFERIDA: "prism-pill accent-rose text-rose-100",
};

const SETOR_ICON: Record<string, typeof Briefcase> = {
  "Produção": Factory,
  "Manutenção Elétrica": Wrench,
  "Manutenção Mecânica": Cog,
  "Administrativo": Building2,
  "Almoxarifado": Boxes,
  "SESMT": ShieldPlus,
};

const SETOR_ACCENT: Record<string, string> = {
  "Produção": "accent-sky",
  "Manutenção Elétrica": "accent-amber",
  "Manutenção Mecânica": "accent-violet",
  "Administrativo": "accent-emerald",
  "Almoxarifado": "accent-wine",
  "SESMT": "accent-rose",
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

  const [q, setQ] = useState("");
  const [setorFilter, setSetorFilter] = useState<string>("__all");

  const { data: reqs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-rcs"],
    enabled: !!user && canAcesso,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Supervisor Geral acompanha TODAS as RCs vivas (PENDENTE, EM_COTACAO,
      // COTADA, APROVADA, INDEFERIDA). PENDENTE/EM_COTACAO entram como
      // "acompanhamento" (o Manual do Supervisor promete essa visão); a ação
      // de deferir/indeferir só habilita quando a RC está COTADA. Arquivadas
      // continuam ocultas.
      const { data, error } = await supabase
        .from("purchase_requisitions")
        .select("id,numero,titulo,data_requisicao,classificacao,solicitante,setor,status,observacoes,created_at,status_token,cotacao_fornecedor,cotacao_valor,cotador_nome,pego_por_compras_nome,motivo_indeferimento,decidido_por_nome,decidido_em,cotacao_at,dispensa_cotacao")
        .in("status", ["PENDENTE", "EM_COTACAO", "COTADA", "APROVADA", "INDEFERIDA"] as any)
        .is("arquivada_em", null)
        .order("created_at", { ascending: false })
        .limit(400);
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

  // Agrupamento por setor (a partir das RCs já filtradas)
  const grupos = useMemo(() => {
    const map = new Map<string, Req[]>();
    for (const r of filtered) {
      const key = r.setor?.trim() || "Sem setor";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Ordem: setores conhecidos primeiro, depois alfabético
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = SETORES.indexOf(a as any);
      const ib = SETORES.indexOf(b as any);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  if (!user) return null;
  if (!canAcesso) {
    return (
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
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
          <div className="h-10 w-10 rounded-xl prism-pill accent-rose flex items-center justify-center text-rose-100">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Administrativo · Requisições Recebidas</h1>
            <p className="text-xs text-muted-foreground">
              Requisições organizadas por setor. Todas já passaram pela cotação do Compras.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="prism-pill accent-sky px-3 py-1 text-xs text-sky-100">
            Total: {filtered.length}
          </span>
          <ManualSupervisorButton />
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº, título, solicitante, setor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
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

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando…</div>
      ) : grupos.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhuma requisição encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {grupos.map(([setor, lista]) => (
            <SetorCard key={setor} setor={setor} lista={lista} onChanged={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}

function SetorCard({
  setor, lista, onChanged,
}: { setor: string; lista: Req[]; onChanged: () => void }) {
  const Icon = SETOR_ICON[setor] ?? Package;
  const accent = SETOR_ACCENT[setor] ?? "accent-sky";
  const aguardando = lista.filter((r) => r.status === "COTADA").length;
  // SESMT começa fechado (lista costuma ser grande); demais abertos por padrão.
  const [open, setOpen] = useState(setor !== "SESMT");
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        className={`p-4 pb-3 flex flex-row items-center justify-between gap-2 cursor-pointer select-none ${open ? "border-b border-white/10" : ""}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className={`h-10 w-10 rounded-xl prism-pill ${accent} flex items-center justify-center text-foreground shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-foreground truncate">{setor}</div>
            <div className="text-[11px] text-muted-foreground">
              {lista.length} requisição{lista.length === 1 ? "" : "ões"}
              {aguardando > 0 ? ` · ${aguardando} aguardando parecer` : ""}
            </div>
          </div>
        </div>
        {aguardando > 0 && (
          <span className="prism-pill accent-sky px-2.5 py-1 text-[11px] text-sky-100 shrink-0">
            {aguardando} p/ decidir
          </span>
        )}
      </CardHeader>
      {open && (
        <CardContent className="p-3 space-y-2">
          {lista.map((r) => (
            <RcCard key={r.id} req={r} onChanged={onChanged} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function RcCard({ req, onChanged }: { req: Req; onChanged: () => void }) {
  const [openDetail, setOpenDetail] = useState(false);
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function excluir() {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("purchase_requisitions")
        .delete()
        .eq("id", req.id);
      if (error) throw error;
      toast.success(`RC ${req.numero} excluída`);
      setConfirmDelete(false);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir");
    } finally {
      setDeleting(false);
    }
  }
  const pulsing = req.status === "COTADA";
  return (
    <Card className={`glass-card overflow-hidden ${pulsing ? "ring-1 ring-sky-400/50" : ""}`}>
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground">RC Nº</span>
            <span className="text-sm font-bold text-foreground">{req.numero}</span>
            <span className={`${STATUS_BADGE[req.status]} px-2.5 py-0.5 text-[11px]`}>{STATUS_LABEL[req.status]}</span>
          </div>
          <div className="text-sm font-semibold mt-1 line-clamp-1 text-foreground">
            {req.titulo || "(sem título)"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {req.solicitante} · {req.setor || "sem setor"} · {fmtBR(req.data_requisicao)}
          </div>
          {req.status === "COTADA" && (
            <div className="text-[11px] text-sky-200 mt-1">
              Cotação: <strong>{req.cotacao_fornecedor ?? "—"}</strong> — {fmtMoney(req.cotacao_valor)}
              {req.cotador_nome ? <> · por {req.cotador_nome}</> : null}
            </div>
          )}
          {req.status === "INDEFERIDA" && req.motivo_indeferimento && (
            <div className="text-[11px] text-rose-200 mt-1 line-clamp-2">
              Motivo: {req.motivo_indeferimento}
            </div>
          )}
        </div>
        <span className="prism-pill px-2 py-0.5 text-[10px] shrink-0 text-foreground/80">
          {req.classificacao === "MATERIAL" ? "Material" : req.classificacao === "SERVICO" ? "Serviço" : "Medicamentos"}
        </span>
      </CardHeader>
      <CardContent className="p-3 pt-1 flex items-center justify-end gap-1">
        <Button size="sm" variant="outline" onClick={() => setOpenDetail(true)}>
          <Eye className="h-3.5 w-3.5 mr-1" /> Abrir
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            title="Excluir RC (admin)"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
          </Button>
        )}
      </CardContent>
      {openDetail && (
        <RcDetailDialog req={req} onClose={() => { setOpenDetail(false); onChanged(); }} />
      )}
      <AlertDialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir RC {req.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove permanentemente a requisição, itens e cotações. Ação irreversível — use para limpar testes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); excluir(); }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? "Excluindo…" : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            <Briefcase className="h-5 w-5" />
            RC Nº {req.numero} — {req.titulo || "sem título"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs prism-pill p-3">
          <div><strong>Solicitante:</strong><br />{req.solicitante}</div>
          <div><strong>Setor:</strong><br />{req.setor || "—"}</div>
          <div><strong>Data:</strong><br />{fmtBR(req.data_requisicao)}</div>
          <div><strong>Status:</strong><br />
            <span className={`${STATUS_BADGE[req.status]} px-2.5 py-0.5 text-[11px] inline-block`}>{STATUS_LABEL[req.status]}</span>
          </div>
        </div>

        {(req.status === "COTADA" || req.status === "APROVADA" || req.status === "INDEFERIDA") && (
          <div className="prism-pill accent-sky p-3">
            <div className="text-xs font-bold mb-1">Resumo da cotação</div>
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
          <div className="prism-pill overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-white/5">
                <tr>
                  <th className="p-2 text-left w-10">#</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-right w-20">Qtd</th>
                  <th className="p-2 text-left w-16">Un</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Sem itens.</td></tr>
                ) : itens.map((i) => (
                  <tr key={i.id} className="border-t border-white/10">
                    <td className="p-2">{i.item_numero}</td>
                    <td className="p-2">
                      {i.descricao}
                      {i.observacao && <div className="text-[10px] text-muted-foreground">{i.observacao}</div>}
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
          <div className="text-xs prism-pill accent-amber p-3">
            <strong>Observações do solicitante:</strong>
            <div className="whitespace-pre-wrap mt-1">{req.observacoes}</div>
          </div>
        )}

        {req.status === "INDEFERIDA" && req.motivo_indeferimento && (
          <div className="prism-pill accent-rose p-3 flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-200 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold uppercase tracking-wide">Motivo do indeferimento</div>
              <div className="mt-1 whitespace-pre-wrap">{req.motivo_indeferimento}</div>
              {req.decidido_por_nome && (
                <div className="text-[11px] opacity-80 mt-1">
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
                className="border-rose-400/40 text-rose-100 hover:bg-rose-500/15"
                onClick={() => setShowIndeferir(true)}
                disabled={deferir.isPending || indeferir.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" /> Indeferir
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => deferir.mutate()}
                disabled={deferir.isPending || indeferir.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> {deferir.isPending ? "Deferindo…" : "Deferir"}
              </Button>
            </>
          ) : req.status === "COTADA" ? (
            <div className="text-xs text-muted-foreground">
              Somente o Supervisor Geral pode dar parecer nesta RC.
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
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
                <div className="text-xs text-muted-foreground">
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
                  className="bg-rose-600 hover:bg-rose-500 text-white"
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
        className="gap-2 border-white/15 text-foreground hover:bg-white/5"
        onClick={() => setOpen(true)}
      >
        <BookOpen className="h-4 w-4" />
        Manual do Supervisor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Manual do Supervisor Geral — Requisições de Compra (RC)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm leading-relaxed">
            <section>
              <h3 className="font-bold text-foreground text-base">1. Para que serve este painel</h3>
              <p className="mt-1">
                Aqui você acompanha <strong>todas as Requisições de Compra (RC)</strong> abertas
                pelos setores da empresa e dá o <strong>parecer final</strong> (Deferido ou
                Indeferido) sobre as cotações fechadas pelo Compras. Você é o último passo
                antes da compra ser efetivada.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-foreground text-base">2. O fluxo completo da RC</h3>
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
              <h3 className="font-bold text-foreground text-base">3. O que cada status significa</h3>
              <ul className="mt-1 space-y-2">
                <li>
                  <span className="prism-pill accent-amber px-2.5 py-0.5 text-[11px] text-amber-100 mr-2">Aguardando cotação</span>
                  RC recém-aberta pelo solicitante. Nenhum comprador pegou ainda.
                  <span className="text-muted-foreground"> Você só acompanha, ainda não age.</span>
                </li>
                <li>
                  <span className="prism-pill accent-violet px-2.5 py-0.5 text-[11px] text-violet-100 mr-2">Em cotação</span>
                  Um comprador está cotando com fornecedores.
                  <span className="text-muted-foreground"> Ainda não é o momento de decidir.</span>
                </li>
                <li>
                  <span className="prism-pill accent-sky px-2.5 py-0.5 text-[11px] text-sky-100 mr-2">Cotada</span>
                  <strong>É a sua vez.</strong> O Compras fechou a melhor proposta e está aguardando seu parecer.
                  Estas RCs aparecem com <strong>borda azul destacada</strong> no card do setor.
                </li>
                <li>
                  <span className="prism-pill accent-emerald px-2.5 py-0.5 text-[11px] text-emerald-100 mr-2">Aprovada</span>
                  Você já deferiu. Compras pode efetivar a compra com o fornecedor escolhido.
                </li>
                <li>
                  <span className="prism-pill accent-rose px-2.5 py-0.5 text-[11px] text-rose-100 mr-2">Indeferida</span>
                  Você bloqueou a compra com um motivo registrado. O Compras não pode dar prosseguimento.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground text-base">4. Como o painel se organiza</h3>
              <ul className="mt-1 space-y-1">
                <li>Cada <strong>setor</strong> (SESMT, Produção, Manutenção, Administrativo, Almoxarifado) tem seu próprio card.</li>
                <li>Dentro do card do setor ficam <em>todas as RCs daquele setor</em> que já passaram pelo Compras.</li>
                <li>As RCs <strong>Cotadas</strong> (aguardando sua decisão) aparecem com borda azul e um contador no topo do card.</li>
                <li>Use a busca ou o filtro de setor no topo para reduzir a visão quando houver muitos pedidos.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground text-base">5. Passo a passo para dar o parecer</h3>
              <ol className="list-decimal pl-5 mt-1 space-y-1">
                <li>Localize o card do <strong>setor</strong> e as RCs marcadas como <em>Cotada</em>.</li>
                <li>No card, confira: <em>solicitante</em>, <em>setor</em>, <em>fornecedor cotado</em>, <em>valor total</em> e <em>quem cotou</em>.</li>
                <li>Clique em <strong>Abrir</strong> para inspecionar os <em>itens</em> da RC (descrição, quantidade, unidade e observações).</li>
                <li>Avalie se: a compra é realmente necessária, se o valor está compatível e se o fornecedor faz sentido.</li>
                <li>Escolha:
                  <ul className="list-disc pl-5 mt-1">
                    <li><strong className="text-emerald-300">Deferir</strong> — libera a compra. Não precisa justificar.</li>
                    <li><strong className="text-rose-300">Indeferir</strong> — bloqueia. É <strong>obrigatório escrever o motivo</strong> (o solicitante e o Compras verão essa mensagem).</li>
                  </ul>
                </li>
                <li>Depois de confirmado, o parecer é registrado com <strong>seu nome e data/hora</strong> e não pode ser desfeito no painel.</li>
              </ol>
            </section>

            <section>
              <h3 className="font-bold text-foreground text-base">6. Boas práticas ao indeferir</h3>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Seja <strong>claro e objetivo</strong> — o solicitante lerá o motivo.</li>
                <li>Se for questão de <strong>valor</strong>, oriente a cotar outros fornecedores.</li>
                <li>Se for questão de <strong>necessidade</strong>, explique o critério (ex.: "Aguardar próximo orçamento", "Item já disponível no almoxarifado").</li>
                <li>Evite motivos vagos como "não autorizado" — dificulta a correção pelo Compras.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground text-base">7. Filtros e busca</h3>
              <p className="mt-1">
                Use a <strong>busca</strong> para localizar por número da RC, título, solicitante ou setor.
                Use o filtro de <strong>setor</strong> para ver só as RCs de uma área específica
                (útil quando há muitos pedidos ao mesmo tempo).
              </p>
            </section>

            <section>
              <h3 className="font-bold text-foreground text-base">8. Dúvidas frequentes</h3>
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