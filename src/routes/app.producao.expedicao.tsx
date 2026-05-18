import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PackageCheck, Pencil, Search, FileSpreadsheet,
} from "lucide-react";

export const Route = createFileRoute("/app/producao/expedicao")({
  component: ExpedicaoPage,
});

function extractCascoNumero(casco?: string | null) {
  const m = String(casco ?? "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function ExpedicaoPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  // Apenas ordens cujo Tipo de Produto é "Acabado" (mtart = FERT)
  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["producao-ordens-fert"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_ordens")
        .select("*")
        .eq("mtart", "FERT")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ordens;
    return (ordens as any[]).filter((o) =>
      [o.numero, o.casco, o.tipo_produto, o.solicitante]
        .filter(Boolean).some((x: string) => x.toLowerCase().includes(q))
    );
  }, [ordens, busca]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
            <PackageCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Expedição</h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Ordens de produção <strong>acabadas (FERT)</strong> — edição e consulta da lista técnica.
            </p>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por número, casco, tipo ou solicitante…"
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Casco</TableHead>
              <TableHead>Tipo (FERT)</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Carregando…
              </TableCell></TableRow>
            )}
            {!isLoading && filtradas.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Nenhuma ordem acabada (FERT) encontrada.
              </TableCell></TableRow>
            )}
            {filtradas.map((o: any) => {
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-bold text-emerald-700">{o.numero}</TableCell>
                  <TableCell>
                    {o.data_solicitacao ? new Date(o.data_solicitacao).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>{o.casco ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white border-0">
                      {o.tipo_produto ?? "FERT"}
                    </Badge>
                  </TableCell>
                  <TableCell>{o.solicitante ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={o.status === "FINALIZADA" ? "default" : "secondary"}>
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        to="/app/producao/criar-ordem"
                        search={{ id: o.id } as any}
                      >
                        <Button size="icon" variant="ghost" title="Editar ordem">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Ver lista técnica do casco"
                        onClick={() => navigate({ to: "/app/producao/lista-tecnica" })}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cada upload gera uma <strong>nova versão</strong> da lista técnica vinculada ao casco da ordem.
        O <Link to="/app/producao/painel-lista-tecnica" className="font-bold underline">Dashboard Dinâmico</Link> reflete a versão mais recente automaticamente.
      </p>
    </div>
  );
}