import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HELP_TOPICS, type HelpTopic } from "@/lib/help-content";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, ArrowRight, HelpCircle } from "lucide-react";

type Search = { q?: string };

export const Route = createFileRoute("/app/ajuda")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Central de Ajuda — SIGMO" },
      { name: "description", content: "Guia rápido dos módulos e conceitos do SIGMO." },
    ],
  }),
  component: CentralAjuda,
});

const CATEGORIAS = [
  "Todos",
  "Segurança",
  "SESMT",
  "Funcionários",
  "Produção",
  "Estoque",
  "Compras",
  "Usuários",
  "Conceitos",
  "Geral",
] as const;

function CentralAjuda() {
  const { q } = Route.useSearch();
  const [query, setQuery] = useState(q ?? "");
  const [cat, setCat] = useState<(typeof CATEGORIAS)[number]>("Todos");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return HELP_TOPICS.filter((t) => {
      if (cat !== "Todos" && t.categoria !== cat) return false;
      if (!needle) return true;
      const hay = [
        t.id,
        t.title,
        t.oQueE,
        t.categoria,
        ...(t.keywords ?? []),
        ...(t.comoUsar ?? []),
        t.base ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [query, cat]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-rose-100 text-rose-800 p-2.5">
          <BookOpen className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Central de Ajuda</h1>
          <p className="text-sm text-muted-foreground">
            Explicações rápidas dos conceitos e telas do SIGMO. Digite o que procura ou navegue por categoria.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {HELP_TOPICS.length} tópicos catalogados · atualizado continuamente
          </p>
        </div>
      </header>

      <div className="glass-card p-3 sm:p-4 rounded-xl space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: MFA, ASO, PPP, dossiê, hora extra, DDS..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={
                "text-xs px-2.5 py-1 rounded-full border transition-colors " +
                (cat === c
                  ? "bg-rose-700 text-white border-rose-700"
                  : "bg-white/70 hover:bg-white border-black/10 text-foreground")
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <HelpCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nada encontrado para “{query}”.</p>
          <p className="text-xs mt-1">Estamos adicionando conteúdo aos poucos. Pergunta o que faltar.</p>
        </div>
      ) : (
        <>
        <p className="text-xs text-muted-foreground">
          {results.length} {results.length === 1 ? "tópico encontrado" : "tópicos encontrados"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((t) => (
            <ArticleCard key={t.id} topic={t} />
          ))}
        </div>
        </>
      )}

      <FooterAviso />
    </div>
  );
}

function ArticleCard({ topic }: { topic: HelpTopic }) {
  return (
    <article className="glass-card p-4 rounded-xl space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-bold text-sm leading-tight">{topic.title}</h2>
        <Badge variant="outline" className="text-[9px] shrink-0">{topic.categoria}</Badge>
      </div>
      <p className="text-xs text-foreground/85 leading-relaxed">{topic.oQueE}</p>
      {topic.comoUsar && topic.comoUsar.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-rose-800">Como usar</summary>
          <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-foreground/85">
            {topic.comoUsar.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
      {topic.dicas && topic.dicas.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-amber-700">Dicas / pegadinhas</summary>
          <ul className="list-disc pl-4 mt-1 space-y-0.5 text-foreground/85">
            {topic.dicas.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      )}
      {topic.base && (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Base: {topic.base}
        </p>
      )}
      {topic.rota && (
        <Link
          to={topic.rota as any}
          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800"
        >
          Ir para a tela <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </article>
  );
}

function FooterAviso() {
  return (
    <aside
      className="mt-8 rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-rose-50/40 p-5 sm:p-6 shadow-sm"
      aria-label="Aviso sobre a Central de Ajuda"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-rose-100 text-rose-800 p-2 shrink-0">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm sm:text-base font-bold text-rose-900">
            Sentiu falta de algum tópico?
          </h3>
          <p className="text-sm text-foreground/85 leading-relaxed">
            Fala com o admin — o SIGMO tá em construção contínua. A cada tela nova,
            a cada dúvida repetida no chão de fábrica, esta Central cresce junto.
            Se você abriu uma tela, leu tudo e continuou sem entender, é sinal de
            que <b>a explicação aqui precisa melhorar</b> — não que você errou.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Manda print, manda áudio, manda um "isso aqui tá confuso" — a gente
            atualiza o texto e todo mundo passa a ver a versão melhor. A ideia é
            que ninguém precise sair do SIGMO pra tirar dúvida do SIGMO.
          </p>
          <p className="text-[11px] uppercase tracking-wider text-rose-800/70 font-semibold pt-1">
            SIGMO — Sistema Integrado de Gestão Modular · v1
          </p>
        </div>
      </div>
    </aside>
  );
}