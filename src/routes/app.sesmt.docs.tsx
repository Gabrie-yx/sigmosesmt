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
import { FileText, Upload, Eye, Trash2, Plus, Calendar, AlertTriangle, History, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/docs")({
  component: SesmtDocsPage,
});

const TIPOS = [
  "PGR", "PCMSO", "LTCAT", "PPRA", "PPP", "AET", "Laudo de Insalubridade",
  "Laudo de Periculosidade", "CIPA - Ata", "Ordem de Serviço", "Procedimento", "Outro",
] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

function todayDateOnly() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// Normaliza datas sem usar new Date("YYYY-MM-DD"), evitando diferença de fuso horário.
function normalizeDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  const year = iso
    ? Number(iso[1])
    : dmy
      ? Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3])
      : null;
  const month = iso ? Number(iso[2]) : dmy ? Number(dmy[2]) : null;
  const day = iso ? Number(iso[3]) : dmy ? Number(dmy[1]) : null;

  if (!year || !month || !day) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function fmtDateBR(value?: string | null): string {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function dateOnlyTime(value?: string | null): number | null {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

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

type Revision = {
  id: string;
  document_id: string;
  data_revisao: string;
  numero_revisao: string;
  descricao: string;
  motivo: string | null;
  responsavel: string;
  created_at: string;
};

function SesmtDocsPage() {
  const { roles } = useAuth();
  const isEditor = roles.includes("admin") || roles.includes("tst");
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const [filterTipo, setFilterTipo] = useState<string>("ALL");
  const [openDialog, setOpenDialog] = useState(false);
  const [historyDoc, setHistoryDoc] = useState<SesmtDoc | null>(null);

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
    const validade = dateOnlyTime(data_validade);
    if (validade === null) return null;
    const hoje = dateOnlyTime(todayDateOnly())!;
    const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
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
                        <Calendar className="h-3 w-3" /> Emissão: {fmtDateBR(d.data_emissao)}
                      </div>
                    )}
                    {d.data_validade && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Validade: {fmtDateBR(d.data_validade)}
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryDoc(d)}
                      title="Controle de revisões"
                    >
                      <History className="h-4 w-4" />
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

      <RevisionsDialog
        doc={historyDoc}
        onClose={() => setHistoryDoc(null)}
        canEdit={isEditor}
        canDelete={isAdmin}
      />
    </div>
  );
}

