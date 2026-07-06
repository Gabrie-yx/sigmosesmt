import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck2, Search, Filter, Building2, Wrench, Cog, Factory, Boxes,
  ShieldPlus, Package, ChevronDown, ChevronRight, Users, Zap, CheckCircle2, XCircle,
} from "lucide-react";

export const Route = createFileRoute("/app/administrativo/hora-extra-recebida")({
  component: AdministrativoHoraExtraRecebidaPage,
});

const SETORES = [
  "Produção",
  "Manutenção",
  "Elétrica",
  "Mecânica",
  "Administrativo",
  "Almoxarifado",
  "Compras",
  "SESMT",
  "Portaria",
] as const;

type HoraExtra = {
  id: string;
  data: string;
  turno: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  setor: string | null;
  tipo_convocacao: "SABADO" | "DIAS_UTEIS" | null;
  modulo_origem?: string | null;
  status: "PENDENTE" | "APROVADA" | "INDEFERIDA" | string;
  justificativa: string | null;
  aberto_por_nome: string | null;
  criado_automatico_por_nome: string | null;
  observacao: string | null;
  motivo_indeferimento: string | null;
  created_at: string;
  company_id?: string | null;
  companies?: { name: string | null } | null;
};

type Funcionario = {
  id: string;
  hora_extra_id: string;
  nome: string;
  funcao: string | null;
  externo: boolean | null;
  presenca: string | null;
  employee_id?: string | null;
  employees?: { companies?: { name: string | null } | null } | null;
};

const STATUS_BADGE: Record<string, string> = {
  PENDENTE: "prism-pill accent-amber text-amber-100",
  APROVADA: "prism-pill accent-emerald text-emerald-100",
  INDEFERIDA: "prism-pill accent-rose text-rose-100",
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  INDEFERIDA: "Indeferida",
};

const SETOR_ICON: Record<string, typeof Building2> = {
  "Produção": Factory,
  "Manutenção": Wrench,
  "Elétrica": Zap,
  "Mecânica": Cog,
  "Administrativo": Building2,
  "Almoxarifado": Boxes,
  "Compras": Package,
  "SESMT": ShieldPlus,
  "Portaria": ShieldPlus,
};

const SETOR_ACCENT: Record<string, string> = {
  "Produção": "accent-sky",
  "Manutenção": "accent-amber",
  "Elétrica": "accent-amber",
  "Mecânica": "accent-violet",
  "Administrativo": "accent-emerald",
  "Almoxarifado": "accent-wine",
  "Compras": "accent-sky",
  "SESMT": "accent-rose",
  "Portaria": "accent-violet",
};

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

const MODULO_LABEL: Record<string, string> = {
  eletrica: "Elétrica",
  mecanica: "Mecânica",
  producao: "Produção",
  compras: "Compras",
  manutencao: "Manutenção",
  almoxarifado: "Almoxarifado",
  portaria: "Portaria",
  administrativo: "Administrativo",
  sesmt: "SESMT",
};

function splitSetores(r: { setor: string | null; modulo_origem?: string | null }): string[] {
  const raw = (r.setor ?? "").trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (r.modulo_origem) return [MODULO_LABEL[r.modulo_origem] ?? r.modulo_origem];
  return ["Sem setor"];
}

/**
 * Rótulo de origem que aparece no card e no dialog. Para fichas de
 * terceirizadas (modulo_origem = "terceirizadas") preferimos o nome da
 * empresa (ex.: "JC Galvão", "NB Construção") em vez do genérico
 * "TERCEIRIZADAS", que não ajuda o Administrativo a distinguir.
 */
function origemLabel(r: HoraExtra): string {
  if (r.modulo_origem === "terceirizadas" && r.companies?.name) {
    return r.companies.name;
  }
  return splitSetores(r)[0];
}

