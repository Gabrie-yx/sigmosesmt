import { createFileRoute, Link } from "@tanstack/react-router";
import { CatalogoGasesManager } from "@/components/sesmt/CatalogoGasesManager";
import { Wind, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/app/sesmt/catalogos/gases")({
  component: CatalogoGasesPage,
});

function CatalogoGasesPage() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <Link
          to="/app/painel"
          className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          <ChevronLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Wind className="h-6 w-6 text-cyan-700" />
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
            Catálogo de Gases Atmosféricos
          </h1>
        </div>
        <p className="text-xs font-bold text-slate-600 mt-1">
          SESMT &rsaquo; Catálogos &rsaquo; Gases — usado nas medições atmosféricas das PETs (NR-33).
        </p>
      </div>

      <CatalogoGasesManager />
    </div>
  );
}