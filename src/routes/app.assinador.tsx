import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature, Upload, Download, FileText, History } from "lucide-react";
import { PdfSignerDialog } from "@/components/pdf-signer-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/assinador")({
  component: AssinadorPage,
});

type DocAssinado = {
  id: string;
  nome_arquivo: string;
  modulo: string;
  pdf_assinado_path: string;
  total_assinaturas: number;
  assinaturas: Array<{ nome: string; cargo: string; page: number }>;
  assinado_por_email: string | null;
  created_at: string;
};

function AssinadorPage() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [open, setOpen] = useState(false);

  const { data: docs = [], refetch } = useQuery({
    queryKey: ["documentos-assinados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos_assinados")
        .select("id,nome_arquivo,modulo,pdf_assinado_path,total_assinaturas,assinaturas,assinado_por_email,created_at")
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
    const buf = new Uint8Array(await f.arrayBuffer());
    setPdfBytes(buf);
    setPdfName(f.name);
    setOpen(true);
  };

  const baixar = async (path: string, nome: string) => {
    const { data, error } = await supabase.storage.from("documentos-assinados").createSignedUrl(path, 60);
    if (error) {
      toast.error("Falha ao gerar link: " + error.message);
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = `assinado_${nome}`;
    a.target = "_blank";
    a.click();
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
            Suba um PDF, clique no local exato da página onde a assinatura deve aparecer e salve com validade interna.
          </p>
        </div>
      </div>

      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-1" /> Assinar novo PDF</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-1" /> Histórico ({docs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="pdf-up" className="block">Selecione um PDF para assinar</Label>
              <Input id="pdf-up" type="file" accept="application/pdf" onChange={handleFile} />
              <div className="rounded-md border bg-slate-50 p-4 text-sm space-y-2">
                <p className="font-semibold">Como funciona</p>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Suba o PDF acima.</li>
                  <li>Navegue até a página onde quer posicionar uma assinatura.</li>
                  <li>Na lateral direita, escolha uma assinatura da galeria (ou desenhe uma nova).</li>
                  <li>Clique no local exato do PDF onde a assinatura deve aparecer.</li>
                  <li>Repita quantas vezes precisar (várias assinaturas, várias páginas).</li>
                  <li>Clique em <strong>Salvar PDF Assinado</strong>. O arquivo é guardado e baixado automaticamente.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Documentos Assinados</CardTitle>
            </CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento assinado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {docs.map((d) => (
                    <div key={d.id} className="border rounded-md p-3 flex items-center gap-3 hover:bg-slate-50">
                      <FileText className="h-8 w-8 text-rose-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{d.nome_arquivo}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{d.modulo}</Badge>
                          <span>{d.total_assinaturas} assinatura(s)</span>
                          <span>•</span>
                          <span>{d.assinado_por_email ?? "—"}</span>
                          <span>•</span>
                          <span>{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        {d.assinaturas?.length > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-1 truncate">
                            {d.assinaturas.map((a) => `${a.nome}${a.cargo ? ` (${a.cargo})` : ""} — pág.${a.page}`).join(" · ")}
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => baixar(d.pdf_assinado_path, d.nome_arquivo)}>
                        <Download className="h-4 w-4 mr-1" /> Baixar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PdfSignerDialog
        open={open}
        onClose={() => { setOpen(false); refetch(); }}
        source={pdfBytes}
        nomeArquivo={pdfName}
        modulo="avulso"
      />
    </div>
  );
}