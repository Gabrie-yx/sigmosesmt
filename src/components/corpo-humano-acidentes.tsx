import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import corpoFrente from "@/assets/corpo-humano-frente.png";
import corpoCostas from "@/assets/corpo-humano-costas.png";

type Acid = { parte_corpo_atingida?: string | null; tipo?: string };

/**
 * Posições normalizadas (0–1) de cada parte do corpo sobre a imagem.
 * x = horizontal (0 esquerda, 1 direita)  /  y = vertical (0 topo, 1 base)
 * side  = onde renderizar o label (left ou right)
 * view  = em qual figura (frente ou costas) o marcador aparece
 */
type Pos = {
  x: number;
  y: number;
  side: "left" | "right";
  short: string;
  view: "frente" | "costas";
};

const POSICOES: Record<string, Pos> = {
  // ====== FRENTE ======
  "Cabeça":          { x: 0.50, y: 0.07, side: "right", short: "CRÂNIO",   view: "frente" },
  "Olho direito":    { x: 0.47, y: 0.09, side: "left",  short: "OLHO D",   view: "frente" },
  "Olho esquerdo":   { x: 0.53, y: 0.09, side: "right", short: "OLHO E",   view: "frente" },
  "Face":            { x: 0.50, y: 0.11, side: "right", short: "FACE",     view: "frente" },
  "Tórax":           { x: 0.50, y: 0.24, side: "right", short: "TÓRAX",    view: "frente" },
  "Abdômen":         { x: 0.50, y: 0.34, side: "right", short: "ABDÔMEN",  view: "frente" },
  "Quadril":         { x: 0.50, y: 0.44, side: "right", short: "QUADRIL",  view: "frente" },
  "Mão direita":     { x: 0.28, y: 0.56, side: "left",  short: "MÃO D",    view: "frente" },
  "Mão esquerda":    { x: 0.72, y: 0.56, side: "right", short: "MÃO E",    view: "frente" },
  "Dedos da mão":          { x: 0.21, y: 0.585, side: "left",  short: "DEDOS MÃO",   view: "frente" },
  "Dedos da mão direita":  { x: 0.21, y: 0.585, side: "left",  short: "DEDOS MÃO D", view: "frente" },
  "Dedos da mão esquerda": { x: 0.79, y: 0.585, side: "right", short: "DEDOS MÃO E", view: "frente" },
  "Joelho direito":  { x: 0.46, y: 0.72, side: "left",  short: "JOELHO D", view: "frente" },
  "Joelho esquerdo": { x: 0.54, y: 0.72, side: "right", short: "JOELHO E", view: "frente" },
  "Pé direito":      { x: 0.46, y: 0.95, side: "left",  short: "PÉ D",     view: "frente" },
  "Pé esquerdo":     { x: 0.54, y: 0.95, side: "right", short: "PÉ E",     view: "frente" },
  "Dedos do pé":          { x: 0.50, y: 0.98, side: "right", short: "DEDOS PÉ",   view: "frente" },
  "Dedos do pé direito":  { x: 0.46, y: 0.98, side: "left",  short: "DEDOS PÉ D", view: "frente" },
  "Dedos do pé esquerdo": { x: 0.54, y: 0.98, side: "right", short: "DEDOS PÉ E", view: "frente" },
  "Múltiplas":       { x: 0.50, y: 0.36, side: "right", short: "MÚLTIPLAS", view: "frente" },

  // ====== COSTAS ======
  "Pescoço":         { x: 0.50, y: 0.12, side: "left",  short: "PESCOÇO",  view: "costas" },
  "Ombro direito":   { x: 0.36, y: 0.205, side: "left",  short: "OMBRO D",  view: "costas" },
  "Ombro esquerdo":  { x: 0.64, y: 0.205, side: "right", short: "OMBRO E",  view: "costas" },
  "Braço direito":   { x: 0.30, y: 0.32, side: "left",  short: "BRAÇO D",  view: "costas" },
  "Braço esquerdo":  { x: 0.70, y: 0.32, side: "right", short: "BRAÇO E",  view: "costas" },
  "Coluna":          { x: 0.50, y: 0.30, side: "right", short: "COLUNA",   view: "costas" },
  "Coxa direita":    { x: 0.45, y: 0.58, side: "left",  short: "COXA D",   view: "costas" },
  "Coxa esquerda":   { x: 0.55, y: 0.58, side: "right", short: "COXA E",   view: "costas" },
  "Perna direita":   { x: 0.45, y: 0.80, side: "left",  short: "PERNA D",  view: "costas" },
  "Perna esquerda":  { x: 0.55, y: 0.80, side: "right", short: "PERNA E",  view: "costas" },
};

