// Card da portaria: "Hora Extra Hoje" — lista convocações APROVADAS do dia
// e permite validar permanência/entrada/saída de cada funcionário.
//
// Dia útil: [Confirmar permanência 17:30] → [Registrar saída]
// Sábado : [Registrar entrada]         → [Registrar saída]

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listHoraExtraHoje,
  confirmarValidacaoPortaria,
  desfazerValidacaoPortaria,
  type HoraExtraHojeConvocacao,
  type HoraExtraHojeFuncionario,
} from "@/lib/portaria/hora-extra-validacao.functions";
import { Button } from "@/components/ui/button";
import { Clock3, CheckCircle2, LogIn, LogOut, Users, Undo2, Loader2, CalendarClock, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSignedAvatarUrl } from "@/lib/signed-avatar-url";

function fmtHora(iso?: string | null) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type GrupoSolicitante = {
  key: string;
  nome: string;
  funcao: string | null;
  setor: string | null;
  total: number;
  validados: number;
  convocacoes: HoraExtraHojeConvocacao[];
};

function isFuncionarioValidado(conv: HoraExtraHojeConvocacao, f: HoraExtraHojeFuncionario) {
  return conv.is_sabado
    ? !!f.entrada_confirmada_at && !!f.saida_confirmada_at
    : !!f.permanencia_confirmada_at && !!f.saida_confirmada_at;
}

