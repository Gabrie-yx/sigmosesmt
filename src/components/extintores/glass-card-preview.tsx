import { Flame } from "lucide-react";

/**
 * Preview de card "vidro escuro" para os extintores.
 * Visual: glassmorphism dark — highlight curvado no topo,
 * brilhos suaves nos cantos e borda translúcida.
 */
export function ExtintorGlassCardPreview() {
  return (
    <div className="bg-black p-10 rounded-3xl flex justify-center">
      <div className="relative w-[360px] aspect-[3/2] [perspective:1200px] group cursor-pointer">
        {/* Glow externo nos cantos */}
        <div className="pointer-events-none absolute -inset-[1px] rounded-[28px] opacity-90">
          <div className="absolute -top-2 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent blur-[2px]" />
          <div className="absolute -bottom-2 left-10 right-10 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent blur-[2px]" />
          <div className="absolute top-6 -left-2 bottom-6 w-px bg-gradient-to-b from-transparent via-white/40 to-transparent blur-[2px]" />
          <div className="absolute top-6 -right-2 bottom-6 w-px bg-gradient-to-b from-transparent via-white/40 to-transparent blur-[2px]" />
        </div>

        {/* Vidro */}
        <div
          className="relative w-full h-full rounded-[26px] border border-white/15 overflow-hidden
                     bg-gradient-to-br from-neutral-800/80 via-neutral-900/90 to-black
                     shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),inset_0_-1px_0_0_rgba(255,255,255,0.05),0_20px_60px_-20px_rgba(0,0,0,0.9)]
                     transition-transform duration-500 ease-out group-hover:[transform:rotateX(4deg)_rotateY(-4deg)]"
        >
          {/* Highlight curvado superior */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 60% at 50% -20%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 35%, transparent 60%)",
            }}
          />
          {/* Reflexo diagonal */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 30%, transparent 55%)",
            }}
          />
          {/* Sombra inferior interna */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "radial-gradient(80% 60% at 50% 120%, rgba(0,0,0,0.8) 0%, transparent 70%)",
            }}
          />

          {/* Conteúdo */}
          <div className="relative z-10 h-full p-5 flex flex-col justify-between text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                  Extintor
                </div>
                <div className="font-mono text-3xl font-black tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  005974
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm">
                <Flame className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-bold tracking-wider text-white/80">
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
    </div>
  );
}
