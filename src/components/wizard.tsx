import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  /** Return true if the step is valid and user can advance. */
  isValid?: () => boolean;
  /** Optional message shown when isValid returns false. */
  invalidMessage?: string;
};

type WizardProps = {
  steps: WizardStep[];
  onComplete: () => void;
  isSubmitting?: boolean;
  completeLabel?: string;
  onCancel?: () => void;
};

export function Wizard({ steps, onComplete, isSubmitting, completeLabel = "Concluir", onCancel }: WizardProps) {
  const [current, setCurrent] = useState(0);
  const [showError, setShowError] = useState(false);
  const step = steps[current];
  const isLast = current === steps.length - 1;
  const isFirst = current === 0;

  const tryNext = () => {
    if (step.isValid && !step.isValid()) {
      setShowError(true);
      return;
    }
    setShowError(false);
    if (isLast) onComplete();
    else setCurrent((c) => c + 1);
  };

  const back = () => {
    setShowError(false);
    setCurrent((c) => Math.max(0, c - 1));
  };

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-colors",
                  done && "bg-emerald-600 text-white",
                  active && "bg-[#7B1E2B] text-white ring-4 ring-[#7B1E2B]/15",
                  !done && !active && "bg-slate-200 text-slate-500",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-1", i < current ? "bg-emerald-600" : "bg-slate-200")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Title */}
      <div className="pb-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Passo {current + 1} de {steps.length}
        </p>
        <h3 className="text-lg font-black text-slate-900 mt-0.5">{step.title}</h3>
        {step.description && <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>}
      </div>

      {/* Step content */}
      <div className="min-h-[200px]">{step.content}</div>

      {showError && step.invalidMessage && (
        <p className="text-xs font-semibold text-rose-600">{step.invalidMessage}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div>
          {!isFirst ? (
            <Button type="button" variant="outline" onClick={back} disabled={isSubmitting}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          ) : onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          ) : <span />}
        </div>
        <Button
          type="button"
          onClick={tryNext}
          disabled={isSubmitting}
          className="bg-[#0f172a] hover:bg-[#7B1E2B] text-white font-black uppercase tracking-widest text-[11px]"
        >
          {isLast ? completeLabel : (<>Avançar <ChevronRight className="h-4 w-4 ml-1" /></>)}
        </Button>
      </div>
    </div>
  );
}