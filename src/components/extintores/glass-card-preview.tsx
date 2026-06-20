import { Flame } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Preview de card "vidro escuro" para os extintores.
 * Painel de vidro fumê com borda cromada brilhante e reflexo diagonal.
 */
export function ExtintorGlassCardPreview() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="bg-black p-10 rounded-3xl flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir extintor 005974"
          className="relative w-[360px] aspect-[3/2] group cursor-pointer focus:outline-none"
        >
          {/* Halo externo — brilho cromado em volta */}
          <div
            className="pointer-events-none absolute -inset-3 rounded-[34px] opacity-90 blur-xl"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, transparent 70%)",
            }}
          />

          {/* Borda cromada (gradient ring) */}
          <div
            className="absolute inset-0 rounded-[26px] p-[1.5px]"
            style={{
              background:
                "linear-gradient(135deg, #ffffff 0%, #b8b8b8 25%, #5a5a5a 50%, #d8d8d8 75%, #ffffff 100%)",
              boxShadow:
                "0 0 24px rgba(255,255,255,0.35), 0 0 60px rgba(255,255,255,0.15)",
            }}
          >
            {/* Vidro escuro */}
            <div
              className="relative w-full h-full rounded-[24px] overflow-hidden"
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
              {/* Reflexo diagonal (lower-left → upper-right) */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(45deg, transparent 35%, rgba(255,255,255,0.10) 48%, rgba(255,255,255,0.22) 52%, rgba(255,255,255,0.06) 58%, transparent 70%)",
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

              {/* Conteúdo */}
              <div className="relative z-10 h-full p-5 flex flex-col justify-between text-white text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                      Extintor
                    </div>
                    <div className="font-mono text-3xl font-black tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      005974
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/25 bg-white/5 backdrop-blur-sm">
                    <Flame className="h-3 w-3 text-red-400" />
                    <span className="text-[10px] font-bold tracking-wider text-white/85">
                      ABC 6KG
                    </span>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">
                      Local no Pátio
                    </div>
                    <div className="text-sm font-semibold text-white/90 truncate">
                      Galpão 2 · Pilar B3
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">
                      Próx. recarga
                    </div>
                    <div className="text-sm font-bold tabular-nums text-emerald-300/90">
                      30/04/2027
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              Extintor 005974
            </DialogTitle>
            <DialogDescription>
              Preview — todos os campos serão editáveis na versão final.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Nº Cilindro" value="005974" />
            <Field label="Selo INMETRO" value="—" />
            <Field label="Tipo / Capacidade" value="ABC 6KG" />
            <Field label="Última recarga" value="30/04/2026" />
            <Field label="Próxima recarga" value="30/04/2027" />
            <Field label="Teste hidrostático" value="30/04/2028" />
            <Field label="Empresa" value="Norte Extintores / Rimatec" />
            <Field label="Local no Pátio" value="Galpão 2 · Pilar B3" />
          </div>
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
