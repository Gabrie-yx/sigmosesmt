import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature, Upload, Download, FileText, History, Pencil, Eye, Trash2, Printer } from "lucide-react";
import { PdfSignerDialog } from "@/components/pdf-signer-dialog";
import { PDFViewerDialog } from "@/components/pdf-viewer-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/assinador")({
  component: AssinadorPage,
});

type DocAssinado = {
  id: string;
  nome_arquivo: string;
  modulo: string;
  pdf_assinado_path: string | null;
  original_pdf_path: string | null;
  total_assinaturas: number;
  assinaturas: any[];
  assinado_por_email: string | null;
  created_at: string;
  status: 'pending' | 'signed';
};

function AssinadorPage() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocAssinado | null>(null);
  const [viewingDoc, setViewingDoc] = useState<DocAssinado | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const { data: docs = [], refetch } = useQuery({
    queryKey: ["documentos-assinados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos_assinados")
        .select("*")
        .eq("modulo", "avulso")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as DocAssinado[];
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF.");
      return;
    }

    // Trava: OS/OSS têm fluxo oficial no módulo OSS (vinculado à ficha do funcionário).
    const nomeUpper = f.name.toUpperCase();
    if (/^OSS?[-_ ]/.test(nomeUpper) || nomeUpper.includes("ORDEM DE SERVIÇO") || nomeUpper.includes("ORDEM DE SERVICO")) {
      toast.error("Ordens de Serviço (OS) devem ser emitidas pelo módulo OSS, não pelo Assinador avulso.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? "anon";
      const ts = new Date().getTime();
      const safeName = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `assinador/pendentes/${uid}/${ts}_${safeName}`;

      const { error: upErr } = await supabase.storage.from("sesmt-docs").upload(path, f);
      if (upErr) throw upErr;

      const { error: insErr } = await (supabase as any).from("documentos_assinados").insert({
        nome_arquivo: f.name,
        modulo: "avulso",
        original_pdf_path: path,
        status: 'pending',
        assinado_por: userData.user?.id ?? null,
        assinado_por_email: userData.user?.email ?? null,
        assinaturas: []
      });
      if (insErr) throw insErr;

      toast.success("Documento carregado com sucesso!");
      refetch();
      setActiveTab("historico");
      // Reset input
      e.target.value = "";
    } catch (err: any) {
      console.error(err);
      toast.error("Falha ao subir documento: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from("documentos_assinados").delete().eq("id", deletingId);
      if (error) throw error;
      toast.success("Documento removido.");
      refetch();
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-rose-600" />
            Assinador de PDFs
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus documentos, posicione assinaturas e visualize ou exporte com validade interna.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-1" /> Novo PDF</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-1" /> Meus Documentos ({docs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload de Documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="pdf-up" className="block">Selecione um PDF para começar</Label>
              <Input 
                id="pdf-up" 
                type="file" 
                accept="application/pdf" 
                onChange={handleFile} 
                disabled={uploading}
              />
              {uploading && <p className="text-sm text-blue-600 animate-pulse">Enviando arquivo...</p>}
              
              <div className="rounded-md border bg-slate-50 p-4 text-sm space-y-2">
                <p className="font-semibold">Como funciona o novo fluxo:</p>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Faça o upload do documento PDF original.</li>
                  <li>Ele ficará salvo na sua lista de documentos.</li>
                  <li>Clique em <strong>Editar/Assinar</strong> para abrir o editor visual.</li>
                  <li>Posicione as assinaturas e salve.</li>
                  <li>Visualize, imprima ou baixe o PDF final a qualquer momento.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Painel de Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <p className="text-sm text-muted-foreground">Nenhum documento encontrado.</p>
                  <Button variant="outline" onClick={() => setActiveTab("upload")}>
                    Subir meu primeiro PDF
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {docs
                    .filter(d => d.modulo !== "ficha-epi")
                    .map((d) => (
                    <Card key={d.id} className="overflow-hidden hover:shadow-md transition-all border-slate-200">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${d.status === 'signed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                            <FileText className="h-7 w-7" />
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => setDeletingId(d.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-slate-800 line-clamp-2 min-h-[40px]" title={d.nome_arquivo}>
                            {d.nome_arquivo}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant={d.status === 'signed' ? "default" : "secondary"} className="text-[10px] uppercase font-bold tracking-wider">
                              {d.status === 'signed' ? 'Assinado' : 'Pendente'}
                            </Badge>
                            {d.status === 'signed' && (
                              <Badge variant="outline" className="text-[10px] font-bold">
                                {d.total_assinaturas} assin.
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 text-xs h-8"
                            onClick={() => setEditingDoc(d)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 text-xs h-8"
                            onClick={() => setViewingDoc(d)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                        </div>

                        <div className="text-[10px] text-slate-400 font-medium">
                          Criado em: {new Date(d.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Editor Modal */}
      {editingDoc && (
        <PdfSignerDialog
          open={!!editingDoc}
          onClose={() => { setEditingDoc(null); refetch(); }}
          source={editingDoc.original_pdf_path || editingDoc.pdf_assinado_path}
          nomeArquivo={editingDoc.nome_arquivo}
          documentId={editingDoc.id}
          modulo={editingDoc.modulo}
        />
      )}

      {/* Viewer Modal */}
      {viewingDoc && (
        <PDFViewerDialog
          open={!!viewingDoc}
          onClose={() => setViewingDoc(null)}
          pdfPath={viewingDoc.pdf_assinado_path || viewingDoc.original_pdf_path}
          fileName={viewingDoc.nome_arquivo}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O documento será excluído permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDoc} className="bg-red-600 hover:bg-red-700">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