export function HoraExtraHojeCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listHoraExtraHoje);
  const confirmFn = useServerFn(confirmarValidacaoPortaria);
  const undoFn = useServerFn(desfazerValidacaoPortaria);
  const { isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["portaria-hora-extra-hoje"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });

  const confirmar = useMutation({
    mutationFn: (v: { funcionarioId: string; tipo: "permanencia" | "entrada" | "saida" }) =>
      confirmFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(
        v.tipo === "permanencia" ? "Permanência confirmada" : v.tipo === "entrada" ? "Entrada registrada" : "Saída registrada",
      );
      qc.invalidateQueries({ queryKey: ["portaria-hora-extra-hoje"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao validar"),
  });

  const desfazer = useMutation({
    mutationFn: (v: { funcionarioId: string; tipo: "permanencia" | "entrada" | "saida" }) =>
      undoFn({ data: v }),
    onSuccess: () => {
      toast.success("Validação desfeita");
      qc.invalidateQueries({ queryKey: ["portaria-hora-extra-hoje"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao desfazer"),
  });

  const totais = useMemo(() => {
    const conv = data ?? [];
    const funcs = conv.flatMap((c) => c.funcionarios);
    const total = funcs.length;
    const validados = funcs.filter((f) => {
      const c = conv.find((cc) => cc.id === f.hora_extra_id)!;
      return isFuncionarioValidado(c, f);
    }).length;
    return { total, validados };
  }, [data]);

  const gruposSolicitante = useMemo<GrupoSolicitante[]>(() => {
    const map = new Map<string, GrupoSolicitante>();
    for (const conv of data ?? []) {
      const key = conv.solicitante_key || conv.id;
      const atual = map.get(key) ?? {
        key,
        nome: conv.solicitante_nome || "Solicitante",
        funcao: conv.solicitante_funcao,
        setor: conv.solicitante_setor,
        total: 0,
        validados: 0,
        convocacoes: [],
      };
      atual.total += conv.funcionarios.length;
      atual.validados += conv.funcionarios.filter((f) => isFuncionarioValidado(conv, f)).length;
      atual.convocacoes.push(conv);
      map.set(key, atual);
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando hora extra do dia…
      </div>
    );
  }

  const isEmpty = !data || data.length === 0;

  return (
    <div
      className="rounded-2xl bg-card border border-primary/40 overflow-hidden"
      style={{
        boxShadow:
          "0 0 0 1px color-mix(in oklab, var(--primary) 25%, transparent), 0 0 24px -4px color-mix(in oklab, var(--primary) 55%, transparent), inset 0 0 18px -8px color-mix(in oklab, var(--primary) 35%, transparent)",
      }}
    >
      <div className="px-4 py-3 border-b border-primary/25 flex items-center justify-between bg-gradient-to-r from-primary/10 via-transparent to-primary/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/20 text-primary grid place-items-center shrink-0 ring-1 ring-primary/40">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Portaria valida</p>
            <h2 className="font-bold text-base leading-tight truncate">Hora Extra Hoje</h2>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Validados</p>
          <p className="font-bold text-lg text-foreground tabular-nums">{totais.validados}<span className="text-muted-foreground text-sm">/{totais.total}</span></p>
        </div>
      </div>

      {isEmpty ? (
        <div className="px-4 py-8 text-center">
          <CalendarClock className="h-7 w-7 mx-auto opacity-40 mb-2 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Sem hora extra aprovada pra hoje</p>
          <p className="text-xs mt-1 text-muted-foreground max-w-sm mx-auto">
            Assim que o encarregado abrir uma convocação e o supervisor aprovar, os funcionários aparecem aqui pra validar permanência/entrada e saída.
          </p>
        </div>
      ) : (
      <div className="space-y-3 p-3">
        {gruposSolicitante.map((grupo) => (
          <SolicitanteBloco
            key={grupo.key}
            grupo={grupo}
            isAdmin={isAdmin}
            onConfirm={(f, tipo) => confirmar.mutate({ funcionarioId: f.id, tipo })}
            onUndo={(f, tipo) => desfazer.mutate({ funcionarioId: f.id, tipo })}
            pendingId={confirmar.isPending ? (confirmar.variables?.funcionarioId ?? null) : desfazer.isPending ? (desfazer.variables?.funcionarioId ?? null) : null}
          />
        ))}
      </div>
      )}
    </div>
  );
}

function SolicitanteBloco({
  grupo, isAdmin, onConfirm, onUndo, pendingId,
}: {
  grupo: GrupoSolicitante;
  isAdmin: boolean;
  onConfirm: (f: HoraExtraHojeFuncionario, tipo: "permanencia" | "entrada" | "saida") => void;
  onUndo: (f: HoraExtraHojeFuncionario, tipo: "permanencia" | "entrada" | "saida") => void;
  pendingId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const detalhe = [grupo.funcao, grupo.setor].filter(Boolean).join(" · ");

  return (
    <section
      className="rounded-xl border border-primary/25 bg-card overflow-hidden"
      style={{ boxShadow: "0 0 0 1px color-mix(in oklab, var(--primary) 12%, transparent), inset 0 0 18px -10px color-mix(in oklab, var(--primary) 50%, transparent)" }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition text-left"
      >
        <div className="min-w-0">
          <h3 className="font-bold text-sm sm:text-base leading-tight truncate">{grupo.nome}</h3>
          {detalhe && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{detalhe}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[11px] font-bold rounded-md border border-primary/25 bg-primary/10 px-2 py-1 tabular-nums">
            {grupo.total} Func.
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
            {grupo.validados}/{grupo.total} validados
          </span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-2.5 space-y-2.5">
          {grupo.convocacoes.map((conv) => (
            <EmpresaBloco
              key={conv.id}
              conv={conv}
              isAdmin={isAdmin}
              onConfirm={(f, tipo) => onConfirm(f, tipo)}
              onUndo={(f, tipo) => onUndo(f, tipo)}
              pendingId={pendingId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmpresaBloco({
  conv, isAdmin, onConfirm, onUndo, pendingId,
}: {
  conv: HoraExtraHojeConvocacao;
  isAdmin: boolean;
  onConfirm: (f: HoraExtraHojeFuncionario, tipo: "permanencia" | "entrada" | "saida") => void;
  onUndo: (f: HoraExtraHojeFuncionario, tipo: "permanencia" | "entrada" | "saida") => void;
  pendingId: string | null;
}) {
  const label = conv.is_sabado ? "Sábado" : "Dia útil";
  const previsto = conv.horario_inicio && conv.horario_fim
    ? `${conv.horario_inicio.slice(0, 5)}–${conv.horario_fim.slice(0, 5)}`
    : conv.horario_fim ? `até ${conv.horario_fim.slice(0, 5)}` : "";
  const validados = conv.funcionarios.filter((f) => isFuncionarioValidado(conv, f)).length;

  const empresasMap = new Map<string, HoraExtraHojeFuncionario[]>();
  for (const f of conv.funcionarios) {
    const key = f.company_name ?? conv.company_name ?? conv.modulo_origem ?? "Sem empresa";
    const arr = empresasMap.get(key) ?? [];
    arr.push(f);
    empresasMap.set(key, arr);
  }
  const empresas = Array.from(empresasMap.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  return (
    <div className="rounded-lg border border-border bg-background/30 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/20">
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30">
            {label}
          </span>
          {previsto && (
            <span className="text-[11px] font-semibold text-foreground tabular-nums inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3 text-muted-foreground" />{previsto}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 tabular-nums">
          <Users className="h-3 w-3" /> {validados}/{conv.funcionarios.length}
        </div>
      </div>
      <div className="divide-y divide-border">
        {empresas.map(([empresa, funcs]) => (
          <div key={empresa}>
            <div className="px-3 py-1.5 bg-muted/30 border-b border-border flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground inline-flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-muted-foreground" /> {empresa}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{funcs.length} func.</span>
            </div>
            <ul className="divide-y divide-border">
              {funcs.map((f) => (
                <FuncionarioRow
                  key={f.id}
                  f={f}
                  isSabado={conv.is_sabado}
                  isAdmin={isAdmin}
                  onConfirm={onConfirm}
                  onUndo={onUndo}
                  pending={pendingId === f.id}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function FuncionarioRow({
  f, isSabado, isAdmin, onConfirm, onUndo, pending,
}: {
  f: HoraExtraHojeFuncionario;
  isSabado: boolean;
  isAdmin: boolean;
  onConfirm: (f: HoraExtraHojeFuncionario, tipo: "permanencia" | "entrada" | "saida") => void;
  onUndo: (f: HoraExtraHojeFuncionario, tipo: "permanencia" | "entrada" | "saida") => void;
  pending: boolean;
}) {
  const primeiro = isSabado
    ? { key: "entrada" as const, label: "Entrada", icon: LogIn, at: f.entrada_confirmada_at, por: f.entrada_confirmada_por_nome }
    : { key: "permanencia" as const, label: "Permanência 17:30", icon: Clock3, at: f.permanencia_confirmada_at, por: f.permanencia_confirmada_por_nome };
  const segundo = { key: "saida" as const, label: "Saída", icon: LogOut, at: f.saida_confirmada_at, por: f.saida_confirmada_por_nome };
  const iniciais = f.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const completo = !!primeiro.at && !!segundo.at;

  return (
    <li className={`px-3 lg:px-4 py-3 flex items-center gap-3 transition ${completo ? "bg-primary/[0.04]" : ""}`}>
      <div className="shrink-0 relative">
        <FuncionarioAvatar fotoUrl={f.foto_url} iniciais={iniciais} nome={f.nome} />
        {completo && (
          <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-card">
            <CheckCircle2 className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate leading-tight">
          {f.nome}
          {f.externo && (
            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">externo</span>
          )}
        </p>
        {f.funcao && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{f.funcao}</p>}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ValidacaoBtn
          label={primeiro.label} Icon={primeiro.icon} at={primeiro.at} por={primeiro.por} pending={pending}
          onClick={() => onConfirm(f, primeiro.key)}
          onUndo={isAdmin ? () => onUndo(f, primeiro.key) : undefined}
        />
        <ValidacaoBtn
          label={segundo.label} Icon={segundo.icon} at={segundo.at} por={segundo.por} pending={pending}
          disabled={!primeiro.at}
          onClick={() => onConfirm(f, segundo.key)}
          onUndo={isAdmin ? () => onUndo(f, segundo.key) : undefined}
        />
      </div>
    </li>
  );
}

function FuncionarioAvatar({ fotoUrl, iniciais, nome }: { fotoUrl: string | null; iniciais: string; nome: string }) {
  const signed = useSignedAvatarUrl(fotoUrl);
  const [broken, setBroken] = useState(false);

  if (!signed || broken) {
    return (
      <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground font-bold text-xs flex items-center justify-center border border-border ring-1 ring-primary/10">
        {iniciais}
      </div>
    );
  }

  return (
    <div className="h-12 w-12 rounded-full overflow-hidden border border-border bg-muted ring-1 ring-primary/10">
      <img
        src={signed}
        className="h-full w-full object-cover"
        style={{ objectPosition: "center 18%" }}
        alt={`Foto de ${nome}`}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

function ValidacaoBtn({
  label, Icon, at, por, pending, disabled, onClick, onUndo,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  at: string | null;
  por: string | null;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
  onUndo?: () => void;
}) {
  if (at) {
    return (
      <div
        title={`${label} · ${fmtHora(at)}${por ? ` · ${por}` : ""}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-1"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold tabular-nums">{fmtHora(at)}</span>
        {onUndo && (
          <button
            onClick={onUndo}
            className="ml-0.5 text-muted-foreground hover:text-destructive transition"
            title="Desfazer (admin)"
          >
            <Undo2 className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }
  return (
    <Button
      size="sm"
      variant={disabled ? "ghost" : "outline"}
      disabled={disabled || pending}
      onClick={onClick}
      className="h-7 px-2 text-[11px] font-semibold"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Icon className="h-3.5 w-3.5 mr-1" />}
      {label}
    </Button>
  );
}