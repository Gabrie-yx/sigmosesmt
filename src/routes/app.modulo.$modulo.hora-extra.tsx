import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck2, Plus, ArrowLeft, Clock, Users, Pencil, Send, AlertTriangle, CheckCircle2, HourglassIcon } from "lucide-react";
import { toast } from "sonner";
import { HoraExtraSabadoDialog } from "@/components/hora-extra-sabado-dialog";
import { useAuth } from "@/hooks/use-auth";

type ModuloScope = {
  slug: string;
  moduloLabel: string;
  setor?: string;
  empresaFixaNome?: string;
  funcionariosPermitidos?: string[];
  /** Oculta os campos Efetivo/Setor no dialog (fluxo simplificado). */
  camposSimplificados?: boolean;
};

type HoraExtraModulo = {
  id: string;
  data: string;
  turno: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  setor: string | null;
  modulo_origem: string | null;
  status: string;
  observacao: string | null;
  justificativa: string | null;
  motivo_indeferimento: string | null;
  tipo_convocacao: string | null;
  created_at: string;
  companies?: { name: string | null } | null;
  hora_extra_sabado_funcionarios?: { id: string; nome: string | null; funcao: string | null; externo: boolean | null }[];
};

export const MODULO_MAP: Record<string, ModuloScope> = {
  eletrica:   { slug: "eletrica",   moduloLabel: "Elétrica",   empresaFixaNome: "DMN", funcionariosPermitidos: ["Natanael Marins de Lira", "Leonardo Carmo dos Santos", "Paulo Sergio de Souza Silva", "Renato Oliveira Barbosa"], camposSimplificados: true },
  mecanica:   { slug: "mecanica",   moduloLabel: "Mecânica",   empresaFixaNome: "LF SERVIÇOS" },
  producao:   { slug: "producao",   moduloLabel: "Produção",   empresaFixaNome: "DMN", funcionariosPermitidos: ["Natanael Marins de Lira", "Leonardo Carmo dos Santos", "Paulo Sergio de Souza Silva", "Renato Oliveira Barbosa"], camposSimplificados: true },
  compras:    { slug: "compras",    moduloLabel: "Compras",    setor: "Compras",    empresaFixaNome: "DMN" },
  manutencao: { slug: "manutencao", moduloLabel: "Manutenção", empresaFixaNome: "LF SERVIÇOS", funcionariosPermitidos: ["José Carlos Batalha", "Kleber Lucas Lima Firmino"] },
  almoxarifado: { slug: "almoxarifado", moduloLabel: "Almoxarifado", funcionariosPermitidos: ["Israel Uchoa Rengifo", "Daniel Dantas"], camposSimplificados: true },
  portaria:   { slug: "portaria",   moduloLabel: "Portaria",   setor: "Portaria",   empresaFixaNome: "DMN" },
  // Escopo dinâmico via hora_extra_marcadores (RPC decide os funcionários).
  // Sem empresaFixa: o marcador escolhe entre as empresas do escopo dele.
  terceirizadas: { slug: "terceirizadas", moduloLabel: "Nova Hora Extra", camposSimplificados: true },
};

export const Route = createFileRoute("/app/modulo/$modulo/hora-extra")({
  head: ({ params }) => {
    const scope = MODULO_MAP[params.modulo];
    const label = scope?.moduloLabel ?? "Módulo";
    return {
      meta: [
        { title: `Hora Extra — ${label} · SIGMO` },
        { name: "description", content: `Registro de horas extras do setor ${label}.` },
      ],
    };
  },
  loader: ({ params }) => {
    if (!MODULO_MAP[params.modulo]) throw notFound();
    return null;
  },
  component: HoraExtraModuloPage,
});

