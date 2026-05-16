import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  CalendarCheck2,
  Users,
  Settings,
  X,
  ExternalLink,
  Maximize2,
  ChevronRight,
  ClipboardList,
  HardHat,
  SearchCheck,
  Wrench,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type DockItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  children?: { label: string; path: string }[];
};

const ITEMS: DockItem[] = [
  {
    label: "O que fazer hoje",
    path: "/app/hoje",
    icon: CalendarCheck2,
    hint: "Pendências e alertas do dia",
  },
  {
    label: "Painel",
    path: "/app/painel",
    icon: LayoutDashboard,
    hint: "Indicadores SESMT",
  },
  {
    label: "Planejar",
    path: "__group_plan",
    icon: ClipboardList,
    hint: "PLAN · POPs, matriz, docs",
    children: [
      { label: "Procedimentos / POPs", path: "/app/sesmt/procedimentos" },
      { label: "Matriz de Treinamento", path: "/app/matriz-treinamento" },
      { label: "Documentos SESMT", path: "/app/sesmt/docs" },
      { label: "Requisições de Compra", path: "/app/sesmt/requisicoes" },
    ],
  },
  {
    label: "Executar",
    path: "__group_do",
    icon: HardHat,
    hint: "DO · execução diária",
    children: [
      { label: "DDS — Diálogo de Segurança", path: "/app/dds" },
      { label: "APRs — Análise de Risco", path: "/app/aprs" },
      { label: "PTEs — Permissão de Trabalho", path: "/app/ptes" },
      { label: "Treinamentos", path: "/app/trainings" },
      { label: "Entrega de EPI", path: "/app/estoque/epi" },
    ],
  },
  {
    label: "Verificar",
    path: "__group_check",
    icon: SearchCheck,
    hint: "CHECK · inspeções e indicadores",
    children: [
      { label: "Estoque de EPIs", path: "/app/estoque/epi" },
      { label: "Estoque SESMT", path: "/app/estoque/sesmt" },
      { label: "Painel de Terceiros", path: "/app/sesmt/terceiros" },
      { label: "Reincidência de EPI", path: "/app/relatorios/reincidencia-epi" },
    ],
  },
  {
    label: "Agir",
    path: "__group_act",
    icon: Wrench,
    hint: "ACT · correções e auditoria",
    children: [
      { label: "Não Conformidades", path: "/app/ncs" },
      { label: "Incidentes / Investigação", path: "/app/incidentes" },
      { label: "Plano de Ações (5W2H)", path: "/app/acoes" },
      { label: "Auditoria", path: "/app/audit" },
    ],
  },
  {
    label: "Pessoas",
    path: "__group_pessoas",
    icon: Users,
    hint: "Funcionários e cascos",
    children: [
      { label: "Funcionários", path: "/app/employees" },
      { label: "Cascos / Embarcações", path: "/app/cascos" },
    ],
  },
  {
    label: "Configurar",
    path: "__group_configurar",
    icon: Settings,
    hint: "Usuários, empresas, papéis",
    children: [
      { label: "Empresas", path: "/app/companies" },
      { label: "Usuários", path: "/app/users" },
      { label: "Papéis e Permissões", path: "/app/roles" },
    ],
  },
];

export function FloatingDock() {
  const [dockOpen, setDockOpen] = useState(false);
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const [drawerLabel, setDrawerLabel] = useState<string>("");
  const [submenuOpen, setSubmenuOpen] = useState<string | null>(null);
  const [mobileSheet, setMobileSheet] = useState<DockItem | null>(null);
  const closeTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  // Hover na borda esquerda abre o dock (apenas em telas com mouse)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mq.matches) return;
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
    setMobileSheet(null);
  }

  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setDockOpen(false), 400);
  }

  return (
    <>
      {/* Zona invisível de captura na borda esquerda (desktop) */}
      <div
        aria-hidden
        className="fixed left-0 top-0 h-screen w-2 z-[60] hidden md:block"
        onMouseEnter={() => setDockOpen(true)}
      />

      {/* Dock flutuante (desktop / tablet ≥ md) */}
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
          "fixed left-2 top-1/2 -translate-y-1/2 z-[70] transition-all duration-200 hidden md:block",
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
                    "group relative flex w-full items-center gap-2 px-2 py-2 rounded-lg hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors min-w-[210px]",
                    isSubOpen && "bg-red-50 text-red-700",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex flex-col items-start leading-tight pr-2">
                    <span className="text-xs font-semibold whitespace-nowrap">{it.label}</span>
                    {it.hint && (
                      <span className="text-[10px] font-normal text-slate-400 group-hover:text-red-400 whitespace-nowrap">
                        {it.hint}
                      </span>
                    )}
                  </span>
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

      {/* Bottom-nav mobile (< md) */}
      <nav
        aria-label="Menu principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-[70] border-t bg-white/95 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-6">
          {ITEMS.slice(0, 6).map((it) => {
            const Icon = it.icon;
            const hasChildren = !!it.children?.length;
            return (
              <button
                key={it.path}
                onClick={() => (hasChildren ? setMobileSheet(it) : openDrawer(it))}
                className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-slate-600 active:bg-red-50 active:text-red-700"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold leading-tight text-center line-clamp-1">
                  {it.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom-sheet mobile com filhos do grupo */}
      {mobileSheet && (() => {
        const SheetIcon = mobileSheet.icon;
        return (
        <div className="md:hidden fixed inset-0 z-[75] flex flex-col">
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileSheet(null)}
          />
          <div className="bg-white rounded-t-2xl shadow-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <div className="flex items-center gap-2 mb-3">
              <SheetIcon className="h-5 w-5 text-red-700" />
              <div className="text-sm font-bold text-slate-800">{mobileSheet.label}</div>
            </div>
            {mobileSheet.hint && (
              <div className="text-xs text-slate-500 mb-3">{mobileSheet.hint}</div>
            )}
            <div className="flex flex-col gap-1">
              {mobileSheet.children!.map((c) => (
                <button
                  key={c.path}
                  onClick={() => openDrawer(c)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 text-sm font-semibold"
                >
                  <span>{c.label}</span>
                  <ChevronRight className="h-4 w-4 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Drawer lateral direito 85% com iframe — preserva 100% do estado da tela atual */}
      {drawerPath && (
        <div className="fixed inset-0 z-[80] flex">
          <div
            className="hidden md:block flex-1 bg-black/40 backdrop-blur-sm animate-in fade-in"
            onClick={() => setDrawerPath(null)}
          />
          <div className="w-full md:w-[85vw] ml-auto h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
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