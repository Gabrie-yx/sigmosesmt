import { createFileRoute } from "@tanstack/react-router";
import { DoorOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/app/portaria/controle-entrada")({
  component: ControleEntradaPage,
  head: () => ({
    meta: [
      { title: "Controle de Entrada — Portaria · SIGMO" },
      { name: "description", content: "Registro e controle de entrada de pessoas e veículos na portaria." },
    ],
  }),
});

function ControleEntradaPage() {
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <header className="flex items-start gap-3 min-w-0">
        <div className="shrink-0 rounded-lg bg-red-100 p-2 text-red-700">
          <DoorOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Controle de Entrada</h1>
          <p className="text-sm text-slate-600">
            Registro de entrada e saída de pessoas, visitantes e veículos.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Este módulo está sendo estruturado. Em breve: registro de visitantes,
          liberação de acesso, histórico de entradas e integração com o cadastro
          de funcionários e contratadas.
        </CardContent>
      </Card>
    </div>
  );
}