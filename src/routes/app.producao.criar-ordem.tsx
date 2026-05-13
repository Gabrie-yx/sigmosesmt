import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/app/producao/criar-ordem")({
  component: CriarOrdemPage,
});

function CriarOrdemPage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <ClipboardList className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Nova Ordem de Produção</h1>
          <p className="text-xs text-muted-foreground font-medium">
            Módulo Produção · ponto de partida
          </p>
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-10 text-center">
        <ClipboardList className="h-12 w-12 mx-auto text-amber-600/70 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">
          Módulo limpo — pronto para reconstruir
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Aqui será construída a nova lógica de Ordem de Produção. Defina os
          requisitos para iniciarmos do zero.
        </p>
      </div>
    </div>
  );
}