function HoraExtraModuloPage() {
  const { modulo } = Route.useParams();
  const scope = MODULO_MAP[modulo]!;
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { user, isAdmin, isExtraSabadoMarcador } = useAuth();
  const qc = useQueryClient();
  const usaEscopoMarcador = !isAdmin && isExtraSabadoMarcador;

  // Marcadores dinâmicos (terceirizadas) SEMPRE salvam com
  // modulo_origem="terceirizadas", independente da URL de entrada
  // (ex.: /app/modulo/producao/hora-extra). O painel precisa filtrar pelo
  // mesmo slug efetivo — senão a ficha some depois de criada.
  const slugEfetivo = usaEscopoMarcador ? "terceirizadas" : scope.slug;

  // Realtime: quando o Administrativo aprova/indefere, o card do módulo
  // solicitante precisa atualizar sozinho (status + motivo).
  useEffect(() => {
    const ch = supabase
      .channel(`hora-extra-modulo-${slugEfetivo}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hora_extra_sabado", filter: `modulo_origem=eq.${slugEfetivo}` },
        () => qc.invalidateQueries({ queryKey: ["hora-extra-modulo", slugEfetivo] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slugEfetivo, qc]);

  // Escopo dinâmico: se o usuário logado é um marcador cadastrado em
  // hora_extra_marcadores, o RPC devolve a lista de employee_ids que ele
  // pode lançar. Admin recebe NULL (vê tudo). Quem não é marcador também.
  const { data: escopoIds, isLoading: loadingEscopoIds } = useQuery({
    queryKey: ["hora-extra-scope", user?.id],
    enabled: !!user?.id && !isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_hora_extra_allowed_employee_ids", { _uid: user!.id });
      if (error) throw error;
      return (data ?? null) as string[] | null;
    },
  });

  // Escopo de EMPRESAS do marcador (terceirizadas): lê hora_extra_marcadores
  // via RPC — resolve TERCEIRIZADAS_AUTO dinamicamente (empresas novas entram
  // sozinhas) e aplica exclude_company_ids configurado pelo admin.
  const { data: companyIdsEscopo, isLoading: loadingCompanyIdsEscopo } = useQuery({
    queryKey: ["hora-extra-marcador-empresas", user?.id],
    enabled: !!user?.id && !isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_hora_extra_allowed_company_ids", { _uid: user!.id });
      if (error) return null;
      const ids = (data ?? []) as string[] | null;
      return ids ? ids.map(String) : null;
    },
  });

  // Admin ignora qualquer restrição hardcoded do MODULO_MAP.
  // Marcador com escopo sobrescreve via IDs (mais confiável que match por nome).
  const employeeIdsPermitidos = isAdmin ? null : (usaEscopoMarcador ? (escopoIds ?? []) : (escopoIds ?? null));
  const funcionariosPermitidos = isAdmin || usaEscopoMarcador
    ? undefined
    : (escopoIds ? undefined : scope.funcionariosPermitidos);
  const companyIdsPermitidos = isAdmin ? null : (usaEscopoMarcador ? (companyIdsEscopo ?? []) : (companyIdsEscopo ?? null));
  const empresaFixaDialog = usaEscopoMarcador ? undefined : scope.empresaFixaNome;
  const setorFixoDialog = usaEscopoMarcador ? undefined : scope.setor;
  const moduloLabelDialog = usaEscopoMarcador ? "Nova Hora Extra" : scope.moduloLabel;
  const aguardandoEscopoMarcador = usaEscopoMarcador && (loadingEscopoIds || loadingCompanyIdsEscopo);

  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ["hora-extra-modulo", slugEfetivo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado")
        .select("id,data,turno,horario_inicio,horario_fim,setor,modulo_origem,status,observacao,justificativa,motivo_indeferimento,tipo_convocacao,created_at,companies(name),hora_extra_sabado_funcionarios(id,nome,funcao,externo)")
        .eq("modulo_origem", slugEfetivo)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HoraExtraModulo[];
    },
  });

  const grupos = useMemo(() => ({
    indeferidas: fichas.filter((f) => f.status === "INDEFERIDA"),
    pendentes: fichas.filter((f) => f.status === "PENDENTE"),
    aprovadas: fichas.filter((f) => f.status === "APROVADA"),
  }), [fichas]);

  function abrirNova() {
    setEditId(null);
    setOpen(true);
  }

  function abrirEdicao(id: string) {
    setEditId(id);
    setOpen(true);
  }

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            Hora Extra
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0 h-8 px-2 sm:px-3">
            <Link to="/app/hoje" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Voltar</span>
            </Link>
          </Button>
        </div>
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-primary/20 border border-primary/40 p-2 text-primary">
            <CalendarCheck2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-foreground">
              {scope.moduloLabel}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-foreground/90">
                Setor: {scope.moduloLabel}
              </span>
              {scope.empresaFixaNome && (
                <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                  Empresa: {scope.empresaFixaNome}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Controle do módulo</span>
            <Button onClick={abrirNova} disabled={aguardandoEscopoMarcador} className="w-full sm:w-auto bg-red-700 hover:bg-red-800">
              <Plus className="h-4 w-4 mr-2" /> Nova ficha
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-center text-muted-foreground">Carregando fichas…</p>
          ) : fichas.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-center text-muted-foreground">Nenhuma ficha registrada para este módulo.</p>
          ) : (
            <>
              <FichasSection title="Indeferidas — corrigir e reenviar" icon="indeferida" fichas={grupos.indeferidas} onEditar={abrirEdicao} />
              <FichasSection title="Pendentes no Administrativo" icon="pendente" fichas={grupos.pendentes} onEditar={abrirEdicao} />
              <FichasSection title="Aprovadas" icon="aprovada" fichas={grupos.aprovadas} onEditar={abrirEdicao} />
            </>
          )}
        </CardContent>
      </Card>

      <HoraExtraSabadoDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditId(null); }}
        editId={editId}
        setorFixo={setorFixoDialog}
        empresaFixaNome={empresaFixaDialog}
        moduloOrigem={usaEscopoMarcador ? "terceirizadas" : scope.slug}
        moduloLabel={moduloLabelDialog}
        funcionariosPermitidos={funcionariosPermitidos}
        employeeIdsPermitidos={employeeIdsPermitidos}
        companyIdsPermitidos={companyIdsPermitidos}
        ocultarEfetivo={scope.camposSimplificados}
        ocultarSetor={scope.camposSimplificados}
        observacaoLabel="DIGITE AQUI A JUSTIFICATIVA DA EXTRA"
        observacaoPlaceholder="Descreva a justificativa da hora extra…"
      />
    </div>
  );
}

function FichasSection({ title, icon, fichas, onEditar }: {
  title: string;
  icon: "indeferida" | "pendente" | "aprovada";
  fichas: HoraExtraModulo[];
  onEditar: (id: string) => void;
}) {
  const Icon = icon === "indeferida" ? AlertTriangle : icon === "aprovada" ? CheckCircle2 : HourglassIcon;
  if (fichas.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <Icon className="h-4 w-4" /> {title} ({fichas.length})
      </h2>
      <div className="grid gap-2 md:grid-cols-2">
        {fichas.map((f) => <FichaModuloCard key={f.id} ficha={f} onEditar={onEditar} />)}
      </div>
    </section>
  );
}

function FichaModuloCard({ ficha, onEditar }: { ficha: HoraExtraModulo; onEditar: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const funcs = ficha.hora_extra_sabado_funcionarios ?? [];
  const motivo = ficha.justificativa?.trim() || ficha.observacao?.trim() || "Sem justificativa informada.";
  const statusClass = ficha.status === "INDEFERIDA"
    ? "border-destructive/30 text-destructive bg-destructive/10"
    : ficha.status === "APROVADA"
      ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
      : "border-amber-500/30 text-amber-300 bg-amber-500/10";

  const reenviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reenviar_hora_extra_modulo", { _hora_extra_id: ficha.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hora-extra-modulo", ficha.modulo_origem] });
      qc.invalidateQueries({ queryKey: ["admin-hora-extra-recebida"] });
      toast.success("Hora extra reenviada ao Administrativo");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao reenviar"),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-left rounded-lg border bg-card/60 hover:bg-accent/40 transition p-3 space-y-2 ${
          ficha.status === "INDEFERIDA" ? "animate-indeferida" : "border-border"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-foreground">{fmtDate(ficha.data)}</div>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" /> {ficha.horario_inicio ?? "--:--"}–{ficha.horario_fim ?? "--:--"}
              <Users className="h-3 w-3 ml-1" /> {funcs.length}
            </div>
          </div>
          <span className={`text-[10px] font-black uppercase rounded border px-2 py-0.5 ${statusClass}`}>{ficha.status}</span>
        </div>
        {ficha.status === "INDEFERIDA" && ficha.motivo_indeferimento && (
          <div className="rounded-md border border-amber-400/40 bg-destructive/15 p-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 mb-0.5">
              Motivo do indeferimento
            </div>
            <p className="text-xs text-rose-100 whitespace-pre-wrap">{ficha.motivo_indeferimento}</p>
          </div>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Hora extra de {fmtDate(ficha.data)}
              <span className={`text-[10px] font-black uppercase rounded border px-2 py-0.5 ${statusClass}`}>{ficha.status}</span>
            </DialogTitle>
            <DialogDescription>
              {ficha.horario_inicio ?? "--:--"}–{ficha.horario_fim ?? "--:--"} · {ficha.turno ?? "—"} turno · {ficha.companies?.name ?? "—"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold text-muted-foreground mb-1">Funcionários ({funcs.length})</div>
              <div className="max-h-44 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {funcs.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Nenhum funcionário listado.</p>
                ) : funcs.map((f) => (
                  <div key={f.id} className="px-3 py-2 text-sm flex justify-between gap-2">
                    <span>{f.nome}</span>
                    {f.funcao ? <span className="text-xs text-muted-foreground">{f.funcao}</span> : null}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-muted-foreground mb-1">Motivo da extra</div>
              <div className="text-sm whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3">{motivo}</div>
            </div>
            {ficha.status === "INDEFERIDA" && ficha.motivo_indeferimento && (
              <div>
                <div className="text-xs font-bold text-destructive mb-1">Motivo do indeferimento</div>
                <div className="text-sm whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">{ficha.motivo_indeferimento}</div>
              </div>
            )}
          </div>

          <DialogFooter>
            {ficha.status === "INDEFERIDA" ? (
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); onEditar(ficha.id); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Corrigir ficha
                </Button>
                <Button className="flex-1 bg-red-700 hover:bg-red-800" onClick={() => reenviar.mutate()} disabled={reenviar.isPending}>
                  <Send className="h-4 w-4 mr-1" /> Reenviar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); onEditar(ficha.id); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar ficha
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Fechar</Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function fmtDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}