import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, FileSpreadsheet, Trash2, Search, Database, Package, Layers } from "lucide-react";
import { toast } from "sonner";
import { parseListaTecnicaXlsx } from "@/lib/lista-tecnica-parser";

export const Route = createFileRoute("/app/producao/lista-tecnica")({
  component: ListaTecnicaPage,
});

const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR");

function ListaTecnicaPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cascoSel, setCascoSel] = useState<string>("");
  const [listaSel, setListaSel] = useState<string>("");
  const [tipoEmb, setTipoEmb] = useState<string>("Graneleira RK");
  const [busca, setBusca] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);

  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cascos").select("id, numero, nome").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: listas = [] } = useQuery({
    queryKey: ["listas-tecnicas", cascoSel],
    enabled: !!cascoSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_lista_tecnica")
        .select("*")
        .eq("casco_id", cascoSel)
        .order("versao", { ascending: false });
      if (error) throw error;
      // auto-seleciona última versão
      if (data && data.length > 0) setListaSel((prev) => prev || data[0].id);
      return data ?? [];
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["lista-tecnica-itens", listaSel],
    enabled: !!listaSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_lista_tecnica_itens")
        .select("*")
        .eq("lista_id", listaSel)
        .order("linha");
      if (error) throw error;
      return data ?? [];
    },
  });

  const listaAtual = useMemo(
    () => (listas as any[]).find((l) => l.id === listaSel),
    [listas, listaSel],
  );

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      if (!cascoSel) throw new Error("Selecione um casco antes de importar.");
      const parsed = await parseListaTecnicaXlsx(file);

      // próxima versão
      const { data: existentes } = await supabase
        .from("producao_lista_tecnica")
        .select("versao")
        .eq("casco_id", cascoSel)
        .order("versao", { ascending: false })
        .limit(1);
      const proxVersao = ((existentes?.[0] as any)?.versao ?? 0) + 1;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: lista, error: e1 } = await supabase
        .from("producao_lista_tecnica")
        .insert({
          casco_id: cascoSel,
          tipo_embarcacao: tipoEmb || null,
          origem: "B51",
          arquivo_nome: file.name,
          versao: proxVersao,
          peso_total_estimado: parsed.peso_total_estimado,
          peso_total_real: parsed.peso_total_real,
          qtd_itens: parsed.itens.length,
          qtd_codigos_distintos: parsed.qtd_codigos_distintos,
          qtd_pecas_total: parsed.qtd_pecas_total,
          importado_por: user?.id ?? null,
        })
        .select("*")
        .single();
      if (e1) throw e1;

      const payload = parsed.itens.map((it) => ({ ...it, lista_id: (lista as any).id }));
      // insere em lotes de 200
      for (let i = 0; i < payload.length; i += 200) {
        const slice = payload.slice(i, i + 200);
        const { error: e2 } = await supabase
          .from("producao_lista_tecnica_itens")
          .insert(slice);
        if (e2) throw e2;
      }
      return lista;
    },
    onSuccess: (l: any) => {
      toast.success(`Lista técnica v${l.versao} importada (${l.qtd_itens} itens).`);
      setListaSel(l.id);
      qc.invalidateQueries({ queryKey: ["listas-tecnicas", cascoSel] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao importar"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("producao_lista_tecnica").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Versão removida.");
      setListaSel("");
      qc.invalidateQueries({ queryKey: ["listas-tecnicas", cascoSel] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao remover"),
  });

  // Agregações
  const porCodigo = useMemo(() => {
    const map = new Map<string, { codigo: string; descricao: string; unidade: string; quantidade: number; peso_real: number; qtd_pecas: number; aplicacoes: number }>();
    (itens as any[]).forEach((it) => {
      const k = it.codigo_sap;
      const cur = map.get(k) ?? { codigo: k, descricao: it.descricao_sap ?? "", unidade: it.unidade ?? "", quantidade: 0, peso_real: 0, qtd_pecas: 0, aplicacoes: 0 };
      cur.quantidade += Number(it.quantidade ?? 0);
      cur.peso_real += Number(it.peso_real ?? 0);
      cur.qtd_pecas += Number(it.qtd_pecas ?? 0);
      cur.aplicacoes += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.peso_real - a.peso_real);
  }, [itens]);

  const porElemento = useMemo(() => {
    const map = new Map<string, { elemento: string; peso_real: number; qtd_pecas: number; linhas: number }>();
    (itens as any[]).forEach((it) => {
      const k = it.elemento ?? "—";
      const cur = map.get(k) ?? { elemento: k, peso_real: 0, qtd_pecas: 0, linhas: 0 };
      cur.peso_real += Number(it.peso_real ?? 0);
      cur.qtd_pecas += Number(it.qtd_pecas ?? 0);
      cur.linhas += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.peso_real - a.peso_real);
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return itens as any[];
    const q = busca.toLowerCase();
    return (itens as any[]).filter((it) =>
      [it.codigo_sap, it.descricao_sap, it.elemento].some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [itens, busca]);

  const desvio = listaAtual && listaAtual.peso_total_estimado
    ? ((Number(listaAtual.peso_total_real) - Number(listaAtual.peso_total_estimado)) / Number(listaAtual.peso_total_estimado)) * 100
    : null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Lista Técnica
          </h1>
          <p className="text-sm text-muted-foreground">
            Importa o arquivo da transação SAP B51 e consolida o material previsto por casco.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Importar planilha</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium">Casco</label>
            <Select value={cascoSel} onValueChange={(v) => { setCascoSel(v); setListaSel(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(cascos as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.numero}{c.nome ? ` — ${c.nome}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Tipo de embarcação</label>
            <Input value={tipoEmb} onChange={(e) => setTipoEmb(e.target.value)} placeholder="Ex.: Graneleira RK" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Arquivo .xlsx (saída B51)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importMut.mutate(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
          </div>
          <Button disabled={!cascoSel || importMut.isPending} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {importMut.isPending ? "Importando…" : "Importar"}
          </Button>
        </CardContent>
      </Card>

      {cascoSel && (listas as any[]).length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Versões importadas</CardTitle>
            <div className="w-72">
              <Select value={listaSel} onValueChange={setListaSel}>
                <SelectTrigger><SelectValue placeholder="Selecione versão" /></SelectTrigger>
                <SelectContent>
                  {(listas as any[]).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      v{l.versao} — {new Date(l.created_at).toLocaleDateString("pt-BR")} — {l.arquivo_nome ?? "sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>
      )}

      {listaAtual && (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <KPI label="Versão" value={`v${listaAtual.versao}`} icon={<Database className="h-4 w-4" />} />
            <KPI label="Peso estimado (kg)" value={fmt(listaAtual.peso_total_estimado)} />
            <KPI label="Peso real (kg)" value={fmt(listaAtual.peso_total_real)} />
            <KPI
              label="Desvio"
              value={desvio == null ? "—" : `${desvio >= 0 ? "+" : ""}${desvio.toFixed(2)}%`}
              variant={desvio == null ? "default" : Math.abs(desvio) > 5 ? "warn" : "ok"}
            />
            <KPI label="Itens / Códigos / Peças" value={`${fmtInt(listaAtual.qtd_itens)} / ${fmtInt(listaAtual.qtd_codigos_distintos)} / ${fmtInt(listaAtual.qtd_pecas_total)}`} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleting({ id: listaAtual.id, label: `v${listaAtual.versao}` })}>
              <Trash2 className="h-4 w-4 mr-1" /> Remover versão
            </Button>
          </div>

          <Tabs defaultValue="codigo">
            <TabsList>
              <TabsTrigger value="codigo"><Package className="h-4 w-4 mr-1" /> Por código SAP</TabsTrigger>
              <TabsTrigger value="elemento"><Layers className="h-4 w-4 mr-1" /> Por elemento</TabsTrigger>
              <TabsTrigger value="linhas">Linha a linha</TabsTrigger>
            </TabsList>

            <TabsContent value="codigo">
              <Card>
                <CardContent className="pt-4 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código SAP</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Aplicações</TableHead>
                        <TableHead className="text-right">Qtd. ({porCodigo[0]?.unidade || "—"})</TableHead>
                        <TableHead className="text-right">Peças</TableHead>
                        <TableHead className="text-right">Peso real (kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porCodigo.map((r) => (
                        <TableRow key={r.codigo}>
                          <TableCell className="font-mono">{r.codigo}</TableCell>
                          <TableCell>{r.descricao}</TableCell>
                          <TableCell className="text-right">{r.aplicacoes}</TableCell>
                          <TableCell className="text-right">{fmt(r.quantidade)}</TableCell>
                          <TableCell className="text-right">{fmtInt(r.qtd_pecas)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(r.peso_real)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="elemento">
              <Card>
                <CardContent className="pt-4 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Elemento</TableHead>
                        <TableHead className="text-right">Linhas</TableHead>
                        <TableHead className="text-right">Peças</TableHead>
                        <TableHead className="text-right">Peso real (kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porElemento.map((r) => (
                        <TableRow key={r.elemento}>
                          <TableCell>{r.elemento}</TableCell>
                          <TableCell className="text-right">{r.linhas}</TableCell>
                          <TableCell className="text-right">{fmtInt(r.qtd_pecas)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(r.peso_real)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="linhas">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="relative max-w-md">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Buscar por código, descrição ou elemento…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  </div>
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Elemento</TableHead>
                          <TableHead>Medida</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead>UM</TableHead>
                          <TableHead className="text-right">Peças</TableHead>
                          <TableHead className="text-right">Peso est.</TableHead>
                          <TableHead className="text-right">Peso real</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensFiltrados.map((it) => (
                          <TableRow key={it.id}>
                            <TableCell className="font-mono">{it.codigo_sap}</TableCell>
                            <TableCell className="max-w-xs truncate" title={it.descricao_sap}>{it.descricao_sap}</TableCell>
                            <TableCell className="max-w-xs truncate" title={it.elemento}>{it.elemento}</TableCell>
                            <TableCell>{it.medida}</TableCell>
                            <TableCell className="text-right">{fmt(it.quantidade)}</TableCell>
                            <TableCell>{it.unidade}</TableCell>
                            <TableCell className="text-right">{fmtInt(it.qtd_pecas)}</TableCell>
                            <TableCell className="text-right">{fmt(it.peso_total_estimado)}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(it.peso_real)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {cascoSel && (listas as any[]).length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma lista técnica importada para este casco ainda.
        </CardContent></Card>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lista técnica {deleting?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta versão e todos os seus itens serão apagados. Só admin pode realizar essa operação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMut.mutate(deleting.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KPI({ label, value, icon, variant = "default" }: { label: string; value: string; icon?: React.ReactNode; variant?: "default" | "ok" | "warn" }) {
  const tone =
    variant === "warn" ? "text-amber-700 bg-amber-50 border-amber-200"
    : variant === "ok" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "";
  return (
    <Card className={tone}>
      <CardContent className="py-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}