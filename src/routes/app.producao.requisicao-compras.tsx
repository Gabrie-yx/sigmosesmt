import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ShoppingCart, Factory, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ReqFormDialog } from "@/routes/app.sesmt.requisicoes";
import { BaseMpLookupSheet, suggestFromBaseMpAndHistorico } from "@/components/compras/base-mp-lookup-sheet";

export const Route = createFileRoute("/app/producao/requisicao-compras")({
  head: () => ({
    meta: [
      { title: "Requisição de Compras — Produção · SIGMO" },
      { name: "description", content: "Abertura e acompanhamento de requisições de compra do setor Produção." },
    ],
  }),
  component: ProducaoRequisicaoComprasPage,
});

function ProducaoRequisicaoComprasPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-red-50 border border-red-200 p-2">
          <Factory className="h-6 w-6 text-red-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requisição de Compras — Produção</h1>
          <p className="text-sm text-slate-600">
            Abra RCs vinculadas ao setor <span className="font-semibold">Produção</span> com consulta direta à Base de Matéria-Prima.
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
            Setor travado em <span className="font-semibold">Produção</span>. No passo dos itens use <span className="font-semibold">Consultar Base de Matéria-Prima</span> ou digite direto na descrição — o dropdown sugere Base MP + histórico de RCs.
          </p>
          <div className="flex flex-wrap gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <Button className="bg-red-700 hover:bg-red-800" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nova RC — Produção
              </Button>
              {open && (
                <ReqFormDialog
                  onClose={() => setOpen(false)}
                  userId={user?.id}
                  setorFixo="Produção"
                  draftKey="requisicao-nova:producao"
                  dialogTitle="Nova Requisição de Compra — Produção"
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