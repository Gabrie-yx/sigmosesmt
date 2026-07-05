import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck2, Plus, ArrowLeft } from "lucide-react";
import { HoraExtraSabadoDialog } from "@/components/hora-extra-sabado-dialog";

type ModuloScope = {
  slug: string;
  moduloLabel: string;
  setor?: string;
  empresaFixaNome: string;
  funcionariosPermitidos?: string[];
};

const MODULO_MAP: Record<string, ModuloScope> = {
  eletrica:   { slug: "eletrica",   moduloLabel: "Elétrica",   empresaFixaNome: "DMN", funcionariosPermitidos: ["Natanael", "Leonardo"] },
  mecanica:   { slug: "mecanica",   moduloLabel: "Mecânica",   setor: "Mecânica",   empresaFixaNome: "DMN" },
  producao:   { slug: "producao",   moduloLabel: "Produção",   setor: "Produção",   empresaFixaNome: "DMN" },
  compras:    { slug: "compras",    moduloLabel: "Compras",    setor: "Compras",    empresaFixaNome: "DMN" },
  manutencao: { slug: "manutencao", moduloLabel: "Manutenção", empresaFixaNome: "DMN", funcionariosPermitidos: ["Natanael", "Leonardo"] },
  almoxarifado: { slug: "almoxarifado", moduloLabel: "Almoxarifado", empresaFixaNome: "DMN", funcionariosPermitidos: ["Israel Uchoa"] },
  portaria:   { slug: "portaria",   moduloLabel: "Portaria",   setor: "Portaria",   empresaFixaNome: "DMN" },
};

export const Route = createFileRoute("/app/modulo/$modulo/hora-extra")({
  head: ({ params }) => {
    const scope = MODULO_MAP[params.modulo];
    const label = scope?.moduloLabel ?? "Módulo";
    return {
      meta: [
        { title: `Hora Extra — ${label} · SIGMO` },
        { name: "description", content: `Registro de horas extras do setor ${label}.` },
      ],
    };
  },
  loader: ({ params }) => {
    if (!MODULO_MAP[params.modulo]) throw notFound();
    return null;
  },
  component: HoraExtraModuloPage,
});

function HoraExtraModuloPage() {
  const { modulo } = Route.useParams();
  const scope = MODULO_MAP[modulo]!;
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-red-50 border border-red-200 p-2">
          <CalendarCheck2 className="h-6 w-6 text-red-700" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Hora Extra — {scope.moduloLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Registro de horas extras vinculado ao setor <span className="font-semibold">{scope.moduloLabel}</span>.
            Empresa travada em <span className="font-semibold">{scope.empresaFixaNome}</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/hoje"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova ficha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md border border-dashed p-4 text-sm text-center text-muted-foreground">
            Nenhuma emissão recente para este módulo.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => setOpen(true)} className="bg-red-700 hover:bg-red-800">
              <Plus className="h-4 w-4 mr-2" /> Nova ficha de hora extra
            </Button>
          </div>
        </CardContent>
      </Card>

      <HoraExtraSabadoDialog
        open={open}
        onOpenChange={setOpen}
        setorFixo={scope.setor}
        empresaFixaNome={scope.empresaFixaNome}
        moduloLabel={scope.moduloLabel}
        funcionariosPermitidos={scope.funcionariosPermitidos}
        observacaoLabel="DIGITE AQUI A JUSTIFICATIVA DA EXTRA"
        observacaoPlaceholder="Descreva a justificativa da hora extra…"
      />
    </div>
  );
}