import { createFileRoute } from "@tanstack/react-router";
import { CargoRiscosPanel } from "@/components/cargo-riscos/cargo-riscos-panel";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/app/matriz-riscos")({
  component: MatrizRiscosPage,
});

function MatrizRiscosPage() {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-6 pt-5 pb-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 via-white to-amber-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-rose-600 to-[#991b1b] text-white shadow">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Matriz de Riscos Ocupacionais</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Base do PGR · LTCAT · PCMSO — vincula cada cargo aos riscos quantitativos (Ruído, Calor IBUTG, Fumos, etc.)
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <CargoRiscosPanel />
      </div>
    </div>
  );
}