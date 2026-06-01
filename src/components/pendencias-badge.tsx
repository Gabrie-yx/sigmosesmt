import { Link } from "@tanstack/react-router";
import { Bell, ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePendencias, type PendenciaItem, severityRank } from "@/hooks/use-pendencias";
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
  const temCritico = activeItems.some((i) => i.severity === "critico");
  const cor = temCritico ? "bg-red-500" : totalPendencias > 0 ? "bg-amber-400 text-amber-950" : "bg-emerald-500";

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
    .slice(0, 3);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={totalPendencias === 0 ? "Sem pendências" : `${totalPendencias} pendência(s)`}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-white/85 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Bell className="h-4 w-4" />
        {totalPendencias > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center shadow-md ring-2 ring-[#7f1212] text-white",
            cor,
            temCritico && "animate-pulse",
          )}>
            {totalPendencias > 99 ? "99+" : totalPendencias}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] rounded-xl border bg-white shadow-2xl z-[90] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              {totalPendencias === 0 ? "Tudo em dia" : `${totalPendencias} pendência${totalPendencias > 1 ? "s" : ""}`}
            </div>
            {temCritico && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500 text-white">
                Crítico
              </span>
            )}
          </div>

          {top.length === 0 ? (
            <div className="px-4 py-6 flex flex-col items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
              <div className="text-xs font-bold uppercase">Nenhuma pendência</div>
            </div>
          ) : (
            <ul className="divide-y">
              {top.map((it) => {
                const meta = LABELS[it.key] ?? { titulo: it.key, sub: "" };
                return (
                  <li key={it.key}>
                    <Link
                      to="/app/hoje"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", severityCor(it.severity))} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-slate-800 truncate">{meta.titulo}</div>
                          <span className="text-[10px] font-black text-slate-500 shrink-0">{it.count}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{meta.sub}</div>
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
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-[#7f1212] hover:bg-red-50 border-t transition-colors"
          >
            Ver todas as pendências <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
