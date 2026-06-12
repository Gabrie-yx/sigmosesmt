import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sugerirEpisIA } from "@/lib/pgr-epi-ai.functions";
import {
  suggestEpisHeuristic, epiKeywordsFaltantes,
  type EstoqueEpiLite, type EpiSugestao,
} from "@/lib/pgr-epi-suggest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert, Plus, Pencil, Trash2, Users, Layers, Grid3x3, ListChecks, AlertTriangle, Save, HardHat,
  Sparkles, Wand2, Loader2,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { GheMembrosDialog } from "@/components/pgr/ghe-membros-dialog";
import { GheFichaDialog } from "@/components/pgr/ghe-ficha-dialog";
import {
  classifyAiha, AIHA_LABEL, AIHA_COLOR, AIHA_CELL, AIHA_PRIORIZACAO,
  PROB_LABELS, SEV_LABELS, CATEGORIA_LABEL, type AihaClass,
} from "@/lib/aiha";

export const Route = createFileRoute("/app/pgr")({
  component: PgrPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

type Ghe = {
  id: string;
  numero: number;
  setor: string;
  descricao_ambiente: string | null;
  qtd_colaboradores: number | null;
  jornada: string | null;
  observacao: string | null;
  ativo: boolean;
};

type InvRow = {
  id: string;
  ghe_id: string;
  categoria: "FISICO" | "QUIMICO" | "BIOLOGICO" | "ERGONOMICO" | "ACIDENTE" | "PSICOSSOCIAL";
  perigo: string;
  agravo: string | null;
  fonte_geradora: string | null;
  controles_existentes: string | null;
  exposicao: string | null;
  intensidade: number | null;
  unidade: string | null;
  limite_tolerancia: number | null;
  tipo_avaliacao: string | null;
  probabilidade: number | null;
  severidade: number | null;
  risco: number | null;
  classificacao: string | null;
  monitoramento: string | null;
  observacao: string | null;
  ativo: boolean;
};

function PgrPage() {
  const [tab, setTab] = useState("ghe");
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="px-6 pt-5 pb-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 via-white to-amber-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-rose-600 to-[#7f1212] text-white shadow">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">PGR — Programa de Gerenciamento de Riscos</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              NR-01 · GHE · Inventário de Riscos (AIHA 5×5) · Plano de Ação 5W2H
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs value={tab} onValueChange={setTab} className="p-6 space-y-4">
          <TabsList className="bg-white border">
            <TabsTrigger value="ghe" className="gap-2"><Layers className="h-4 w-4" />GHEs</TabsTrigger>
            <TabsTrigger value="inv" className="gap-2"><Grid3x3 className="h-4 w-4" />Inventário de Riscos</TabsTrigger>
            <TabsTrigger value="plano" className="gap-2"><ListChecks className="h-4 w-4" />Plano de Ação (5W2H)</TabsTrigger>
          </TabsList>

          <TabsContent value="ghe"><GheTab /></TabsContent>
          <TabsContent value="inv"><InventarioTab /></TabsContent>
          <TabsContent value="plano"><PlanoTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ============================================================
   ABA 1 — GHEs
   ============================================================ */
function GheTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Ghe | null>(null);
  const [membrosFor, setMembrosFor] = useState<Ghe | null>(null);
  const [fichaFor, setFichaFor] = useState<Ghe | null>(null);

  const { data: ghes = [], isLoading } = useQuery<Ghe[]>({
    queryKey: ["pgr_ghe"],
    queryFn: async () => {
      const { data, error } = await sb.from("pgr_ghe").select("*").eq("ativo", true).order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-min-ghe"],
    queryFn: async () => {
      const { data, error } = await sb.from("roles").select("id, name, ghe_id").eq("ativo", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Membros efetivos de TODOS os GHEs (uma única query) — agrupado client-side
  const { data: allMembros = [] } = useQuery({
    queryKey: ["pgr_ghe_membros_all"],
    queryFn: async () => {
      const { data: rows, error } = await sb
        .from("pgr_ghe_membros_efetivos")
        .select("ghe_id, employee_id");
      if (error) throw error;
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.employee_id))).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: emps } = await sb.from("employees").select("id, nome, foto_url").in("id", ids);
      const m = new Map<string, { nome: string; foto_url: string | null }>((emps ?? []).map((e: any) => [e.id, e]));
      return (rows ?? []).map((r: any) => ({
        ghe_id: r.ghe_id,
        employee_id: r.employee_id,
        employees: m.get(r.employee_id) ?? null,
      }));
    },
  });

  const membrosPorGhe = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; foto_url: string | null }[]>();
    for (const m of allMembros as { ghe_id: string; employee_id: string; employees: { nome: string; foto_url: string | null } | null }[]) {
      const arr = map.get(m.ghe_id) ?? [];
      arr.push({ id: m.employee_id, nome: m.employees?.nome ?? "—", foto_url: m.employees?.foto_url ?? null });
      map.set(m.ghe_id, arr);
    }
    return map;
  }, [allMembros]);

  const linkRole = useMutation({
    mutationFn: async ({ role_id, ghe_id }: { role_id: string; ghe_id: string | null }) => {
      const { error } = await sb.from("roles").update({ ghe_id }).eq("id", role_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles-min-ghe"] });
      toast.success("Cargo vinculado ao GHE");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("pgr_ghe").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_ghe"] });
      toast.success("GHE arquivado");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {ghes.length} GHE{ghes.length === 1 ? "" : "s"} cadastrado{ghes.length === 1 ? "" : "s"}
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }} className="bg-rose-700 hover:bg-rose-800 gap-2">
          <Plus className="h-4 w-4" />Novo GHE
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-slate-500">Carregando GHEs…</div>
      ) : ghes.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          <Layers className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold">Nenhum GHE cadastrado</p>
          <p className="text-sm mt-1">Comece criando os Grupos Homogêneos de Exposição (ex: GHE 1 — Supervisores).</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ghes.map((g) => {
            const cargosLigados = roles.filter((r: { ghe_id: string | null }) => r.ghe_id === g.id);
            const membros = membrosPorGhe.get(g.id) ?? [];
            const visiveis = membros.slice(0, 5);
            const extras = Math.max(0, membros.length - visiveis.length);
            return (
              <Card key={g.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-rose-700 text-white">GHE {g.numero}</Badge>
                      <h4 className="font-bold text-slate-900 truncate">{g.setor}</h4>
                    </div>
                    {g.descricao_ambiente && (
                      <p className="text-xs text-slate-600 mt-1">{g.descricao_ambiente}</p>
                    )}
                    <div className="flex gap-3 text-xs text-slate-500 mt-2">
                      <button
                        type="button"
                        onClick={() => setMembrosFor(g)}
                        className="flex items-center gap-1 hover:text-rose-700 hover:underline"
                        title="Ver / gerenciar membros"
                      >
                        <Users className="h-3 w-3" />
                        <strong className="text-slate-700">{membros.length}</strong> {membros.length === 1 ? "pessoa" : "pessoas"}
                      </button>
                      {g.jornada && <span>· {g.jornada}</span>}
                    </div>
                    {membros.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMembrosFor(g)}
                        className="flex items-center mt-2 group"
                        title="Ver membros"
                      >
                        <div className="flex -space-x-2">
                          {visiveis.map((p) => (
                            <div
                              key={p.id}
                              className="h-7 w-7 rounded-full border-2 border-white bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-600"
                              title={p.nome}
                            >
                              {p.foto_url ? <img src={p.foto_url} alt={p.nome} className="h-full w-full object-cover" /> : p.nome.charAt(0)}
                            </div>
                          ))}
                          {extras > 0 && (
                            <div className="h-7 w-7 rounded-full border-2 border-white bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                              +{extras}
                            </div>
                          )}
                        </div>
                      </button>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cargosLigados.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Nenhum cargo vinculado</span>
                      ) : cargosLigados.map((c: { id: string; name: string }) => (
                        <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" title="Ficha do GHE" onClick={() => setFichaFor(g)}>
                      <ClipboardList className="h-3.5 w-3.5 text-rose-700" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Membros" onClick={() => setMembrosFor(g)}>
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEdit(g); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="text-rose-700"
                      onClick={() => {
                        if (confirm(`Arquivar GHE ${g.numero}?`)) remove.mutate(g.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Vincular cargos ao GHE */}
      {ghes.length > 0 && (
        <Card className="p-4">
          <h3 className="font-bold text-slate-900 mb-3 text-sm">Vincular cargos aos GHEs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {roles.map((r: { id: string; name: string; ghe_id: string | null }) => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{r.name}</span>
                <Select
                  value={r.ghe_id ?? "none"}
                  onValueChange={(v) => linkRole.mutate({ role_id: r.id, ghe_id: v === "none" ? null : v })}
                >
                  <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem GHE —</SelectItem>
                    {ghes.map((g) => (
                      <SelectItem key={g.id} value={g.id}>GHE {g.numero} — {g.setor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>
      )}

      <GheDialog open={open} onOpenChange={setOpen} edit={edit} />
      {membrosFor && (
        <GheMembrosDialog
          open={!!membrosFor}
          onOpenChange={(v) => { if (!v) setMembrosFor(null); }}
          gheId={membrosFor.id}
          gheLabel={`GHE ${membrosFor.numero} — ${membrosFor.setor}`}
        />
      )}
      <GheFichaDialog
        open={!!fichaFor}
        onOpenChange={(v) => { if (!v) setFichaFor(null); }}
        ghe={fichaFor}
      />
    </div>
  );
}

function GheDialog({
  open, onOpenChange, edit,
}: { open: boolean; onOpenChange: (v: boolean) => void; edit: Ghe | null }) {
  const qc = useQueryClient();
  const [numero, setNumero] = useState<number | "">("");
  const [setor, setSetor] = useState("");
  const [amb, setAmb] = useState("");
  const [qtd, setQtd] = useState<number | "">("");
  const [jornada, setJornada] = useState("");
  const [obs, setObs] = useState("");

  // Reset on open
  useMemo(() => {
    if (open) {
      setNumero(edit?.numero ?? "");
      setSetor(edit?.setor ?? "");
      setAmb(edit?.descricao_ambiente ?? "");
      setQtd(edit?.qtd_colaboradores ?? "");
      setJornada(edit?.jornada ?? "");
      setObs(edit?.observacao ?? "");
    }
  }, [open, edit]);

  const save = useMutation({
    mutationFn: async () => {
      if (numero === "" || !setor.trim()) throw new Error("Número e setor são obrigatórios");
      const payload = {
        numero: Number(numero),
        setor: setor.trim(),
        descricao_ambiente: amb.trim() || null,
        qtd_colaboradores: qtd === "" ? 0 : Number(qtd),
        jornada: jornada.trim() || null,
        observacao: obs.trim() || null,
      };
      if (edit) {
        const { error } = await sb.from("pgr_ghe").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("pgr_ghe").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_ghe"] });
      toast.success(edit ? "GHE atualizado" : "GHE criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{edit ? `Editar GHE ${edit.numero}` : "Novo GHE"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Número *</Label>
              <Input type="number" value={numero} onChange={(e) => setNumero(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label>Qtd. colaboradores</Label>
              <Input type="number" value={qtd} onChange={(e) => setQtd(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Setor / Função *</Label>
            <Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: Supervisão / Caldeiraria / Solda" />
          </div>
          <div>
            <Label>Descrição do ambiente</Label>
            <Textarea rows={2} value={amb} onChange={(e) => setAmb(e.target.value)} placeholder="Ex: Galpão de produção, área aberta com cobertura..." />
          </div>
          <div>
            <Label>Jornada</Label>
            <Input value={jornada} onChange={(e) => setJornada(e.target.value)} placeholder="Ex: 44h/semana — 07h às 17h" />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-rose-700 hover:bg-rose-800 gap-2">
            <Save className="h-4 w-4" />{save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   DIALOG — Vincular EPIs a um Risco do Inventário
   ============================================================ */
function RiscoEpisDialog({ risco, onClose }: { risco: InvRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [epiSel, setEpiSel] = useState<string>("");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [obs, setObs] = useState("");
  const [iaSugestoes, setIaSugestoes] = useState<Array<{ epi_id: string; nome_material: string; obrigatorio: boolean; motivo: string }>>([]);
  const sugerirIA = useServerFn(sugerirEpisIA);

  const { data: vinc = [] } = useQuery<any[]>({
    queryKey: ["pgr_risco_epi", risco.id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("pgr_risco_epi")
        .select("id, obrigatorio, observacao, epi_id, estoque_epi:epi_id(id, nome_material, codigo_material, ca)")
        .eq("inventario_id", risco.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: epis = [] } = useQuery<EstoqueEpiLite[]>({
    queryKey: ["estoque_epi_select"],
    queryFn: async () => {
      const { data, error } = await sb.from("estoque_epi").select("id, nome_material, codigo_material, ca, quantidade_atual").order("nome_material");
      if (error) throw error;
      return data ?? [];
    },
  });

  const epiIdsVinc = new Set(vinc.map((v) => v.epi_id));
  const episDisponiveis = epis.filter((e) => !epiIdsVinc.has(e.id));

  // Heurística local — roda na hora
  const sugestoesLocais: EpiSugestao[] = useMemo(
    () => suggestEpisHeuristic(
      { categoria: risco.categoria, perigo: risco.perigo, agravo: risco.agravo },
      episDisponiveis,
    ),
    [risco, episDisponiveis],
  );
  const faltantes = useMemo(
    () => epiKeywordsFaltantes(
      { categoria: risco.categoria, perigo: risco.perigo, agravo: risco.agravo },
      epis,
    ),
    [risco, epis],
  );

  const add = useMutation({
    mutationFn: async () => {
      if (!epiSel) throw new Error("Selecione um EPI");
      const { error } = await sb.from("pgr_risco_epi").insert({
        inventario_id: risco.id,
        epi_id: epiSel,
        obrigatorio,
        observacao: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_risco_epi", risco.id] });
      setEpiSel(""); setObs(""); setObrigatorio(true);
      toast.success("EPI vinculado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addOne = useMutation({
    mutationFn: async (p: { epi_id: string; obrigatorio: boolean; observacao: string | null }) => {
      const { error } = await sb.from("pgr_risco_epi").insert({
        inventario_id: risco.id,
        epi_id: p.epi_id,
        obrigatorio: p.obrigatorio,
        observacao: p.observacao,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_risco_epi", risco.id] });
      qc.invalidateQueries({ queryKey: ["pgr_risco_epi_counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const aplicarTodasLocais = useMutation({
    mutationFn: async () => {
      if (sugestoesLocais.length === 0) return;
      const rows = sugestoesLocais.map((s) => ({
        inventario_id: risco.id,
        epi_id: s.epi.id,
        obrigatorio: s.obrigatorio,
        observacao: s.motivo,
      }));
      const { error } = await sb.from("pgr_risco_epi").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_risco_epi", risco.id] });
      qc.invalidateQueries({ queryKey: ["pgr_risco_epi_counts"] });
      toast.success(`${sugestoesLocais.length} EPI(s) vinculado(s) automaticamente`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const callIA = useMutation({
    mutationFn: async () => {
      const r = await sugerirIA({ data: { riscoId: risco.id } });
      if (r.error) throw new Error(r.error);
      return r.sugestoes;
    },
    onSuccess: (s) => {
      setIaSugestoes(s);
      if (s.length === 0) toast.info("IA não encontrou EPIs adequados no estoque");
      else toast.success(`IA sugeriu ${s.length} EPI(s)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("pgr_risco_epi").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_risco_epi", risco.id] });
      toast.success("EPI desvinculado");
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, obrigatorio }: { id: string; obrigatorio: boolean }) => {
      const { error } = await sb.from("pgr_risco_epi").update({ obrigatorio }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pgr_risco_epi", risco.id] }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-amber-700" />
            EPIs do risco
          </DialogTitle>
          <p className="text-xs text-slate-500">
            <b>{risco.perigo}</b>
            {risco.agravo && <> · agravo: {risco.agravo}</>}
            {" · "}<Badge variant="outline" className="text-[10px]">{risco.categoria}</Badge>
          </p>
        </DialogHeader>

        {/* Painel de sugestões automáticas */}
        {(sugestoesLocais.length > 0 || faltantes.length > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <Sparkles className="h-4 w-4" />
                Sugestões automáticas ({sugestoesLocais.length})
              </div>
              <div className="flex gap-2">
                {sugestoesLocais.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-400 text-amber-900 hover:bg-amber-100"
                    onClick={() => aplicarTodasLocais.mutate()}
                    disabled={aplicarTodasLocais.isPending}
                  >
                    {aplicarTodasLocais.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Aplicar todas
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-7 text-xs bg-violet-700 hover:bg-violet-800 gap-1"
                  onClick={() => callIA.mutate()}
                  disabled={callIA.isPending}
                >
                  {callIA.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  Sugerir com IA
                </Button>
              </div>
            </div>
            {sugestoesLocais.length === 0 && (
              <p className="text-xs text-amber-900">
                Nada com matching automático. Tente o botão <b>Sugerir com IA</b> ou adicione manualmente abaixo.
              </p>
            )}
            {sugestoesLocais.map((s) => (
              <div key={s.epi.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{s.epi.nome_material}</div>
                  <div className="text-[11px] text-slate-500">
                    {s.epi.ca && <>CA {s.epi.ca} · </>}
                    Estoque: {s.epi.quantidade_atual ?? 0} · {s.motivo}
                  </div>
                </div>
                <Badge className={s.obrigatorio ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-slate-100 text-slate-700"} variant="outline">
                  {s.obrigatorio ? "Obrigatório" : "Recomendado"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => addOne.mutate({ epi_id: s.epi.id, obrigatorio: s.obrigatorio, observacao: s.motivo })}
                  disabled={addOne.isPending}
                >
                  <Plus className="h-3 w-3" /> Vincular
                </Button>
              </div>
            ))}
            {faltantes.length > 0 && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <b>EPIs esperados que não existem no estoque:</b> {faltantes.join(", ")}.
                  Cadastre em Estoque → EPI para conseguir vincular.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sugestões da IA */}
        {iaSugestoes.length > 0 && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-violet-900">
              <Wand2 className="h-4 w-4" /> Sugestão da IA
            </div>
            {iaSugestoes.map((s) => (
              <div key={s.epi_id} className="flex items-center gap-2 bg-white border border-violet-200 rounded p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{s.nome_material}</div>
                  <div className="text-[11px] text-slate-500 italic">{s.motivo}</div>
                </div>
                <Badge className={s.obrigatorio ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-slate-100 text-slate-700"} variant="outline">
                  {s.obrigatorio ? "Obrigatório" : "Recomendado"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    addOne.mutate({ epi_id: s.epi_id, obrigatorio: s.obrigatorio, observacao: s.motivo });
                    setIaSugestoes((prev) => prev.filter((x) => x.epi_id !== s.epi_id));
                  }}
                  disabled={addOne.isPending}
                >
                  <Plus className="h-3 w-3" /> Vincular
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Lista de EPIs já vinculados */}
        <div className="space-y-2">
          {vinc.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum EPI vinculado ainda.</p>
          )}
          {vinc.map((v) => (
            <div key={v.id} className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{v.estoque_epi?.nome_material}</div>
                <div className="text-xs text-slate-500">
                  Cód {v.estoque_epi?.codigo_material}
                  {v.estoque_epi?.ca && <> · CA {v.estoque_epi.ca}</>}
                </div>
                {v.observacao && <div className="text-xs text-slate-600 italic mt-0.5">{v.observacao}</div>}
              </div>
              <Button
                size="sm"
                variant={v.obrigatorio ? "default" : "outline"}
                className={v.obrigatorio ? "bg-rose-700 hover:bg-rose-800" : ""}
                onClick={() => toggle.mutate({ id: v.id, obrigatorio: !v.obrigatorio })}
              >
                {v.obrigatorio ? "Obrigatório" : "Recomendado"}
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => remove.mutate(v.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Form de adicionar */}
        <div className="border-t pt-3 space-y-2">
          <Label className="text-xs font-semibold text-slate-600">Adicionar EPI</Label>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <Select value={epiSel} onValueChange={setEpiSel}>
              <SelectTrigger><SelectValue placeholder="Selecione o EPI do estoque" /></SelectTrigger>
              <SelectContent>
                {episDisponiveis.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-500">Todos os EPIs do estoque já estão vinculados.</div>}
                {episDisponiveis.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_material} {e.ca && `(CA ${e.ca})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={obrigatorio ? "default" : "outline"}
              className={obrigatorio ? "bg-rose-700 hover:bg-rose-800" : ""}
              onClick={() => setObrigatorio(!obrigatorio)}
            >
              {obrigatorio ? "Obrigatório" : "Recomendado"}
            </Button>
          </div>
          <Input
            placeholder="Observação (opcional)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => add.mutate()} disabled={!epiSel || add.isPending} className="bg-rose-700 hover:bg-rose-800 gap-2">
            <Plus className="h-4 w-4" />Vincular EPI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ABA 2 — Inventário de Riscos (AIHA 5×5)
   ============================================================ */
function InventarioTab() {
  const qc = useQueryClient();
  const [gheSel, setGheSel] = useState<string>("all");
  const [catTab, setCatTab] = useState<"all" | InvRow["categoria"]>("all");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<InvRow | null>(null);
  const [episFor, setEpisFor] = useState<InvRow | null>(null);

  const { data: ghes = [] } = useQuery<Ghe[]>({
    queryKey: ["pgr_ghe"],
    queryFn: async () => {
      const { data, error } = await sb.from("pgr_ghe").select("*").eq("ativo", true).order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inv = [], isLoading } = useQuery<InvRow[]>({
    queryKey: ["pgr_inventario_riscos", gheSel],
    queryFn: async () => {
      let q = sb.from("pgr_inventario_riscos").select("*").eq("ativo", true);
      if (gheSel !== "all") q = q.eq("ghe_id", gheSel);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Conta EPIs vinculados por risco (para badge "Sem EPI")
  const { data: epiCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["pgr_risco_epi_counts", gheSel, inv.length],
    enabled: inv.length > 0,
    queryFn: async () => {
      const ids = inv.map((r) => r.id);
      if (ids.length === 0) return {};
      const { data, error } = await sb
        .from("pgr_risco_epi")
        .select("inventario_id")
        .in("inventario_id", ids);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((row: { inventario_id: string }) => {
        map[row.inventario_id] = (map[row.inventario_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("pgr_inventario_riscos").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_inventario_riscos"] });
      toast.success("Risco removido");
    },
  });

  const counts = useMemo(() => {
    const c: Record<AihaClass, number> = {
      TRIVIAL: 0, BAIXO: 0, MODERADO: 0, ALTO: 0, MUITO_ALTO: 0, NAO_CLASSIFICADO: 0,
    };
    inv.forEach((r) => { c[classifyAiha(r.probabilidade, r.severidade)]++; });
    return c;
  }, [inv]);

  const catCounts = useMemo(() => {
    const c: Record<InvRow["categoria"], number> = {
      FISICO: 0, QUIMICO: 0, BIOLOGICO: 0, ERGONOMICO: 0, ACIDENTE: 0, PSICOSSOCIAL: 0,
    };
    inv.forEach((r) => { c[r.categoria] = (c[r.categoria] ?? 0) + 1; });
    return c;
  }, [inv]);

  const invFiltered = useMemo(
    () => (catTab === "all" ? inv : inv.filter((r) => r.categoria === catTab)),
    [inv, catTab],
  );

  const CAT_STYLE: Record<InvRow["categoria"], { active: string; badge: string }> = {
    FISICO:       { active: "data-[state=active]:bg-orange-600  data-[state=active]:border-orange-700  data-[state=active]:shadow-orange-500/30",  badge: "data-[state=active]:bg-orange-800/40  data-[state=active]:text-white" },
    QUIMICO:      { active: "data-[state=active]:bg-amber-500   data-[state=active]:border-amber-600   data-[state=active]:shadow-amber-500/30",   badge: "data-[state=active]:bg-amber-800/40   data-[state=active]:text-white" },
    BIOLOGICO:    { active: "data-[state=active]:bg-emerald-600 data-[state=active]:border-emerald-700 data-[state=active]:shadow-emerald-500/30", badge: "data-[state=active]:bg-emerald-900/40 data-[state=active]:text-white" },
    ERGONOMICO:   { active: "data-[state=active]:bg-sky-600     data-[state=active]:border-sky-700     data-[state=active]:shadow-sky-500/30",     badge: "data-[state=active]:bg-sky-900/40     data-[state=active]:text-white" },
    ACIDENTE:     { active: "data-[state=active]:bg-rose-600    data-[state=active]:border-rose-700    data-[state=active]:shadow-rose-500/30",    badge: "data-[state=active]:bg-rose-900/40    data-[state=active]:text-white" },
    PSICOSSOCIAL: { active: "data-[state=active]:bg-fuchsia-600 data-[state=active]:border-fuchsia-700 data-[state=active]:shadow-fuchsia-500/30", badge: "data-[state=active]:bg-fuchsia-900/40 data-[state=active]:text-white" },
  };
  const CAT_DOT: Record<InvRow["categoria"], string> = {
    FISICO: "bg-orange-500", QUIMICO: "bg-amber-500", BIOLOGICO: "bg-emerald-500",
    ERGONOMICO: "bg-sky-500", ACIDENTE: "bg-rose-500", PSICOSSOCIAL: "bg-fuchsia-500",
  };
  const CAT_ORDER: InvRow["categoria"][] = ["FISICO","QUIMICO","BIOLOGICO","ERGONOMICO","ACIDENTE","PSICOSSOCIAL"];

  return (
    <div className="space-y-4">
      {/* Topo: filtro + ação */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Select value={gheSel} onValueChange={setGheSel}>
          <SelectTrigger className="w-72 bg-white"><SelectValue placeholder="Todos os GHEs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os GHEs</SelectItem>
            {ghes.map((g) => (
              <SelectItem key={g.id} value={g.id}>GHE {g.numero} — {g.setor}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          onClick={() => { setEdit(null); setOpen(true); }}
          className="bg-rose-700 hover:bg-rose-800 gap-2"
          disabled={ghes.length === 0}
        >
          <Plus className="h-4 w-4" />Novo risco
        </Button>
      </div>

      {/* KPIs por classe */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(["TRIVIAL","BAIXO","MODERADO","ALTO","MUITO_ALTO"] as AihaClass[]).map((c) => (
          <Card key={c} className={`p-3 border ${AIHA_COLOR[c]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{AIHA_LABEL[c]}</div>
            <div className="text-2xl font-black">{counts[c]}</div>
            <div className="text-[10px] opacity-70">{AIHA_PRIORIZACAO[c]}</div>
          </Card>
        ))}
      </div>

      {/* Matriz visual 5×5 */}
      <MatrizVisual inv={inv} />

      {/* Abas por categoria */}
      <Tabs value={catTab} onValueChange={(v) => setCatTab(v as typeof catTab)}>
        <TabsList className="bg-slate-100/70 border border-slate-200 h-auto flex-wrap gap-1.5 p-1.5 rounded-xl w-full justify-start">
          <TabsTrigger
            value="all"
            className="gap-2 h-9 px-3.5 rounded-lg border border-transparent text-slate-600 font-semibold transition-all
              hover:bg-white hover:text-slate-900
              data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-slate-900
              data-[state=active]:shadow-md data-[state=active]:shadow-slate-900/20 data-[state=active]:scale-[1.02]"
          >
            Todos
            <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-200 text-slate-700
              data-[state=active]:bg-white/20 data-[state=active]:text-white">{inv.length}</span>
          </TabsTrigger>
          {CAT_ORDER.map((c) => (
            <TabsTrigger
              key={c}
              value={c}
              className={`gap-2 h-9 px-3.5 rounded-lg border border-transparent text-slate-600 font-semibold transition-all
                hover:bg-white hover:text-slate-900
                data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-[1.02]
                ${CAT_STYLE[c].active}`}
            >
              <span className={`h-2 w-2 rounded-full ${CAT_DOT[c]} data-[state=active]:bg-white shadow-sm`} />
              {CATEGORIA_LABEL[c]}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-200 text-slate-700 ${CAT_STYLE[c].badge}`}>
                {catCounts[c]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-500">Carregando…</div>
      ) : ghes.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-400" />
          <p className="font-semibold">Crie GHEs primeiro</p>
          <p className="text-sm">Cada risco precisa estar vinculado a um GHE.</p>
        </Card>
      ) : invFiltered.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          <Grid3x3 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold">
            {catTab === "all" ? "Nenhum risco no inventário" : `Nenhum risco da categoria ${CATEGORIA_LABEL[catTab]}`}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {invFiltered.map((r) => {
            const cls = classifyAiha(r.probabilidade, r.severidade);
            const ghe = ghes.find((g) => g.id === r.ghe_id);
            return (
              <Card key={r.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-14 h-14 rounded-lg ${AIHA_CELL[cls]} flex flex-col items-center justify-center shrink-0`}>
                    <div className="text-lg font-black">{r.risco ?? "—"}</div>
                    <div className="text-[9px] uppercase opacity-90">{AIHA_LABEL[cls]}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900">{r.perigo}</h4>
                      <Badge variant="outline" className="text-xs">{CATEGORIA_LABEL[r.categoria]}</Badge>
                      {ghe && <Badge variant="outline" className="text-xs">GHE {ghe.numero} · {ghe.setor}</Badge>}
                      {(epiCounts[r.id] ?? 0) === 0 ? (
                        <Badge className="text-xs bg-rose-100 text-rose-800 border-rose-200" variant="outline">
                          <AlertTriangle className="h-3 w-3 mr-0.5" /> Sem EPI
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">
                          <HardHat className="h-3 w-3 mr-0.5" /> {epiCounts[r.id]} EPI(s)
                        </Badge>
                      )}
                    </div>
                    {r.agravo && <p className="text-xs text-slate-600"><b>Agravo:</b> {r.agravo}</p>}
                    {r.fonte_geradora && <p className="text-xs text-slate-600"><b>Fonte:</b> {r.fonte_geradora}</p>}
                    {r.controles_existentes && <p className="text-xs text-slate-600"><b>Controles:</b> {r.controles_existentes}</p>}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-0.5 text-xs text-slate-600 mt-1">
                      {r.intensidade != null && <Field label="Intensidade" value={`${r.intensidade} ${r.unidade ?? ""}`} highlight={r.limite_tolerancia != null && r.intensidade > r.limite_tolerancia} />}
                      {r.limite_tolerancia != null && <Field label="LT" value={`${r.limite_tolerancia} ${r.unidade ?? ""}`} />}
                      {r.exposicao && <Field label="Exposição" value={r.exposicao} />}
                      {r.tipo_avaliacao && <Field label="Tipo aval." value={r.tipo_avaliacao} />}
                      <Field label="P × S" value={`${r.probabilidade ?? "?"} × ${r.severidade ?? "?"}`} />
                      {r.monitoramento && <Field label="Monit." value={r.monitoramento} />}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-amber-700" title="EPIs do risco" onClick={() => setEpisFor(r)}>
                      <HardHat className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => { if (confirm("Remover risco?")) remove.mutate(r.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <InvDialog open={open} onOpenChange={setOpen} edit={edit} ghes={ghes} gheDefault={gheSel !== "all" ? gheSel : undefined} />
      {episFor && <RiscoEpisDialog risco={episFor} onClose={() => setEpisFor(null)} />}
    </div>
  );
}

function MatrizVisual({ inv }: { inv: InvRow[] }) {
  // bucket [sev][prob] => count
  const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  inv.forEach((r) => {
    if (r.severidade && r.probabilidade) {
      grid[r.severidade - 1][r.probabilidade - 1]++;
    }
  });
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold mb-3 text-slate-900">Matriz AIHA 5×5 — Severidade × Probabilidade</h3>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1.5 text-right text-slate-500 font-normal">Sev ↓ / Prob →</th>
              {PROB_LABELS.map((p) => (
                <th key={p.v} className="p-1.5 text-center font-semibold text-slate-700 min-w-20">{p.v}<div className="text-[9px] font-normal text-slate-400">{p.label}</div></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5,4,3,2,1].map((sev) => (
              <tr key={sev}>
                <td className="p-1.5 text-right font-semibold text-slate-700">{sev}<div className="text-[9px] font-normal text-slate-400">{SEV_LABELS[sev-1].label}</div></td>
                {[1,2,3,4,5].map((prob) => {
                  const cls = classifyAiha(prob, sev);
                  const n = grid[sev-1][prob-1];
                  return (
                    <td key={prob} className={`p-2 text-center border ${AIHA_CELL[cls]} font-bold w-16 h-12`}>
                      <div className="text-lg leading-none">{prob * sev}</div>
                      {n > 0 && <div className="text-[10px] mt-0.5 bg-black/30 rounded px-1 inline-block">{n}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="text-slate-400">{label}: </span>
      <span className={highlight ? "font-bold text-rose-700" : "font-semibold text-slate-700"}>{value}</span>
    </div>
  );
}

function InvDialog({
  open, onOpenChange, edit, ghes, gheDefault,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  edit: InvRow | null; ghes: Ghe[]; gheDefault?: string;
}) {
  const qc = useQueryClient();
  const [ghe, setGhe] = useState<string>("");
  const [cat, setCat] = useState<InvRow["categoria"]>("FISICO");
  const [perigo, setPerigo] = useState("");
  const [agravo, setAgravo] = useState("");
  const [fonte, setFonte] = useState("");
  const [controles, setControles] = useState("");
  const [exp, setExp] = useState("");
  const [intens, setIntens] = useState<number | "">("");
  const [unid, setUnid] = useState("");
  const [lt, setLt] = useState<number | "">("");
  const [tipoAv, setTipoAv] = useState("");
  const [prob, setProb] = useState<number | "">("");
  const [sev, setSev] = useState<number | "">("");
  const [monit, setMonit] = useState("");

  useMemo(() => {
    if (open) {
      setGhe(edit?.ghe_id ?? gheDefault ?? "");
      setCat(edit?.categoria ?? "FISICO");
      setPerigo(edit?.perigo ?? "");
      setAgravo(edit?.agravo ?? "");
      setFonte(edit?.fonte_geradora ?? "");
      setControles(edit?.controles_existentes ?? "");
      setExp(edit?.exposicao ?? "");
      setIntens(edit?.intensidade ?? "");
      setUnid(edit?.unidade ?? "");
      setLt(edit?.limite_tolerancia ?? "");
      setTipoAv(edit?.tipo_avaliacao ?? "");
      setProb(edit?.probabilidade ?? "");
      setSev(edit?.severidade ?? "");
      setMonit(edit?.monitoramento ?? "");
    }
  }, [open, edit, gheDefault]);

  const classif = classifyAiha(typeof prob === "number" ? prob : null, typeof sev === "number" ? sev : null);

  const save = useMutation({
    mutationFn: async () => {
      if (!ghe) throw new Error("Selecione um GHE");
      if (!perigo.trim()) throw new Error("Perigo é obrigatório");
      const payload = {
        ghe_id: ghe,
        categoria: cat,
        perigo: perigo.trim(),
        agravo: agravo.trim() || null,
        fonte_geradora: fonte.trim() || null,
        controles_existentes: controles.trim() || null,
        exposicao: exp.trim() || null,
        intensidade: intens === "" ? null : Number(intens),
        unidade: unid.trim() || null,
        limite_tolerancia: lt === "" ? null : Number(lt),
        tipo_avaliacao: tipoAv.trim() || null,
        probabilidade: prob === "" ? null : Number(prob),
        severidade: sev === "" ? null : Number(sev),
        classificacao: AIHA_LABEL[classif],
        monitoramento: monit.trim() || null,
      };
      if (edit) {
        const { error } = await sb.from("pgr_inventario_riscos").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("pgr_inventario_riscos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_inventario_riscos"] });
      toast.success(edit ? "Risco atualizado" : "Risco adicionado ao inventário");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? "Editar risco" : "Novo risco no inventário"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>GHE *</Label>
              <Select value={ghe} onValueChange={setGhe}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ghes.map((g) => (<SelectItem key={g.id} value={g.id}>GHE {g.numero} — {g.setor}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={cat} onValueChange={(v) => setCat(v as InvRow["categoria"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_LABEL).map(([k,v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Perigo *</Label>
            <Input value={perigo} onChange={(e) => setPerigo(e.target.value)} placeholder="Ex: Ruído, Calor, Fumos metálicos, Postura inadequada..." />
          </div>
          <div>
            <Label>Agravo à saúde</Label>
            <Input value={agravo} onChange={(e) => setAgravo(e.target.value)} placeholder="Ex: PAIR, intermação, intoxicação por Mn..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fonte geradora</Label>
              <Input value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Ex: Esmerilhadeira, máquina de solda..." />
            </div>
            <div>
              <Label>Controles existentes</Label>
              <Input value={controles} onChange={(e) => setControles(e.target.value)} placeholder="Ex: EPI, ventilação, treinamento..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Exposição</Label>
              <Input value={exp} onChange={(e) => setExp(e.target.value)} placeholder="Habitual / Eventual / Intermitente" />
            </div>
            <div>
              <Label>Tipo de avaliação</Label>
              <Input value={tipoAv} onChange={(e) => setTipoAv(e.target.value)} placeholder="Qualitativa / Quantitativa" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Intensidade</Label>
              <Input type="number" step="any" value={intens} onChange={(e) => setIntens(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={unid} onChange={(e) => setUnid(e.target.value)} placeholder="dB(A), °C IBUTG, ppm..." />
            </div>
            <div>
              <Label>Limite de tolerância</Label>
              <Input type="number" step="any" value={lt} onChange={(e) => setLt(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>

          {/* Matriz P × S */}
          <Card className="p-3 bg-slate-50">
            <div className="text-xs font-bold text-slate-600 uppercase mb-2">Classificação AIHA 5×5</div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label>Probabilidade (1-5)</Label>
                <Select value={prob === "" ? "" : String(prob)} onValueChange={(v) => setProb(v ? Number(v) : "")}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {PROB_LABELS.map((p) => (<SelectItem key={p.v} value={String(p.v)}>{p.v} — {p.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severidade (1-5)</Label>
                <Select value={sev === "" ? "" : String(sev)} onValueChange={(v) => setSev(v ? Number(v) : "")}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {SEV_LABELS.map((s) => (<SelectItem key={s.v} value={String(s.v)}>{s.v} — {s.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className={`p-3 rounded-lg text-center ${AIHA_CELL[classif]}`}>
                <div className="text-[10px] uppercase opacity-90 font-bold">Risco</div>
                <div className="text-2xl font-black">{typeof prob === "number" && typeof sev === "number" ? prob*sev : "—"}</div>
                <div className="text-[10px] font-semibold">{AIHA_LABEL[classif]}</div>
              </div>
            </div>
          </Card>

          <div>
            <Label>Monitoramento</Label>
            <Input value={monit} onChange={(e) => setMonit(e.target.value)} placeholder="Ex: Audiometria anual, monitoramento ambiental..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-rose-700 hover:bg-rose-800 gap-2">
            <Save className="h-4 w-4" />{save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ABA 3 — Plano de Ação 5W2H
   ============================================================ */
type PlanoRow = {
  id: string;
  inventario_id: string;
  o_que: string;
  por_que: string | null;
  onde: string | null;
  quem: string | null;
  quando: string | null;
  como: string | null;
  quanto: number | null;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
  data_conclusao: string | null;
  observacao: string | null;
};

function PlanoTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<PlanoRow | null>(null);

  const { data: inv = [] } = useQuery<InvRow[]>({
    queryKey: ["pgr_inventario_riscos", "all-for-plano"],
    queryFn: async () => {
      const { data, error } = await sb.from("pgr_inventario_riscos").select("*").eq("ativo", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: planos = [], isLoading } = useQuery<PlanoRow[]>({
    queryKey: ["pgr_plano_acao"],
    queryFn: async () => {
      const { data, error } = await sb.from("pgr_plano_acao").select("*").order("quando", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sugere riscos sem plano (Alto / Muito Alto)
  const sugeridos = useMemo(() => {
    const comPlano = new Set(planos.map((p) => p.inventario_id));
    return inv.filter((r) => {
      const cls = classifyAiha(r.probabilidade, r.severidade);
      return (cls === "ALTO" || cls === "MUITO_ALTO") && !comPlano.has(r.id);
    });
  }, [inv, planos]);

  const updStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PlanoRow["status"] }) => {
      const patch: Partial<PlanoRow> = { status };
      if (status === "CONCLUIDA") patch.data_conclusao = new Date().toISOString().slice(0,10);
      const { error } = await sb.from("pgr_plano_acao").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_plano_acao"] });
      toast.success("Status atualizado");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("pgr_plano_acao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_plano_acao"] });
      toast.success("Ação removida");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">{planos.length} ação{planos.length === 1 ? "" : "es"} cadastrada{planos.length === 1 ? "" : "s"}</div>
        <Button onClick={() => { setEdit(null); setOpen(true); }} className="bg-rose-700 hover:bg-rose-800 gap-2" disabled={inv.length === 0}>
          <Plus className="h-4 w-4" />Nova ação
        </Button>
      </div>

      {sugeridos.length > 0 && (
        <Card className="p-4 border-rose-200 bg-rose-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-rose-700" />
            <h3 className="font-bold text-sm text-rose-900">
              {sugeridos.length} risco{sugeridos.length === 1 ? "" : "s"} Alto/Muito Alto sem plano de ação
            </h3>
          </div>
          <div className="text-xs text-rose-800 space-y-1">
            {sugeridos.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <span>• {r.perigo} <span className="opacity-60">({AIHA_LABEL[classifyAiha(r.probabilidade, r.severidade)]})</span></span>
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => {
                  setEdit({
                    id: "", inventario_id: r.id, o_que: "", por_que: `Mitigar: ${r.perigo}`,
                    onde: null, quem: null, quando: null, como: null, quanto: null,
                    status: "PENDENTE", data_conclusao: null, observacao: null,
                  });
                  setOpen(true);
                }}>
                  Criar ação
                </Button>
              </div>
            ))}
            {sugeridos.length > 5 && <div className="text-rose-700 italic">... e mais {sugeridos.length - 5}</div>}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-slate-500">Carregando…</div>
      ) : planos.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          <ListChecks className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold">Nenhuma ação no plano</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {planos.map((p) => {
            const risco = inv.find((r) => r.id === p.inventario_id);
            const cls = risco ? classifyAiha(risco.probabilidade, risco.severidade) : "NAO_CLASSIFICADO";
            const statusColor = {
              PENDENTE: "bg-slate-100 text-slate-700 border-slate-300",
              EM_ANDAMENTO: "bg-amber-100 text-amber-800 border-amber-300",
              CONCLUIDA: "bg-emerald-100 text-emerald-800 border-emerald-300",
              CANCELADA: "bg-rose-100 text-rose-700 border-rose-300",
            }[p.status];
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900">{p.o_que}</h4>
                      <Badge className={statusColor} variant="outline">{p.status}</Badge>
                      {risco && <Badge className={AIHA_COLOR[cls]} variant="outline">{risco.perigo} · {AIHA_LABEL[cls]}</Badge>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-0.5 text-xs text-slate-600">
                      {p.por_que && <Field label="Por quê" value={p.por_que} />}
                      {p.onde && <Field label="Onde" value={p.onde} />}
                      {p.quem && <Field label="Quem" value={p.quem} />}
                      {p.quando && <Field label="Quando" value={p.quando} />}
                      {p.como && <Field label="Como" value={p.como} />}
                      {p.quanto != null && <Field label="Quanto" value={`R$ ${p.quanto}`} />}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Select value={p.status} onValueChange={(v) => updStatus.mutate({ id: p.id, status: v as PlanoRow["status"] })}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDENTE">Pendente</SelectItem>
                        <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                        <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                        <SelectItem value="CANCELADA">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEdit(p); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => { if (confirm("Remover ação?")) remove.mutate(p.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PlanoDialog open={open} onOpenChange={setOpen} edit={edit} inv={inv} />
    </div>
  );
}

function PlanoDialog({
  open, onOpenChange, edit, inv,
}: { open: boolean; onOpenChange: (v: boolean) => void; edit: PlanoRow | null; inv: InvRow[] }) {
  const qc = useQueryClient();
  const [invId, setInvId] = useState("");
  const [oque, setOque] = useState("");
  const [porque, setPorque] = useState("");
  const [onde, setOnde] = useState("");
  const [quem, setQuem] = useState("");
  const [quando, setQuando] = useState("");
  const [como, setComo] = useState("");
  const [quanto, setQuanto] = useState<number | "">("");

  useMemo(() => {
    if (open) {
      setInvId(edit?.inventario_id ?? "");
      setOque(edit?.o_que ?? "");
      setPorque(edit?.por_que ?? "");
      setOnde(edit?.onde ?? "");
      setQuem(edit?.quem ?? "");
      setQuando(edit?.quando ?? "");
      setComo(edit?.como ?? "");
      setQuanto(edit?.quanto ?? "");
    }
  }, [open, edit]);

  const save = useMutation({
    mutationFn: async () => {
      if (!invId) throw new Error("Selecione o risco");
      if (!oque.trim()) throw new Error("Campo 'O quê' é obrigatório");
      const payload = {
        inventario_id: invId,
        o_que: oque.trim(),
        por_que: porque.trim() || null,
        onde: onde.trim() || null,
        quem: quem.trim() || null,
        quando: quando || null,
        como: como.trim() || null,
        quanto: quanto === "" ? null : Number(quanto),
      };
      if (edit && edit.id) {
        const { error } = await sb.from("pgr_plano_acao").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("pgr_plano_acao").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr_plano_acao"] });
      toast.success(edit && edit.id ? "Ação atualizada" : "Ação criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{edit && edit.id ? "Editar ação 5W2H" : "Nova ação 5W2H"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Risco vinculado *</Label>
            <Select value={invId} onValueChange={setInvId}>
              <SelectTrigger><SelectValue placeholder="Selecione o risco do inventário" /></SelectTrigger>
              <SelectContent>
                {inv.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.perigo} — {CATEGORIA_LABEL[r.categoria]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>O quê * (ação)</Label>
            <Textarea rows={2} value={oque} onChange={(e) => setOque(e.target.value)} placeholder="O que será feito?" />
          </div>
          <div>
            <Label>Por quê</Label>
            <Textarea rows={2} value={porque} onChange={(e) => setPorque(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Onde</Label><Input value={onde} onChange={(e) => setOnde(e.target.value)} /></div>
            <div><Label>Quem (responsável)</Label><Input value={quem} onChange={(e) => setQuem(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quando (prazo)</Label><Input type="date" value={quando} onChange={(e) => setQuando(e.target.value)} /></div>
            <div><Label>Quanto (R$)</Label><Input type="number" step="any" value={quanto} onChange={(e) => setQuanto(e.target.value === "" ? "" : Number(e.target.value))} /></div>
          </div>
          <div>
            <Label>Como</Label>
            <Textarea rows={2} value={como} onChange={(e) => setComo(e.target.value)} placeholder="Como será executada?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-rose-700 hover:bg-rose-800 gap-2">
            <Save className="h-4 w-4" />{save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}