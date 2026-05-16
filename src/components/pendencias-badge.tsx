import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { usePendencias } from "@/hooks/use-pendencias";
import { cn } from "@/lib/utils";

export function PendenciasBadge() {
  const { totalPendencias, activeItems } = usePendencias();
  const temCritico = activeItems.some((i) => i.severity === "critico");
  const cor = temCritico ? "bg-red-500" : totalPendencias > 0 ? "bg-amber-400 text-amber-950" : "bg-emerald-500";

  return (
    <Link
      to="/app/hoje"
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
    </Link>
  );
}
