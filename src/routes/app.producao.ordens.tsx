import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClipboardList, Eye, Pencil, Trash2, Printer, FileDown, Plus, Search, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { gerarPdfOrdem, imprimirOrdem, type OrdemFull } from "@/lib/producao-pdf";
import { parseListaTecnicaXlsx } from "@/lib/lista-tecnica-parser";

export const Route = createFileRoute("/app/producao/ordens")({
  component: OrdensListPage,
});

function extractCascoNumero(casco?: string | null) {
  const m = String(casco ?? "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function OrdensListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [viewing, setViewing] = useState<OrdemFull | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; numero: string } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["producao-ordens-halb"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_ordens")
        .select("*, itens:producao_ordem_itens(*)")
        .or("mtart.eq.HALB,mtart.is.null")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Garante exclusão de qualquer FERT que escape (defensivo) e mantém HALB + legado sem MTART
      return ((data ?? []) as any[]).filter((o) => o.mtart !== "FERT");
    },
  });

  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-min-ordens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cascos").select("id, numero");
      if (error) throw error;
      return data ?? [];
    },
  });
  const cascoIdByNumero = useMemo(() => {
    const m = new Map<number, string>();
    (cascos as any[]).forEach((c) => {
      const n = extractCascoNumero(c.numero);
      if (n != null) m.set(n, c.id);
    });
    return m;
  }, [cascos]);

  // Lookup MTART por nome do tipo de produto (para o cabeçalho do PDF)
  const { data: tipos = [] } = useQuery({
    queryKey: ["producao-tipos-mtart"],
    queryFn: async () => {
      const { data } = await supabase
        .from("producao_tipos_produto")
        .select("nome, mtart");
      return data ?? [];
    },
  });
  const mtartByNome = useMemo(() => {
    const m = new Map<string, string>();
    (tipos as any[]).forEach((t) => t?.nome && m.set(t.nome, t.mtart ?? ""));
    return m;
  }, [tipos]);
  const withMtart = (o: any): OrdemFull => ({
    ...o,
    mtart: o.mtart ?? (o.tipo_produto ? mtartByNome.get(o.tipo_produto) ?? null : null),
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ordens;
    return ordens.filter((o) =>
      [o.numero, o.casco, o.tipo_produto, o.solicitante]
        .filter(Boolean).some((x: string) => x.toLowerCase().includes(q))
    );
  }, [ordens, busca]);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("producao_ordem_itens").delete().eq("ordem_id", id);
      const { error } = await supabase.from("producao_ordens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ordem excluída");
      qc.invalidateQueries({ queryKey: ["producao-ordens-halb"] });
      qc.invalidateQueries({ queryKey: ["cascos-min"] });
      qc.invalidateQueries({ queryKey: ["cascos-em-ordens"] });
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadMut = useMutation({
    mutationFn: async ({ ordem, file }: { ordem: any; file: File }) => {
      const numero = extractCascoNumero(ordem.casco);
      if (numero == null) throw new Error("Ordem sem número de casco válido.");
      let cascoId = cascoIdByNumero.get(numero);
      if (!cascoId) {
        // Auto-cadastra o casco em Cascos/Embarcações usando o número da OP
        const numeroFmt = `CASCO ${String(numero).padStart(3, "0")}`;
        const { data: novo, error: eCasco } = await supabase
          .from("cascos")
          .insert({ numero: numeroFmt, status: "ATIVO" })
          .select("id")
          .maybeSingle();
        if (eCasco || !novo) {
          throw new Error(eCasco?.message ?? "Falha ao cadastrar o casco automaticamente.");
        }
        cascoId = (novo as any).id;
        toast.success(`Casco ${numeroFmt} cadastrado automaticamente.`);
      }
      const parsed = await parseListaTecnicaXlsx(file);
      const { data: existentes } = await supabase
        .from("producao_lista_tecnica")
        .select("versao")
        .eq("casco_id", cascoId)
        .order("versao", { ascending: false })
        .limit(1);
      const proxVersao = ((existentes?.[0] as any)?.versao ?? 0) + 1;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: lista, error: e1 } = await supabase
        .from("producao_lista_tecnica")
        .insert({
          casco_id: cascoId,
          tipo_embarcacao: ordem.tipo_produto ?? null,
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
      for (let i = 0; i < payload.length; i += 200) {
        const { error: e2 } = await supabase
          .from("producao_lista_tecnica_itens")
          .insert(payload.slice(i, i + 200));
        if (e2) throw e2;
      }
      return lista as any;
    },
    onSuccess: (l) => {
      toast.success(`Lista técnica v${l.versao} importada (${l.qtd_itens} itens). Histórico preservado.`);
      qc.invalidateQueries({ queryKey: ["listas-tecnicas-latest"] });
      qc.invalidateQueries({ queryKey: ["listas-tecnicas"] });
      setUploadingId(null);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Falha ao importar planilha");
      setUploadingId(null);
    },
  });

  const handleFile = (ordem: any, files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploadingId(ordem.id);
    uploadMut.mutate({ ordem, file: f });
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Ordens de Produção</h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Ordens de <strong>Casco em construção (HALB)</strong> — visualize, edite, imprima ou importe a Lista Técnica
            </p>
          </div>
        </div>
        <Link to="/app/producao/criar-ordem">
          <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="h-4 w-4" /> Nova Ordem
          </Button>
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por número, casco, tipo ou solicitante…"
          className="pl-9" />
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Casco</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && filtradas.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Nenhuma ordem cadastrada ainda.
              </TableCell></TableRow>
            )}
            {filtradas.map((o) => {
              const isUp = uploadingId === o.id && uploadMut.isPending;
              return (
              <TableRow key={o.id}>
                <TableCell className="font-bold text-amber-700">{o.numero}</TableCell>
                <TableCell>{o.data_solicitacao ? new Date(o.data_solicitacao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell>{o.casco ?? "—"}</TableCell>
                <TableCell>{o.tipo_produto ?? "—"}</TableCell>
                <TableCell>{o.solicitante ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={o.status === "FINALIZADA" ? "default" : "secondary"}>
                    {o.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <input
                      ref={(el) => { inputsRef.current[o.id] = el; }}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => { handleFile(o, e.target.files); e.target.value = ""; }}
                    />
                    <Button size="sm" variant="outline"
                      className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                      disabled={isUp}
                      onClick={() => inputsRef.current[o.id]?.click()}
                      title="Importar Lista Técnica (SAP B51) — gera nova versão preservando o histórico">
                      {isUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {isUp ? "Importando…" : "Upload B51"}
                    </Button>
                    <Button size="icon" variant="ghost" title="Visualizar"
                      onClick={() => setViewing(o)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Editar"
                      onClick={() => navigate({ to: "/app/producao/criar-ordem", search: { id: o.id } as any })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Imprimir"
                      onClick={() => imprimirOrdem(withMtart(o))}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Baixar PDF"
                      onClick={() => gerarPdfOrdem(withMtart(o))}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Excluir"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleting({ id: o.id, numero: o.numero })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Visualizar */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ordem {viewing?.numero}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm max-h-[70vh] overflow-y-auto">
              <Campo k="Data" v={viewing.data_solicitacao ? new Date(viewing.data_solicitacao).toLocaleDateString("pt-BR") : "—"} />
              <Campo k="Casco" v={viewing.casco} />
              <Campo k="Tipo de Produto" v={viewing.tipo_produto} />
              <Campo k="Solicitante" v={viewing.solicitante} />
              <Campo k="Qtde. Itens" v={viewing.qtde_itens?.toString()} />
              <Campo k="Observações" v={viewing.observacoes} />
              <hr />
              <p className="font-bold text-xs uppercase tracking-wider">Itens</p>
              {(viewing.itens ?? []).map((it: any, i: number) => (
                <div key={it.id} className="rounded border p-3 space-y-1 bg-slate-50">
                  <p className="font-semibold">#{i + 1} — {it.descricao_material}</p>
                  <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                    <span>UM: {it.unidade_medida ?? "—"}</span>
                    <span>NCM: {it.ncm ?? "—"}</span>
                    <span>Centro: {it.centro ?? "—"}</span>
                    <span>Depósito: {it.deposito ?? "—"}</span>
                    <span>Grupo Merc.: {it.grupo_mercadorias ?? "—"}</span>
                    <span>Setor Ativ.: {it.setor_atividade ?? "—"}</span>
                    <span>Grupo Compr.: {it.grupo_compradores ?? "—"}</span>
                    <span>Classe Aval.: {it.classe_avaliacao ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => viewing && imprimirOrdem(withMtart(viewing))}>
              <Printer className="h-4 w-4 mr-1.5" /> Imprimir
            </Button>
            <Button variant="outline" onClick={() => viewing && gerarPdfOrdem(withMtart(viewing))}>
              <FileDown className="h-4 w-4 mr-1.5" /> Baixar PDF
            </Button>
            <Button onClick={() => setViewing(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem?</AlertDialogTitle>
            <AlertDialogDescription>
              A ordem <strong>{deleting?.numero}</strong> e todos os seus itens serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleting && delMut.mutate(deleting.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Campo({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="col-span-2">{v || "—"}</span>
    </div>
  );
}