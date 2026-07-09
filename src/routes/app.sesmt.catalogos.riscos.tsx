import { createFileRoute, Link } from "@tanstack/react-router";
import { CatalogoRiscosPanel } from "@/components/catalogo/catalogo-riscos-panel";
import { ShieldAlert, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/app/sesmt/catalogos/riscos")({
  component: () => (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/app/sesmt/catalogos" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Hub de Catálogos
      </Link>
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-6 w-6 text-rose-700" />
        <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Catálogo de Riscos Ocupacionais</h1>
      </div>
      <CatalogoRiscosPanel />
    </div>
  ),
});
