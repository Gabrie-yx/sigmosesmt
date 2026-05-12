import { createFileRoute } from "@tanstack/react-router";
import { Factory, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/producao/ordens")({
  component: OrdensProducaoPage,
});

function OrdensProducaoPage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <Factory className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Ordens de Produção</h1>
            <p className="text-xs text-muted-foreground font-medium">
              Módulo Produção · Gestão de OPs
            </p>
          </div>
        </div>
        <Button disabled className="gap-2">
          <Plus className="h-4 w-4" /> Nova Ordem
        </Button>
      </div>

      <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-10 text-center">
        <ClipboardList className="h-12 w-12 mx-auto text-amber-600/70 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">
          Nenhuma ordem de produção cadastrada
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Este é o ponto de partida do módulo de Produção. Em breve você poderá
          criar, acompanhar e encerrar ordens de produção por casco/embarcação,
          equipe e período.
        </p>
      </div>
    </div>
  );
}