import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, ArrowRight, CheckCircle2, ShoppingCart, Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePendencias, type PendenciaItem, severityRank } from "@/hooks/use-pendencias";
import { useAuth } from "@/hooks/use-auth";
import { contarRcsPendentes } from "@/lib/rc-public.functions";
import { cn } from "@/lib/utils";

const LABELS: Record<string, { titulo: string; sub: string }> = {
  "asos-vencidos": { titulo: "ASOs vencidos", sub: "Bloqueia acesso à obra" },
  "aprs-vencidas": { titulo: "APRs vencidas", sub: "Renovar antes de liberar trabalho" },
  "pops-atrasados": { titulo: "POPs com revisão atrasada", sub: "Procedimentos fora do prazo" },
  "vacinas-vencidas": { titulo: "Vacinas vencidas", sub: "Próxima dose em atraso" },
  "colab-sem-docs": { titulo: "Colaboradores sem ASO/integração", sub: "Novos sem documentação" },
  "dds-hoje": { titulo: "DDS pendente hoje", sub: "Diálogo de segurança do dia" },
  "aprs-vencendo": { titulo: "APRs vencendo em 7 dias", sub: "Programar renovação" },
  "ptes-vencidas": { titulo: "PTEs com mais de 7 dias", sub: "Trabalho a quente / altura / confinado" },
  "exames-30": { titulo: "ASOs vencendo em 30 dias", sub: "Agendar exames" },
  "trein-60": { titulo: "Treinamentos vencendo em 60 dias", sub: "Programar reciclagem" },
  "req-pendentes": { titulo: "Requisições de compra pendentes", sub: "Aguardando aprovação" },
  "epi-baixo": { titulo: "EPIs com estoque baixo", sub: "Repor antes da falta" },
  "inspecao-epi": { titulo: "Inspeção mensal de EPI", sub: "Rotina do mês" },
  "extintores-vencidos": { titulo: "Extintores com recarga vencida", sub: "Bloqueia uso — NR-23" },
  "extintores-sem-inspecao": { titulo: "Extintores sem inspeção no mês", sub: "Checklist FOR-SFG 08" },
  "oss-pendentes": { titulo: "OSS pendentes (NR-01)", sub: "Ordens de Serviço a tratar" },
};

function severityCor(s: PendenciaItem["severity"]) {
  if (s === "critico") return "bg-red-500";
  if (s === "alto") return "bg-amber-500";
  if (s === "medio") return "bg-sky-500";
  return "bg-emerald-500";
}

export function PendenciasBadge() {
  const { totalPendencias, activeItems } = usePendencias();
  const navigate = useNavigate();
  const { user, isEditor } = useAuth();

  // RC items (Compras / Supervisor / Solicitante) — antes viviam num badge separado
  const fetchRc = useServerFn(contarRcsPendentes);
  const { data: rcData } = useQuery({
    queryKey: ["rc-header-badge", user?.id],
    queryFn: () => fetchRc(),
    enabled: !!user && isEditor,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  type RcAlert = {
    key: string;
    count: number;
    titulo: string;
    sub: string;
    to: "/app/compras/requisicoes-recebidas" | "/app/sesmt/requisicoes";
    tab?: string;
    Icon: typeof ShoppingCart;
  };
  const rcAlerts: RcAlert[] = [];
  if (rcData) {
    if (rcData.isCompras && rcData.recebidas) {
      rcAlerts.push({
        key: "rc-compras",
        count: rcData.recebidas,
        titulo: "RCs na fila do Compras",
        sub: "Aguardando cotação",
        to: "/app/compras/requisicoes-recebidas",
        Icon: Package,
      });
    }
    if (rcData.isSupervisor && rcData.cotadas) {
      rcAlerts.push({
        key: "rc-supervisor",
        count: rcData.cotadas,
        titulo: "RCs cotadas aguardando decisão",
        sub: "Deferir / indeferir",
        to: "/app/sesmt/requisicoes",
        tab: "COTADA",
        Icon: ShoppingCart,
      });
    }
    if (!rcData.isSupervisor && !rcData.isCompras && rcData.pendentes) {
      rcAlerts.push({
        key: "rc-solicitante",
        count: rcData.pendentes,
        titulo: "Suas RCs pendentes",
        sub: "Aguardando cotação do Compras",
        to: "/app/sesmt/requisicoes",
        tab: "PENDENTE",
        Icon: ShoppingCart,
      });
    }
  }

  const totalGeral = totalPendencias + rcAlerts.length;
  const temCritico = activeItems.some((i) => i.severity === "critico");
  const cor = temCritico
    ? "bg-primary"
    : totalGeral > 0
      ? "bg-primary/80"
      : "bg-emerald-500";

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const top = [...activeItems]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 4);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={totalGeral === 0 ? "Sem pendências" : `${totalGeral} pendência(s)`}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-white/85 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Bell className="h-4 w-4" />
        {totalGeral > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center shadow-md ring-2 ring-[#7f1212] text-white",
            cor,
            temCritico && "animate-pulse",
          )}>
            {totalGeral > 99 ? "99+" : totalGeral}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl z-[90] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-wider text-foreground">
              {totalGeral === 0 ? "Tudo em dia" : `${totalGeral} pendência${totalGeral > 1 ? "s" : ""}`}
            </div>
            {temCritico && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                Crítico
              </span>
            )}
          </div>

          {top.length === 0 && rcAlerts.length === 0 ? (
            <div className="px-4 py-6 flex flex-col items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
              <div className="text-xs font-bold uppercase">Nenhuma pendência</div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rcAlerts.map((rc) => (
                <li key={rc.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (rc.to === "/app/compras/requisicoes-recebidas") {
                        navigate({ to: rc.to });
                      } else {
                        navigate({ to: rc.to, search: { tab: rc.tab } as any });
                      }
                      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
                    }}
                    className="w-full text-left flex items-stretch gap-0 hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {/* Faixa amarela lateral: sinaliza que é RC */}
                    <span className="w-1 bg-amber-400 shrink-0" aria-hidden />
                    <div className="flex items-start gap-2 px-3 py-2.5 flex-1 min-w-0">
                      <rc.Icon className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold truncate">
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 mr-1.5 px-1 py-0.5 rounded bg-amber-400/15">RC</span>
                            {rc.titulo}
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground shrink-0">{rc.count}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{rc.sub}</div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
              {top.map((it) => {
                const meta = LABELS[it.key] ?? { titulo: it.key, sub: "" };
                return (
                  <li key={it.key}>
                    <Link
                      to="/app/hoje"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", severityCor(it.severity))} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-foreground truncate">{meta.titulo}</div>
                          <span className="text-[10px] font-black text-muted-foreground shrink-0">{it.count}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{meta.sub}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            to="/app/hoje"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary hover:bg-accent border-t border-border transition-colors"
          >
            Ver todas as pendências <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
