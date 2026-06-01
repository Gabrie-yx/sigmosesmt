import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Sparkles, FileSignature, Search, ArrowLeft, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import { buildOssPdf } from "@/lib/oss-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/oss/templates")({
  component: OssTemplatesPage,
  head: () => ({ meta: [{ title: "Modelos de OSS · SIGMO" }] }),
});

type Template = {
  id: string;
  cargo: string;
  titulo: string;
  setor: string | null;
  descricao_atividades: string;
  riscos_texto: string;
  medidas_preventivas: string;
  epis_obrigatorios: string;
  proibicoes: string;
  penalidades: string;
  procedimentos_emergencia: string;
  validade_meses: number;
  revisao: number;
  hash_conteudo: string | null;
  ativo: boolean;
  updated_at: string;
  risco_fisico: string | null;
  risco_quimico: string | null;
  risco_biologico: string | null;
  risco_ergonomico: string | null;
  risco_acidente: string | null;
};

function OssTemplatesPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["oss-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oss_templates")
        .select("*")
        .order("cargo");
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return templates;
    return templates.filter(
      (t) =>
        t.cargo.toLowerCase().includes(s) ||
        t.titulo.toLowerCase().includes(s) ||
        (t.setor ?? "").toLowerCase().includes(s),
    );
  }, [templates, q]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-6 pt-5 pb-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 via-white to-amber-50 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/oss"><ArrowLeft className="h-4 w-4 mr-1" />OSS Emitidas</Link>
            </Button>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Modelos de OSS por Cargo</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Conteúdo base da Ordem de Serviço de cada cargo — gerado a partir da Matriz de Riscos e editável.
              </p>
            </div>
          </div>
          {isEditor && (
            <Button onClick={() => setCreating(true)} className="bg-rose-600 hover:bg-rose-700">
              <Plus className="h-4 w-4 mr-1" />Novo Modelo
            </Button>
          )}
        </div>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cargo, título ou setor..."
            className="pl-8 h-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && <div className="text-sm text-slate-500">Carregando modelos...</div>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center">
            <FileSignature className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">
              {q ? "Nenhum modelo encontrado." : "Nenhum modelo cadastrado. Clique em \"Novo Modelo\" para começar."}
            </p>
          </Card>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">{t.cargo}</div>
                  <div className="text-xs text-slate-500 truncate">{t.titulo}</div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">Rev. {t.revisao}</Badge>
              </div>
              {t.setor && (
                <div className="text-[11px] text-slate-500 mb-2">Setor: {t.setor}</div>
              )}
              <div className="text-[10px] text-slate-400 mb-3">
                Validade: {t.validade_meses} meses · Atualizado em {new Date(t.updated_at).toLocaleDateString("pt-BR")}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditing(t)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {(editing || creating) && (
        <TemplateEditorDialog
          template={editing}
          open={true}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["oss-templates"] })}
        />
      )}
    </div>
  );
}

const EMPTY: Omit<Template, "id" | "revisao" | "hash_conteudo" | "updated_at"> = {
  cargo: "",
  titulo: "",
  setor: "",
  descricao_atividades: "",
  riscos_texto: "",
  medidas_preventivas: "",
  epis_obrigatorios: "",
  proibicoes:
    "É proibido executar atividades sem o uso integral dos EPIs obrigatórios; remover ou inutilizar dispositivos de segurança; operar máquinas/equipamentos sem habilitação ou autorização; consumir bebida alcoólica ou outras substâncias entorpecentes no exercício do trabalho.",
  penalidades:
    "O descumprimento das normas de segurança contidas nesta Ordem de Serviço sujeita o trabalhador às penalidades previstas no art. 158 da CLT (advertência, suspensão e demissão por justa causa).",
  procedimentos_emergencia:
    "Em caso de acidente, incidente ou condição de risco grave e iminente: 1) Interromper a atividade; 2) Comunicar imediatamente o supervisor e o SESMT (ramal/telefone); 3) Acionar a brigada de emergência se necessário; 4) Prestar primeiros socorros conforme treinamento; 5) Acionar SAMU (192) e Bombeiros (193) quando aplicável.",
  validade_meses: 12,
  ativo: true,
  risco_fisico: "",
  risco_quimico: "",
  risco_biologico: "",
  risco_ergonomico: "",
  risco_acidente: "",
};

