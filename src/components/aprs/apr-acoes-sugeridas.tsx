import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, Search } from "lucide-react";

export type AcaoBiblioteca = {
  id: string;
  categoria: string;
  risco_padrao: string;
  palavras_chave: string[] | null;
  hierarquia: string;
  acao: string;
  como: string | null;
  efeitos_danos: string | null;
  epis: string[] | null;
  nrs: string[] | null;
  prioridade: string;
};

const norm = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const HIER_CLS: Record<string, string> = {
  ELIMINACAO: "bg-emerald-600",
  ENGENHARIA: "bg-sky-600",
  ADMINISTRATIVA: "bg-amber-600",
  EPI: "bg-fuchsia-600",
};

function score(a: AcaoBiblioteca, alvo: string, categoria?: string | null) {
  const t = norm(alvo);
  if (!t.trim()) return categoria && norm(a.categoria) === norm(categoria) ? 1 : 0;
  let s = 0;
  const risco = norm(a.risco_padrao);
  if (risco && (t.includes(risco) || risco.includes(t.trim()))) s += 6;
  for (const kw of a.palavras_chave ?? []) {
    const k = norm(String(kw));
    if (k.length > 2 && t.includes(k)) s += 3;
  }
  if (categoria && norm(a.categoria) === norm(categoria)) s += 1;
  return s;
}

/** Biblioteca de ações preventivas da APR (hierarquia CA/EPC/EPI), sugerindo pelo risco selecionado. */
export function AprAcoesSugeridas({
  riscoNome,
  passo,
  categoria,
  onAplicar,
}: {
  riscoNome: string;
  passo?: string | null;
  categoria?: string | null;
  onAplicar: (a: AcaoBiblioteca) => void;
}) {
  const [busca, setBusca] = useState("");
  const [verTodas, setVerTodas] = useState(false);

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ["apr_acoes_biblioteca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apr_acoes_biblioteca")
        .select("*")
        .eq("ativo", true)
        .order("prioridade");
      if (error) throw error;
      return (data ?? []) as unknown as AcaoBiblioteca[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const lista = useMemo(() => {
    const alvo = `${riscoNome ?? ""} ${passo ?? ""}`;
    if (busca.trim()) {
      const b = norm(busca);
      return acoes.filter(
        (a) => norm(a.acao).includes(b) || norm(a.risco_padrao).includes(b) || norm(a.como ?? "").includes(b),
      );
    }
    if (verTodas) return acoes;
    return acoes
      .map((a) => ({ a, s: score(a, alvo, categoria) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 8)
      .map((x) => x.a);
  }, [acoes, riscoNome, passo, categoria, busca, verTodas]);

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Biblioteca de ações preventivas
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setVerTodas((v) => !v)}>
          {verTodas ? "Ver sugeridas" : "Ver todas"}
        </Button>
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="h-8 pl-7 text-xs"
          placeholder="Buscar ação (ex.: içamento, altura, hidrojato)…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
        {isLoading && <div className="text-xs text-muted-foreground py-2">Carregando biblioteca…</div>}
        {!isLoading && lista.length === 0 && (
          <div className="text-xs text-muted-foreground py-2">
            Nenhuma ação sugerida para este risco. Use “Ver todas” ou a busca.
          </div>
        )}
        {lista.map((a) => (
          <button
            type="button"
            key={a.id}
            onClick={() => onAplicar(a)}
            className="w-full text-left rounded-md border border-border bg-background/60 hover:bg-accent/40 transition-colors p-2"
          >
            <div className="flex items-start gap-2">
              <Plus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
              <div className="min-w-0">
                <div className="text-xs font-bold leading-snug">{a.acao}</div>
                {a.como && <div className="text-[11px] text-muted-foreground leading-snug">{a.como}</div>}
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  <Badge className={`${HIER_CLS[a.hierarquia] ?? "bg-slate-600"} text-white text-[9px] px-1.5 py-0`}>
                    {a.hierarquia}
                  </Badge>
                  <span className="text-[9px] uppercase text-muted-foreground">{a.risco_padrao}</span>
                  {(a.nrs ?? []).slice(0, 3).map((n) => (
                    <span key={n} className="text-[9px] rounded bg-muted px-1 py-0 text-muted-foreground">{n}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
