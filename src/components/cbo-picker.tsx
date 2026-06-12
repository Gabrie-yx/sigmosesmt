import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, Check } from "lucide-react";

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
  const boxRef = useRef<HTMLDivElement>(null);

  const display = useMemo(() => {
    if (!codigo) return "";
    return titulo ? `${codigo} — ${titulo}` : codigo;
  }, [codigo, titulo]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

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

  return (
    <div ref={boxRef} className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
          className="flex-1 text-left bg-white border-2 border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 focus:border-[#991b1b] focus:ring-4 focus:ring-rose-200/40 outline-none transition-all disabled:opacity-60 shadow-sm flex items-center gap-2"
        >
          <Search className="h-4 w-4 text-rose-400 shrink-0" />
          {display ? (
            <span className="truncate">{display}</span>
          ) : (
            <span className="text-slate-300 font-normal">{placeholder ?? "Buscar CBO por código ou nome…"}</span>
          )}
        </button>
        {codigo && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
            title="Limpar CBO"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-rose-200 rounded-xl shadow-2xl max-h-96 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-rose-100">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Digite código (7244) ou nome (soldador)…"
              className="w-full px-3 py-2 text-sm border border-rose-100 rounded-lg outline-none focus:border-[#991b1b]"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-4 text-center text-xs text-slate-400">Buscando…</div>}
            {!loading && results.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">Nenhum CBO encontrado</div>
            )}
            {!loading && results.map((r) => {
              const sel = r.codigo === codigo && r.titulo === titulo;
              return (
                <button
                  key={`${r.codigo}::${r.titulo}`}
                  type="button"
                  onClick={() => {
                    onChange(r.codigo, r.titulo);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-rose-50 flex items-start gap-2 border-b border-rose-50 last:border-0 ${sel ? "bg-rose-50" : ""}`}
                >
                  <span className="font-mono font-bold text-rose-700 shrink-0 w-16">{r.codigo}</span>
                  <span className="flex-1 text-slate-700">{r.titulo}</span>
                  <span className={`text-[10px] font-black uppercase shrink-0 ${r.tipo === "Ocupação" ? "text-emerald-600" : "text-slate-400"}`}>
                    {r.tipo === "Ocupação" ? "OFICIAL" : "sinônimo"}
                  </span>
                  {sel && <Check className="h-4 w-4 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}