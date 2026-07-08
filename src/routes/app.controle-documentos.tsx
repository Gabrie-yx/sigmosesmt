import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Upload, FileText, CheckCircle2, AlertTriangle, Clock, Trash2, Download, FolderOpen, RefreshCw, History, Paperclip, Eye, Pencil } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDateBR, daysUntil } from "@/lib/utils-date";
import { openStorageFile, FileViewerHost } from "@/components/file-viewer";

function sanitizeFilename(name: string): string {
  const i = name.lastIndexOf(".");
  const base = i > 0 ? name.slice(0, i) : name;
  const ext = i > 0 ? name.slice(i) : "";
  const clean = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return (clean(base) || "arquivo") + clean(ext);
}

export const Route = createFileRoute("/app/controle-documentos")({
  component: ControleDocumentosPage,
  head: () => ({ meta: [{ title: "Controle de Documentos · SIGMO" }] }),
});

const CRIT_STYLES: Record<string, string> = {
  CRITICA: "bg-red-100 text-red-700 border-red-300",
  ALTA: "bg-orange-100 text-orange-700 border-orange-300",
  MEDIA: "bg-amber-100 text-amber-700 border-amber-300",
  BAIXA: "bg-slate-100 text-slate-700 border-slate-300",
};
const STATUS_STYLES: Record<string, string> = {
  RECEBIDO: "bg-blue-100 text-blue-700 border-blue-200",
  EM_ANALISE: "bg-indigo-100 text-indigo-700 border-indigo-200",
  EM_TRATATIVA: "bg-amber-100 text-amber-700 border-amber-200",
  AGUARDANDO_TERCEIRO: "bg-purple-100 text-purple-700 border-purple-200",
  RESOLVIDO: "bg-emerald-100 text-emerald-700 border-emerald-300",
  CANCELADO: "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUS_LABEL: Record<string, string> = {
  RECEBIDO: "Recebido", EM_ANALISE: "Em análise", EM_TRATATIVA: "Em tratativa",
  AGUARDANDO_TERCEIRO: "Aguardando terceiro", RESOLVIDO: "Resolvido", CANCELADO: "Cancelado",
};
const ORIGEM_LABEL: Record<string, string> = {
  EMAIL: "E-mail", WHATSAPP: "WhatsApp", OFICIO: "Ofício", AUDITORIA: "Auditoria",
  INTERNO: "Interno", RECORRENTE_AUTO: "Recorrente (auto)", OUTRO: "Outro",
};

type Doc = any;
type Categoria = { id: string; codigo: string; nome: string; criticidade_sugerida: string; ativo: boolean };
type Recorrente = any;
type Employee = { id: string; nome: string; status: string };

function ControleDocumentosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("matriz");
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("ABERTOS");
  const [fCrit, setFCrit] = useState<string>("");
  const [fCat, setFCat] = useState<string>("");
  const [fResp, setFResp] = useState<string>("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [recEdit, setRecEdit] = useState<Recorrente | null>(null);

  const docs = useQuery({
    queryKey: ["controle-documentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_documentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const categorias = useQuery({
    queryKey: ["controle-doc-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_doc_categorias").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const employees = useQuery({
    queryKey: ["controle-doc-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees").select("id, nome, status").eq("status", "ATIVO").order("nome");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const recorrentes = useQuery({
    queryKey: ["controle-doc-recorrentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_doc_recorrentes").select("*").order("proxima_validade", { ascending: true });
      if (error) throw error;
      return data as Recorrente[];
    },
  });

  const filtered = useMemo(() => {
    let list = docs.data ?? [];
    if (fStatus === "ABERTOS") list = list.filter((d) => d.status !== "RESOLVIDO" && d.status !== "CANCELADO");
    else if (fStatus === "VENCIDOS") list = list.filter((d) => d.prazo && d.prazo < new Date().toISOString().slice(0, 10) && d.status !== "RESOLVIDO" && d.status !== "CANCELADO");
    else if (fStatus) list = list.filter((d) => d.status === fStatus);
    if (fCrit) list = list.filter((d) => d.criticidade === fCrit);
    if (fCat) list = list.filter((d) => d.categoria_id === fCat);
    if (fResp) list = list.filter((d) => d.responsavel_id === fResp);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter((d) =>
        (d.numero ?? "").toLowerCase().includes(q) ||
        (d.titulo ?? "").toLowerCase().includes(q) ||
        (d.descricao ?? "").toLowerCase().includes(q) ||
        (d.remetente_nome ?? "").toLowerCase().includes(q) ||
        (d.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [docs.data, fStatus, fCrit, fCat, fResp, busca]);

  const stats = useMemo(() => {
    const all = docs.data ?? [];
    const hoje = new Date().toISOString().slice(0, 10);
    const abertos = all.filter((d) => d.status !== "RESOLVIDO" && d.status !== "CANCELADO");
    const vencidos = abertos.filter((d) => d.prazo && d.prazo < hoje);
    const criticos = abertos.filter((d) => d.criticidade === "CRITICA");
    const mesAtual = new Date().toISOString().slice(0, 7);
    const resolvidosMes = all.filter((d) => d.status === "RESOLVIDO" && d.data_resolucao?.startsWith(mesAtual));
    return { abertos: abertos.length, vencidos: vencidos.length, criticos: criticos.length, resolvidosMes: resolvidosMes.length };
  }, [docs.data]);

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-red-700" /> Controle de Documentos
          </h1>
          <p className="text-sm text-muted-foreground">Matriz de rastreabilidade de documentos, demandas e pendências documentais.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRecOpen(true)}><RefreshCw className="h-4 w-4 mr-1" /> Recorrentes</Button>
          <Button onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova entrada</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Abertos" value={stats.abertos} icon={Clock} color="text-blue-600" />
        <StatCard label="Vencidos" value={stats.vencidos} icon={AlertTriangle} color="text-red-600" />
        <StatCard label="Críticos abertos" value={stats.criticos} icon={AlertTriangle} color="text-orange-600" />
        <StatCard label="Resolvidos no mês" value={stats.resolvidosMes} icon={CheckCircle2} color="text-emerald-600" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar nº, título, remetente, tag…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ABERTOS">Abertos</SelectItem>
                <SelectItem value="VENCIDOS">Vencidos</SelectItem>
                <SelectItem value="TODOS_">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={fCrit || "_"} onValueChange={(v) => setFCrit(v === "_" ? "" : v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Criticidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Toda criticidade</SelectItem>
                {["CRITICA", "ALTA", "MEDIA", "BAIXA"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={fCat || "_"} onValueChange={(v) => setFCat(v === "_" ? "" : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Toda categoria</SelectItem>
                {(categorias.data ?? []).map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={fResp || "_"} onValueChange={(v) => setFResp(v === "_" ? "" : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Todos responsáveis</SelectItem>
                {(employees.data ?? []).map((e) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList><TabsTrigger value="lista">Lista</TabsTrigger><TabsTrigger value="kanban">Kanban</TabsTrigger></TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {docs.isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-40" />
              Nenhum documento encontrado. Clique em "Nova entrada" para registrar a primeira demanda.
            </div>
          ) : view === "lista" ? (
            <ListaView docs={filtered} categorias={categorias.data ?? []} employees={employees.data ?? []} onOpen={setDetalheId} />
          ) : (
            <KanbanView docs={filtered} onOpen={setDetalheId} />
          )}
        </CardContent>
      </Card>

      <NovaEntradaDialog
        open={novoOpen} onClose={() => setNovoOpen(false)}
        categorias={categorias.data ?? []}
        employees={employees.data ?? []}
        userId={user?.id}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["controle-documentos"] }); }}
      />

      <DetalheSheet
        id={detalheId} onClose={() => setDetalheId(null)}
        categorias={categorias.data ?? []}
        employees={employees.data ?? []}
      />

      <RecorrentesDialog
        open={recOpen} onClose={() => { setRecOpen(false); setRecEdit(null); }}
        recorrentes={recorrentes.data ?? []}
        categorias={categorias.data ?? []}
        employees={employees.data ?? []}
        editing={recEdit} setEditing={setRecEdit}
        userId={user?.id}
      />
      <FileViewerHost />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card><CardContent className="p-4 flex items-center justify-between">
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value}</div></div>
      <Icon className={`h-8 w-8 ${color}`} />
    </CardContent></Card>
  );
}

function ListaView({ docs, categorias, employees, onOpen }: { docs: Doc[]; categorias: Categoria[]; employees: Employee[]; onOpen: (id: string) => void }) {
  const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
  const empMap = new Map(employees.map((e) => [e.id, e.nome]));
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Nº</TableHead><TableHead>Título</TableHead><TableHead>Categoria</TableHead>
          <TableHead>Criticidade</TableHead><TableHead>Status</TableHead>
          <TableHead>Responsável</TableHead><TableHead>Recebimento</TableHead><TableHead>Prazo</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {docs.map((d) => {
            const vencido = d.prazo && d.prazo < hoje && d.status !== "RESOLVIDO" && d.status !== "CANCELADO";
            const dias = d.prazo ? daysUntil(d.prazo) : null;
            return (
              <TableRow key={d.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpen(d.id)}>
                <TableCell className="font-mono text-xs">{d.numero}</TableCell>
                <TableCell className="font-medium max-w-[280px] truncate">{d.titulo}</TableCell>
                <TableCell className="text-xs">{catMap.get(d.categoria_id) ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className={CRIT_STYLES[d.criticidade]}>{d.criticidade}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={STATUS_STYLES[d.status]}>{STATUS_LABEL[d.status]}</Badge></TableCell>
                <TableCell className="text-xs">{empMap.get(d.responsavel_id) ?? "—"}</TableCell>
                <TableCell className="text-xs">{formatDateBR(d.data_recebimento)}</TableCell>
                <TableCell className="text-xs">
                  {d.prazo ? (
                    <span className={vencido ? "text-red-700 font-semibold" : dias !== null && dias <= 3 ? "text-amber-700 font-semibold" : ""}>
                      {formatDateBR(d.prazo)}
                      {vencido ? " (vencido)" : dias !== null && dias <= 7 ? ` (${dias}d)` : ""}
                    </span>
                  ) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function KanbanView({ docs, onOpen }: { docs: Doc[]; onOpen: (id: string) => void }) {
  const cols = ["RECEBIDO", "EM_ANALISE", "EM_TRATATIVA", "AGUARDANDO_TERCEIRO", "RESOLVIDO"];
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cols.map((s) => {
        const items = docs.filter((d) => d.status === s);
        return (
          <div key={s} className="bg-muted/40 rounded p-2 min-h-[200px]">
            <div className="text-xs font-semibold mb-2 flex justify-between"><span>{STATUS_LABEL[s]}</span><span className="text-muted-foreground">{items.length}</span></div>
            <div className="space-y-2">
              {items.map((d) => {
                const vencido = d.prazo && d.prazo < hoje && d.status !== "RESOLVIDO";
                return (
                  <div key={d.id} onClick={() => onOpen(d.id)} className="bg-white p-2 rounded border shadow-sm cursor-pointer hover:border-red-300">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-mono text-[10px] text-muted-foreground">{d.numero}</span>
                      <Badge variant="outline" className={`${CRIT_STYLES[d.criticidade]} text-[9px] px-1 py-0`}>{d.criticidade}</Badge>
                    </div>
                    <div className="text-xs font-medium line-clamp-2">{d.titulo}</div>
                    {d.prazo && (
                      <div className={`text-[10px] mt-1 ${vencido ? "text-red-700 font-semibold" : "text-muted-foreground"}`}>
                        Prazo: {formatDateBR(d.prazo)}{vencido ? " ⚠" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NovaEntradaDialog({ open, onClose, categorias, employees, userId, onCreated }: any) {
  const [form, setForm] = useState({
    titulo: "", descricao: "", origem: "EMAIL", remetente_nome: "", remetente_contato: "",
    data_recebimento: new Date().toISOString().slice(0, 10), prazo: "",
    categoria_id: "", criticidade: "MEDIA", responsavel_id: "", tratativa: "", tags: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setForm({ titulo: "", descricao: "", origem: "EMAIL", remetente_nome: "", remetente_contato: "",
      data_recebimento: new Date().toISOString().slice(0, 10), prazo: "",
      categoria_id: "", criticidade: "MEDIA", responsavel_id: "", tratativa: "", tags: "" });
    setFiles([]);
  }

  function onCatChange(catId: string) {
    const cat = categorias.find((c: any) => c.id === catId);
    setForm((f) => ({ ...f, categoria_id: catId, criticidade: cat?.criticidade_sugerida ?? f.criticidade }));
  }

  async function salvar() {
    if (!form.titulo.trim()) { toast.error("Informe o título"); return; }
    setSaving(true);
    try {
      const payload: any = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        origem: form.origem,
        remetente_nome: form.remetente_nome.trim() || null,
        remetente_contato: form.remetente_contato.trim() || null,
        data_recebimento: form.data_recebimento,
        prazo: form.prazo || null,
        categoria_id: form.categoria_id || null,
        criticidade: form.criticidade,
        responsavel_id: form.responsavel_id || null,
        tratativa: form.tratativa.trim() || null,
        tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
        created_by: userId ?? null,
      };
      const { data: doc, error } = await supabase.from("controle_documentos").insert(payload).select("*").single();
      if (error) throw error;

      for (const f of files) {
        const path = `${doc.id}/${Date.now()}-${sanitizeFilename(f.name)}`;
        const { error: upErr } = await supabase.storage.from("controle-documentos").upload(path, f);
        if (upErr) { toast.error(`Upload ${f.name}: ${upErr.message}`); continue; }
        await supabase.from("controle_doc_anexos").insert({
          documento_id: doc.id, file_path: path, nome_original: f.name, tipo: "ORIGEM", uploaded_by: userId ?? null,
        });
      }

      toast.success(`Documento ${doc.numero} registrado`);
      reset(); onCreated(); onClose();
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Nova entrada de documento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Atualização dos documentos legais DMN" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Cole aqui o trecho do e-mail ou descreva a demanda" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Origem</Label>
              <Select value={form.origem} onValueChange={(v) => setForm((f) => ({ ...f, origem: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ORIGEM_LABEL).filter(([k]) => k !== "RECORRENTE_AUTO").map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label>Categoria</Label>
              <Select value={form.categoria_id} onValueChange={onCatChange}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categorias.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label>Remetente (quem cobrou)</Label>
              <Input value={form.remetente_nome} onChange={(e) => setForm((f) => ({ ...f, remetente_nome: e.target.value }))} />
            </div>
            <div><Label>Contato (e-mail / tel)</Label>
              <Input value={form.remetente_contato} onChange={(e) => setForm((f) => ({ ...f, remetente_contato: e.target.value }))} />
            </div>
            <div><Label>Data recebimento</Label>
              <Input type="date" value={form.data_recebimento} onChange={(e) => setForm((f) => ({ ...f, data_recebimento: e.target.value }))} />
            </div>
            <div><Label>Prazo para resolução</Label>
              <Input type="date" value={form.prazo} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} />
            </div>
            <div><Label>Criticidade {form.categoria_id && <span className="text-[10px] text-muted-foreground">(sugerida pela categoria)</span>}</Label>
              <Select value={form.criticidade} onValueChange={(v) => setForm((f) => ({ ...f, criticidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["CRITICA", "ALTA", "MEDIA", "BAIXA"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label>Responsável</Label>
              <Select value={form.responsavel_id || "_"} onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v === "_" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Sem responsável</SelectItem>
                  {employees.map((e: any) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Tratativa proposta</Label>
            <Textarea rows={2} value={form.tratativa} onChange={(e) => setForm((f) => ({ ...f, tratativa: e.target.value }))} placeholder="O que será feito" />
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="DMN, Receita Federal" />
          </div>
          <div>
            <Label>Anexos (e-mail, documentos vencidos, referência)</Label>
            <div className="border-2 border-dashed rounded p-3 text-center">
              <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
              <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-xs" />
              {files.length > 0 && (
                <div className="mt-2 text-xs text-left">
                  {files.map((f) => (<div key={f.name}>📎 {f.name}</div>))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Registrar entrada"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalheSheet({ id, onClose, categorias, employees }: { id: string | null; onClose: () => void; categorias: Categoria[]; employees: Employee[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const doc = useQuery({
    queryKey: ["controle-doc", id], enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("controle_documentos").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Doc;
    },
  });
  const anexos = useQuery({
    queryKey: ["controle-doc-anexos", id], enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("controle_doc_anexos").select("*").eq("documento_id", id!).order("uploaded_at", { ascending: false });
      return data ?? [];
    },
  });
  const hist = useQuery({
    queryKey: ["controle-doc-hist", id], enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("controle_doc_historico").select("*").eq("documento_id", id!).order("alterado_em", { ascending: false });
      return data ?? [];
    },
  });

  const [tratativa, setTratativa] = useState("");
  const [status, setStatus] = useState("");
  const [respId, setRespId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [obsFech, setObsFech] = useState("");
  const [tercNome, setTercNome] = useState("");
  const [tercDate, setTercDate] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  // sync form when doc loads
  useMemo(() => {
    if (doc.data) {
      setTratativa(doc.data.tratativa ?? "");
      setStatus(doc.data.status);
      setRespId(doc.data.responsavel_id ?? "");
      setPrazo(doc.data.prazo ?? "");
      setObsFech(doc.data.observacao_fechamento ?? "");
      setTercNome(doc.data.terceiro_nome ?? "");
      setTercDate(doc.data.terceiro_followup_em ?? "");
      setEdit({
        titulo: doc.data.titulo ?? "",
        descricao: doc.data.descricao ?? "",
        origem: doc.data.origem ?? "EMAIL",
        categoria_id: doc.data.categoria_id ?? "",
        criticidade: doc.data.criticidade ?? "MEDIA",
        remetente_nome: doc.data.remetente_nome ?? "",
        remetente_contato: doc.data.remetente_contato ?? "",
        data_recebimento: doc.data.data_recebimento ?? "",
        tags: (doc.data.tags ?? []).join(", "),
      });
    }
  }, [doc.data]);

  const updateMut = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("controle_documentos").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["controle-documentos"] });
      qc.invalidateQueries({ queryKey: ["controle-doc", id] });
      qc.invalidateQueries({ queryKey: ["controle-doc-hist", id] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function uploadAnexo(file: File, tipo: string) {
    if (!id) return;
    const path = `${id}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const { error } = await supabase.storage.from("controle-documentos").upload(path, file);
    if (error) { toast.error(error.message); return; }
    await supabase.from("controle_doc_anexos").insert({
      documento_id: id, file_path: path, nome_original: file.name, tipo, uploaded_by: user?.id ?? null,
    });
    qc.invalidateQueries({ queryKey: ["controle-doc-anexos", id] });
    toast.success("Anexo enviado");
  }

  async function removerAnexo(anexoId: string, path: string) {
    await supabase.storage.from("controle-documentos").remove([path]);
    await supabase.from("controle_doc_anexos").delete().eq("id", anexoId);
    qc.invalidateQueries({ queryKey: ["controle-doc-anexos", id] });
  }

  async function deletarDoc() {
    if (!id) return;
    try {
      const { data: ax } = await supabase.from("controle_doc_anexos").select("id, file_path").eq("documento_id", id);
      const paths = (ax ?? []).map((a: any) => a.file_path).filter(Boolean);
      if (paths.length) await supabase.storage.from("controle-documentos").remove(paths);
      await supabase.from("controle_doc_anexos").delete().eq("documento_id", id);
      await supabase.from("controle_doc_historico").delete().eq("documento_id", id);
      const { error } = await supabase.from("controle_documentos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Documento excluído");
      qc.invalidateQueries({ queryKey: ["controle-documentos"] });
      setConfirmDel(false);
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir");
    }
  }

  async function salvarEdicao() {
    if (!edit?.titulo?.trim()) { toast.error("Título obrigatório"); return; }
    await updateMut.mutateAsync({
      titulo: edit.titulo.trim(),
      descricao: edit.descricao?.trim() || null,
      origem: edit.origem,
      categoria_id: edit.categoria_id || null,
      criticidade: edit.criticidade,
      remetente_nome: edit.remetente_nome?.trim() || null,
      remetente_contato: edit.remetente_contato?.trim() || null,
      data_recebimento: edit.data_recebimento,
      tags: String(edit.tags || "").split(",").map((s: string) => s.trim()).filter(Boolean),
    });
  }

  async function resolver() {
    if (!obsFech.trim()) { toast.error("Descreva a observação de fechamento"); return; }
    await updateMut.mutateAsync({
      status: "RESOLVIDO",
      data_resolucao: new Date().toISOString().slice(0, 10),
      observacao_fechamento: obsFech,
      tratativa,
    });
    // se vier de recorrente, avança próxima validade
    if (doc.data?.recorrente_id) {
      const { data: rec } = await supabase.from("controle_doc_recorrentes").select("*").eq("id", doc.data.recorrente_id).single();
      if (rec) {
        const base = doc.data.prazo ? new Date(doc.data.prazo) : new Date();
        base.setMonth(base.getMonth() + (rec.periodicidade_meses ?? 12));
        await supabase.from("controle_doc_recorrentes").update({ proxima_validade: base.toISOString().slice(0, 10) }).eq("id", rec.id);
        qc.invalidateQueries({ queryKey: ["controle-doc-recorrentes"] });
      }
    }
  }

  if (!id) return null;
  const d = doc.data;
  const empMap = new Map(employees.map((e) => [e.id, e.nome]));
  const catMap = new Map(categorias.map((c) => [c.id, c.nome]));

  return (
    <>
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {!d ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div> : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{d.numero}</span>
                <Badge variant="outline" className={CRIT_STYLES[d.criticidade]}>{d.criticidade}</Badge>
                <Badge variant="outline" className={STATUS_STYLES[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDel(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
              </SheetTitle>
              <div className="text-base font-semibold">{d.titulo}</div>
              {d.descricao && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{d.descricao}</p>}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div><strong>Origem:</strong> {ORIGEM_LABEL[d.origem]}</div>
                <div><strong>Categoria:</strong> {catMap.get(d.categoria_id) ?? "—"}</div>
                <div><strong>Remetente:</strong> {d.remetente_nome ?? "—"} {d.remetente_contato ? `(${d.remetente_contato})` : ""}</div>
                <div><strong>Recebido em:</strong> {formatDateBR(d.data_recebimento)}</div>
                {d.data_resolucao && <div className="col-span-2 text-emerald-700"><strong>Resolvido em:</strong> {formatDateBR(d.data_resolucao)}</div>}
              </div>
              {(d.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">{d.tags.map((t: string) => (<Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>))}</div>
              )}
            </SheetHeader>

            <Tabs defaultValue="tratativa" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="tratativa" className="flex-1">Tratativa</TabsTrigger>
                <TabsTrigger value="editar" className="flex-1"><Pencil className="h-3 w-3 mr-1" />Editar</TabsTrigger>
                <TabsTrigger value="anexos" className="flex-1">Anexos ({anexos.data?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="hist" className="flex-1">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="tratativa" className="space-y-3 pt-3">
                <div><Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label>Responsável</Label>
                  <Select value={respId || "_"} onValueChange={(v) => setRespId(v === "_" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Sem responsável</SelectItem>
                      {employees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Prazo</Label><Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
                <div><Label>Tratativa</Label><Textarea rows={4} value={tratativa} onChange={(e) => setTratativa(e.target.value)} /></div>
                {status === "AGUARDANDO_TERCEIRO" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Terceiro</Label><Input value={tercNome} onChange={(e) => setTercNome(e.target.value)} /></div>
                    <div><Label>Follow-up em</Label><Input type="date" value={tercDate} onChange={(e) => setTercDate(e.target.value)} /></div>
                  </div>
                )}
                <Button className="w-full" variant="outline" onClick={() => updateMut.mutate({
                  status, responsavel_id: respId || null, prazo: prazo || null, tratativa,
                  terceiro_nome: tercNome || null, terceiro_followup_em: tercDate || null,
                })}>Salvar alterações</Button>

                <div className="border-t pt-3 mt-4">
                  <Label>Observação de fechamento (obrigatório para resolver)</Label>
                  <Textarea rows={2} value={obsFech} onChange={(e) => setObsFech(e.target.value)} placeholder="Como foi resolvido, número do novo doc emitido, etc." />
                  <Button className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700" onClick={resolver} disabled={d.status === "RESOLVIDO"}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como RESOLVIDO
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="editar" className="space-y-3 pt-3">
                {edit && (
                  <>
                    <div><Label>Título *</Label><Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
                    <div><Label>Descrição</Label><Textarea rows={3} value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Origem</Label>
                        <Select value={edit.origem} onValueChange={(v) => setEdit({ ...edit, origem: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(ORIGEM_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Categoria</Label>
                        <Select value={edit.categoria_id || "_"} onValueChange={(v) => setEdit({ ...edit, categoria_id: v === "_" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_">Sem categoria</SelectItem>
                            {categorias.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Criticidade</Label>
                        <Select value={edit.criticidade} onValueChange={(v) => setEdit({ ...edit, criticidade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{["CRITICA", "ALTA", "MEDIA", "BAIXA"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Data recebimento</Label><Input type="date" value={edit.data_recebimento} onChange={(e) => setEdit({ ...edit, data_recebimento: e.target.value })} /></div>
                      <div><Label>Remetente</Label><Input value={edit.remetente_nome} onChange={(e) => setEdit({ ...edit, remetente_nome: e.target.value })} /></div>
                      <div><Label>Contato</Label><Input value={edit.remetente_contato} onChange={(e) => setEdit({ ...edit, remetente_contato: e.target.value })} /></div>
                    </div>
                    <div><Label>Tags (separadas por vírgula)</Label><Input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} /></div>
                    <Button className="w-full" onClick={salvarEdicao}><Pencil className="h-4 w-4 mr-1" /> Salvar dados da entrada</Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="anexos" className="space-y-3 pt-3">
                <div className="flex gap-2 flex-wrap">
                  {(["ORIGEM", "REFERENCIA", "EVIDENCIA_RESOLUCAO"] as const).map((tipo) => (
                    <label key={tipo} className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild><span><Upload className="h-3 w-3 mr-1" /> {tipo.replace("_", " ")}</span></Button>
                      <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAnexo(f, tipo); e.target.value = ""; }} />
                    </label>
                  ))}
                </div>
                <div className="space-y-1">
                  {(anexos.data ?? []).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between border rounded p-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <button className="truncate text-left hover:underline" onClick={() => openStorageFile("controle-documentos", a.file_path, a.nome_original)}>{a.nome_original}</button>
                        <Badge variant="secondary" className="text-[9px]">{a.tipo}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" title="Visualizar" onClick={() => openStorageFile("controle-documentos", a.file_path, a.nome_original)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removerAnexo(a.id, a.file_path)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                      </div>
                    </div>
                  ))}
                  {(anexos.data ?? []).length === 0 && <div className="text-xs text-muted-foreground text-center py-4">Nenhum anexo</div>}
                </div>
              </TabsContent>

              <TabsContent value="hist" className="pt-3">
                <div className="space-y-1 text-xs">
                  {(hist.data ?? []).map((h: any) => (
                    <div key={h.id} className="border-l-2 border-muted pl-2 py-1">
                      <div className="font-medium">{h.campo}: <span className="text-muted-foreground">{h.valor_anterior ?? "—"}</span> → <span className="text-foreground">{h.valor_novo ?? "—"}</span></div>
                      <div className="text-muted-foreground">{h.alterado_por_email ?? "sistema"} · {new Date(h.alterado_em).toLocaleString("pt-BR")}</div>
                    </div>
                  ))}
                  {(hist.data ?? []).length === 0 && <div className="text-muted-foreground text-center py-4">Sem alterações registradas</div>}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
    <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent className="z-[110]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento {d?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o documento, todos os anexos e o histórico. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deletarDoc} className="bg-red-600 hover:bg-red-700">Excluir definitivamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RecorrentesDialog({ open, onClose, recorrentes, categorias, employees, editing, setEditing, userId }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ nome: "", categoria_id: "", criticidade: "MEDIA", responsavel_id: "", periodicidade_meses: 12, dias_aviso_previo: 30, proxima_validade: "", observacoes: "" });

  useMemo(() => {
    if (editing) setForm({
      nome: editing.nome ?? "", categoria_id: editing.categoria_id ?? "",
      criticidade: editing.criticidade ?? "MEDIA", responsavel_id: editing.responsavel_id ?? "",
      periodicidade_meses: editing.periodicidade_meses ?? 12, dias_aviso_previo: editing.dias_aviso_previo ?? 30,
      proxima_validade: editing.proxima_validade ?? "", observacoes: editing.observacoes ?? "",
    });
  }, [editing]);

  async function salvar() {
    if (!form.nome.trim() || !form.proxima_validade) { toast.error("Nome e próxima validade são obrigatórios"); return; }
    const payload = {
      nome: form.nome.trim(),
      categoria_id: form.categoria_id || null,
      criticidade: form.criticidade,
      responsavel_id: form.responsavel_id || null,
      periodicidade_meses: Number(form.periodicidade_meses) || 12,
      dias_aviso_previo: Number(form.dias_aviso_previo) || 30,
      proxima_validade: form.proxima_validade,
      observacoes: form.observacoes || null,
      created_by: userId ?? null,
    };
    const q = editing
      ? supabase.from("controle_doc_recorrentes").update(payload).eq("id", editing.id)
      : supabase.from("controle_doc_recorrentes").insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Atualizado" : "Documento recorrente cadastrado");
    qc.invalidateQueries({ queryKey: ["controle-doc-recorrentes"] });
    setEditing(null);
    setForm({ nome: "", categoria_id: "", criticidade: "MEDIA", responsavel_id: "", periodicidade_meses: 12, dias_aviso_previo: 30, proxima_validade: "", observacoes: "" });
  }

  async function excluir(rec: any) {
    if (!confirm(`Excluir "${rec.nome}"?`)) return;
    const { error } = await supabase.from("controle_doc_recorrentes").delete().eq("id", rec.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["controle-doc-recorrentes"] });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Documentos Recorrentes</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{editing ? "Editar" : "Novo"}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: AVCB Estaleiro, Licença Ambiental DMN" /></div>
                <div><Label>Categoria</Label>
                  <Select value={form.categoria_id || "_"} onValueChange={(v) => setForm({ ...form, categoria_id: v === "_" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="_">—</SelectItem>{categorias.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label>Criticidade</Label>
                  <Select value={form.criticidade} onValueChange={(v) => setForm({ ...form, criticidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["CRITICA", "ALTA", "MEDIA", "BAIXA"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label>Responsável</Label>
                  <Select value={form.responsavel_id || "_"} onValueChange={(v) => setForm({ ...form, responsavel_id: v === "_" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="_">—</SelectItem>{employees.map((e: any) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label>Periodicidade (meses)</Label><Input type="number" value={form.periodicidade_meses} onChange={(e) => setForm({ ...form, periodicidade_meses: e.target.value })} /></div>
                <div><Label>Aviso prévio (dias)</Label><Input type="number" value={form.dias_aviso_previo} onChange={(e) => setForm({ ...form, dias_aviso_previo: e.target.value })} /></div>
                <div><Label>Próxima validade *</Label><Input type="date" value={form.proxima_validade} onChange={(e) => setForm({ ...form, proxima_validade: e.target.value })} /></div>
                <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2">
                {editing && <Button variant="outline" onClick={() => setEditing(null)}>Cancelar edição</Button>}
                <Button onClick={salvar}>{editing ? "Atualizar" : "Cadastrar"}</Button>
              </div>
            </CardContent>
          </Card>

          <div className="border rounded">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Periodicidade</TableHead><TableHead>Próxima validade</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {recorrentes.map((r: any) => {
                  const dias = daysUntil(r.proxima_validade);
                  return (
                    <TableRow key={r.id}>
                      <TableCell><div className="font-medium">{r.nome}</div><Badge variant="outline" className={`${CRIT_STYLES[r.criticidade]} text-[9px] mt-1`}>{r.criticidade}</Badge></TableCell>
                      <TableCell className="text-xs">{r.periodicidade_meses}m (aviso {r.dias_aviso_previo}d)</TableCell>
                      <TableCell className="text-xs"><div>{formatDateBR(r.proxima_validade)}</div>{dias !== null && <div className={dias < 0 ? "text-red-700" : dias < 30 ? "text-amber-700" : "text-muted-foreground"}>{dias < 0 ? `${-dias}d atrás` : `em ${dias}d`}</div>}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Editar</Button><Button size="icon" variant="ghost" onClick={() => excluir(r)}><Trash2 className="h-3 w-3 text-red-600" /></Button></TableCell>
                    </TableRow>
                  );
                })}
                {recorrentes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Nenhum documento recorrente cadastrado</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}