function AdministrativoHoraExtraRecebidaPage() {
  const { user, roles, hasModule } = useAuth();
  const isAdmin = roles.includes("admin");
  const canAcesso = isAdmin || hasModule("administrativo" as any);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [setorFilter, setSetorFilter] = useState<string>("__all");

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["admin-hora-extra-recebida"],
    enabled: !!user && canAcesso,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado")
        .select("id,data,turno,horario_inicio,horario_fim,setor,modulo_origem,tipo_convocacao,status,justificativa,aberto_por_nome,criado_automatico_por_nome,observacao,motivo_indeferimento,created_at,company_id,companies(name)")
        .order("data", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as HoraExtra[];
    },
  });

  // Realtime: quando o SESMT/Admin apaga ou o módulo cria/edita, o painel
  // do Anderson precisa atualizar sozinho (nada de card fantasma pós-exclusão).
  useEffect(() => {
    if (!user || !canAcesso) return;
    const ch = supabase
      .channel(`admin-hora-extra-recebida-rt-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hora_extra_sabado" },
        () => {
          qc.invalidateQueries({ queryKey: ["admin-hora-extra-recebida"] });
          qc.invalidateQueries({ queryKey: ["admin-hora-extra-recebida-funcs"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hora_extra_sabado_funcionarios" },
        () => {
          qc.invalidateQueries({ queryKey: ["admin-hora-extra-recebida"] });
          qc.invalidateQueries({ queryKey: ["admin-hora-extra-recebida-funcs"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, user?.id, canAcesso]);

  const ids = registros.map((r) => r.id);
  const { data: funcs = [] } = useQuery({
    queryKey: ["admin-hora-extra-recebida-funcs", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado_funcionarios")
        .select("id,hora_extra_id,nome,funcao,externo,presenca,employee_id,employees(companies(name))")
        .in("hora_extra_id", ids);
      if (error) throw error;
      return (data ?? []) as Funcionario[];
    },
  });

  const funcsByHE = useMemo(() => {
    const map = new Map<string, Funcionario[]>();
    for (const f of funcs) {
      if (!map.has(f.hora_extra_id)) map.set(f.hora_extra_id, []);
      map.get(f.hora_extra_id)!.push(f);
    }
    return map;
  }, [funcs]);

  const filtered = useMemo(() => {
    return registros.filter((r) => {
      const setores = splitSetores(r);
      if (setorFilter !== "__all" && !setores.includes(setorFilter)) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        (r.aberto_por_nome ?? "").toLowerCase().includes(s) ||
        (r.criado_automatico_por_nome ?? "").toLowerCase().includes(s) ||
        (r.justificativa ?? "").toLowerCase().includes(s) ||
        (r.observacao ?? "").toLowerCase().includes(s) ||
        (r.setor ?? "").toLowerCase().includes(s)
      );
    });
  }, [registros, q, setorFilter]);

  // Agrupamento por setor — 1 registro pode aparecer em vários setores
  const grupos = useMemo(() => {
    const map = new Map<string, HoraExtra[]>();
    for (const r of filtered) {
      for (const setor of splitSetores(r)) {
        if (!map.has(setor)) map.set(setor, []);
        map.get(setor)!.push(r);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = SETORES.indexOf(a as any);
      const ib = SETORES.indexOf(b as any);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  if (!user) return null;
  if (!canAcesso) {
    return (
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader><CardTitle>Acesso restrito</CardTitle></CardHeader>
          <CardContent className="text-sm">
            Este painel é restrito ao módulo <strong>Administrativo</strong>. Fale com o admin para liberar seu acesso.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl prism-pill accent-amber flex items-center justify-center text-amber-100">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Administrativo · H. Extra Recebida</h1>
            <p className="text-xs text-muted-foreground">
              Fichas de hora extra emitidas pelos setores, organizadas por setor de origem.
            </p>
          </div>
        </div>
        <span className="prism-pill accent-sky px-3 py-1 text-xs text-sky-100">
          Total: {filtered.length}
        </span>
      </div>

      <Card className="glass-card">
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por solicitante, setor, justificativa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os setores</SelectItem>
                {SETORES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando…</div>
      ) : grupos.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhuma ficha de hora extra encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {grupos.map(([setor, lista]) => (
            <SetorCard key={setor} setor={setor} lista={lista} funcsByHE={funcsByHE} />
          ))}
        </div>
      )}
    </div>
  );
}

function SetorCard({
  setor, lista, funcsByHE,
}: { setor: string; lista: HoraExtra[]; funcsByHE: Map<string, Funcionario[]> }) {
  const Icon = SETOR_ICON[setor] ?? Package;
  const accent = SETOR_ACCENT[setor] ?? "accent-sky";
  const pendentes = lista.filter((r) => r.status === "PENDENTE").length;
  const [open, setOpen] = useState(true);
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        className={`p-4 pb-3 flex flex-row items-center justify-between gap-2 cursor-pointer select-none ${open ? "border-b border-white/10" : ""}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className={`h-10 w-10 rounded-xl prism-pill ${accent} flex items-center justify-center text-foreground shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-foreground truncate">{setor}</div>
            <div className="text-[11px] text-muted-foreground">
              {lista.length} ficha{lista.length === 1 ? "" : "s"}
              {pendentes > 0 ? ` · ${pendentes} pendente${pendentes === 1 ? "" : "s"}` : ""}
            </div>
          </div>
        </div>
        {pendentes > 0 && (
          <span className="prism-pill accent-amber px-2.5 py-1 text-[11px] text-amber-100 shrink-0">
            {pendentes} pendente{pendentes === 1 ? "" : "s"}
          </span>
        )}
      </CardHeader>
      {open && (
        <CardContent className="p-3 space-y-2">
          {lista.map((r) => (
            <FichaCard key={r.id} he={r} funcs={funcsByHE.get(r.id) ?? []} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function FichaCard({ he, funcs }: { he: HoraExtra; funcs: Funcionario[] }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [indeferirOpen, setIndeferirOpen] = useState(false);
  const qc = useQueryClient();
  const aprovar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("decidir_convocacao_extra", {
        _hora_extra_id: he.id, _aprovar: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hora extra aprovada");
      qc.invalidateQueries({ queryKey: ["admin-hora-extra-recebida"] });
      setDetailOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao aprovar"),
  });
  const tipo = he.tipo_convocacao === "DIAS_UTEIS" ? "Dia útil" : he.tipo_convocacao === "SABADO" ? "Sábado" : "—";
  const solicitante = he.aberto_por_nome ?? he.criado_automatico_por_nome ?? "—";
  const statusKey = he.status in STATUS_BADGE ? he.status : "PENDENTE";
  const origem = origemLabel(he);
  const origemAccent = SETOR_ACCENT[splitSetores(he)[0]] ?? "accent-amber";
  const setorDialog = he.modulo_origem === "terceirizadas"
    ? (he.companies?.name ?? he.setor ?? "—")
    : (he.setor ?? "—");
  return (
    <>
    <Card
      className="glass-card overflow-hidden cursor-pointer hover:bg-white/5 transition-colors"
      role="button"
      tabIndex={0}
      onClick={() => setDetailOpen(true)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailOpen(true); } }}
    >
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground">Data</span>
            <span className="text-sm font-bold text-foreground">{fmtBR(he.data)}</span>
            <span className={`${STATUS_BADGE[statusKey]} px-2.5 py-0.5 text-[11px]`}>{STATUS_LABEL[statusKey] ?? he.status}</span>
            <span className="prism-pill px-2 py-0.5 text-[10px] text-foreground/80">{tipo}</span>
            <span
              className={`prism-pill ${origemAccent} px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-foreground animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.55)]`}
              title="Setor de origem"
            >
              {origem}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {solicitante} · {he.horario_inicio ?? "--:--"}–{he.horario_fim ?? "--:--"} ·
            <Users className="inline h-3 w-3 ml-1 mr-0.5" /> {funcs.length}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </CardHeader>
    </Card>

    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Ficha de {fmtBR(he.data)}
            <span className={`${STATUS_BADGE[statusKey]} px-2.5 py-0.5 text-[11px]`}>{STATUS_LABEL[statusKey] ?? he.status}</span>
            <span className="prism-pill px-2 py-0.5 text-[10px] text-foreground/80">{tipo}</span>
          </DialogTitle>
          <DialogDescription>
            Solicitante: <strong className="text-foreground">{solicitante}</strong> ·
            {he.modulo_origem === "terceirizadas" ? "Empresa: " : "Setor: "}
            <strong className="text-foreground">{setorDialog}</strong> ·
            Horário: <strong className="text-foreground">{he.horario_inicio ?? "--:--"}–{he.horario_fim ?? "--:--"}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Funcionários ({funcs.length})
            </div>
            {funcs.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">Nenhum funcionário marcado.</div>
            ) : (
              (() => {
                const empresaFicha = he.companies?.name ?? "Sem empresa";
                const grupos = new Map<string, Funcionario[]>();
                for (const f of funcs) {
                  const emp = f.employees?.companies?.name
                    ?? (f.externo ? "Sem empresa" : empresaFicha);
                  if (!grupos.has(emp)) grupos.set(emp, []);
                  grupos.get(emp)!.push(f);
                }
                const ordenadas = Array.from(grupos.entries())
                  .sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
                return (
                  <div className="max-h-56 overflow-y-auto rounded-md border border-white/10 divide-y divide-white/10">
                    {ordenadas.map(([empresa, lista]) => (
                      <div key={empresa}>
                        <div className="sticky top-0 z-10 flex items-center justify-between px-2 py-1 bg-amber-500/10 border-b border-amber-400/30">
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-100">{empresa}</span>
                          <span className="text-[10px] font-bold text-amber-100/70">{lista.length}</span>
                        </div>
                        <ul className="text-[12px] divide-y divide-white/5">
                          {lista.map((f) => (
                            <li key={f.id} className="flex items-center justify-between gap-2 px-2 py-1">
                              <span className="truncate">
                                {f.nome}
                                {f.externo ? <span className="ml-1 text-[10px] text-amber-300">(externo)</span> : null}
                                {f.funcao ? <span className="text-muted-foreground"> · {f.funcao}</span> : null}
                              </span>
                              {f.presenca && (
                                <span className="prism-pill px-1.5 py-0.5 text-[10px] text-foreground/80">{f.presenca}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          <div>
            <div className="text-xs font-bold text-muted-foreground mb-1">Motivo / Justificativa</div>
            <div className="text-[12px] text-foreground/90 whitespace-pre-wrap rounded-md bg-white/5 p-2 border border-white/10">
              {he.justificativa?.trim() || he.observacao?.trim() || "Sem justificativa informada."}
            </div>
          </div>

          {he.status === "INDEFERIDA" && he.motivo_indeferimento && (
            <div>
              <div className="text-xs font-bold text-rose-300 mb-1">Motivo do indeferimento</div>
              <div className="text-[12px] text-rose-100 whitespace-pre-wrap rounded-md bg-rose-950/30 p-2 border border-rose-500/30">
                {he.motivo_indeferimento}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {he.status === "PENDENTE" ? (
            <div className="flex gap-2 w-full">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => aprovar.mutate()}
                disabled={aprovar.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Deferir
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setIndeferirOpen(true)}
                disabled={aprovar.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" /> Indeferir
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setDetailOpen(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <IndeferirDialog
      open={indeferirOpen}
      onClose={() => setIndeferirOpen(false)}
      horaExtraId={he.id}
      onDone={() => { qc.invalidateQueries({ queryKey: ["admin-hora-extra-recebida"] }); setDetailOpen(false); }}
    />
    </>
  );
}

function IndeferirDialog({ open, onClose, horaExtraId, onDone }: {
  open: boolean; onClose: () => void; horaExtraId: string; onDone: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirmar() {
    if (motivo.trim().length < 5) {
      toast.error("Motivo muito curto (mín. 5 caracteres)");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("decidir_convocacao_extra", {
      _hora_extra_id: horaExtraId, _aprovar: false, _motivo: motivo,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Hora extra indeferida — retornou ao solicitante");
    setMotivo("");
    onDone();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setMotivo(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Indeferir hora extra</DialogTitle>
          <DialogDescription>
            O solicitante verá o motivo e a ficha retornará a ele para correção.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={4}
          placeholder="Ex.: escopo já coberto pela equipe de dia, sem urgência para justificar hora extra…"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); setMotivo(""); }}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmar} disabled={saving}>
            {saving ? "Enviando…" : "Confirmar indeferimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}