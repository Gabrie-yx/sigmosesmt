// Configurações → Produtividade — CRUD de Snippets, Templates de Perfil e Anexos Padrão de PDF.
// Só admin acessa. Snippets: usuários comuns também podem criar/editar os próprios (não-oficiais).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { signedUrlAnexo } from "@/lib/pdf-anexos.functions";
import { APP_MODULES } from "@/lib/access-control";
import { menusForModule } from "@/lib/menu-catalog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Zap, LayoutTemplate, Paperclip, Plus, Pencil, Trash2, Upload, ShieldAlert, Lock, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/produtividade")({
  head: () => ({
    meta: [
      { title: "Produtividade — SIGMO" },
      { name: "description", content: "Snippets, templates de perfil e anexos padrão de PDF do SIGMO." },
    ],
  }),
  component: Page,
});

const ESCOPOS_SNIPPET = [
  { value: "apr", label: "APR" },
  { value: "oss", label: "OSS" },
  { value: "inspecao", label: "Inspeção" },
  { value: "plano_acao", label: "Plano de Ação" },
  { value: "generico", label: "Genérico" },
] as const;

const ESCOPOS_ANEXO = [
  { value: "apr", label: "APR" },
  { value: "oss", label: "OSS" },
  { value: "pte", label: "PTE" },
  { value: "dds", label: "DDS" },
  { value: "os", label: "OS Avulsa" },
  { value: "rc", label: "Requisição de Compra" },
] as const;

