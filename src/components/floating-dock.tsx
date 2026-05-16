import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  FileWarning,
  Megaphone,
  BookOpen,
  GraduationCap,
  Package,
  FolderOpen,
  X,
  ExternalLink,
  Maximize2,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type DockItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { label: string; path: string }[];
};

const ITEMS: DockItem[] = [
  { label: "Painel", path: "/app/painel", icon: LayoutDashboard },
  { label: "Colaboradores", path: "/app/employees", icon: Users },
  { label: "APRs", path: "/app/aprs", icon: ShieldAlert },
  { label: "PTEs", path: "/app/ptes", icon: FileWarning },
  { label: "DDS", path: "/app/dds", icon: Megaphone },
  { label: "POPs", path: "/app/sesmt/procedimentos", icon: BookOpen },
  { label: "Matriz Treinamento", path: "/app/matriz-treinamento", icon: GraduationCap },
  { label: "Estoque", path: "/app/estoque/epi", icon: Package },
  {
    label: "Documentos",
    path: "/app/sesmt/docs",
    icon: FolderOpen,
    children: [
      { label: "Documentos SESMT", path: "/app/sesmt/docs" },
      { label: "Procedimentos / POPs", path: "/app/sesmt/procedimentos" },
      { label: "Painel de Terceiros", path: "/app/sesmt/terceiros" },
      { label: "Requisições de Compra", path: "/app/sesmt/requisicoes" },
    ],
  },
];

export function FloatingDock() {
  const [dockOpen, setDockOpen] = useState(false);
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const [drawerLabel, setDrawerLabel] = useState<string>("");
  const [submenuOpen, setSubmenuOpen] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  // Hover na borda esquerda abre o dock
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (e.clientX <= 6) {
        if (closeTimer.current) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
        setDockOpen(true);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Atalhos Alt+1..8 abrem o item no drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      // Esc fecha drawer
      if (e.key === "Escape" && drawerPath) {
        setDrawerPath(null);
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= ITEMS.length) {
        e.preventDefault();
        const item = ITEMS[n - 1];
        if (item.children?.length) {
          setSubmenuOpen(item.path);
          setDockOpen(true);
        } else {
          openDrawer(item);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerPath]);

  function openDrawer(item: { label: string; path: string }) {
    setDrawerPath(item.path);
    setDrawerLabel(item.label);
    setSubmenuOpen(null);
    setDockOpen(false);
  }

  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setDockOpen(false), 400);
  }

  return (
    <>
      {/* Zona invisível de captura na borda esquerda */}
      <div
        aria-hidden
        className="fixed left-0 top-0 h-screen w-2 z-[60]"
        onMouseEnter={() => setDockOpen(true)}
      />

      {/* Dock flutuante */}
      <div
        onMouseEnter={() => {
          if (closeTimer.current) {
            window.clearTimeout(closeTimer.current);
            closeTimer.current = null;
          }
          setDockOpen(true);
        }}
        onMouseLeave={() => {
          scheduleClose();
          setSubmenuOpen(null);
        }}
        className={cn(
          "fixed left-2 top-1/2 -translate-y-1/2 z-[70] transition-all duration-200",
          dockOpen ? "translate-x-0 opacity-100" : "-translate-x-[120%] opacity-0 pointer-events-none",
        )}
      >
        <div className="relative flex flex-col gap-1 rounded-2xl border bg-white/95 backdrop-blur shadow-2xl p-2">
          <div className="text-[10px] uppercase font-bold text-slate-400 text-center px-1 pb-1 border-b">
            Atalhos
          </div>
          {ITEMS.map((it, idx) => {
            const Icon = it.icon;
            const hasChildren = !!it.children?.length;
            const isSubOpen = submenuOpen === it.path;
            return (
              <div
                key={it.path}
                className="relative"
                onMouseEnter={() => hasChildren && setSubmenuOpen(it.path)}
              >
                <button
                  onClick={() => (hasChildren ? setSubmenuOpen(isSubOpen ? null : it.path) : openDrawer(it))}
                  title={`${it.label} (Alt+${idx + 1})`}
                  className={cn(
                    "group relative flex w-full items-center gap-2 px-2 py-2 rounded-lg hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors",
                    isSubOpen && "bg-red-50 text-red-700",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-xs font-semibold whitespace-nowrap pr-2">{it.label}</span>
                  {hasChildren ? (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <kbd className="ml-auto text-[9px] font-mono bg-slate-100 group-hover:bg-white border rounded px-1">
                      ⌥{idx + 1}
                    </kbd>
                  )}
                </button>
                {hasChildren && isSubOpen && (
                  <div className="absolute left-full top-0 ml-2 min-w-[220px] rounded-2xl border bg-white/95 backdrop-blur shadow-2xl p-2 z-[71] animate-in fade-in slide-in-from-left-2 duration-150">
                    {it.children!.map((c) => (
                      <button
                        key={c.path}
                        onClick={() => openDrawer(c)}
                        className="flex w-full items-center gap-2 px-2 py-2 rounded-lg hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors text-xs font-semibold whitespace-nowrap"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer lateral direito 85% com iframe — preserva 100% do estado da tela atual */}
      {drawerPath && (
        <div className="fixed inset-0 z-[80] flex">
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm animate-in fade-in"
            onClick={() => setDrawerPath(null)}
          />
          <div className="w-[85vw] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center gap-2 border-b px-4 py-2 bg-slate-50">
              <div className="text-xs uppercase font-bold text-slate-500">Visualização rápida</div>
              <div className="text-sm font-bold text-slate-800">· {drawerLabel}</div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => {
                    const p = drawerPath;
                    setDrawerPath(null);
                    if (p) navigate({ to: p });
                  }}
                  title="Abrir em tela cheia"
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
                <a
                  href={drawerPath}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir em nova aba"
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => setDrawerPath(null)}
                  title="Fechar (Esc)"
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              key={drawerPath}
              src={drawerPath}
              title={drawerLabel}
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </>
  );
}