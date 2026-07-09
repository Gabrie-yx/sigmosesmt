// Cockpit da Portaria — home mobile-first pro porteiro.
// Botões enormes, dedão-friendly, contadores ao vivo.
// Ao logar como "porteiro puro", o usuário cai direto aqui.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DoorOpen, Plus, LogOut, Clock3, Users, ChevronRight, AlertTriangle,
  ShieldAlert, ListChecks, Car,
} from "lucide-react";
import { InstallPwaCard } from "@/components/install-pwa-card";
const SaidasFuncHojeCard = lazy(() =>
  import("@/components/portaria/saidas-func-hoje-card").then((m) => ({ default: m.SaidasFuncHojeCard })),
);

const NovaEntradaWizard = lazy(() =>
  import("@/components/portaria/nova-entrada-wizard").then((m) => ({ default: m.NovaEntradaWizard })),
);
const ValidarSaidaFuncionarioDrawer = lazy(() =>
  import("@/components/portaria/validar-saida-funcionario-drawer").then((m) => ({ default: m.ValidarSaidaFuncionarioDrawer })),
);
const HoraExtraHojeCard = lazy(() =>
  import("@/components/portaria/hora-extra-hoje-card").then((m) => ({ default: m.HoraExtraHojeCard })),
);

export const Route = createFileRoute("/app/portaria/")({
  component: PortariaCockpit,
  head: () => ({
    meta: [
      { title: "Portaria · SIGMO" },
      { name: "description", content: "Cockpit da Portaria: entradas, saídas e hora extra do dia." },
    ],
  }),
});

const DIAS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

