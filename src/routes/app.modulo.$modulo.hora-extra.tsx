import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck2, Plus, ArrowLeft, Clock, Users, Pencil, Send, AlertTriangle, CheckCircle2, HourglassIcon } from "lucide-react";
import { toast } from "sonner";
import { HoraExtraSabadoDialog } from "@/components/hora-extra-sabado-dialog";

type ModuloScope = {
  slug: string;
  moduloLabel: string;
  setor?: string;
  empresaFixaNome: string;
  funcionariosPermitidos?: string[];
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

const MODULO_MAP: Record<string, ModuloScope> = {
  eletrica:   { slug: "eletrica",   moduloLabel: "Elétrica",   empresaFixaNome: "DMN", funcionariosPermitidos: ["Natanael", "Leonardo"] },
  mecanica:   { slug: "mecanica",   moduloLabel: "Mecânica",   empresaFixaNome: "LF SERVIÇOS" },
  producao:   { slug: "producao",   moduloLabel: "Produção",   setor: "Produção",   empresaFixaNome: "DMN" },
  compras:    { slug: "compras",    moduloLabel: "Compras",    setor: "Compras",    empresaFixaNome: "DMN" },
  manutencao: { slug: "manutencao", moduloLabel: "Manutenção", empresaFixaNome: "DMN", funcionariosPermitidos: ["Natanael", "Leonardo"] },
  almoxarifado: { slug: "almoxarifado", moduloLabel: "Almoxarifado", empresaFixaNome: "DMN", funcionariosPermitidos: ["Israel Uchoa"] },
  portaria:   { slug: "portaria",   moduloLabel: "Portaria",   setor: "Portaria",   empresaFixaNome: "DMN" },
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

  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ["hora-extra-modulo", scope.slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado")
        .select("id,data,turno,horario_inicio,horario_fim,setor,modulo_origem,status,observacao,justificativa,motivo_indeferimento,tipo_convocacao,created_at,companies(name),hora_extra_sabado_funcionarios(id,nome,funcao,externo)")
        .eq("modulo_origem", scope.slug)
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
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-primary">
          <CalendarCheck2 className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Hora Extra — {scope.moduloLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Registro de horas extras vinculado ao setor <span className="font-semibold">{scope.moduloLabel}</span>.
            Empresa travada em <span className="font-semibold">{scope.empresaFixaNome}</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/hoje"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-3">
            <span>Controle do módulo</span>
            <Button onClick={abrirNova} className="bg-red-700 hover:bg-red-800">
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
        setorFixo={scope.setor}
        empresaFixaNome={scope.empresaFixaNome}
        moduloOrigem={scope.slug}
        moduloLabel={scope.moduloLabel}
        funcionariosPermitidos={scope.funcionariosPermitidos}
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
        className="text-left rounded-lg border border-border bg-card/60 hover:bg-accent/40 transition p-3 space-y-2"
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
          <p className="text-xs text-destructive line-clamp-2">{ficha.motivo_indeferimento}</p>
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
              <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
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