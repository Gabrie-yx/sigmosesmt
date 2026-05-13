import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Factory, Plus, Search, Pencil, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/producao/materiais")({
  component: MateriaisPage,
});

type Material = {
  id: string;
  codigo_material: string;
  tipo_material: "HALB" | "FERT";
  ncm: string | null;
  descricao: string;
  embarcacao_id: string | null;
  tipo_embarcacao: string | null;
  grupo_mercadorias: string | null;
  umb: string | null;
  grupo_compradores: string | null;
  classe_avaliacao: string | null;
  controle_preco: string | null;
  unidade_preco: number | null;
  centro: string | null;
  deposito: string | null;
  org_vendas: string | null;
  canal_distribuicao: string | null;
  setor_atividade: string | null;
  grupo_categ_item: string | null;
  determ_preco: string | null;
  data_solicitacao: string | null;
  item_solicitacao: number | null;
  observacoes: string | null;
};

type Embarcacao = { id: string; nome: string; numero_casco: string | null; tipo: string };

const TIPO_BADGE: Record<string, string> = {
  HALB: "bg-blue-100 text-blue-800 border-blue-300",
  FERT: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

function MateriaisPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"FERT" | "HALB">("FERT");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["producao_materiais"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_materiais")
        .select("*")
        .order("codigo_material");
      if (error) throw error;
      return data as Material[];
    },
  });

  const { data: embarcacoes = [] } = useQuery({
    queryKey: ["producao_embarcacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_embarcacoes")
        .select("id, nome, numero_casco, tipo")
        .order("nome");
      if (error) throw error;
      return data as Embarcacao[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return materiais
      .filter((m) => m.tipo_material === tab)
      .filter(
        (m) =>
          !s ||
          m.codigo_material.toLowerCase().includes(s) ||
          m.descricao.toLowerCase().includes(s) ||
          (m.ncm ?? "").includes(s),
      );
  }, [materiais, tab, search]);

  const counts = useMemo(
    () => ({
      FERT: materiais.filter((m) => m.tipo_material === "FERT").length,
      HALB: materiais.filter((m) => m.tipo_material === "HALB").length,
    }),
    [materiais],
  );

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Material>) => {
      if (editing) {
        const { error } = await (supabase as any)
          .from("producao_materiais")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("producao_materiais")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producao_materiais"] });
      toast.success(editing ? "Material atualizado" : "Material cadastrado");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(m: Material) {
    setEditing(m);
    setDialogOpen(true);
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Catálogo de Materiais</h1>
            <p className="text-xs text-muted-foreground font-medium">
              Produção · HALB (Semiacabado) e FERT (Produto Acabado)
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2 bg-amber-600 hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Novo Material
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "FERT" | "HALB")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="FERT" className="gap-2">
              FERT — Produto Acabado <Badge variant="secondary">{counts.FERT}</Badge>
            </TabsTrigger>
            <TabsTrigger value="HALB" className="gap-2">
              HALB — Semiacabado <Badge variant="secondary">{counts.HALB}</Badge>
            </TabsTrigger>
          </TabsList>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, descrição, NCM…"
              className="pl-8 w-72"
            />
          </div>
        </div>

        <TabsContent value="FERT" className="mt-4">
          <MaterialTable rows={filtered} loading={isLoading} onEdit={openEdit} />
        </TabsContent>
        <TabsContent value="HALB" className="mt-4">
          <MaterialTable rows={filtered} loading={isLoading} onEdit={openEdit} />
        </TabsContent>
      </Tabs>

      <MaterialFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        defaultTipo={tab}
        embarcacoes={embarcacoes}
        onSave={(p) => saveMutation.mutate(p)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}

function MaterialTable({
  rows, loading, onEdit,
}: { rows: Material[]; loading: boolean; onEdit: (m: Material) => void }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-[120px]">Código</TableHead>
            <TableHead className="w-[80px]">Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-[110px]">NCM</TableHead>
            <TableHead className="w-[120px]">Grupo Merc.</TableHead>
            <TableHead className="w-[100px]">Centro/Dep.</TableHead>
            <TableHead className="w-[80px]">UMB</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum material encontrado.</TableCell></TableRow>
          ) : (
            rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs font-bold">{m.codigo_material}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={TIPO_BADGE[m.tipo_material]}>
                    {m.tipo_material}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{m.descricao}</TableCell>
                <TableCell className="font-mono text-xs">{m.ncm ?? "—"}</TableCell>
                <TableCell className="text-xs">{m.grupo_mercadorias ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {[m.centro, m.deposito].filter(Boolean).join(" / ") || "—"}
                </TableCell>
                <TableCell className="text-xs">{m.umb ?? "UN"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => onEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MaterialFormDialog({
  open, onOpenChange, editing, defaultTipo, embarcacoes, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Material | null;
  defaultTipo: "HALB" | "FERT";
  embarcacoes: Embarcacao[];
  onSave: (p: Partial<Material>) => void;
  saving: boolean;
}) {
  const init: Partial<Material> = editing ?? {
    tipo_material: defaultTipo,
    umb: "UN",
    ncm: "89079000",
    centro: "C020",
    deposito: defaultTipo === "FERT" ? "DE01" : "DP01",
    grupo_compradores: "não tem",
    setor_atividade: "20",
    grupo_categ_item: "NORM",
    classe_avaliacao: defaultTipo === "FERT" ? "20" : "3000",
    org_vendas: defaultTipo === "FERT" ? "1002" : null,
    canal_distribuicao: defaultTipo === "FERT" ? "10" : null,
    determ_preco: defaultTipo === "HALB" ? "3" : null,
    grupo_mercadorias: "AT0024",
    data_solicitacao: new Date().toISOString().split("T")[0],
  };
  const [form, setForm] = useState<Partial<Material>>(init);

  // re-init when opening for new editing target
  useMemo(() => setForm(init), [editing, defaultTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  function update<K extends keyof Material>(k: K, v: Material[K] | null) {
    setForm((f) => ({ ...f, [k]: v as never }));
  }

  function submit() {
    if (!form.codigo_material || !form.descricao || !form.tipo_material) {
      toast.error("Código, tipo e descrição são obrigatórios");
      return;
    }
    onSave(form);
  }

  const isFert = form.tipo_material === "FERT";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-amber-600" />
            {editing ? "Editar Material" : "Novo Material"}
            <span className="text-xs font-normal text-muted-foreground ml-2">
              FOR-PROD-{isFert ? "02" : "01"} · Rev. 00
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Identificação */}
          <Section title="Identificação">
            <Field label="Tipo *">
              <Select
                value={form.tipo_material ?? defaultTipo}
                onValueChange={(v) => update("tipo_material", v as Material["tipo_material"])}
                disabled={!!editing}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FERT">FERT — Produto Acabado</SelectItem>
                  <SelectItem value="HALB">HALB — Semiacabado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Código do Material (SAP) *">
              <Input
                value={form.codigo_material ?? ""}
                onChange={(e) => update("codigo_material", e.target.value)}
                placeholder="ex: 50000300"
                disabled={!!editing}
              />
            </Field>
            <Field label="Item da Solicitação">
              <Input
                type="number"
                value={form.item_solicitacao ?? ""}
                onChange={(e) => update("item_solicitacao", e.target.value ? Number(e.target.value) : null)}
                placeholder="1"
              />
            </Field>
            <Field label="Data da Solicitação">
              <Input
                type="date"
                value={form.data_solicitacao ?? ""}
                onChange={(e) => update("data_solicitacao", e.target.value || null)}
              />
            </Field>
            <Field label="Descrição do Material *" className="col-span-2">
              <Input
                value={form.descricao ?? ""}
                onChange={(e) => update("descricao", e.target.value)}
                placeholder="ex: AMAZON AGRO 5 - CASCO 134"
              />
            </Field>
            <Field label="Embarcação Vinculada" className="col-span-2">
              <Select
                value={form.embarcacao_id ?? "__none__"}
                onValueChange={(v) =>
                  update("embarcacao_id", v === "__none__" ? null : v)
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecionar embarcação…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {embarcacoes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          {/* Classificação Fiscal e Comercial */}
          <Section title="Classificação Fiscal e Comercial">
            <Field label="NCM">
              <Input
                value={form.ncm ?? ""}
                onChange={(e) => update("ncm", e.target.value)}
                placeholder="89079000"
              />
            </Field>
            <Field label="Tipo Embarcação">
              <Input
                value={form.tipo_embarcacao ?? ""}
                onChange={(e) => update("tipo_embarcacao", e.target.value)}
                placeholder="BALSA / EMPURRADOR"
              />
            </Field>
            <Field label="Grupo de Mercadorias">
              <Input
                value={form.grupo_mercadorias ?? ""}
                onChange={(e) => update("grupo_mercadorias", e.target.value)}
                placeholder="AT0024"
              />
            </Field>
            <Field label="UMB (Unidade)">
              <Input
                value={form.umb ?? ""}
                onChange={(e) => update("umb", e.target.value)}
                placeholder="UN"
              />
            </Field>
            <Field label="Grupo de Compradores">
              <Input
                value={form.grupo_compradores ?? ""}
                onChange={(e) => update("grupo_compradores", e.target.value)}
                placeholder="A03"
              />
            </Field>
            <Field label="Setor de Atividade">
              <Input
                value={form.setor_atividade ?? ""}
                onChange={(e) => update("setor_atividade", e.target.value)}
                placeholder="20"
              />
            </Field>
          </Section>

          {/* Logística e SAP */}
          <Section title="Logística & Estrutura SAP">
            <Field label="Centro">
              <Input
                value={form.centro ?? ""}
                onChange={(e) => update("centro", e.target.value)}
                placeholder="C020"
              />
            </Field>
            <Field label="Depósito">
              <Input
                value={form.deposito ?? ""}
                onChange={(e) => update("deposito", e.target.value)}
                placeholder={isFert ? "DE01" : "DP01"}
              />
            </Field>
            <Field label="Classe de Avaliação">
              <Input
                value={form.classe_avaliacao ?? ""}
                onChange={(e) => update("classe_avaliacao", e.target.value)}
                placeholder={isFert ? "20" : "3000"}
              />
            </Field>
            <Field label="Grupo Categ. Item Ger.">
              <Input
                value={form.grupo_categ_item ?? ""}
                onChange={(e) => update("grupo_categ_item", e.target.value)}
                placeholder="NORM"
              />
            </Field>
            {isFert && (
              <>
                <Field label="Organização de Vendas">
                  <Input
                    value={form.org_vendas ?? ""}
                    onChange={(e) => update("org_vendas", e.target.value)}
                    placeholder="1002"
                  />
                </Field>
                <Field label="Canal de Distribuição">
                  <Input
                    value={form.canal_distribuicao ?? ""}
                    onChange={(e) => update("canal_distribuicao", e.target.value)}
                    placeholder="10"
                  />
                </Field>
              </>
            )}
            {!isFert && (
              <Field label="Determ. Preço">
                <Input
                  value={form.determ_preco ?? ""}
                  onChange={(e) => update("determ_preco", e.target.value)}
                  placeholder="3"
                />
              </Field>
            )}
            <Field label="Controle de Preço">
              <Input
                value={form.controle_preco ?? ""}
                onChange={(e) => update("controle_preco", e.target.value)}
                placeholder="S"
              />
            </Field>
            <Field label="Unidade de Preço">
              <Input
                type="number"
                value={form.unidade_preco ?? ""}
                onChange={(e) => update("unidade_preco", e.target.value ? Number(e.target.value) : null)}
                placeholder="1"
              />
            </Field>
          </Section>

          <Field label="Observações">
            <Textarea
              value={form.observacoes ?? ""}
              onChange={(e) => update("observacoes", e.target.value)}
              rows={3}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            {saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label, children, className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
    </div>
  );
}