function Page() {
  const { roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Produtividade</h1>
        <p className="text-sm text-muted-foreground">
          Snippets de texto rápido, templates de perfil de usuário e anexos padrão para PDFs.
          {!isAdmin && " (Apenas snippets pessoais estão disponíveis para o seu perfil.)"}
        </p>
      </div>

      <Tabs defaultValue="snippets">
        <TabsList>
          <TabsTrigger value="snippets"><Zap className="h-3.5 w-3.5 mr-1" /> Snippets</TabsTrigger>
          <TabsTrigger value="templates" disabled={!isAdmin}>
            <LayoutTemplate className="h-3.5 w-3.5 mr-1" /> Templates de Perfil
          </TabsTrigger>
          <TabsTrigger value="anexos" disabled={!isAdmin}>
            <Paperclip className="h-3.5 w-3.5 mr-1" /> Anexos Padrão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snippets" className="mt-4">
          <SnippetsTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          {isAdmin ? <TemplatesTab /> : <NoAdmin />}
        </TabsContent>
        <TabsContent value="anexos" className="mt-4">
          {isAdmin ? <AnexosTab /> : <NoAdmin />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoAdmin() {
  return (
    <Card className="p-6 flex items-start gap-3">
      <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5" />
      <div>
        <p className="font-semibold">Apenas administradores</p>
        <p className="text-sm text-muted-foreground">Esta seção é restrita ao perfil admin.</p>
      </div>
    </Card>
  );
}

// ================= SNIPPETS =================
type SnippetRow = {
  id: string;
  escopo: string;
  campo_alvo: string | null;
  titulo: string;
  conteudo: string;
  oficial: boolean;
  created_by: string | null;
};

function SnippetsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SnippetRow | null>(null);
  const { user } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ["snippets-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("snippets")
        .select("*")
        .order("oficial", { ascending: false })
        .order("escopo", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return data as SnippetRow[];
    },
  });

  const filtrados = data.filter((s) => {
    if (filtro !== "all" && s.escopo !== filtro) return false;
    if (busca && !(s.titulo + s.conteudo).toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  function canEdit(s: SnippetRow) {
    if (isAdmin) return true;
    return !s.oficial && s.created_by === user?.id;
  }

  async function del(s: SnippetRow) {
    if (!confirm(`Excluir snippet "${s.titulo}"?`)) return;
    const { error } = await supabase.from("snippets").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Snippet excluído");
    qc.invalidateQueries({ queryKey: ["snippets-admin"] });
    qc.invalidateQueries({ queryKey: ["snippets"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os escopos</SelectItem>
            {ESCOPOS_SNIPPET.map((e) => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo snippet
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtrados.map((s) => (
          <Card key={s.id} className="p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm">{s.titulo}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{s.escopo}</Badge>
                  {s.campo_alvo && (
                    <Badge variant="outline" className="text-[10px]">campo: {s.campo_alvo}</Badge>
                  )}
                  {s.oficial && <Badge className="text-[10px] bg-red-700 hover:bg-red-800">OFICIAL</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{s.conteudo}</p>
              </div>
              {canEdit(s) && (
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => del(s)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
        {!isLoading && filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhum snippet encontrado.</p>
        )}
      </div>

      <SnippetDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        isAdmin={isAdmin}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["snippets-admin"] });
          qc.invalidateQueries({ queryKey: ["snippets"] });
        }}
      />
    </div>
  );
}

function SnippetDialog({
  open, onOpenChange, editing, isAdmin, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: SnippetRow | null; isAdmin: boolean; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [escopo, setEscopo] = useState<string>("apr");
  const [campo, setCampo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [oficial, setOficial] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEscopo(editing?.escopo ?? "apr");
    setCampo(editing?.campo_alvo ?? "");
    setTitulo(editing?.titulo ?? "");
    setConteudo(editing?.conteudo ?? "");
    setOficial(editing?.oficial ?? false);
  }, [open, editing]);

  async function save() {
    if (!titulo.trim() || !conteudo.trim()) return toast.error("Título e conteúdo são obrigatórios");
    setSaving(true);
    try {
      const payload: any = {
        escopo,
        campo_alvo: campo.trim() || null,
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        oficial: isAdmin ? oficial : false,
      };
      if (editing) {
        const { error } = await supabase.from("snippets").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Snippet atualizado");
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("snippets").insert(payload);
        if (error) throw error;
        toast.success("Snippet criado");
      }
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar snippet" : "Novo snippet"}</DialogTitle>
          <DialogDescription>Texto rápido reutilizável nos wizards do sistema.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Escopo *</Label>
              <Select value={escopo} onValueChange={setEscopo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESCOPOS_SNIPPET.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campo alvo (opcional)</Label>
              <Input value={campo} onChange={(e) => setCampo(e.target.value)}
                placeholder="ex: descricao_atividade, medida_controle" />
            </div>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Conteúdo *</Label>
            <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={6} />
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={oficial} onCheckedChange={(v) => setOficial(!!v)} />
              Marcar como snippet OFICIAL do sistema
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================= TEMPLATES DE PERFIL =================
type TemplateRow = {
  id: string;
  nome: string;
  descricao: string | null;
  roles: string[];
  modulos: string[];
  menus: string[];
  oficial: boolean;
};

function TemplatesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["role-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_templates")
        .select("*")
        .order("oficial", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as TemplateRow[];
    },
  });

  async function del(t: TemplateRow) {
    if (!confirm(`Excluir template "${t.nome}"?`)) return;
    const { error } = await supabase.from("role_templates").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Template excluído");
    qc.invalidateQueries({ queryKey: ["role-templates"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo template
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.map((t) => (
          <Card key={t.id} className="p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold">{t.nome}</span>
                  {t.oficial && <Badge className="text-[10px] bg-red-700 hover:bg-red-800">OFICIAL</Badge>}
                </div>
                {t.descricao && <p className="text-xs text-muted-foreground mb-2">{t.descricao}</p>}
                <div className="flex flex-wrap gap-1">
                  {(t.roles ?? []).map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px]">papel: {r}</Badge>
                  ))}
                  {(t.modulos ?? []).map((m) => (
                    <Badge key={m} variant="outline" className="text-[10px]">mód: {m}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => del(t)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <TemplateDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["role-templates"] })}
      />
    </div>
  );
}

const ROLES_TEMPLATE = ["admin", "moderador", "editor", "viewer", "compras", "tst", "porteiro"];

function TemplateDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: TemplateRow | null; onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [modulos, setModulos] = useState<string[]>([]);
  const [menus, setMenus] = useState<string[]>([]);
  const [oficial, setOficial] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(editing?.nome ?? "");
    setDescricao(editing?.descricao ?? "");
    setRoles(editing?.roles ?? []);
    setModulos(editing?.modulos ?? []);
    setMenus(editing?.menus ?? []);
    setOficial(editing?.oficial ?? false);
  }, [open, editing]);

  function toggle(arr: string[], setArr: (v: string[]) => void, v: string) {
    if (arr.includes(v)) setArr(arr.filter((x) => x !== v));
    else setArr([...arr, v]);
  }

  async function save() {
    if (!nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        roles, modulos, menus,
        oficial,
      };
      if (editing) {
        const { error } = await supabase.from("role_templates").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Template atualizado");
      } else {
        const { error } = await supabase.from("role_templates").insert(payload);
        if (error) throw error;
        toast.success("Template criado");
      }
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar template" : "Novo template de perfil"}</DialogTitle>
          <DialogDescription>Preset de papel + módulos + menus para acelerar convite de usuário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: TST Pleno" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Papéis</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
              {ROLES_TEMPLATE.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggle(roles, setRoles, r)} />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Módulos</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
              {Object.entries(APP_MODULES).map(([v, label]) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={modulos.includes(v)} onCheckedChange={() => toggle(modulos, setModulos, v)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Menus específicos (opcional — vazio = libera tudo dos módulos)</Label>
            <div className="border rounded p-2 max-h-[220px] overflow-y-auto space-y-2 mt-1">
              {modulos.length === 0 && (
                <p className="text-xs text-muted-foreground">Selecione módulos para listar menus.</p>
              )}
              {modulos.map((mod) => {
                const ms = menusForModule(mod as any);
                if (ms.length === 0) return null;
                return (
                  <div key={mod}>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{mod}</p>
                    <div className="grid grid-cols-1 gap-0.5">
                      {ms.map((m) => (
                        <label key={m.key} className="flex items-center gap-2 text-xs">
                          <Checkbox checked={menus.includes(m.key)}
                            onCheckedChange={() => toggle(menus, setMenus, m.key)} />
                          <span className="truncate">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={oficial} onCheckedChange={(v) => setOficial(!!v)} />
            Marcar como template OFICIAL do sistema
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================= ANEXOS PADRÃO =================
type AnexoRow = {
  id: string;
  escopo: string;
  titulo: string;
  descricao: string | null;
  arquivo_path: string;
  obrigatorio: boolean;
  ativo: boolean;
  ordem: number;
};

function AnexosTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnexoRow | null>(null);
  const signedFn = useServerFn(signedUrlAnexo);

  const { data = [], isLoading } = useQuery({
    queryKey: ["pdf-anexos-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_anexos_padrao")
        .select("*")
        .order("escopo", { ascending: true })
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return data as AnexoRow[];
    },
  });

  const filtrados = data.filter((a) => filtro === "all" || a.escopo === filtro);

  async function del(a: AnexoRow) {
    if (!confirm(`Excluir anexo "${a.titulo}"?`)) return;
    // Apaga arquivo do storage
    await supabase.storage.from("pdf-anexos-padrao").remove([a.arquivo_path]).catch(() => {});
    const { error } = await supabase.from("pdf_anexos_padrao").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Anexo excluído");
    qc.invalidateQueries({ queryKey: ["pdf-anexos-admin"] });
    qc.invalidateQueries({ queryKey: ["pdf-anexos-padrao"] });
  }

  async function toggleAtivo(a: AnexoRow) {
    const { error } = await supabase.from("pdf_anexos_padrao")
      .update({ ativo: !a.ativo }).eq("id", a.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pdf-anexos-admin"] });
    qc.invalidateQueries({ queryKey: ["pdf-anexos-padrao"] });
  }

  async function baixar(a: AnexoRow) {
    try {
      const { url } = await signedFn({ data: { arquivo_path: a.arquivo_path, expira_seg: 300 } });
      window.open(url, "_blank");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os escopos</SelectItem>
            {ESCOPOS_ANEXO.map((e) => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Upload className="h-4 w-4 mr-1" /> Novo anexo
          </Button>
        </div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtrados.map((a) => (
          <Card key={a.id} className="p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm">{a.titulo}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{a.escopo}</Badge>
                  {a.obrigatorio && (
                    <Badge className="text-[10px] bg-amber-600 hover:bg-amber-700">
                      <Lock className="h-2.5 w-2.5 mr-0.5" /> OBRIGATÓRIO
                    </Badge>
                  )}
                  {!a.ativo && <Badge variant="outline" className="text-[10px]">INATIVO</Badge>}
                </div>
                {a.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{a.descricao}</p>}
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{a.arquivo_path}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={() => baixar(a)} title="Baixar">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => toggleAtivo(a)} title={a.ativo ? "Desativar" : "Ativar"}>
                  <ShieldAlert className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => del(a)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {!isLoading && filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhum anexo cadastrado.</p>
        )}
      </div>

      <AnexoDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["pdf-anexos-admin"] });
          qc.invalidateQueries({ queryKey: ["pdf-anexos-padrao"] });
        }}
      />
    </div>
  );
}

function AnexoDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: AnexoRow | null; onSaved: () => void;
}) {
  const [escopo, setEscopo] = useState<string>("oss");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [obrigatorio, setObrigatorio] = useState(false);
  const [ordem, setOrdem] = useState<number>(0);
  const [ativo, setAtivo] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEscopo(editing?.escopo ?? "oss");
    setTitulo(editing?.titulo ?? "");
    setDescricao(editing?.descricao ?? "");
    setObrigatorio(editing?.obrigatorio ?? false);
    setOrdem(editing?.ordem ?? 0);
    setAtivo(editing?.ativo ?? true);
    setFile(null);
  }, [open, editing]);

  async function save() {
    if (!titulo.trim()) return toast.error("Título é obrigatório");
    if (!editing && !file) return toast.error("Selecione um arquivo PDF");
    if (file && file.type !== "application/pdf") return toast.error("Arquivo precisa ser PDF");
    setSaving(true);
    try {
      let arquivo_path = editing?.arquivo_path ?? "";
      if (file) {
        const key = `${escopo}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("pdf-anexos-padrao")
          .upload(key, file, { contentType: "application/pdf" });
        if (upErr) throw upErr;
        // Se estava atualizando arquivo, remove o antigo
        if (editing?.arquivo_path && editing.arquivo_path !== key) {
          await supabase.storage.from("pdf-anexos-padrao").remove([editing.arquivo_path]).catch(() => {});
        }
        arquivo_path = key;
      }
      const payload = {
        escopo, titulo: titulo.trim(), descricao: descricao.trim() || null,
        arquivo_path, obrigatorio, ordem, ativo,
      };
      if (editing) {
        const { error } = await supabase.from("pdf_anexos_padrao").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Anexo atualizado");
      } else {
        const { error } = await supabase.from("pdf_anexos_padrao").insert(payload);
        if (error) throw error;
        toast.success("Anexo cadastrado");
      }
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar anexo padrão" : "Novo anexo padrão"}</DialogTitle>
          <DialogDescription>Arquivo PDF que será anexado ao final dos documentos gerados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Escopo *</Label>
              <Select value={escopo} onValueChange={setEscopo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESCOPOS_ANEXO.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={ordem} onChange={(e) => setOrdem(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Arquivo PDF {editing ? "(substituir — opcional)" : "*"}</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {editing?.arquivo_path && !file && (
              <p className="text-[10px] text-muted-foreground mt-1">Atual: {editing.arquivo_path}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={obrigatorio} onCheckedChange={(v) => setObrigatorio(!!v)} />
              Obrigatório (usuário não pode desmarcar)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={ativo} onCheckedChange={(v) => setAtivo(!!v)} />
              Ativo
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}