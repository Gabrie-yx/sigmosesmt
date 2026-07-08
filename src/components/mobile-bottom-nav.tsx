import { Link, useLocation } from "@tanstack/react-router";
import { CalendarCheck2, LayoutDashboard, Zap, Menu, User, CalendarClock } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

/**
 * Barra de ações fixa no rodapé — só aparece no mobile (< md).
 * Fornece os atalhos mais usados pra qualquer tela do /app:
 *  - Hoje (agenda pessoal do dia)
 *  - Painel SESMT
 *  - Ações rápidas (Ctrl/⌘+K → CommandPalette)
 *  - Menu (abre a Sidebar como drawer)
 *  - Conta (Segurança / MFA / logout)
 */
export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { toggleSidebar } = useSidebar();
  const { isModerator, isExtraSabadoMarcador } = useAuth();

  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(to + "/");

  const triggerCommandPalette = () => {
    const isMac =
      typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
      }),
    );
  };

  const itemBase =
    "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors";
  const idle = "text-white/70 hover:text-white";
  const active = "text-white";

  return (
    <nav
      aria-label="Navegação rápida"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-gradient-to-b from-[#7f1212] to-[#5a0d0d] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch">
        {isModerator && (
          <Link
            to="/app/hoje"
            className={cn(itemBase, isActive("/app/hoje") ? active : idle)}
          >
            <CalendarCheck2 className={cn("h-5 w-5", isActive("/app/hoje") && "scale-110")} />
            <span className="truncate">Hoje</span>
          </Link>
        )}
        {!isModerator && isExtraSabadoMarcador && (
          <Link
            to="/app/modulo/$modulo/hora-extra"
            params={{ modulo: "terceirizadas" }}
            className={cn(itemBase, isActive("/app/modulo/terceirizadas/hora-extra") ? active : idle)}
          >
            <CalendarClock className={cn("h-5 w-5", isActive("/app/modulo/terceirizadas/hora-extra") && "scale-110")} />
            <span className="truncate">H. Extra</span>
          </Link>
        )}
        <Link
          to="/app/painel"
          className={cn(itemBase, isActive("/app/painel") ? active : idle)}
        >
          <LayoutDashboard className={cn("h-5 w-5", isActive("/app/painel") && "scale-110")} />
          <span className="truncate">Painel</span>
        </Link>
        <button
          type="button"
          onClick={triggerCommandPalette}
          className="flex flex-col items-center justify-center flex-1 min-w-0 py-1 -mt-4"
          aria-label="Ações rápidas"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[#5a0d0d] shadow-lg ring-4 ring-[#5a0d0d]">
            <Zap className="h-5 w-5" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-white mt-0.5">
            Ações
          </span>
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(itemBase, idle)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
          <span className="truncate">Menu</span>
        </button>
        <Link
          to="/app/conta/seguranca"
          className={cn(itemBase, isActive("/app/conta") ? active : idle)}
        >
          <User className={cn("h-5 w-5", isActive("/app/conta") && "scale-110")} />
          <span className="truncate">Conta</span>
        </Link>
      </div>
    </nav>
  );
}