function turnoAtual() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Turno Manhã";
  if (h >= 12 && h < 18) return "Turno Tarde";
  return "Turno Noite";
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function PortariaCockpit() {
  const { user } = useAuth();
  const [wizOpen, setWizOpen] = useState(false);
  const [saidaFuncOpen, setSaidaFuncOpen] = useState(false);
  const hoje = new Date();
  const hoje0 = new Date(hoje); hoje0.setHours(0,0,0,0);

  // Nome do porteiro logado
  const { data: perfil } = useQuery({
    queryKey: ["porteiro-perfil", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  // KPIs ao vivo
  const { data: kpis } = useQuery({
    queryKey: ["portaria-cockpit-kpis"],
    queryFn: async () => {
      const [dentroRes, entradasRes] = await Promise.all([
        supabase.from("portaria_visitas").select("*", { count: "exact", head: true }).eq("status", "DENTRO"),
        supabase.from("portaria_visitas").select("*", { count: "exact", head: true }).gte("entrada_at", hoje0.toISOString()),
      ]);
      return { dentro: dentroRes.count ?? 0, entradasHoje: entradasRes.count ?? 0 };
    },
    refetchInterval: 20_000,
  });

  // Últimas 5 movimentações (feed)
  const { data: feed } = useQuery({
    queryKey: ["portaria-cockpit-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("portaria_visitas")
        .select("id, status, entrada_at, saida_at, foto_rosto_url, pessoa:pessoa_id(nome), veiculo:veiculo_id(placa)")
        .gte("entrada_at", hoje0.toISOString())
        .order("entrada_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 20_000,
  });

  const primeiroNome = (perfil?.full_name ?? user?.email ?? "Porteiro").split(" ")[0];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* HEADER — status do turno */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-primary/95 to-primary/85 text-primary-foreground backdrop-blur border-b border-primary/40 shadow-lg">
        <div className="mx-auto max-w-3xl px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-white/15 grid place-items-center ring-1 ring-white/25">
              <DoorOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 leading-none">
                {DIAS[hoje.getDay()]} · {hoje.toLocaleDateString("pt-BR")} · {turnoAtual()}
              </p>
              <h1 className="truncate text-lg font-black leading-tight mt-0.5">Olá, {primeiroNome}</h1>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 h-10 px-3 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition ring-1 ring-white/25 inline-flex items-center gap-1.5 font-black text-xs uppercase tracking-wider"
            onClick={() => alert("SOS: acione o SESMT/segurança do estaleiro imediatamente.")}
            aria-label="Emergência"
          >
            <ShieldAlert className="h-4 w-4" /> SOS
          </button>
        </div>

        {/* KPI strip */}
        <div className="mx-auto max-w-3xl px-4 pb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 ring-1 ring-white/15 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/70">Dentro agora</p>
            <p className="font-black text-2xl leading-none mt-1">{kpis?.dentro ?? 0}</p>
          </div>
          <div className="rounded-xl bg-white/10 ring-1 ring-white/15 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/70">Entradas hoje</p>
            <p className="font-black text-2xl leading-none mt-1">{kpis?.entradasHoje ?? 0}</p>
          </div>
        </div>
      </div>

      {/* CARDS DE AÇÃO — botões gigantes */}
      <div className="mx-auto max-w-3xl px-4 pt-4 space-y-3">
        <InstallPwaCard />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Ações rápidas</p>

        <button
          type="button"
          onClick={() => setWizOpen(true)}
          className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 flex items-center gap-4 shadow-xl shadow-primary/30 ring-1 ring-primary/40 active:scale-[0.98] transition"
        >
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-white/20 grid place-items-center ring-1 ring-white/25">
            <Plus className="h-7 w-7" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="font-black text-xl leading-tight">Nova entrada</p>
            <p className="text-xs text-white/80 font-semibold mt-0.5">Visitante, fornecedor ou veículo</p>
          </div>
          <ChevronRight className="h-6 w-6 opacity-70 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setSaidaFuncOpen(true)}
          className="w-full rounded-2xl bg-card border-2 border-border p-5 flex items-center gap-4 shadow-md active:scale-[0.98] transition hover:border-primary/40"
        >
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-emerald-500/15 text-emerald-600 grid place-items-center ring-1 ring-emerald-500/30">
            <LogOut className="h-7 w-7" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="font-black text-xl leading-tight text-foreground">Saída de funcionário</p>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">Validar quem tá saindo do estaleiro</p>
          </div>
          <ChevronRight className="h-6 w-6 text-muted-foreground shrink-0" />
        </button>

        <Link
          to="/app/portaria/controle-entrada"
          className="w-full rounded-2xl bg-card border-2 border-border p-5 flex items-center gap-4 shadow-md active:scale-[0.98] transition hover:border-primary/40"
        >
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-blue-500/15 text-blue-600 grid place-items-center ring-1 ring-blue-500/30">
            <ListChecks className="h-7 w-7" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="font-black text-xl leading-tight text-foreground">Movimento do dia</p>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">Ver todas as visitas e registrar saídas</p>
          </div>
          <ChevronRight className="h-6 w-6 text-muted-foreground shrink-0" />
        </Link>

        {/* HORA EXTRA HOJE — card completo já pronto */}
        <div className="pt-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-2">Hora extra do dia</p>
          <Suspense fallback={<div className="rounded-2xl bg-muted/40 h-32 animate-pulse" />}>
            <HoraExtraHojeCard />
          </Suspense>
        </div>

        {/* FEED — últimas movimentações */}
        <div className="pt-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-2">Saídas de funcionário hoje</p>
          <Suspense fallback={<div className="rounded-2xl bg-muted/40 h-32 animate-pulse" />}>
            <SaidasFuncHojeCard limit={5} />
          </Suspense>
        </div>

        <div className="pt-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-2">Últimas movimentações</p>
          <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
            {(!feed || feed.length === 0) && (
              <div className="p-6 text-center text-muted-foreground">
                <Users className="h-6 w-6 mx-auto opacity-40 mb-2" />
                <p className="text-xs font-semibold">Nada rolando ainda hoje</p>
              </div>
            )}
            {feed?.map((v: any) => {
              const pendente = v.status === "DENTRO";
              return (
                <div key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                  {v.foto_rosto_url ? (
                    <img src={v.foto_rosto_url} className="h-10 w-10 rounded-full object-cover object-top border border-border shrink-0" alt="" loading="lazy" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted grid place-items-center text-[10px] font-black text-muted-foreground shrink-0">
                      {v.pessoa?.nome?.split(/\s+/).map((p: string) => p[0]).slice(0,2).join("").toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate text-foreground">{v.pessoa?.nome ?? "—"}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <Clock3 className="h-3 w-3" />
                      <span>Entrou {fmtHora(v.entrada_at)}</span>
                      {v.saida_at && <span>· Saiu {fmtHora(v.saida_at)}</span>}
                      {v.veiculo?.placa && (
                        <span className="inline-flex items-center gap-0.5">
                          <Car className="h-3 w-3" /> {v.veiculo.placa}
                        </span>
                      )}
                    </div>
                  </div>
                  {pendente ? (
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-wider bg-destructive/15 text-destructive rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> Dentro
                    </span>
                  ) : (
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 rounded-full px-2 py-0.5">
                      Saiu
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {wizOpen && <NovaEntradaWizard open={wizOpen} onClose={() => setWizOpen(false)} />}
        {saidaFuncOpen && <ValidarSaidaFuncionarioDrawer open={saidaFuncOpen} onClose={() => setSaidaFuncOpen(false)} />}
      </Suspense>
    </div>
  );
}