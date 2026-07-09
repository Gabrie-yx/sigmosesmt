import { createFileRoute, Link } from "@tanstack/react-router";
import { CatalogoNrsPanel } from "@/components/catalogo/catalogo-nrs-panel";
import { BookOpenCheck, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/app/sesmt/catalogos/nrs")({
  component: () => (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/app/sesmt/catalogos" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Hub de Catálogos
      </Link>
      <div className="flex items-center gap-2">
        <BookOpenCheck className="h-6 w-6 text-emerald-700" />
        <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Catálogo de Normas Regulamentadoras</h1>
      </div>
      <CatalogoNrsPanel />
    </div>
  ),
});
