import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, BarChart3, History, BookOpen, Users } from "lucide-react";

type Tab = { to: string; label: string; icon: typeof ClipboardList; exact?: boolean };
const tabs: Tab[] = [
  { to: "/app/dds", label: "Sessões", icon: ClipboardList, exact: true },
  { to: "/app/dds/painel", label: "Painel", icon: BarChart3 },
  { to: "/app/dds/historico", label: "Histórico", icon: History },
  { to: "/app/dds/temas", label: "Temas", icon: BookOpen },
  { to: "/app/dds/gestores", label: "Gestores", icon: Users },
];

export function DDSTabsNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900/40 border border-white/5 rounded-xl backdrop-blur-sm">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to as any}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
              active
                ? "bg-gradient-to-br from-rose-600 to-rose-800 text-white shadow-[0_4px_18px_-4px_rgba(244,63,94,0.6)] scale-[1.02]"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}