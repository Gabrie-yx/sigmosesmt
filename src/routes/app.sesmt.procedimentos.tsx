import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileViewerHost, openStorageFile } from "@/components/file-viewer";
import {
  FileCheck2,
  Plus,
  Eye,
  Trash2,
  Upload,
  History,
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Pencil,
  Wand2,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { gerarAuditoriaPopPdf } from "@/lib/pop-auditoria-pdf";

export const Route = createFileRoute("/app/sesmt/procedimentos")({
  component: ProcedimentosPage,
});

const ESCOPOS = ["AMBOS", "CLT", "TERCEIRO"] as const;
const AREAS = ["SST", "QUALIDADE", "PRODUCAO", "RH", "OUTRO"] as const;
const CRITICIDADES = ["ALTA", "MEDIA", "BAIXA"] as const;
const STATUS = ["RASCUNHO", "HOMOLOGADO", "OBSOLETO"] as const;

type GuidedPop = {
  codigo: string;
  titulo: string;
  objetivo: string;
  escopo: "AMBOS" | "CLT" | "TERCEIRO";
  criticidade: "ALTA" | "MEDIA" | "BAIXA";
  periodicidade: number;
  baseLegal: string;
  descricao: string;
  observacoes: string;
};

const GUIDED_POPS: GuidedPop[] = [
  {
    codigo: "POP-SST-001",
    titulo: "Controle de SST para CLT e Terceiros",
    objetivo:
      "Padronizar a admissão, aptidão e ciência de procedimentos para colaboradores CLT e terceirizados, garantindo conformidade com NR-01, NR-07 e NR-18.",
    escopo: "AMBOS",
    criticidade: "ALTA",
    periodicidade: 24,
    baseLegal: "NR-01 + NR-07 + NR-18",
    descricao:
      "Cria o POP-SST-001 (Controle SST CLT/Terceiros), escopo AMBOS, criticidade ALTA, v01 já HOMOLOGADA.",
    observacoes:
      "POP base de auditoria — define a metodologia executada pelo safety-engine.",
  },
  {
    codigo: "POP-SST-002",
    titulo: "Integração de Segurança",
    objetivo:
      "Definir conteúdo, carga horária e registro da integração de segurança aplicada a todo colaborador (CLT ou terceiro) antes do início das atividades.",
    escopo: "AMBOS",
    criticidade: "ALTA",
    periodicidade: 24,
    baseLegal: "NR-01 item 1.7 + NR-18",
    descricao:
      "Cria o POP-SST-002 (Integração de Segurança), escopo AMBOS, criticidade ALTA, v01 já HOMOLOGADA.",
    observacoes:
      "Carga horária mínima 4h. Conteúdo: política de SST, riscos da empresa, EPIs obrigatórios, plano de emergência, comunicação de acidentes.",
  },
  {
    codigo: "POP-SST-003",
    titulo: "Controle de ASO e PCMSO",
    objetivo:
      "Padronizar a solicitação, realização, arquivamento e controle de validade dos exames ocupacionais (admissional, periódico, mudança de função, retorno e demissional).",
    escopo: "AMBOS",
    criticidade: "ALTA",
    periodicidade: 12,
    baseLegal: "NR-07 (PCMSO)",
    descricao:
      "Cria o POP-SST-003 (Controle ASO/PCMSO), escopo AMBOS, criticidade ALTA, v01 já HOMOLOGADA.",
    observacoes:
      "Periodicidade dos exames conforme PCMSO. Bloqueio automático ao vencer (safety-engine).",
  },
  {
    codigo: "POP-SST-004",
    titulo: "Gestão de Empresas Terceirizadas",
    objetivo:
      "Estabelecer critérios para contratação, avaliação e fiscalização de empresas terceirizadas no que se refere a SST, evitando responsabilização subsidiária.",
    escopo: "TERCEIRO",
    criticidade: "ALTA",
    periodicidade: 12,
    baseLegal: "NR-01 + Súmula 331 TST",
    descricao:
      "Cria o POP-SST-004 (Gestão de Terceiros), escopo TERCEIRO, criticidade ALTA, v01 já HOMOLOGADA.",
    observacoes:
      "Exige cláusula contratual de SST, apresentação mensal de ASOs/treinamentos e auditoria semestral nas terceiras.",
  },
];

type Procedimento = {
  id: string;
  codigo: string;
  titulo: string;
  objetivo: string | null;
  escopo: "CLT" | "TERCEIRO" | "AMBOS";
  area: string;
  criticidade: "ALTA" | "MEDIA" | "BAIXA";
  status: "RASCUNHO" | "HOMOLOGADO" | "OBSOLETO";
  versao_atual: string;
  periodicidade_revisao_meses: number;
  proxima_revisao: string | null;
  responsavel: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type Revisao = {
  id: string;
  procedimento_id: string;
  versao: string;
  pdf_path: string | null;
  data_emissao: string;
  data_homologacao: string | null;
  motivo_revisao: string | null;
  responsavel: string | null;
  status: "RASCUNHO" | "HOMOLOGADO" | "SUPERADA";
  created_at: string;
};

type Ciente = {
  id: string;
  procedimento_id: string;
  versao: string;
  employee_id: string;
  origem: "MANUAL" | "DDS" | "INTEGRACAO";
  data_ciencia: string;
  observacao: string | null;
};

type EmployeeMini = {
  id: string;
  nome: string;
  cpf: string | null;
  status: string;
  setor: string | null;
  company_id: string | null;
};

type CompanyMini = { id: string; name: string; type: string };

function statusBadge(s: string) {
  if (s === "HOMOLOGADO") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "RASCUNHO") return "bg-slate-200 text-slate-700 border-slate-300";
  if (s === "OBSOLETO") return "bg-zinc-200 text-zinc-600 border-zinc-300 line-through";
  if (s === "SUPERADA") return "bg-zinc-100 text-zinc-500 border-zinc-200";
  return "bg-slate-100 text-slate-700";
}
function criticidadeBadge(c: string) {
  if (c === "ALTA") return "bg-red-100 text-red-800 border-red-200";
  if (c === "MEDIA") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}
function escopoBadge(e: string) {
  if (e === "CLT") return "bg-blue-100 text-blue-800 border-blue-200";
  if (e === "TERCEIRO") return "bg-purple-100 text-purple-800 border-purple-200";
  return "bg-slate-900 text-white border-slate-900";
}

function ProcedimentosPage() {
  const { roles } = useAuth();
  const isEditor =
    roles.includes("admin") ||
    roles.includes("moderador") ||
    roles.includes("editor") ||
    roles.includes("tst");
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();

  const [filterEscopo, setFilterEscopo] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Procedimento | null>(null);
  const [detail, setDetail] = useState<Procedimento | null>(null);
  const [creatingGuided, setCreatingGuided] = useState<string | null>(null);

  const { data: procs = [], isLoading } = useQuery({
    queryKey: ["procedimentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("procedimentos")
        .select("*")
        .order("codigo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Procedimento[];
    },
  });

  const { data: cientesAll = [] } = useQuery({
    queryKey: ["procedimento-cientes-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("procedimento_cientes")
        .select("procedimento_id, versao, employee_id");
      if (error) throw error;
      return (data ?? []) as Array<Pick<Ciente, "procedimento_id" | "versao" | "employee_id">>;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, type");
      if (error) throw error;
      return (data ?? []) as CompanyMini[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-mini-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, cpf, status, setor, company_id")
        .eq("status", "ATIVO");
      if (error) throw error;
      return (data ?? []) as EmployeeMini[];
    },
  });

  const companyType = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) m.set(c.id, c.type);
    return m;
  }, [companies]);

  function applicableCount(p: Procedimento) {
    return employees.filter((e) => {
      if (p.escopo === "AMBOS") return true;
      const t = e.company_id ? companyType.get(e.company_id) : null;
      return t === p.escopo;
    }).length;
  }
  function cientesCount(p: Procedimento) {
    return cientesAll.filter(
      (c) => c.procedimento_id === p.id && c.versao === p.versao_atual,
    ).length;
  }

  const filtered = procs.filter((p) => {
    if (filterEscopo !== "ALL" && p.escopo !== filterEscopo) return false;
    if (filterStatus !== "ALL" && p.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.codigo.toLowerCase().includes(s) && !p.titulo.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const stats = useMemo(() => {
    const total = procs.length;
    const homologados = procs.filter((p) => p.status === "HOMOLOGADO").length;
    const rascunhos = procs.filter((p) => p.status === "RASCUNHO").length;
    let totalCienciaPct = 0;
    let countWithApp = 0;
    for (const p of procs.filter((x) => x.status === "HOMOLOGADO")) {
      const app = applicableCount(p);
      if (app > 0) {
        totalCienciaPct += (cientesCount(p) / app) * 100;
        countWithApp++;
      }
    }
    const aderencia = countWithApp ? Math.round(totalCienciaPct / countWithApp) : 0;
    return { total, homologados, rascunhos, aderencia };
  }, [procs, employees, cientesAll, companyType]);

  const del = useMutation({
    mutationFn: async (p: Procedimento) => {
      const { error } = await (supabase as any).from("procedimentos").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Procedimento excluído");
      qc.invalidateQueries({ queryKey: ["procedimentos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <FileViewerHost />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-red-700" /> Procedimentos / POPs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de Procedimentos Operacionais Padrão com versionamento, homologação e ciência
            dos colaboradores (CLT e Terceiros).
          </p>
        </div>
        {isEditor && (
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="bg-red-700 hover:bg-red-800">
                <Plus className="h-4 w-4 mr-2" /> Novo Procedimento
              </Button>
            </DialogTrigger>
            <ProcedimentoFormDialog
              key="create"
              onClose={() => setOpenCreate(false)}
              onSaved={() => {
                setOpenCreate(false);
                qc.invalidateQueries({ queryKey: ["procedimentos"] });
              }}
            />
          </Dialog>
        )}
      </div>

      {isEditor &&
        GUIDED_POPS.filter((g) => !procs.some((p) => p.codigo === g.codigo)).map((g) => (
          <Card key={g.codigo} className="mb-3 border-amber-300 bg-amber-50">
            <CardContent className="pt-4 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Wand2 className="h-5 w-5 text-amber-700 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900">
                    Cadastro guiado: {g.codigo}
                  </div>
                  <div className="text-sm text-amber-800">
                    {g.descricao} Anexe o PDF em seguida pelo botão “Detalhes”.
                  </div>
                  <div className="text-xs text-amber-700 mt-1 font-mono">
                    Base legal: {g.baseLegal}
                  </div>
                </div>
              </div>
              <Button
                disabled={creatingGuided === g.codigo}
                onClick={async () => {
                  setCreatingGuided(g.codigo);
                  try {
                    const today = new Date();
                    const proxima = new Date(today);
                    proxima.setMonth(proxima.getMonth() + g.periodicidade);
                    const payload = {
                      codigo: g.codigo,
                      titulo: g.titulo,
                      objetivo: g.objetivo,
                      escopo: g.escopo,
                      area: "SST",
                      criticidade: g.criticidade,
                      status: "HOMOLOGADO",
                      versao_atual: "01",
                      periodicidade_revisao_meses: g.periodicidade,
                      proxima_revisao: proxima.toISOString().slice(0, 10),
                      responsavel: "SESMT",
                      observacoes: g.observacoes,
                    };
                    const { data: ins, error } = await (supabase as any)
                      .from("procedimentos")
                      .insert(payload)
                      .select()
                      .single();
                    if (error) throw error;
                    await (supabase as any).from("procedimento_revisoes").insert({
                      procedimento_id: ins.id,
                      versao: "01",
                      status: "HOMOLOGADO",
                      motivo_revisao: `Emissão inicial — auditoria ${g.codigo}`,
                      responsavel: "SESMT",
                      data_homologacao: today.toISOString().slice(0, 10),
                    });
                    toast.success(`${g.codigo} criado e homologado em v01`);
                    qc.invalidateQueries({ queryKey: ["procedimentos"] });
                    setDetail(ins as Procedimento);
                  } catch (e: any) {
                    toast.error(e.message ?? "Erro ao cadastrar POP guiado");
                  } finally {
                    setCreatingGuided(null);
                  }
                }}
                className="bg-amber-700 hover:bg-amber-800 text-white whitespace-nowrap"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {creatingGuided === g.codigo ? "Criando…" : `Cadastrar ${g.codigo}`}
              </Button>
            </CardContent>
          </Card>
        ))}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total" value={stats.total} icon={<FileCheck2 className="h-4 w-4" />} />
        <StatCard
          label="Homologados"
          value={stats.homologados}
          icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          label="Em Rascunho"
          value={stats.rascunhos}
          icon={<Clock className="h-4 w-4 text-amber-600" />}
        />
        <StatCard
          label="Aderência média"
          value={`${stats.aderencia}%`}
          icon={<Users className="h-4 w-4 text-blue-600" />}
        />
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-slate-400" />
                <Input
                  className="pl-8"
                  placeholder="Código ou título…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs">Escopo</Label>
              <Select value={filterEscopo} onValueChange={setFilterEscopo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {ESCOPOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-slate-600 ml-auto">{filtered.length} POP(s)</div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center text-sm text-slate-500 py-8">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <FileCheck2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            Nenhum procedimento cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const app = applicableCount(p);
            const cnt = cientesCount(p);
            const pct = app ? Math.round((cnt / app) * 100) : 0;
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className={escopoBadge(p.escopo)}>
                      {p.escopo}
                    </Badge>
                    <Badge variant="outline" className={statusBadge(p.status)}>
                      {p.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2 leading-tight">
                    <span className="font-mono text-xs text-slate-500">{p.codigo}</span>
                    <div className="text-slate-900 mt-0.5">{p.titulo}</div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className={criticidadeBadge(p.criticidade)}>
                      {p.criticidade}
                    </Badge>
                    <Badge variant="outline" className="bg-slate-50">
                      {p.area}
                    </Badge>
                    <Badge variant="outline" className="bg-white">
                      v{p.versao_atual}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Users className="h-3 w-3" /> Ciência: {cnt}/{app}
                      </span>
                      <span className="font-bold text-slate-900">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetail(p)}
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" /> Detalhes
                    </Button>
                    {isEditor && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(p)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Excluir ${p.codigo}? Todas as revisões e ciências serão removidas.`))
                            del.mutate(p);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <ProcedimentoFormDialog
            key={editing.id}
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["procedimentos"] });
            }}
          />
        </Dialog>
      )}

      {detail && (
        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DetailDialog
            proc={detail}
            employees={employees}
            companyType={companyType}
            companies={companies}
            isEditor={isEditor}
            onClose={() => setDetail(null)}
          />
        </Dialog>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-black text-slate-900">{value}</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-100">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ========================================================================
 * FORM (criar / editar procedimento)
 * ====================================================================== */
function ProcedimentoFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Procedimento;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = useState(initial?.codigo ?? "");
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [objetivo, setObjetivo] = useState(initial?.objetivo ?? "");
  const [escopo, setEscopo] = useState<string>(initial?.escopo ?? "AMBOS");
  const [area, setArea] = useState<string>(initial?.area ?? "SST");
  const [criticidade, setCriticidade] = useState<string>(initial?.criticidade ?? "MEDIA");
  const [status, setStatus] = useState<string>(initial?.status ?? "RASCUNHO");
  const [versao, setVersao] = useState(initial?.versao_atual ?? "01");
  const [periodicidade, setPeriodicidade] = useState<number>(
    initial?.periodicidade_revisao_meses ?? 24,
  );
  const [responsavel, setResponsavel] = useState(initial?.responsavel ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!codigo.trim() || !titulo.trim()) {
      toast.error("Código e título são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        codigo: codigo.trim(),
        titulo: titulo.trim(),
        objetivo: objetivo || null,
        escopo,
        area,
        criticidade,
        status,
        versao_atual: versao || "01",
        periodicidade_revisao_meses: periodicidade,
        responsavel: responsavel || null,
        observacoes: observacoes || null,
      };
      if (initial) {
        const { error } = await (supabase as any)
          .from("procedimentos")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
        toast.success("Procedimento atualizado");
      } else {
        const { data: ins, error } = await (supabase as any)
          .from("procedimentos")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        // cria revisão inicial
        await (supabase as any).from("procedimento_revisoes").insert({
          procedimento_id: ins.id,
          versao: payload.versao_atual,
          status: payload.status === "HOMOLOGADO" ? "HOMOLOGADO" : "RASCUNHO",
          motivo_revisao: "Emissão inicial",
          responsavel: payload.responsavel,
        });
        toast.success("Procedimento criado");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Editar" : "Novo"} Procedimento</DialogTitle>
        <DialogDescription>
          Cadastre um POP com escopo (CLT/Terceiro/Ambos), área e periodicidade de revisão.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Código *</Label>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="POP-SST-001" />
        </div>
        <div>
          <Label>Versão atual</Label>
          <Input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="01" />
        </div>
        <div className="col-span-2">
          <Label>Título *</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Objetivo</Label>
          <Textarea
            rows={2}
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="Para que serve esse POP?"
          />
        </div>
        <div>
          <Label>Escopo</Label>
          <Select value={escopo} onValueChange={setEscopo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESCOPOS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Área</Label>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AREAS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Criticidade</Label>
          <Select value={criticidade} onValueChange={setCriticidade}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRITICIDADES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Periodicidade de revisão (meses)</Label>
          <Input
            type="number"
            value={periodicidade}
            onChange={(e) => setPeriodicidade(Number(e.target.value) || 24)}
          />
        </div>
        <div>
          <Label>Responsável</Label>
          <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Observações</Label>
          <Textarea
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={saving} className="bg-red-700 hover:bg-red-800">
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ========================================================================
 * DETALHE (Revisões / PDF / Ciência)
 * ====================================================================== */
function DetailDialog({
  proc,
  employees,
  companyType,
  companies,
  isEditor,
  onClose,
}: {
  proc: Procedimento;
  employees: EmployeeMini[];
  companyType: Map<string, string>;
  companies: CompanyMini[];
  isEditor: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const companyName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) m.set(c.id, c.name);
    return m;
  }, [companies]);

  const { data: revisoes = [] } = useQuery({
    queryKey: ["proc-revisoes", proc.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("procedimento_revisoes")
        .select("*")
        .eq("procedimento_id", proc.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Revisao[];
    },
  });

  const { data: cientes = [] } = useQuery({
    queryKey: ["proc-cientes", proc.id, proc.versao_atual],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("procedimento_cientes")
        .select("*")
        .eq("procedimento_id", proc.id)
        .eq("versao", proc.versao_atual);
      if (error) throw error;
      return (data ?? []) as Ciente[];
    },
  });

  const applicable = employees.filter((e) => {
    if (proc.escopo === "AMBOS") return true;
    const t = e.company_id ? companyType.get(e.company_id) : null;
    return t === proc.escopo;
  });
  const cientesSet = new Set(cientes.map((c) => c.employee_id));

  const [novaVersao, setNovaVersao] = useState("");
  const [motivoRev, setMotivoRev] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");

  async function uploadNovaRevisao() {
    if (!novaVersao.trim()) return toast.error("Informe a nova versão");
    try {
      let pdfPath: string | null = null;
      if (pdfFile) {
        const path = `${proc.id}/v${novaVersao}-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("procedimentos-pdfs")
          .upload(path, pdfFile, { upsert: false });
        if (upErr) throw upErr;
        pdfPath = path;
      }
      // marca revisões anteriores como SUPERADA
      await (supabase as any)
        .from("procedimento_revisoes")
        .update({ status: "SUPERADA" })
        .eq("procedimento_id", proc.id)
        .eq("status", "HOMOLOGADO");
      // insere nova
      const { error: insErr } = await (supabase as any).from("procedimento_revisoes").insert({
        procedimento_id: proc.id,
        versao: novaVersao,
        pdf_path: pdfPath,
        motivo_revisao: motivoRev || null,
        responsavel: proc.responsavel,
        status: "HOMOLOGADO",
        data_homologacao: new Date().toISOString().slice(0, 10),
      });
      if (insErr) throw insErr;
      // atualiza procedimento
      await (supabase as any)
        .from("procedimentos")
        .update({ versao_atual: novaVersao, status: "HOMOLOGADO" })
        .eq("id", proc.id);
      toast.success("Nova revisão homologada. Ciências da versão anterior foram preservadas no histórico.");
      setNovaVersao("");
      setMotivoRev("");
      setPdfFile(null);
      qc.invalidateQueries({ queryKey: ["proc-revisoes", proc.id] });
      qc.invalidateQueries({ queryKey: ["proc-cientes", proc.id, proc.versao_atual] });
      qc.invalidateQueries({ queryKey: ["procedimentos"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar revisão");
    }
  }

  async function uploadPdfAtual(file: File) {
    try {
      const path = `${proc.id}/v${proc.versao_atual}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("procedimentos-pdfs")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const cur = revisoes.find((r) => r.versao === proc.versao_atual);
      if (cur) {
        await (supabase as any)
          .from("procedimento_revisoes")
          .update({ pdf_path: path })
          .eq("id", cur.id);
      }
      toast.success("PDF anexado à versão atual");
      qc.invalidateQueries({ queryKey: ["proc-revisoes", proc.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    }
  }

  async function homologar() {
    try {
      await (supabase as any)
        .from("procedimentos")
        .update({ status: "HOMOLOGADO" })
        .eq("id", proc.id);
      const cur = revisoes.find((r) => r.versao === proc.versao_atual);
      if (cur) {
        await (supabase as any)
          .from("procedimento_revisoes")
          .update({
            status: "HOMOLOGADO",
            data_homologacao: new Date().toISOString().slice(0, 10),
          })
          .eq("id", cur.id);
      }
      toast.success("Procedimento homologado");
      qc.invalidateQueries({ queryKey: ["procedimentos"] });
      qc.invalidateQueries({ queryKey: ["proc-revisoes", proc.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  async function registrarCiencia(employeeId: string) {
    try {
      const { error } = await (supabase as any).from("procedimento_cientes").insert({
        procedimento_id: proc.id,
        versao: proc.versao_atual,
        employee_id: employeeId,
        origem: "MANUAL",
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["proc-cientes", proc.id, proc.versao_atual] });
      qc.invalidateQueries({ queryKey: ["procedimento-cientes-all"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  async function removerCiencia(employeeId: string) {
    try {
      const { error } = await (supabase as any)
        .from("procedimento_cientes")
        .delete()
        .eq("procedimento_id", proc.id)
        .eq("versao", proc.versao_atual)
        .eq("employee_id", employeeId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["proc-cientes", proc.id, proc.versao_atual] });
      qc.invalidateQueries({ queryKey: ["procedimento-cientes-all"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  const aplicaveisFiltrados = applicable.filter((e) =>
    !search ? true : e.nome.toLowerCase().includes(search.toLowerCase()),
  );

  const currentRev = revisoes.find((r) => r.versao === proc.versao_atual);

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="font-mono text-sm text-slate-500">{proc.codigo}</span>
          <span>{proc.titulo}</span>
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline" className={escopoBadge(proc.escopo)}>
            {proc.escopo}
          </Badge>
          <Badge variant="outline" className={statusBadge(proc.status)}>
            {proc.status}
          </Badge>
          <Badge variant="outline">v{proc.versao_atual}</Badge>
          <Badge variant="outline" className={criticidadeBadge(proc.criticidade)}>
            {proc.criticidade}
          </Badge>
          <Badge variant="outline" className="bg-slate-50">{proc.area}</Badge>
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="ciencia">
        <TabsList>
          <TabsTrigger value="ciencia">
            <Users className="h-3 w-3 mr-1" /> Ciência ({cientes.length}/{applicable.length})
          </TabsTrigger>
          <TabsTrigger value="revisoes">
            <History className="h-3 w-3 mr-1" /> Revisões ({revisoes.length})
          </TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        <TabsContent value="ciencia" className="space-y-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-slate-500">Aderência (versão atual)</div>
                  <div className="text-2xl font-black">
                    {applicable.length
                      ? Math.round((cientes.length / applicable.length) * 100)
                      : 0}
                    %
                  </div>
                </div>
                {currentRev?.pdf_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openStorageFile("procedimentos-pdfs", currentRev.pdf_path!)}
                  >
                    <Eye className="h-3 w-3 mr-1" /> Ver POP
                  </Button>
                )}
              </div>
              <Progress
                value={applicable.length ? (cientes.length / applicable.length) * 100 : 0}
                className="h-2"
              />
            </CardContent>
          </Card>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-slate-400" />
            <Input
              className="pl-8"
              placeholder="Buscar colaborador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto border rounded-md divide-y">
            {aplicaveisFiltrados.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhum colaborador aplicável.
              </div>
            )}
            {aplicaveisFiltrados.map((e) => {
              const ok = cientesSet.has(e.id);
              return (
                <div key={e.id} className="flex items-center justify-between p-2 hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{e.nome}</div>
                      <div className="text-xs text-slate-500">
                        {e.setor || "—"}
                        {e.company_id && companyType.get(e.company_id) === "TERCEIRIZADO" && (
                          <Badge
                            variant="outline"
                            className="ml-2 bg-purple-50 text-purple-700 border-purple-200 text-[10px] py-0"
                          >
                            TERCEIRO
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {isEditor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (ok ? removerCiencia(e.id) : registrarCiencia(e.id))}
                    >
                      {ok ? "Remover" : "Registrar ciência"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="revisoes" className="space-y-3">
          {isEditor && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Nova Revisão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nova versão</Label>
                    <Input value={novaVersao} onChange={(e) => setNovaVersao(e.target.value)} placeholder="02" />
                  </div>
                  <div>
                    <Label className="text-xs">PDF (opcional)</Label>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Motivo da revisão</Label>
                  <Textarea
                    rows={2}
                    value={motivoRev}
                    onChange={(e) => setMotivoRev(e.target.value)}
                    placeholder="Ex.: Atualização para inclusão de NR-XX"
                  />
                </div>
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Ao homologar a nova versão, todos os colaboradores precisarão registrar ciência novamente.
                </div>
                <Button onClick={uploadNovaRevisao} className="bg-red-700 hover:bg-red-800">
                  <Upload className="h-3 w-3 mr-1" /> Homologar nova revisão
                </Button>
              </CardContent>
            </Card>
          )}
          {isEditor && proc.status !== "HOMOLOGADO" && (
            <Button onClick={homologar} variant="outline">
              <ShieldCheck className="h-3 w-3 mr-1" /> Homologar versão atual ({proc.versao_atual})
            </Button>
          )}
          {isEditor && currentRev && !currentRev.pdf_path && (
            <div>
              <Label className="text-xs">Anexar PDF à versão atual</Label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPdfAtual(f);
                }}
              />
            </div>
          )}
          <div className="border rounded-md divide-y">
            {revisoes.length === 0 && (
              <div className="p-4 text-center text-sm text-slate-500">Sem revisões.</div>
            )}
            {revisoes.map((r) => (
              <div key={r.id} className="p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{r.versao}</Badge>
                    <Badge variant="outline" className={statusBadge(r.status)}>
                      {r.status}
                    </Badge>
                    <span className="text-xs text-slate-500">{r.data_emissao}</span>
                  </div>
                  {r.motivo_revisao && (
                    <div className="text-sm text-slate-700 mt-1">{r.motivo_revisao}</div>
                  )}
                </div>
                {r.pdf_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openStorageFile("procedimentos-pdfs", r.pdf_path!)}
                  >
                    <Eye className="h-3 w-3 mr-1" /> PDF
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="info" className="space-y-2 text-sm">
          <InfoRow label="Objetivo" value={proc.objetivo || "—"} />
          <InfoRow label="Responsável" value={proc.responsavel || "—"} />
          <InfoRow label="Periodicidade de revisão" value={`${proc.periodicidade_revisao_meses} meses`} />
          <InfoRow label="Próxima revisão" value={proc.proxima_revisao || "—"} />
          <InfoRow label="Observações" value={proc.observacoes || "—"} />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button
          variant="outline"
          className="border-red-700 text-red-700 hover:bg-red-50"
          onClick={() =>
            gerarAuditoriaPopPdf({
              proc,
              revisoes,
              applicable,
              cientesAtuais: cientes,
              companyName,
              companyType,
            })
          }
        >
          <FileDown className="h-4 w-4 mr-1" /> Relatório de auditoria (PDF)
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <div className="w-48 text-slate-500">{label}:</div>
      <div className="flex-1 text-slate-900">{value}</div>
    </div>
  );
}