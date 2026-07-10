import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DRAFTS_EVENT, deleteDraft, listDrafts, type DraftMeta } from "@/lib/draft-store";
import { FileClock, FileUp, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export function QuickActionsBar() {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    const refresh = () => setDrafts(listDrafts());
    refresh();
    window.addEventListener(DRAFTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    const id = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener(DRAFTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(id);
    };
  }, []);

  const handleDiscard = (key: string, label: string) => {
    if (!confirm(`Descartar o rascunho "${label}"?`)) return;
    deleteDraft(key);
    toast.success("Rascunho descartado");
  };

  return (
    <>
      <div className="border-b bg-gradient-to-r from-slate-50 to-amber-50/40 px-3 md:px-4 py-1.5 flex items-center gap-2 text-[12px] overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: !isMac, metaKey: isMac, bubbles: true }),
            );
          }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          title="Abrir busca rápida (Ctrl/⌘ + K)"
        >
          <Zap className="h-3.5 w-3.5 text-sky-600" />
          Ações rápidas
        </button>

        {isAdmin && (
          <Link
            to="/app/sesmt/templates-documentos"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 font-black text-amber-950 hover:bg-amber-200 transition-colors shadow-sm"
            title="Abrir upload dos modelos oficiais FOR-SEG"
          >
            <FileUp className="h-3.5 w-3.5" />
            Upload FOR-SEG
          </Link>
        )}

        {drafts.length > 0 && (
          <>
            <div className="h-5 w-px bg-slate-300/60 shrink-0" />
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <FileClock className="h-3.5 w-3.5" />
              Rascunhos
            </span>
            <div className="flex items-center gap-1.5">
              {drafts.slice(0, 4).map((d) => (
                <div
                  key={d.key}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-50 pl-2 pr-1 py-0.5 text-[11px] text-emerald-800"
                  title={`Salvo ${timeAgo(d.updatedAt)}`}
                >
                  <Link
                    to={d.route as any}
                    search={{ draft: "true" } as any}
                    className="font-semibold hover:underline max-w-[180px] truncate"
                  >
                    {d.label}
                  </Link>
                  <span className="text-[10px] text-emerald-700/70">· {timeAgo(d.updatedAt)}</span>
                  <button
                    type="button"
                    onClick={() => handleDiscard(d.key, d.label)}
                    className="ml-0.5 h-4 w-4 rounded-full hover:bg-emerald-200/70 flex items-center justify-center"
                    title="Descartar rascunho"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {drafts.length > 4 && (
                <span className="text-[11px] text-slate-500 shrink-0">
                  +{drafts.length - 4}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}