function TemplateEditorDialog({
  template, open, onClose, onSaved,
}: {
  template: Template | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Omit<Template, "id" | "revisao" | "hash_conteudo" | "updated_at">>(
    template ? { ...template } : { ...EMPTY },
  );
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);

  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Buscar cargos disponíveis (da matriz de riscos)
  const { data: roles = [] } = useQuery({
    queryKey: ["oss-roles-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("id, name").eq("ativo", true).order("name");
      return data ?? [];
    },
  });

  // Catálogo de riscos (para picker por categoria)
  const { data: catalogo = [] } = useQuery({
    queryKey: ["oss-catalogo-riscos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("catalogo_riscos")
        .select("id, nome, categoria, medidas_controle_padrao, epis_sugeridos")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []) as Array<{
        id: string; nome: string; categoria: string;
        medidas_controle_padrao: string[] | null;
        epis_sugeridos: string[] | null;
      }>;
    },
  });

  /** Adiciona um item do catálogo no campo de risco daquela categoria,
   *  e ainda enriquece medidas_preventivas + epis_obrigatorios. */
  function addFromCatalogo(
    riscoField: "risco_fisico" | "risco_quimico" | "risco_biologico" | "risco_ergonomico" | "risco_acidente",
    item: { nome: string; medidas_controle_padrao: string[] | null; epis_sugeridos: string[] | null },
  ) {
    setForm((f) => {
      const cur = (f as any)[riscoField] ?? "";
      const line = `• ${item.nome}`;
      const already = cur.split(/\r?\n/).some((l: string) => l.trim() === line);
      const next: any = { ...f };
      if (!already) next[riscoField] = cur.trim() ? `${cur.trim()}\n${line}` : line;
      // medidas
      const medAtual = (f.medidas_preventivas || "").split(/\r?\n/);
      const novasMed = (item.medidas_controle_padrao ?? [])
        .filter((m) => !medAtual.some((l) => l.trim() === `• ${m}`))
        .map((m) => `• ${m}`);
      if (novasMed.length) {
        next.medidas_preventivas = (f.medidas_preventivas?.trim() ? f.medidas_preventivas.trim() + "\n" : "") + novasMed.join("\n");
      }
      // EPIs
      const epiAtual = (f.epis_obrigatorios || "").split(/\r?\n/);
      const novosEpi = (item.epis_sugeridos ?? [])
        .filter((e) => !epiAtual.some((l) => l.trim() === `• ${e}`))
        .map((e) => `• ${e}`);
      if (novosEpi.length) {
        next.epis_obrigatorios = (f.epis_obrigatorios?.trim() ? f.epis_obrigatorios.trim() + "\n" : "") + novosEpi.join("\n");
      }
      return next;
    });
  }

  // "Gerar a partir da Matriz" — busca cargo_riscos + catalogo_riscos do cargo selecionado
  const gerarFromMatriz = useMutation({
    mutationFn: async () => {
      if (!form.cargo.trim()) throw new Error("Selecione/digite o cargo primeiro");
      // Encontrar role correspondente
      const role = roles.find((r) => r.name.toUpperCase() === form.cargo.toUpperCase());
      if (!role) throw new Error("Cargo não encontrado em \"Cargos & Matriz de Riscos\". Cadastre-o lá primeiro.");
      const { data: riscos } = await supabase
        .from("cargo_riscos")
        .select("*, catalogo_riscos(nome, categoria, medidas_controle_padrao, epis_sugeridos)")
        .eq("role_id", role.id)
        .eq("ativo", true);
      const lista = (riscos ?? []) as any[];
      // Agrupa por categoria (mapeia categoria do catálogo → campo do template)
      const catMap: Record<string, keyof typeof form> = {
        FISICO: "risco_fisico",
        QUIMICO: "risco_quimico",
        BIOLOGICO: "risco_biologico",
        ERGONOMICO: "risco_ergonomico",
        ACIDENTE_MECANICO: "risco_acidente",
      };
      const buckets: Record<string, string[]> = {};
      const medidasSet = new Set<string>();
      const episSet = new Set<string>();
      for (const r of lista) {
        const cat = (r.catalogo_riscos?.categoria ?? "").toUpperCase();
        const nome = r.catalogo_riscos?.nome ?? "(risco)";
        const intens = r.intensidade != null ? ` — ${r.intensidade}${r.unidade ?? ""}` : "";
        const fonte = r.fonte_geradora ? ` (fonte: ${r.fonte_geradora})` : "";
        (buckets[cat] ||= []).push(`${nome}${intens}${fonte}`);
        for (const m of r.catalogo_riscos?.medidas_controle_padrao ?? []) medidasSet.add(String(m));
        for (const e of r.catalogo_riscos?.epis_sugeridos ?? []) episSet.add(String(e));
      }
      return { buckets, catMap, medidas: [...medidasSet], epis: [...episSet], total: lista.length };
    },
    onSuccess: (res) => {
      // Preenche cada campo categorizado
      setForm((f) => {
        const next = { ...f };
        for (const [cat, field] of Object.entries(res.catMap)) {
          const items = res.buckets[cat] ?? [];
          if (items.length) (next as any)[field] = items.map((s) => `• ${s}`).join("\n");
        }
        if (res.medidas.length) {
          const existing = f.medidas_preventivas.trim();
          const block = res.medidas.map((m) => `• ${m}`).join("\n");
          next.medidas_preventivas = existing ? `${existing}\n${block}` : block;
        }
        if (res.epis.length) {
          const existing = f.epis_obrigatorios.trim();
          const block = res.epis.map((e) => `• ${e}`).join("\n");
          next.epis_obrigatorios = existing ? `${existing}\n${block}` : block;
        }
        return next;
      });
      toast.success(`${res.total} risco(s) importado(s) da Matriz — categorias, medidas e EPIs preenchidos`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.cargo.trim()) throw new Error("Cargo é obrigatório");
      if (!form.titulo.trim()) throw new Error("Título é obrigatório");
      const payload = { ...form, cargo: form.cargo.trim().toUpperCase() };
      if (template) {
        const { error } = await supabase.from("oss_templates").update(payload).eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("oss_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(template ? "Modelo atualizado (revisão incrementada se houve mudança)" : "Modelo criado");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const visualizar = () => {
    const doc = buildOssPdf({
      numero: "PREVIEW",
      revisao: template?.revisao ?? 1,
      emitido_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + form.validade_meses * 30 * 86400000).toISOString(),
      funcionario: { nome: "[NOME DO FUNCIONÁRIO]", cpf: "[CPF]", matricula: "[MAT]" },
      cargo: form.cargo || "[CARGO]",
      setor: form.setor,
      empresa: null,
      conteudo: {
        descricao_atividades: form.descricao_atividades,
        riscos_texto: form.riscos_texto,
        medidas_preventivas: form.medidas_preventivas,
        epis_obrigatorios: form.epis_obrigatorios,
        proibicoes: form.proibicoes,
        penalidades: form.penalidades,
        procedimentos_emergencia: form.procedimentos_emergencia,
        riscos_categorias: {
          fisico: form.risco_fisico,
          quimico: form.risco_quimico,
          biologico: form.risco_biologico,
          ergonomico: form.risco_ergonomico,
          acidente: form.risco_acidente,
        },
      },
    });
    setPreviewDoc(doc);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{template ? `Editar OSS — ${template.cargo}` : "Novo Modelo de OSS"}</DialogTitle>
            <DialogDescription>
              Editar o conteúdo incrementa a revisão e marca OSS antigas deste cargo como Substituídas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] font-black uppercase">Cargo *</Label>
                <Input
                  value={form.cargo}
                  onChange={(e) => upd("cargo", e.target.value.toUpperCase())}
                  placeholder="Ex: SOLDADOR"
                  list="oss-cargos-list"
                  disabled={!!template}
                />
                <datalist id="oss-cargos-list">
                  {roles.map((r) => <option key={r.id} value={r.name.toUpperCase()} />)}
                </datalist>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase">Título *</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => upd("titulo", e.target.value)}
                  placeholder="Ex: OSS — Soldador (eletrodo revestido)"
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase">Setor</Label>
                <Input value={form.setor ?? ""} onChange={(e) => upd("setor", e.target.value)} placeholder="Caldeiraria, Pintura..." />
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div className="w-32">
                <Label className="text-[10px] font-black uppercase">Validade (meses)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={form.validade_meses}
                  onChange={(e) => upd("validade_meses", Number(e.target.value) || 12)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => gerarFromMatriz.mutate()}
                disabled={gerarFromMatriz.isPending || !form.cargo.trim()}
                className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
              >
                <Sparkles className="h-4 w-4 mr-1" />Importar riscos da Matriz
              </Button>
            </div>

            <TextoSecao label="1. Descrição das Atividades" value={form.descricao_atividades} onChange={(v) => upd("descricao_atividades", v)} placeholder="Descreva o que o trabalhador faz no dia a dia..." />
            {/* 2. Riscos Ocupacionais — 5 categorias separadas (NR-09 / PGR) */}
            <div className="border rounded-md p-3 bg-slate-50 space-y-2">
              <div className="text-[10px] font-black uppercase text-slate-700">2. Riscos Ocupacionais (por categoria)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <RiscoCategoria
                  label="Físico" catKey="FISICO" field="risco_fisico"
                  value={form.risco_fisico ?? ""} onChange={(v) => upd("risco_fisico", v)}
                  placeholder="Ex: ruído, calor, vibração..."
                  catalogo={catalogo} onAdd={addFromCatalogo}
                />
                <RiscoCategoria
                  label="Químico" catKey="QUIMICO" field="risco_quimico"
                  value={form.risco_quimico ?? ""} onChange={(v) => upd("risco_quimico", v)}
                  placeholder="Ex: fumos metálicos, solventes..."
                  catalogo={catalogo} onAdd={addFromCatalogo}
                />
                <RiscoCategoria
                  label="Biológico" catKey="BIOLOGICO" field="risco_biologico"
                  value={form.risco_biologico ?? ""} onChange={(v) => upd("risco_biologico", v)}
                  placeholder="Ex: bactérias, fungos..."
                  catalogo={catalogo} onAdd={addFromCatalogo}
                />
                <RiscoCategoria
                  label="Ergonômico" catKey="ERGONOMICO" field="risco_ergonomico"
                  value={form.risco_ergonomico ?? ""} onChange={(v) => upd("risco_ergonomico", v)}
                  placeholder="Ex: postura prolongada, levantamento de peso..."
                  catalogo={catalogo} onAdd={addFromCatalogo}
                />
                <RiscoCategoria
                  label="Acidente / Mecânico" catKey="ACIDENTE_MECANICO" field="risco_acidente"
                  value={form.risco_acidente ?? ""} onChange={(v) => upd("risco_acidente", v)}
                  placeholder="Ex: espaço confinado, altura, projeção..."
                  catalogo={catalogo} onAdd={addFromCatalogo}
                />
              </div>
              <details className="text-[10px] text-slate-500">
                <summary className="cursor-pointer">Texto livre (legado / fallback)</summary>
                <TextoSecao label="" value={form.riscos_texto} onChange={(v) => upd("riscos_texto", v)} placeholder="Só preencha se quiser substituir todas as categorias acima por um único bloco." />
              </details>
            </div>
            <TextoSecao label="3. Medidas Preventivas" value={form.medidas_preventivas} onChange={(v) => upd("medidas_preventivas", v)} placeholder="Procedimentos, EPCs, sinalização, treinamentos..." />
            <TextoSecao label="4. EPIs Obrigatórios" value={form.epis_obrigatorios} onChange={(v) => upd("epis_obrigatorios", v)} placeholder="Liste os EPIs com respectivos CAs (capacete CA 12345, óculos CA 67890...)" />
            <TextoSecao label="5. Proibições" value={form.proibicoes} onChange={(v) => upd("proibicoes", v)} />
            <TextoSecao label="6. Procedimentos de Emergência" value={form.procedimentos_emergencia} onChange={(v) => upd("procedimentos_emergencia", v)} />
            <TextoSecao label="7. Penalidades" value={form.penalidades} onChange={(v) => upd("penalidades", v)} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="outline" onClick={visualizar}><Eye className="h-4 w-4 mr-1" />Pré-visualizar PDF</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-rose-600 hover:bg-rose-700">
              <Save className="h-4 w-4 mr-1" />Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PDFPreviewDialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
        fileName={`OSS-PREVIEW-${form.cargo || "MODELO"}.pdf`}
        title="Pré-visualização da OSS"
      />
    </>
  );
}

function TextoSecao({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      {label && <Label className="text-[10px] font-black uppercase">{label}</Label>}
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="text-sm" />
    </div>
  );
}

type CatalogoItem = {
  id: string; nome: string; categoria: string;
  medidas_controle_padrao: string[] | null;
  epis_sugeridos: string[] | null;
};

function RiscoCategoria({
  label, catKey, field, value, onChange, placeholder, catalogo, onAdd,
}: {
  label: string;
  catKey: "FISICO" | "QUIMICO" | "BIOLOGICO" | "ERGONOMICO" | "ACIDENTE_MECANICO";
  field: "risco_fisico" | "risco_quimico" | "risco_biologico" | "risco_ergonomico" | "risco_acidente";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  catalogo: CatalogoItem[];
  onAdd: (
    field: "risco_fisico" | "risco_quimico" | "risco_biologico" | "risco_ergonomico" | "risco_acidente",
    item: CatalogoItem,
  ) => void;
}) {
  const items = useMemo(
    () => catalogo.filter((c) => (c.categoria ?? "").toUpperCase() === catKey),
    [catalogo, catKey],
  );
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-black uppercase">{label}</Label>
        <Select
          value=""
          onValueChange={(id) => {
            const it = items.find((i) => i.id === id);
            if (it) onAdd(field, it);
          }}
        >
          <SelectTrigger className="h-6 w-44 text-[10px] border-amber-300 bg-amber-50 hover:bg-amber-100">
            <SelectValue placeholder={items.length ? "+ Do catálogo" : "(catálogo vazio)"} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id} className="text-xs">{i.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} className="text-sm" />
    </div>
  );
}
