// Painel operacional da Portaria (mobile-first).
// Estrutura Mês > Semana > Dia com card do dia atual sempre expandido.
// Cards de visita com borda vermelha pulsando quando saida_at é NULL.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DoorOpen, Plus, LogOut, ChevronRight, AlertTriangle, Users, Clock, Car, Building2, BarChart3, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { deletePortariaVisita } from "@/lib/portaria/foto-ocr.functions";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const NovaEntradaWizard = lazy(() => import("@/components/portaria/nova-entrada-wizard").then((m) => ({ default: m.NovaEntradaWizard })));
const ValidarSaidaFuncionarioDrawer = lazy(() => import("@/components/portaria/validar-saida-funcionario-drawer").then((m) => ({ default: m.ValidarSaidaFuncionarioDrawer })));
const RegistrarSaidaVisitaDialog = lazy(() => import("@/components/portaria/registrar-saida-visita-dialog").then((m) => ({ default: m.RegistrarSaidaVisitaDialog })));
const HoraExtraHojeCard = lazy(() => import("@/components/portaria/hora-extra-hoje-card").then((m) => ({ default: m.HoraExtraHojeCard })));

export const Route = createFileRoute("/app/portaria/controle-entrada")({
  component: ControleEntradaPage,
  head: () => ({
    meta: [
      { title: "Portaria · SIGMO" },
      { name: "description", content: "Controle de entrada e saída de visitantes, fornecedores e validação de saídas de funcionários." },
    ],
  }),
});

