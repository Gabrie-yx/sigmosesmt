import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CboRow = { codigo: string; titulo: string; tipo: string };

type Props = {
  codigo: string | null | undefined;
  titulo?: string | null;
  onChange: (codigo: string | null, titulo: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * Autocomplete oficial do CBO 2002.
 * Busca em public.cbo_catalogo por código (XXXX-XX) ou por título (trgm),
 * mostra "Ocupação" e "Sinônimo" e devolve sempre o código + título escolhido.
 */
export function CboPicker({ codigo, titulo, onChange, disabled, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CboRow[]>([]);
  const [loading, setLoading] = useState(false);

  const display = useMemo(() => {
    if (!codigo) return "";
    return titulo ? `${codigo} — ${titulo}` : codigo;
  }, [codigo, titulo]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase.from("cbo_catalogo").select("codigo, titulo, tipo").limit(30);
        if (/^\d/.test(term)) {
          // busca por código (ex.: "7244" ou "7244-10")
          query = query.ilike("codigo", `${term.replace(/[^\d-]/g, "")}%`);
        } else if (term) {
          query = query.ilike("titulo", `%${term}%`);
        } else {
          query = query.eq("tipo", "Ocupação").order("titulo").limit(30);
        }
        const { data } = await query;
        const list = (data ?? []) as CboRow[];
        // Ocupações primeiro
        list.sort((a, b) => (a.tipo === b.tipo ? a.titulo.localeCompare(b.titulo) : a.tipo === "Ocupação" ? -1 : 1));
        setResults(list);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQ("");
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="h-12 min-w-0 flex-1 justify-start rounded-xl border-input bg-background px-4 text-left text-sm font-semibold"
        >
          <Search className="shrink-0 text-primary" />
          {display ? (
            <span className="truncate">{display}</span>
          ) : (
            <span className="truncate font-normal text-muted-foreground">{placeholder ?? "Buscar CBO por código ou nome…"}</span>
          )}
        </Button>
        {codigo && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null, null)}
            title="Limpar CBO"
            aria-label="Limpar CBO"
          >
            <X />
          </Button>
        )}
      </div>

      <Dialog open={open && !disabled} onOpenChange={handleOpenChange}>
        <DialogContent className="cbo-picker-dialog w-[calc(100vw-2rem)] max-w-lg gap-0 overflow-hidden border-border p-0 text-popover-foreground shadow-2xl">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-primary" />
              Selecionar CBO
            </DialogTitle>
            <DialogDescription>Busque pelo código ou pelo nome da ocupação.</DialogDescription>
          </DialogHeader>

          <div className="border-b border-border p-4">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Digite código (7244) ou nome (soldador)…"
              className="h-11 bg-background text-foreground"
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {loading && <div className="p-6 text-center text-sm text-muted-foreground">Buscando…</div>}
            {!loading && results.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhum CBO encontrado</div>
            )}
            {!loading && results.map((r) => {
              const sel = r.codigo === codigo && r.titulo === titulo;
              return (
                <Button
                  key={`${r.codigo}::${r.titulo}`}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onChange(r.codigo, r.titulo);
                    handleOpenChange(false);
                  }}
                  className={`grid h-auto min-h-12 w-full grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 text-left ${sel ? "bg-accent text-accent-foreground" : ""}`}
                >
                  <span className="whitespace-nowrap font-mono text-sm font-bold text-primary">{r.codigo}</span>
                  <span className="min-w-0 truncate text-sm text-foreground" title={r.titulo}>{r.titulo}</span>
                  <span className="flex items-center gap-2 whitespace-nowrap text-[10px] font-bold uppercase text-muted-foreground">
                    {r.tipo === "Ocupação" ? "OFICIAL" : "sinônimo"}
                    {sel && <Check className="h-4 w-4 text-primary" />}
                  </span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}