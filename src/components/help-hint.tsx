// Balãozinho de ajuda reutilizável. Uso:
//   <HelpHint topic="mfa" />                          // ícone "?" padrão
//   <HelpHint topic="aso" side="right" />             // controle de lado
//   <HelpHint topic="ppp"><span>saiba mais</span></HelpHint>  // trigger custom
import { Link } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getHelp } from "@/lib/help-content";
import { cn } from "@/lib/utils";

type Props = {
  topic: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  children?: React.ReactNode;
  /** Se true, esconde o link "Abrir na Central de Ajuda". */
  hideCentralLink?: boolean;
};

export function HelpHint({
  topic,
  side = "bottom",
  align = "start",
  className,
  children,
  hideCentralLink,
}: Props) {
  const t = getHelp(topic);
  if (!t) {
    if (import.meta.env.DEV) {
      console.warn(`[HelpHint] tópico não encontrado: "${topic}"`);
    }
    return null;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children ? (
          <button type="button" aria-label={t.title} className={cn("inline-flex items-center", className)}>
            {children}
          </button>
        ) : (
          <button
            type="button"
            aria-label={t.title}
            title={t.title}
            className={cn(
              "inline-flex items-center justify-center rounded-full hover:bg-black/5 p-0.5 shrink-0",
              className,
            )}
          >
            <HelpCircle className="h-4 w-4 opacity-70" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-80 text-xs leading-relaxed">
        <p className="font-semibold text-sm mb-1">{t.title}</p>
        <p className="mb-2 text-foreground/90">{t.oQueE}</p>
        {t.comoUsar && t.comoUsar.length > 0 && (
          <>
            <p className="font-semibold mb-1">Como usar:</p>
            <ol className="list-decimal pl-4 space-y-0.5 mb-2">
              {t.comoUsar.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </>
        )}
        {t.dicas && t.dicas.length > 0 && (
          <>
            <p className="font-semibold mb-1">Dicas:</p>
            <ul className="list-disc pl-4 space-y-0.5 mb-2 text-foreground/85">
              {t.dicas.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </>
        )}
        {t.base && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Base: {t.base}
          </p>
        )}
        {!hideCentralLink && (
          <div className="flex items-center justify-between pt-2 border-t border-black/5">
            <Link
              to="/app/ajuda"
              search={{ q: t.id }}
              className="text-[11px] font-semibold underline underline-offset-2 text-rose-700 hover:text-rose-800"
            >
              Abrir na Central de Ajuda
            </Link>
            {t.rota && (
              <Link
                to={t.rota as any}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Ir para tela →
              </Link>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}