const DIAS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; }
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x; }
function fmtHora(iso: string) { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

function ControleEntradaPage() {
  const hoje = startOfDay(new Date());
  const inicioMes = startOfMonth(hoje);
  const [wizOpen, setWizOpen] = useState(false);
  const [saidaFuncOpen, setSaidaFuncOpen] = useState(false);
  const [saidaVisita, setSaidaVisita] = useState<any | null>(null);
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const deleteFn = useServerFn(deletePortariaVisita);
  const delMut = useMutation({
    mutationFn: (visitaId: string) => deleteFn({ data: { visitaId } }),
    onSuccess: () => {
      toast.success("Visita excluída");
      qc.invalidateQueries({ queryKey: ["portaria-visitas"] });
      qc.invalidateQueries({ queryKey: ["portaria-kpis"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir"),
  });
  const onDelete = isAdmin ? (id: string) => delMut.mutate(id) : undefined;
  const deletingId = delMut.isPending ? (delMut.variables as string) : null;

  // Todas as visitas do mês atual (com joins essenciais)
  const { data: visitas, isLoading } = useQuery({
    queryKey: ["portaria-visitas", inicioMes.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portaria_visitas")
        .select(`
          id, tipo, status, entrada_at, saida_at, motivo_visita, foto_rosto_url,
          pessoa:pessoa_id(id,nome,cpf),
          veiculo:veiculo_id(id,placa,modelo),
          empresa:empresa_visitada_id(id,name)
        `)
        .gte("entrada_at", inicioMes.toISOString())
        .order("entrada_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  // KPIs
  const { data: kpis } = useQuery({
    queryKey: ["portaria-kpis"],
    queryFn: async () => {
      const { count: dentro } = await supabase.from("portaria_visitas")
        .select("*", { count: "exact", head: true }).eq("status","DENTRO");
      const hoje0 = startOfDay(new Date()).toISOString();
      const { count: entradasHoje } = await supabase.from("portaria_visitas")
        .select("*", { count: "exact", head: true }).gte("entrada_at", hoje0);
      return { dentro: dentro ?? 0, entradasHoje: entradasHoje ?? 0 };
    },
    refetchInterval: 30_000,
  });

  const grupos = useMemo(() => {
    const porDia = new Map<string, any[]>();
    (visitas ?? []).forEach((v: any) => {
      const d = startOfDay(new Date(v.entrada_at)).toISOString().slice(0,10);
      const arr = porDia.get(d) ?? []; arr.push(v); porDia.set(d, arr);
    });
    return Array.from(porDia.entries()).sort((a,b) => b[0].localeCompare(a[0]));
  }, [visitas]);

  const hojeIso = hoje.toISOString().slice(0,10);
  const gruposHoje = grupos.find(([d]) => d === hojeIso)?.[1] ?? [];
  const gruposOutros = grupos.filter(([d]) => d !== hojeIso);

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-6xl px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
              <DoorOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base leading-tight truncate">Portaria</h1>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{DIAS[hoje.getDay()]} · {hoje.toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
          <Link to="/app/portaria/controle"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 hover:bg-muted">
            <BarChart3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Painel SESMT</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-3 lg:px-6 pt-4 lg:pt-5 space-y-4">
        {/* KPIs + ações — linha compacta */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-card border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Dentro agora</p>
            <p className="font-bold text-2xl text-primary mt-0.5">{kpis?.dentro ?? 0}</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Entradas hoje</p>
            <p className="font-bold text-2xl text-foreground mt-0.5">{kpis?.entradasHoje ?? 0}</p>
          </div>
          <Button onClick={() => setWizOpen(true)} size="lg" className="h-auto py-3 rounded-xl font-semibold text-sm shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" /> Nova entrada
          </Button>
          <Button onClick={() => setSaidaFuncOpen(true)} size="lg" variant="secondary" className="h-auto py-3 rounded-xl font-semibold text-sm">
            <LogOut className="h-4 w-4 mr-1.5" /> Saída funcionário
          </Button>
        </div>

        {/* Grid principal: HOJE dominante + lateral (semana + mês) no desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card do DIA */}
          <div className="lg:col-span-2">
            <Suspense fallback={null}>
              <div className="mb-4"><HoraExtraHojeCard /></div>
            </Suspense>
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Hoje</p>
                  <h2 className="font-bold text-base">{DIAS[hoje.getDay()]} · {hoje.toLocaleDateString("pt-BR")}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Visitas</p>
                  <p className="font-bold text-xl text-foreground">{gruposHoje.length}</p>
                </div>
              </div>
              <div className="divide-y divide-border">
                {isLoading && <div className="p-6 text-center text-muted-foreground text-sm">Carregando…</div>}
                {!isLoading && gruposHoje.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="h-7 w-7 mx-auto opacity-40 mb-2" />
                    <p className="text-sm font-semibold">Nenhuma visita hoje</p>
                    <p className="text-xs mt-1 opacity-70">Toque em "Nova entrada" para começar</p>
                  </div>
                )}
                {gruposHoje.map((v: any) => (
                  <VisitaRow key={v.id} visita={v} onRegistrarSaida={() => setSaidaVisita(v)} onDelete={onDelete} deleting={deletingId === v.id} />
                ))}
              </div>
            </div>
          </div>

          {/* Coluna lateral: Semana + Mês */}
          <div className="space-y-4">
            <SemanaCard grupos={gruposOutros} onRegistrarSaida={setSaidaVisita} onDelete={onDelete} deletingId={deletingId} />
            <MesCard grupos={grupos} />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {wizOpen && <NovaEntradaWizard open={wizOpen} onClose={() => setWizOpen(false)} />}
        {saidaFuncOpen && <ValidarSaidaFuncionarioDrawer open={saidaFuncOpen} onClose={() => setSaidaFuncOpen(false)} />}
        {saidaVisita && <RegistrarSaidaVisitaDialog open={!!saidaVisita} visita={saidaVisita} onClose={() => setSaidaVisita(null)} />}
      </Suspense>
    </div>
  );
}

function VisitaRow({ visita, onRegistrarSaida, onDelete, deleting }: { visita: any; onRegistrarSaida: () => void; onDelete?: (id: string) => void; deleting?: boolean }) {
  const pendente = visita.status === "DENTRO";
  return (
    <div className={`w-full flex items-center gap-3 px-3 lg:px-4 py-2.5 hover:bg-muted/40 transition ${pendente ? "border-l-2 border-destructive bg-destructive/5" : ""}`}>
      <button
        onClick={() => pendente && onRegistrarSaida()}
        disabled={!pendente}
        className="flex-1 min-w-0 flex items-center gap-3 text-left"
      >
      <div className="relative shrink-0">
        {visita.foto_rosto_url ? (
          <img src={visita.foto_rosto_url} className="h-10 w-10 rounded-full object-cover object-center border border-border bg-muted" alt="" loading="lazy" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted text-muted-foreground font-bold text-xs flex items-center justify-center border border-border">
            {visita.pessoa?.nome?.split(/\s+/).map((p: string) => p[0]).slice(0,2).join("").toUpperCase()}
          </div>
        )}
        {pendente && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse ring-2 ring-card" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{visita.pessoa?.nome}</p>
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground rounded px-1.5 py-0.5">{visita.tipo}</span>
          {visita.veiculo?.placa && (
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
              <Car className="h-2.5 w-2.5" /> {visita.veiculo.placa}
            </span>
          )}
          {visita.empresa?.name && (
            <span className="text-[9px] text-muted-foreground inline-flex items-center gap-0.5">
              <Building2 className="h-2.5 w-2.5" /> {visita.empresa.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          <span>Entrada {fmtHora(visita.entrada_at)}</span>
          {visita.saida_at && <span>· Saída {fmtHora(visita.saida_at)}</span>}
          {pendente && <span className="text-destructive font-semibold uppercase tracking-wider">· Pendente</span>}
        </div>
      </div>
      {pendente && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir visita (admin)">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir visita?</AlertDialogTitle>
              <AlertDialogDescription>
                Vai apagar a visita de <b>{visita.pessoa?.nome}</b> ({new Date(visita.entrada_at).toLocaleString("pt-BR")}) e seus acompanhantes. A pessoa e o veículo cadastrados <b>ficam</b> no cadastro. Ação irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(visita.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function SemanaCard({ grupos, onRegistrarSaida, onDelete, deletingId }: { grupos: [string, any[]][]; onRegistrarSaida: (v: any) => void; onDelete?: (id: string) => void; deletingId?: string | null }) {
  const iniSem = startOfWeek(new Date()).toISOString().slice(0,10);
  const gruposSemana = grupos.filter(([d]) => d >= iniSem);
  const total = gruposSemana.reduce((s, [,arr]) => s + arr.length, 0);
  return (
    <Collapsible defaultOpen={false}>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40">
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Esta semana</p>
            <h3 className="font-bold text-sm">{total} visitas</h3>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="divide-y divide-border border-t border-border">
          {gruposSemana.length === 0 && <p className="p-4 text-xs text-muted-foreground text-center">Sem visitas nos outros dias da semana</p>}
          {gruposSemana.map(([d, arr]) => (
            <div key={d}>
              <div className="px-4 py-2 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })} · {arr.length}
              </div>
              {arr.map((v) => <VisitaRow key={v.id} visita={v} onRegistrarSaida={() => onRegistrarSaida(v)} onDelete={onDelete} deleting={deletingId === v.id} />)}
            </div>
          ))}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function MesCard({ grupos }: { grupos: [string, any[]][] }) {
  const total = grupos.reduce((s, [,arr]) => s + arr.length, 0);
  const pend = grupos.reduce((s, [,arr]) => s + arr.filter((v: any) => v.status === "DENTRO").length, 0);
  const hoje = new Date();
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{MESES[hoje.getMonth()]} · {hoje.getFullYear()}</p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="font-bold text-2xl text-foreground">{total}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Pendentes
            </p>
            <p className={`font-bold text-2xl ${pend > 0 ? "text-destructive" : "text-muted-foreground"}`}>{pend}</p>
          </div>
        </div>
      </div>
    </div>
  );
}