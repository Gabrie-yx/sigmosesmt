import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronRight, ArrowLeft, Home, X } from "lucide-react";

/**
 * Mapa de rótulos por segmento de rota.
 * Chave = primeiro/segundo nível depois de /app/.
 * Para IDs dinâmicos (UUIDs) mostramos "Detalhe".
 */
const LABELS: Record<string, string> = {
  app: "Início",
  hoje: "Hoje",
  employees: "Funcionários",
  cascos: "Cascos",
  companies: "Empresas",
  aprs: "APRs",
  ptes: "PTEs",
  oss: "OSS",
  acoes: "Plano de Ação",
  acidentes: "Acidentes",
  audit: "Auditoria",
  assinador: "Assinador",
  "controle-documentos": "Controle de Documentos",
  "configuracoes-indicadores": "Indicadores",
  sesmt: "SESMT",
  "convocacoes-aso": "Convocações ASO",
  docs: "Documentos",
  procedimentos: "Procedimentos",
  requisicoes: "Requisições",
  "equipamentos-moveis": "Equipamentos Móveis",
  "guia-documentos": "Guia de Documentos",
  catalogos: "Catálogos",
  gases: "Gases Atmosféricos",
  conta: "Conta",
  seguranca: "Segurança",
  producao: "Produção",
  "painel-lista-tecnica": "Lista Técnica",
  estoque: "Estoque",
  epi: "EPI",
  treinamentos: "Treinamentos",
  dds: "DDS",
  pgr: "PGR",
  pcmso: "PCMSO",
};

const STACK_KEY = "sigmo.navstack";
const MAX_STACK = 25;
const STACK_EVT = "sigmo.navstack.changed";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function labelFor(seg: string): string {
  if (LABELS[seg]) return LABELS[seg];
  if (UUID_RE.test(seg)) return "Detalhe";
  // título com primeira maiúscula
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelForPath(path: string): string {
  const parts = path.split("/").filter(Boolean).filter((p) => p !== "app");
  if (parts.length === 0) return "Início";
  // Pega os 2 últimos segmentos significativos pro rótulo
  const meaningful = parts.filter((p) => !UUID_RE.test(p));
  const last = meaningful[meaningful.length - 1] ?? parts[parts.length - 1];
  // Se o último é UUID, mostra "Pai · Detalhe"
  const lastIsUuid = UUID_RE.test(parts[parts.length - 1]);
  if (lastIsUuid && meaningful.length > 0) {
    return `${labelFor(last)} · Detalhe`;
  }
  return labelFor(last);
}

function readStack(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(STACK_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeStack(s: string[]) {
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(s.slice(-MAX_STACK)));
    window.dispatchEvent(new Event(STACK_EVT));
  } catch {}
}

export function SmartBreadcrumb() {
  const location = useLocation();
  const router = useRouter();
  const pathname = location.pathname;
  const [stack, setStack] = useState<string[]>(() => readStack());

  // Empilha histórico sempre que o pathname muda (ignora duplicados consecutivos)
  useEffect(() => {
    if (!pathname.startsWith("/app")) return;
    const s = readStack();
    if (s[s.length - 1] !== pathname) {
      s.push(pathname);
      writeStack(s);
    }
    setStack(readStack());
  }, [pathname]);

  // escuta mudanças externas no stack (clear de outras abas/limpeza)
  useEffect(() => {
    const sync = () => setStack(readStack());
    window.addEventListener(STACK_EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STACK_EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Trilha = histórico de páginas visitadas (sem duplicatas consecutivas)
  const trail = useMemo(() => {
    const seen = new Set<string>();
    const out: { href: string; label: string }[] = [];
    for (const p of stack) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push({ href: p, label: labelForPath(p) });
    }
    // Colapsa itens consecutivos com o MESMO rótulo — mantém o href mais recente.
    // Evita a fileira infinita de "Funcionários · Detalhe" ao abrir vários registros.
    const collapsed: { href: string; label: string }[] = [];
    for (const item of out) {
      const last = collapsed[collapsed.length - 1];
      if (last && last.label === item.label) {
        last.href = item.href; // atualiza pro mais recente
      } else {
        collapsed.push({ ...item });
      }
    }
    return collapsed;
  }, [stack]);

  // Cap visual: mostra no máximo N itens com "…" no meio (primeiro + últimos).
  const MAX_VISIBLE = 6;
  const visibleTrail = useMemo(() => {
    if (trail.length <= MAX_VISIBLE) {
      return trail.map((c) => ({ kind: "item" as const, ...c }));
    }
    const first = trail[0];
    const tail = trail.slice(-(MAX_VISIBLE - 2));
    return [
      { kind: "item" as const, ...first },
      { kind: "ellipsis" as const, href: "__ellipsis__", label: "…" },
      ...tail.map((c) => ({ kind: "item" as const, ...c })),
    ];
  }, [trail]);

  const canGoBack = stack.length > 1;

  if (!pathname.startsWith("/app")) return null;

  const goBack = () => {
    const s = readStack();
    // remove a entrada atual e pega a anterior
    s.pop();
    const prev = s.pop();
    writeStack(s);
    if (prev) {
      router.navigate({ to: prev });
    } else {
      router.history.back();
    }
  };

  const clearTrail = () => {
    writeStack([pathname]);
    setStack([pathname]);
  };

  return (
    <nav
      aria-label="Navegação"
      className="smart-breadcrumb relative flex items-center gap-2 px-3 sm:px-4 py-1.5 text-[12px] text-rose-100/70 w-full bg-gradient-to-b from-white/[0.06] via-white/[0.02] to-transparent backdrop-blur-xl border-y border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(255,255,255,0.04)]"
    >
      {canGoBack && (
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white transition shrink-0"
          title="Voltar para a página anterior"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Voltar</span>
        </button>
      )}
      <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block shrink-0" />
      <ol
        className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden"
      >
        <li className="flex items-center gap-1 shrink-0">
          <Home className="h-3.5 w-3.5 shrink-0" />
        </li>
        {visibleTrail.length > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
        {visibleTrail.map((c, i) => {
          const isLast = i === visibleTrail.length - 1;
          if (c.kind === "ellipsis") {
            return (
              <li key={`ell-${i}`} className="flex items-center gap-1 shrink-0">
                <span className="px-1.5 py-0.5 text-rose-100/50 select-none" title={`${trail.length} páginas no histórico`}>
                  …
                </span>
                {!isLast && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
              </li>
            );
          }
          const isActive = c.href === pathname;
          return (
            <li key={c.href + i} className="flex items-center gap-1 min-w-0">
              <Link
                to={c.href}
                className={
                  isActive
                    ? "truncate max-w-[220px] text-white font-semibold px-1.5 py-0.5 rounded-md bg-rose-500/15 ring-1 ring-rose-300/30 shadow-[0_0_12px_-2px_rgba(244,63,94,0.55)] animate-[crumb-pulse_2.2s_ease-in-out_infinite]"
                    : "truncate max-w-[160px] hover:text-white transition opacity-80"
                }
              >
                {c.label}
              </Link>
              {!isLast && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
            </li>
          );
        })}
      </ol>
      {trail.length > 1 && (
        <button
          onClick={clearTrail}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white transition shrink-0 text-rose-100/60"
          title="Limpar histórico de navegação"
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Limpar</span>
        </button>
      )}
      {/* flare superior fininho */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </nav>
  );
}
