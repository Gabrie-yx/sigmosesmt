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
import { Clock3, CheckCircle2, LogIn, LogOut, Users, Undo2, Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

function fmtHora(iso?: string | null) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
      return c.is_sabado
        ? !!f.entrada_confirmada_at && !!f.saida_confirmada_at
        : !!f.permanencia_confirmada_at && !!f.saida_confirmada_at;
    }).length;
    return { total, validados };
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
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Portaria valida</p>
            <h2 className="font-bold text-base leading-tight truncate">Hora Extra Hoje</h2>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Validados</p>
          <p className="font-bold text-lg text-foreground">{totais.validados}<span className="text-muted-foreground text-sm">/{totais.total}</span></p>
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
      <div className="divide-y divide-border">
        {data.map((conv) => (
          <ConvocacaoBloco
            key={conv.id}
            conv={conv}
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

function ConvocacaoBloco({
  conv, isAdmin, onConfirm, onUndo, pendingId,
}: {
  conv: HoraExtraHojeConvocacao;
  isAdmin: boolean;
  onConfirm: (f: HoraExtraHojeFuncionario, tipo: "permanencia" | "entrada" | "saida") => void;
  onUndo: (f: HoraExtraHojeFuncionario, tipo: "permanencia" | "entrada" | "saida") => void;
  pendingId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const label = conv.is_sabado ? "Sábado" : "Dia útil";
  const modulo = conv.modulo_origem ? ` · ${conv.modulo_origem.toUpperCase()}` : "";
  const setor = conv.setor ? ` · ${conv.setor}` : "";
  const previsto = conv.horario_inicio && conv.horario_fim
    ? `${conv.horario_inicio.slice(0, 5)}–${conv.horario_fim.slice(0, 5)}`
    : conv.horario_fim ? `até ${conv.horario_fim.slice(0, 5)}` : "";

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition text-left"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}{modulo}{setor}</p>
          <p className="text-sm font-semibold truncate">
            {conv.company_name ?? "—"} <span className="text-muted-foreground font-normal">· {conv.funcionarios.length} pessoa(s){previsto ? ` · ${previsto}` : ""}</span>
          </p>
        </div>
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {expanded && (
        <ul className="divide-y divide-border border-t border-border">
          {conv.funcionarios.map((f) => (
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
      )}
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

  return (
    <li className="px-3 lg:px-4 py-2.5 flex items-center gap-3">
      <div className="shrink-0">
        {f.foto_url ? (
          <img src={f.foto_url} className="h-9 w-9 rounded-full object-cover object-center border border-border bg-muted" alt="" loading="lazy" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground font-bold text-[11px] flex items-center justify-center border border-border">{iniciais}</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{f.nome}{f.externo && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">externo</span>}</p>
        {f.funcao && <p className="text-[11px] text-muted-foreground truncate">{f.funcao}</p>}
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