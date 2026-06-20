import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles, ClipboardEdit, History, Pencil, CheckCircle2 } from "lucide-react";

export type PendenciaTipo =
  | "mes"
  | "recarga"
  | "nao_conforme"
  | "precisa_revisao"
  | "hidrostatico"
  | "divergencia";

export type Pendencia = {
  tipo: PendenciaTipo;
  label: string;
};

function actionForTipo(tipo: PendenciaTipo): { label: string; key: "foto" | "manual" | "cadastro" | "historico" } {
  switch (tipo) {
    case "mes":
      return { label: "Inspecionar", key: "foto" };
    case "nao_conforme":
    case "precisa_revisao":
      return { label: "Registrar correção", key: "manual" };
    case "recarga":
    case "hidrostatico":
    case "divergencia":
      return { label: "Atualizar cadastro", key: "cadastro" };
    default:
      return { label: "Abrir", key: "historico" };
  }
}

export function PendenciasPopover({
  pendencias,
  onInspecionarFoto,
  onInspecionarManual,
  onAbrirHistorico,
  onEditarCadastro,
}: {
  pendencias: Pendencia[];
  onInspecionarFoto: () => void;
  onInspecionarManual: () => void;
  onAbrirHistorico: () => void;
  onEditarCadastro: () => void;
}) {
  const temCritica = pendencias.some((p) => p.tipo === "recarga" || p.tipo === "nao_conforme" || p.tipo === "hidrostatico");
  const tone = pendencias.length === 0
    ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
    : temCritica
      ? "border-red-500/40 bg-red-950/40 text-red-200 hover:bg-red-950/60"
      : "border-amber-500/40 bg-amber-950/40 text-amber-200 hover:bg-amber-950/60";

  if (pendencias.length === 0) {
    return (
      <div className={`rounded-md border ${tone} px-2 py-1.5 text-[10px] leading-snug`}>
        <div className="flex items-center gap-1 font-black uppercase tracking-wider text-[9px]">
          <CheckCircle2 className="h-3 w-3" /> Tudo em ordem
        </div>
        <div className="opacity-80 mt-0.5">Sem ações pendentes este mês.</div>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full rounded-md border ${tone} px-2 py-1.5 text-[10px] leading-snug text-left transition-colors cursor-pointer`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 font-black uppercase tracking-wider text-[9px] opacity-90">
              <AlertTriangle className="h-3 w-3" /> {pendencias.length} pendência{pendencias.length > 1 ? "s" : ""}
            </div>
            <span className="text-[9px] opacity-70 underline-offset-2 underline">resolver →</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 mt-0.5">
            {pendencias.slice(0, 2).map((p, i) => (
              <li key={i} className="truncate" title={p.label}>{p.label}</li>
            ))}
            {pendencias.length > 2 && (
              <li className="text-[9px] opacity-70">+ {pendencias.length - 2} outras…</li>
            )}
          </ul>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-3 space-y-3 border-slate-700 bg-slate-950/95 backdrop-blur text-slate-100"
      >
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
            Pendências deste extintor
          </div>
          <ul className="space-y-2">
            {pendencias.map((p, i) => {
              const act = actionForTipo(p.tipo);
              const critica = p.tipo === "recarga" || p.tipo === "nao_conforme" || p.tipo === "hidrostatico";
              const handler =
                act.key === "foto" ? onInspecionarFoto
                : act.key === "manual" ? onInspecionarManual
                : act.key === "cadastro" ? onEditarCadastro
                : onAbrirHistorico;
              const Icon =
                act.key === "foto" ? Sparkles
                : act.key === "manual" ? ClipboardEdit
                : act.key === "cadastro" ? Pencil
                : History;
              return (
                <li key={i} className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <div className="flex items-start gap-2 text-xs">
                    <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${critica ? "text-red-400" : "text-amber-300"}`} />
                    <span className="leading-snug flex-1">{p.label}</span>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handler}
                      className="h-7 gap-1 text-[10px] border-slate-600 text-slate-100 hover:bg-slate-800"
                    >
                      <Icon className="h-3 w-3" /> {act.label}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="border-t border-slate-700 pt-2 flex justify-end">
          <button
            type="button"
            onClick={onAbrirHistorico}
            className="text-[10px] text-slate-400 hover:text-slate-200 underline underline-offset-2"
          >
            Ver histórico completo
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}