/** Cor sólida da bolha conforme intensidade (0–1): amarelo → laranja → vermelho */
function bubbleSolid(intensity: number) {
  if (intensity < 0.25) return "#facc15"; // amarelo
  if (intensity < 0.5)  return "#fb923c"; // laranja claro
  if (intensity < 0.75) return "#f97316"; // laranja
  return "#ef4444";                        // vermelho
}

export function CorpoHumanoAcidentes({ acidentes }: { acidentes: Acid[] }) {
  const { contagens, total, max } = useMemo(() => {
    const c: Record<string, number> = {};
    let t = 0;
    acidentes.forEach((a) => {
      const p = a.parte_corpo_atingida;
      if (!p) return;
      c[p] = (c[p] || 0) + 1;
      t += 1;
    });
    const m = Math.max(1, ...Object.values(c));
    return { contagens: c, total: t, max: m };
  }, [acidentes]);

  const partesComDados = Object.entries(contagens)
    .filter(([k]) => POSICOES[k])
    .sort((a, b) => b[1] - a[1]);

  const partesFrente = partesComDados.filter(([k]) => POSICOES[k].view === "frente");
  const partesCostas = partesComDados.filter(([k]) => POSICOES[k].view === "costas");

  const renderFigure = (
    label: string,
    src: string,
    parts: [string, number][],
  ) => (
    <div className="flex flex-col items-center">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="relative w-full px-8" style={{ maxWidth: 320 }}>
        <div className="relative mx-auto w-full" style={{ aspectRatio: "3 / 4" }}>
          <img
            src={src}
            alt={`Diagrama do corpo humano — ${label}`}
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
          />
          {parts.map(([parte, qtd]) => {
            const pos = POSICOES[parte];
            if (!pos) return null;
            const intensity = qtd / max;
            const pct = Math.round((qtd / total) * 100);
            const size = 8 + intensity * 8; // 8–16 px (marcador preciso)
            const color = bubbleSolid(intensity);
            return (
              <div key={parte}>
                <div
                  className="absolute rounded-full pointer-events-none ring-1 ring-white shadow-sm"
                  style={{
                    left: `${pos.x * 100}%`,
                    top: `${pos.y * 100}%`,
                    width: size,
                    height: size,
                    transform: "translate(-50%, -50%)",
                    background: color,
                    opacity: 0.95,
                  }}
                  title={`${parte}: ${qtd} (${pct}%)`}
                />
                <div
                  className="absolute pointer-events-none select-none"
                  style={{
                    left:
                      pos.side === "left"
                        ? `${pos.x * 100 - 3}%`
                        : `${pos.x * 100 + 3}%`,
                    top: `${pos.y * 100}%`,
                    transform: `translate(${pos.side === "left" ? "-100%" : "0"}, -50%)`,
                    textAlign: pos.side === "left" ? "right" : "left",
                  }}
                >
                  <div className="text-[9px] font-bold text-slate-800 leading-tight whitespace-nowrap">
                    {pos.short}
                  </div>
                  <div className="text-[9px] font-semibold text-slate-500 leading-tight">
                    {pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Parte do Corpo Atingida</span>
          <span className="text-xs font-normal text-muted-foreground">
            {total} {total === 1 ? "ocorrência" : "ocorrências"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Duas figuras lado a lado: frente + costas */}
          <div className="grid grid-cols-2 gap-2 relative">
            {renderFigure("Frente", corpoFrente, partesFrente)}
            {renderFigure("Costas", corpoCostas, partesCostas)}
            {total === 0 && (
              <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
                <span className="text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
                  Sem ocorrências identificadas
                </span>
              </div>
            )}
          </div>

          {/* Ranking compacto em 2 colunas (preenche o espaço inferior) */}
          <div className="border-t pt-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Ranking das partes atingidas
            </div>
            {partesComDados.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                Nenhuma parte do corpo identificada ainda.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {partesComDados.slice(0, 10).map(([parte, qtd]) => {
                  const pct = Math.round((qtd / total) * 100);
                  const intensity = qtd / max;
                  return (
                    <div key={parte} className="flex items-center justify-between text-sm gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ background: bubbleSolid(intensity) }}
                        />
                        <span className="text-slate-700 truncate text-xs">{parte}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 text-xs whitespace-nowrap">
                        {qtd} <span className="text-muted-foreground font-normal">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}