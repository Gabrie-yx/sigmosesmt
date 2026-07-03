import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowRight, Warehouse } from "lucide-react";

export const Route = createFileRoute("/app/almoxarifado/requisicao-compras")({
  head: () => ({
    meta: [
      { title: "Requisição de Compras — Almoxarifado · SIGMO" },
      { name: "description", content: "Abertura e acompanhamento de requisições de compra do Almoxarifado." },
    ],
  }),
  component: AlmoxarifadoRequisicaoComprasPage,
});

function AlmoxarifadoRequisicaoComprasPage() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-red-50 border border-red-200 p-2">
          <Warehouse className="h-6 w-6 text-red-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requisição de Compras — Almoxarifado</h1>
          <p className="text-sm text-slate-600">
            Abra RCs vinculadas ao setor <span className="font-semibold">Almoxarifado</span> para reposição de estoque e materiais gerais.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-red-700" />
            Nova Requisição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">
            A abertura de RC segue o fluxo padronizado (formulário, aprovação, cotação, decisão). Enquanto o formulário dedicado do Almoxarifado não é publicado, utilize o fluxo compartilhado — selecione o setor <span className="font-semibold">Almoxarifado</span> ao criar a requisição.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-red-700 hover:bg-red-800">
              <Link to="/app/sesmt/requisicoes">
                Abrir formulário de RC
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/compras/requisicoes-recebidas">Ver RCs recebidas pelo Compras</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Em desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-2">
          <p>
            O módulo Almoxarifado ainda está em construção — em breve teremos controle de saldo, ponto de reposição automático e requisições internas ligadas às RCs.
          </p>
          <p className="text-slate-500">
            Sugestões? Fale com o time do SGI.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}