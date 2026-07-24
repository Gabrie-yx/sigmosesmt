// SnippetPicker — botão "⚡ Inserir texto rápido" para textareas de APR/OSS/Inspeção/Plano.
// Uso: <SnippetPicker escopo="apr" campo="descricao_atividade" onPick={(t) => setValor((v) => v ? v + "\n" + t : t)} />
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Zap, Search } from "lucide-react";

export type SnippetEscopo = "apr" | "oss" | "inspecao" | "plano_acao" | "generico";

type Snippet = {
  id: string;
  escopo: SnippetEscopo;
  campo_alvo: string | null;
  titulo: string;
  conteudo: string;
  oficial: boolean;
};

interface Props {
  escopo: SnippetEscopo;
  campo?: string;
  onPick: (conteudo: string) => void;
  className?: string;
  label?: string;
  /** Se true, além do escopo alvo, também mostra snippets "genericos". */
  incluirGenerico?: boolean;
}

export function SnippetPicker({
  escopo,
  campo,
  onPick,
  className,
  label = "Texto rápido",
  incluirGenerico = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const escopos = incluirGenerico ? [escopo, "generico" as const] : [escopo];

  const { data = [], isLoading } = useQuery({
    queryKey: ["snippets", escopos, campo ?? null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("snippets")
        .select("id, escopo, campo_alvo, titulo, conteudo, oficial")
        .in("escopo", escopos)
        .order("oficial", { ascending: false })
        .order("titulo", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Snippet[];
      if (!campo) return rows;
      // Prioriza: mesmo campo → sem campo específico → resto
      return rows.sort((a, b) => {
        const aScore = a.campo_alvo === campo ? 0 : a.campo_alvo == null ? 1 : 2;
        const bScore = b.campo_alvo === campo ? 0 : b.campo_alvo == null ? 1 : 2;
        return aScore - bScore;
      });
    },
    enabled: open,
    staleTime: 60_000,
  });

  const filtered = q.trim()
    ? data.filter((s) =>
        (s.titulo + " " + s.conteudo).toLowerCase().includes(q.toLowerCase()),
      )
    : data;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={className}
          title="Inserir texto rápido"
        >
          <Zap className="h-3.5 w-3.5 mr-1" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="p-2 border-b border-black/10 flex items-center gap-2">
          <Search className="h-3.5 w-3.5 opacity-60" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar snippet…"
            className="h-8 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {isLoading && (
            <p className="p-4 text-xs text-muted-foreground">Carregando…</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">
              Nenhum snippet encontrado. Cadastre em <b>Configurações → Produtividade</b>.
            </p>
          )}
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPick(s.conteudo);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent/40 border-b border-black/5 last:border-0"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-xs">{s.titulo}</span>
                {s.oficial && (
                  <Badge variant="outline" className="text-[9px] py-0 h-4">
                    OFICIAL
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px] py-0 h-4 uppercase">
                  {s.escopo}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                {s.conteudo}
              </p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}