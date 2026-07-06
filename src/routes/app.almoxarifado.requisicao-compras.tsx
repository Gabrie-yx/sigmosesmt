import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ShoppingCart, Warehouse, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ReqFormDialog } from "@/routes/app.sesmt.requisicoes";
import { BaseMpLookupSheet, suggestFromBaseMpAndHistorico } from "@/components/compras/base-mp-lookup-sheet";

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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 shrink-0">
          <Warehouse className="h-6 w-6 text-red-700" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 leading-tight">Requisição de Compras — Almoxarifado</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Abra RCs vinculadas ao setor <span className="font-semibold">Almoxarifado</span>. Setor travado, consulta direta à Base de Matéria-Prima.
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
            No passo dos itens use <span className="font-semibold">Consultar Base de Matéria-Prima</span> ou digite na descrição — o dropdown sugere Base MP + histórico de RCs.
          </p>
          <div className="flex flex-wrap gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <Button className="bg-red-700 hover:bg-red-800" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nova RC — Almoxarifado
              </Button>
              {open && (
                <ReqFormDialog
                  onClose={() => setOpen(false)}
                  userId={user?.id}
                  setorFixo="Almoxarifado"
                  draftKey="requisicao-nova:almoxarifado"
                  dialogTitle="Nova Requisição de Compra — Almoxarifado"
                  descricaoSuggest={suggestFromBaseMpAndHistorico}
                  consultaSlot={(pick) => (
                    <BaseMpLookupSheet onPick={pick} triggerLabel="Consultar Base de Matéria-Prima" />
                  )}
                />
              )}
            </Dialog>
            <Button asChild variant="outline">
              <Link to="/app/compras/requisicoes-recebidas">Ver RCs recebidas pelo Compras</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}