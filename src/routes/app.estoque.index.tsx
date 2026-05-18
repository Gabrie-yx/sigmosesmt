import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Boxes, PackageSearch, UserSearch, ShoppingCart, ArrowRight } from "lucide-react";
import { EstoqueSesmtPage } from "./app.estoque.sesmt";
import { EstoqueEpiPage, ConsultaColaborador } from "./app.estoque.epi";

export const Route = createFileRoute("/app/estoque/")({
  component: EstoqueUnificadoPage,
});

function EstoqueUnificadoPage() {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Boxes className="h-6 w-6 text-primary" />
          Estoque de EPIs
        </h1>
        <p className="text-sm text-muted-foreground">
          Catálogo, movimentações, ficha por funcionário e requisições de compra — tudo em um só painel.
        </p>
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="catalogo" className="gap-1.5">
            <PackageSearch className="h-4 w-4" /> Catálogo & Estoque
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-1.5">
            <Boxes className="h-4 w-4" /> Movimentações
          </TabsTrigger>
          <TabsTrigger value="ficha" className="gap-1.5">
            <UserSearch className="h-4 w-4" /> Ficha por Funcionário
          </TabsTrigger>
          <TabsTrigger value="requisicao" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" /> Requisição de Compra
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="mt-4">
          <EstoqueSesmtPage />
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-4">
          <EstoqueEpiPage />
        </TabsContent>

        <TabsContent value="ficha" className="mt-4">
          <div className="mx-auto max-w-7xl">
            <ConsultaColaborador />
          </div>
        </TabsContent>

        <TabsContent value="requisicao" className="mt-4">
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Requisição de Compra</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              O carrinho de requisição é montado a partir do <strong>Catálogo & Estoque</strong>: marque até 15 itens
              em falta e finalize o pedido para o setor de compras.
            </p>
            <Button asChild variant="default" className="gap-1.5">
              <Link to="/app/estoque/sesmt">
                Abrir catálogo completo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}