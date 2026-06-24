import { useEffect, useMemo } from "react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronRight, ArrowLeft, Home } from "lucide-react";

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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function labelFor(seg: string): string {
  if (LABELS[seg]) return LABELS[seg];
  if (UUID_RE.test(seg)) return "Detalhe";
  // título com primeira maiúscula
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  } catch {}
}

export function SmartBreadcrumb() {
  const location = useLocation();
  const router = useRouter();
  const pathname = location.pathname;

  // Empilha histórico sempre que o pathname muda (ignora duplicados consecutivos)
  useEffect(() => {
    if (!pathname.startsWith("/app")) return;
    const stack = readStack();
    if (stack[stack.length - 1] !== pathname) {
      stack.push(pathname);
      writeStack(stack);
    }
  }, [pathname]);

  const segments = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean); // ex: ["app","employees","abc-uuid"]
    // monta crumbs acumulando href
    const crumbs: { href: string; label: string }[] = [];
    let acc = "";
    parts.forEach((seg) => {
      acc += "/" + seg;
      crumbs.push({ href: acc, label: labelFor(seg) });
    });
    return crumbs;
  }, [pathname]);

  const canGoBack = useMemo(() => readStack().length > 1, [pathname]);

  if (!pathname.startsWith("/app") || segments.length <= 1) return null;

  const goBack = () => {
    const stack = readStack();
    // remove a entrada atual e pega a anterior
    stack.pop();
    const prev = stack.pop();
    writeStack(stack);
    if (prev) {
      router.navigate({ to: prev });
    } else {
      router.history.back();
    }
  };

  return (
    <nav
      aria-label="Navegação"
      className="flex items-center gap-2 px-3 sm:px-4 py-1.5 border-b border-white/5 bg-black/20 text-[12px] text-rose-100/70 backdrop-blur"
    >
      {canGoBack && (
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white transition"
          title="Voltar para a página anterior"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Voltar</span>
        </button>
      )}
      <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />
      <ol className="flex items-center gap-1 min-w-0 overflow-hidden">
        {segments.map((c, i) => {
          const isLast = i === segments.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1 min-w-0">
              {i === 0 ? <Home className="h-3.5 w-3.5 shrink-0" /> : null}
              {isLast ? (
                <span className="text-white font-medium truncate">{c.label}</span>
              ) : (
                <Link
                  to={c.href}
                  className="hover:text-white truncate transition"
                >
                  {c.label}
                </Link>
              )}
              {!isLast && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
