import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FileViewerHost, openStorageFile } from "@/components/file-viewer";
import { FileText, Upload, Eye, Trash2, Plus, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/docs")({
  component: SesmtDocsPage,
});

const TIPOS = [
  "PGR", "PCMSO", "LTCAT", "PPRA", "PPP", "AET", "Laudo de Insalubridade",
  "Laudo de Periculosidade", "CIPA - Ata", "Ordem de Serviço", "Procedimento", "Outro",
] as const;

type SesmtDoc = {
  id: string;
  tipo: string;
  titulo: string | null;
  descricao: string | null;
  file_path: string;
  data_emissao: string | null;
  data_validade: string | null;
  uploaded_at: string;
};

function SesmtDocsPage() {
  const { roles } = useAuth();
  const isEditor = roles.includes("admin") || roles.includes("tst");
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const [filterTipo, setFilterTipo] = useState<string>("ALL");
  const [openDialog, setOpenDialog] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["sesmt-docs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sesmt_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SesmtDoc[];
    },
  });

  const del = useMutation({
    mutationFn: async (d: SesmtDoc) => {
      await supabase.storage.from("sesmt-docs").remove([d.file_path]);
      const { error } = await (supabase as any).from("sesmt_documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluído");
      qc.invalidateQueries({ queryKey: ["sesmt-docs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const filtered = filterTipo === "ALL" ? docs : docs.filter((d) => d.tipo === filterTipo);

  function vencimentoStatus(data_validade: string | null) {
    if (!data_validade) return null;
    const dias = Math.ceil((new Date(data_validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (dias < 0) return { label: "Vencido", color: "bg-red-100 text-red-800 border-red-200" };
    if (dias <= 30) return { label: `Vence em ${dias}d`, color: "bg-amber-100 text-amber-800 border-amber-200" };
    return { label: "Vigente", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <FileViewerHost />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-red-700" /> Documentos SESMT
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Repositório central de PGR, PCMSO, LTCAT e demais documentos legais.
          </p>
        </div>
        {isEditor && (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button className="bg-red-700 hover:bg-red-800">
                <Plus className="h-4 w-4 mr-2" /> Novo Documento
              </Button>
            </DialogTrigger>
            <UploadDialog onClose={() => setOpenDialog(false)} />
          </Dialog>
        )}
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[200px]">
              <Label className="text-xs">Filtrar por tipo</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os tipos</SelectItem>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-slate-600 ml-auto">
              {filtered.length} documento(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center text-sm text-slate-500 py-8">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            Nenhum documento encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => {
            const status = vencimentoStatus(d.data_validade);
            return (
              <Card key={d.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="bg-slate-900 text-white border-0">
                      {d.tipo}
                    </Badge>
                    {status && (
                      <Badge variant="outline" className={status.color}>
                        {status.label === "Vencido" && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {status.label}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2 line-clamp-2">
                    {d.titulo || d.tipo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {d.descricao && (
                    <p className="text-xs text-slate-600 line-clamp-2">{d.descricao}</p>
                  )}
                  <div className="text-xs text-slate-500 space-y-1">
                    {d.data_emissao && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Emissão: {new Date(d.data_emissao).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                    {d.data_validade && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Validade: {new Date(d.data_validade).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openStorageFile("sesmt-docs", d.file_path, d.titulo ?? d.tipo)}
                    >
                      <Eye className="h-4 w-4 mr-1" /> Ver
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Excluir "${d.titulo ?? d.tipo}"?`)) del.mutate(d);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UploadDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("PGR");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSave() {
    if (!file) { toast.error("Selecione um arquivo"); return; }
    if (!tipo) { toast.error("Selecione o tipo"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Arquivo maior que 25MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${tipo}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("sesmt-docs").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: userData } = await supabase.auth.getUser();
      const { error: insErr } = await (supabase as any).from("sesmt_documents").insert({
        tipo,
        titulo: titulo || null,
        descricao: descricao || null,
        file_path: path,
        data_emissao: dataEmissao || null,
        data_validade: dataValidade || null,
        uploaded_by: userData.user?.id,
      });
      if (insErr) throw insErr;

      toast.success("Documento enviado!");
      qc.invalidateQueries({ queryKey: ["sesmt-docs"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Novo Documento SESMT</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Tipo *</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: PGR 2026 - Estaleiro DMN" />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data de Emissão</Label>
            <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
          </div>
          <div>
            <Label>Data de Validade</Label>
            <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Arquivo * (PDF, imagem, máx 25MB)</Label>
          <Input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
        <Button onClick={handleSave} disabled={uploading} className="bg-red-700 hover:bg-red-800">
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Enviando…" : "Enviar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
