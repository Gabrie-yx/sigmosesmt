import {
  Flame,
  ClipboardCheck,
  Camera,
  ClipboardEdit,
  Ban,
  Pencil,
  Trash2,
  History,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/utils-date";

export interface ExtintorGlassCardProps {
  extintor: any;
  totalInspecoes?: number;
  podeExcluir?: boolean;
  indisponivel?: boolean;
  onInspecaoFoto: () => void;
  onInspecaoManual: () => void;
  onHistorico: () => void;
  onEditar: () => void;
  onExcluir?: () => void;
}

/**
 * Card "vidro escuro" — padrão visual oficial dos extintores.
 * Painel de vidro fumê com borda cromada (vermelha quando indisponível).
 */
export function ExtintorGlassCard({
  extintor: e,
  totalInspecoes = 0,
  podeExcluir = false,
  indisponivel = false,
  onInspecaoFoto,
  onInspecaoManual,
  onHistorico,
  onEditar,
  onExcluir,
}: ExtintorGlassCardProps) {
  const [open, setOpen] = useState(false);

  const numero = e?.numero ?? "—";
  const tipo = e?.tipo_agente
    ? `${e.tipo_agente}${e.carga_nominal ? ` ${e.carga_nominal}${e.carga_unidade || "KG"}` : ""}`
    : "—";
  const local =
    [e?.area, e?.localizacao].filter(Boolean).join(" · ") || "—";
  const proxRecarga = e?.proxima_recarga ? formatDateBR(e.proxima_recarga) : "—";
  const hojeISO = new Date().toISOString().slice(0, 10);
  const vencido = !!e?.proxima_recarga && e.proxima_recarga < hojeISO;

  return (
    <>
      <div className="w-full">
        <div
          aria-label={`Extintor ${numero}`}
          className="relative w-full group focus:outline-none"
        >
          {/* Halo externo — cromado padrão OU vermelho pulsante quando bloqueado */}
          <div
            className={`pointer-events-none absolute -inset-3 rounded-[34px] blur-xl ${
              indisponivel ? "animate-pulse opacity-100" : "opacity-90"
            }`}
            style={{
              background: indisponivel
                ? "radial-gradient(60% 50% at 50% 50%, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.35) 40%, transparent 75%)"
                : "radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, transparent 70%)",
            }}
          />

          {/* Borda — cromada OU vermelha quando bloqueado */}
          <div
            className="relative rounded-[26px] p-[1.5px]"
            style={{
              background: indisponivel
                ? "linear-gradient(135deg, #ff6b6b 0%, #ef4444 25%, #b91c1c 50%, #ef4444 75%, #ff6b6b 100%)"
                : "linear-gradient(135deg, #ffffff 0%, #b8b8b8 25%, #5a5a5a 50%, #d8d8d8 75%, #ffffff 100%)",
              boxShadow: indisponivel
                ? "0 0 32px rgba(239,68,68,0.7), 0 0 80px rgba(239,68,68,0.4)"
                : "0 0 24px rgba(255,255,255,0.35), 0 0 60px rgba(255,255,255,0.15)",
            }}
          >
            {/* Vidro escuro */}
            <div
              className="relative w-full rounded-[24px] overflow-hidden"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 0%, #2a2a2a 0%, #161616 40%, #050505 100%)",
              }}
            >
              {/* Highlight superior (curva de luz) */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(140% 55% at 50% -25%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 35%, transparent 60%)",
                }}
              />
              {/* Vinheta inferior */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(90% 70% at 50% 120%, rgba(0,0,0,0.85) 0%, transparent 60%)",
                }}
              />

              {/* Banner pulsante INDISPONÍVEL */}
              {indisponivel && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 animate-pulse">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-red-400 bg-red-600/90 shadow-[0_0_18px_rgba(239,68,68,0.9)]">
                    <Ban className="h-3 w-3 text-white" />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">
                      Indisponível para Uso
                    </span>
                  </div>
                </div>
              )}

              {/* Conteúdo */}
              <div className="relative z-10 h-full p-5 flex flex-col gap-4 text-white text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                      Extintor
                    </div>
                    <div className="font-mono text-3xl font-black tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      {numero}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-red-300/60"
                    style={{
                      background:
                        "linear-gradient(180deg, #ff6b6b 0%, #ef4444 45%, #b91c1c 100%)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.4), 0 0 14px rgba(239,68,68,0.35)",
                    }}
                  >
                    <Flame className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                    <span className="text-[12px] font-black uppercase tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                      {tipo}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mt-auto">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-1">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">
                      Local no Pátio
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.18em] text-white/40 text-right">
                      Próx. recarga
                    </div>
                    <div
                      className="min-w-0 text-sm font-semibold text-white/90 truncate"
                      title={local}
                    >
                      {local}
                    </div>
                    <div
                      className={`text-sm font-bold tabular-nums text-right shrink-0 ${
                        vencido ? "text-red-400" : "text-emerald-300/90"
                      }`}
                    >
                      {proxRecarga}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] backdrop-blur-sm py-2 text-xs font-semibold tracking-wide text-white/90 transition"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Inspeção
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      className="w-56"
                    >
                      <DropdownMenuLabel className="text-xs">
                        Escolha o tipo
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onInspecaoFoto()}>
                        <Camera className="h-4 w-4 mr-2 text-red-500" />
                        <div className="flex flex-col">
                          <span className="text-sm">Inspeção por Foto</span>
                          <span className="text-[10px] text-muted-foreground">
                            IA analisa + cruza com cadastro
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onInspecaoManual()}>
                        <ClipboardEdit className="h-4 w-4 mr-2 text-blue-500" />
                        <div className="flex flex-col">
                          <span className="text-sm">Inspeção Manual</span>
                          <span className="text-[10px] text-muted-foreground">
                            Checklist preenchido em tela
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Barra de ações integrada ao card */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={onHistorico}
                      title="Ver todas as inspeções deste extintor"
                      className="flex-1 h-8 inline-flex items-center justify-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-200 hover:text-cyan-100 text-[11px] font-bold transition"
                    >
                      <History className="h-3.5 w-3.5" />
                      Histórico
                      {totalInspecoes > 0 && (
                        <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black tabular-nums">
                          {totalInspecoes}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(true)}
                      title="Ver detalhes do cadastro"
                      className="h-8 px-2 inline-flex items-center justify-center gap-1 rounded-md border border-white/15 bg-white/[0.04] hover:bg-white/[0.10] text-white/80 text-[11px] font-semibold transition"
                    >
                      Detalhes
                    </button>
                    <button
                      type="button"
                      onClick={onEditar}
                      title="Editar cadastro"
                      className="h-8 px-2 inline-flex items-center justify-center gap-1 rounded-md border border-white/15 bg-white/[0.04] hover:bg-white/[0.10] text-white/80 text-[11px] font-semibold transition"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={onExcluir}
                        title="Excluir extintor"
                        className="h-8 px-2 inline-flex items-center justify-center gap-1 rounded-md border border-red-500/30 bg-red-950/30 hover:bg-red-900/50 text-red-300 hover:text-red-200 text-[11px] font-semibold transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              Extintor {numero}
              {indisponivel && (
                <Badge className="ml-2 bg-red-600 text-white animate-pulse">
                  <Ban className="h-3 w-3 mr-1" /> Indisponível
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Detalhes do cadastro do cilindro.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Nº Cilindro" value={numero} />
            <Field label="Selo INMETRO" value={e?.selo_inmetro || "—"} />
            <Field label="Tipo / Capacidade" value={tipo} />
            <Field
              label="Última recarga"
              value={e?.data_ultima_recarga ? formatDateBR(e.data_ultima_recarga) : "—"}
            />
            <Field label="Próxima recarga" value={proxRecarga} />
            <Field
              label="Teste hidrostático"
              value={e?.proximo_teste_hidrostatico ? String(e.proximo_teste_hidrostatico) : "—"}
            />
            <Field label="Empresa" value={e?.empresa_responsavel || "—"} />
            <Field label="Local no Pátio" value={local} />
          </div>
          <DialogFooter className="gap-2 sm:justify-end border-t pt-3 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setOpen(false);
                onEditar();
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Editar cadastro
            </Button>
            {podeExcluir && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-600 hover:text-red-700"
                onClick={() => {
                  setOpen(false);
                  onExcluir?.();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