function RevisionsDialog({
  doc,
  onClose,
  canEdit,
  canDelete,
}: {
  doc: SesmtDoc | null;
  onClose: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const [dataRev, setDataRev] = useState(todayDateOnly());
  const [numero, setNumero] = useState("");
  const [descricao, setDescricao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Revision>>({});

  const { data: revs = [], isLoading } = useQuery({
    queryKey: ["sesmt-doc-revisions", doc?.id],
    enabled: !!doc?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sesmt_document_revisions")
        .select("*")
        .eq("document_id", doc!.id)
        .order("data_revisao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Revision[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!doc) return;
      const dataRevisao = normalizeDateOnly(dataRev);
      if (!numero || !descricao || !responsavel || !dataRevisao) {
        throw new Error("Preencha data, número, descrição e responsável");
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("sesmt_document_revisions").insert({
        document_id: doc.id,
        data_revisao: dataRevisao,
        numero_revisao: numero,
        descricao,
        motivo: motivo || null,
        responsavel,
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Revisão registrada");
      setNumero(""); setDescricao(""); setMotivo(""); setResponsavel("");
      qc.invalidateQueries({ queryKey: ["sesmt-doc-revisions", doc?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("sesmt_document_revisions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Revisão excluída");
      qc.invalidateQueries({ queryKey: ["sesmt-doc-revisions", doc?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const update = useMutation({
    mutationFn: async (payload: {
      id: string;
      data_revisao: string;
      numero_revisao: string;
      descricao: string;
      motivo: string | null;
      responsavel: string;
    }) => {
      const { id, ...rest } = payload;
      const dataRevisao = normalizeDateOnly(rest.data_revisao);
      if (!dataRevisao) throw new Error("Data da revisão inválida");
      const { data, error } = await (supabase as any)
        .from("sesmt_document_revisions")
        .update({ ...rest, data_revisao: dataRevisao })
        .eq("id", id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nenhuma linha atualizada (verifique permissões)");
      }
    },
    onSuccess: () => {
      toast.success("Revisão atualizada");
      qc.invalidateQueries({ queryKey: ["sesmt-doc-revisions", doc?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  // Suggest next revision number (00, 01, 02…)
  const suggestedNext = (() => {
    const nums = revs
      .map((r) => parseInt(r.numero_revisao, 10))
      .filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 0;
    return String(next).padStart(2, "0");
  })();

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Controle de Revisões — {doc?.titulo ?? doc?.tipo}
          </DialogTitle>
        </DialogHeader>

        {canEdit && (
          <Card className="bg-slate-50">
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Data *</Label>
                  <Input type="date" value={dataRev} onChange={(e) => setDataRev(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Revisão *</Label>
                  <Input
                    placeholder={suggestedNext}
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Responsável *</Label>
                  <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Descrição *</Label>
                <Textarea
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Realização de treinamento NR-35"
                />
              </div>
              <div>
                <Label className="text-xs">Motivo</Label>
                <Input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: 1-Elaboração, 2-Atualização de cargo, 3-Acidente, 4-Treinamento"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-red-700 hover:bg-red-800"
                  onClick={() => add.mutate()}
                  disabled={add.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" /> Registrar revisão
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-2">
          <h3 className="text-sm font-bold text-slate-700 mb-2">Histórico</h3>
          {isLoading ? (
            <div className="text-sm text-slate-500 py-4 text-center">Carregando…</div>
          ) : revs.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center border rounded-md">
              Nenhuma revisão registrada.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Revisão</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-left">Motivo</th>
                    <th className="px-3 py-2 text-left">Responsável</th>
                    {(canEdit || canDelete) && <th className="px-3 py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {revs.map((r) => (
                    editingId === r.id ? (
                      <tr key={r.id} className="border-t bg-amber-50">
                        <td className="px-2 py-1">
                          <Input type="date" value={editDraft.data_revisao ?? ""} onChange={(e) => setEditDraft({ ...editDraft, data_revisao: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <Input value={editDraft.numero_revisao ?? ""} onChange={(e) => setEditDraft({ ...editDraft, numero_revisao: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <Input value={editDraft.descricao ?? ""} onChange={(e) => setEditDraft({ ...editDraft, descricao: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <Input value={editDraft.motivo ?? ""} onChange={(e) => setEditDraft({ ...editDraft, motivo: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <Input value={editDraft.responsavel ?? ""} onChange={(e) => setEditDraft({ ...editDraft, responsavel: e.target.value })} />
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          <Button size="sm" variant="ghost" className="text-emerald-700" onClick={() => {
                            update.mutate({
                              id: r.id,
                              data_revisao: editDraft.data_revisao || r.data_revisao,
                              numero_revisao: editDraft.numero_revisao || r.numero_revisao,
                              descricao: editDraft.descricao || r.descricao,
                              motivo: editDraft.motivo ?? null,
                              responsavel: editDraft.responsavel || r.responsavel,
                            }, { onSuccess: () => { setEditingId(null); setEditDraft({}); } });
                          }}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditDraft({}); }}><X className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">{fmtDateBR(r.data_revisao)}</td>
                        <td className="px-3 py-2 font-mono">{r.numero_revisao}</td>
                        <td className="px-3 py-2">{r.descricao}</td>
                        <td className="px-3 py-2 text-slate-600">{r.motivo ?? "—"}</td>
                        <td className="px-3 py-2">{r.responsavel}</td>
                        {(canEdit || canDelete) && (
                          <td className="px-3 py-2 whitespace-nowrap">
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-slate-700"
                                onClick={() => {
                                  setEditingId(r.id);
                                  setEditDraft({
                                    data_revisao: normalizeDateOnly(r.data_revisao) ?? "",
                                    numero_revisao: r.numero_revisao,
                                    descricao: r.descricao,
                                    motivo: r.motivo ?? "",
                                    responsavel: r.responsavel,
                                  });
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-700"
                                onClick={() => { if (confirm("Excluir revisão?")) del.mutate(r.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
              <div className="bg-slate-50 border-t px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Legenda – Motivo:</span>{" "}
                <span className="mr-3"><b>1</b> Elaboração</span>
                <span className="mr-3"><b>2</b> Atualização de cargo/função</span>
                <span className="mr-3"><b>3</b> Acidente de trabalho</span>
                <span className="mr-3"><b>4</b> Treinamento</span>
                <span className="mr-3"><b>5</b> Alteração de processo</span>
                <span className="mr-3"><b>6</b> Auditoria/Não conformidade</span>
                <span className="mr-3"><b>7</b> Revisão periódica</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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

      const emissao = normalizeDateOnly(dataEmissao);
      const validade = normalizeDateOnly(dataValidade);
      const { data: userData } = await supabase.auth.getUser();
      const { error: insErr } = await (supabase as any).from("sesmt_documents").insert({
        tipo,
        titulo: titulo || null,
        descricao: descricao || null,
        file_path: path,
        data_emissao: emissao,
        data_validade: validade,
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
