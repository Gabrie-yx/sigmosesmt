import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Database, Upload, Loader2, Search, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { parseBaseMpXlsx } from "@/lib/base-mp-parser";

export const Route = createFileRoute("/app/producao/base-materia-prima")({
  component: BaseMpPage,
});

const TIPO_COLOR: Record<string, string> = {
  FERRO: "bg-red-100 text-red-700 border-red-300",
  "GÁS": "bg-blue-100 text-blue-700 border-blue-300",
  SOLDA: "bg-orange-100 text-orange-700 border-orange-300",
  TINTA: "bg-purple-100 text-purple-700 border-purple-300",
  OUTROS: "bg-slate-100 text-slate-700 border-slate-300",
};

function BaseMpPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["producao-base-mp"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_base_materia_prima")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { FERRO: 0, "GÁS": 0, SOLDA: 0, TINTA: 0, OUTROS: 0 };
    (itens as any[]).forEach((i) => { c[i.tipo] = (c[i.tipo] ?? 0) + 1; });
    return c;
  }, [itens]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens as any[];
    return (itens as any[]).filter((i) =>
      String(i.codigo).toLowerCase().includes(q) ||
      String(i.descricao ?? "").toLowerCase().includes(q) ||
      String(i.tipo).toLowerCase().includes(q),
    );
  }, [itens, busca]);

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const parsed = await parseBaseMpXlsx(file);
      if (parsed.length === 0) throw new Error("Nenhum material encontrado.");
      for (let i = 0; i < parsed.length; i += 500) {
        const slice = parsed.slice(i, i + 500);
        const { error } = await (supabase as any)
          .from("producao_base_materia_prima")
          .upsert(slice, { onConflict: "codigo" });
        if (error) throw error;
      }
      return parsed.length;
    },
    onSuccess: (n) => {
      toast.success(`Base atualizada: ${n} materiais.`);
      qc.invalidateQueries({ queryKey: ["producao-base-mp"] });
      qc.invalidateQueries({ queryKey: ["mb51-base-mp-map"] });
      setImporting(false);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Falha ao importar");
      setImporting(false);
    },
  });

  const handleFile = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setImporting(true);
    importMut.mutate(f);
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-md">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Base de Matéria-Prima</h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Cadastro oficial de materiais — define o <strong>tipo</strong> (Ferro / Gás / Solda / Tinta / Outros)
              usado pelo Dashboard Dinâmico para classificar a MB51.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { handleFile(e.target.files); e.target.value = ""; }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={importing}
            className="gap-1.5 bg-slate-700 hover:bg-slate-800 text-white">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importando…" : "Importar Base MP (.xlsx)"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="O que enviar aqui?">
                <Info className="h-4 w-4 text-slate-600" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-xs space-y-2">
              <p className="font-bold text-sm text-slate-800">📋 Base de Matéria-Prima (.xlsx)</p>
              <p>Envie aqui APENAS o <strong>cadastro oficial de materiais</strong> exportado do SAP — a planilha que classifica cada código em <strong>Ferro / Gás / Solda / Tinta / Outros</strong>.</p>
              <p className="text-red-700"><strong>⚠️ NÃO envie aqui:</strong> MB51 (consumo) nem Lista Técnica (B51). Isso polui o catálogo.</p>
              <p className="text-muted-foreground">Colunas esperadas: <code>Código</code>, <code>Descrição</code>, <code>Tipo</code>.</p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["FERRO","GÁS","SOLDA","TINTA","OUTROS"] as const).map((t) => (
          <Card key={t} className="shadow-sm">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t}</div>
              <div className="text-xl font-bold">{counts[t] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código, descrição ou tipo…" className="pl-9" />
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-28">Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && filtrados.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                Nenhum material cadastrado. Importe a Base de Matéria-Prima (.xlsx).
              </TableCell></TableRow>
            )}
            {filtrados.slice(0, 500).map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.codigo}</TableCell>
                <TableCell className="text-sm">{m.descricao ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={TIPO_COLOR[m.tipo] ?? ""}>{m.tipo}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtrados.length > 500 && (
          <p className="text-[11px] text-center text-muted-foreground py-2 border-t">
            Mostrando 500 de {filtrados.length} resultados — refine a busca para ver mais.
          </p>
        )}
      </div>
    </div>
  );
}