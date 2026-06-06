import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import corpoFrente from "@/assets/corpo-humano-frente.png";

type Acid = { parte_corpo_atingida?: string | null; tipo?: string };

/**
 * Posições normalizadas (0–1) de cada parte do corpo sobre a imagem.
 * x = horizontal (0 esquerda, 1 direita)  /  y = vertical (0 topo, 1 base)
 * side = onde renderizar o label (left ou right)
 */
type Pos = { x: number; y: number; side: "left" | "right"; short: string };

const POSICOES: Record<string, Pos> = {
  "Cabeça":          { x: 0.50, y: 0.085, side: "left",  short: "CRÂNIO" },
  "Olho direito":    { x: 0.47, y: 0.105, side: "left",  short: "OLHO D" },
  "Olho esquerdo":   { x: 0.53, y: 0.105, side: "right", short: "OLHO E" },
  "Face":            { x: 0.50, y: 0.135, side: "right", short: "FACE" },
  "Pescoço":         { x: 0.50, y: 0.18,  side: "left",  short: "PESCOÇO" },
  "Ombro direito":   { x: 0.38, y: 0.23,  side: "left",  short: "OMBRO D" },
  "Ombro esquerdo":  { x: 0.62, y: 0.23,  side: "right", short: "OMBRO E" },
  "Tórax":           { x: 0.50, y: 0.30,  side: "right", short: "TÓRAX" },
  "Abdômen":         { x: 0.50, y: 0.41,  side: "left",  short: "ABDÔMEN" },
  "Coluna":          { x: 0.50, y: 0.36,  side: "right", short: "REG. LOMBAR" },
  "Quadril":         { x: 0.50, y: 0.50,  side: "right", short: "QUADRIL" },
  "Braço direito":   { x: 0.30, y: 0.36,  side: "left",  short: "BRAÇO D" },
  "Braço esquerdo":  { x: 0.70, y: 0.36,  side: "right", short: "BRAÇO E" },
  "Mão direita":     { x: 0.22, y: 0.54,  side: "left",  short: "MÃO D" },
  "Mão esquerda":    { x: 0.78, y: 0.54,  side: "right", short: "MÃO E" },
  "Dedos da mão":          { x: 0.20, y: 0.585, side: "left",  short: "DEDOS MÃO" }, // legado
  "Dedos da mão direita":  { x: 0.20, y: 0.585, side: "left",  short: "DEDOS MÃO D" },
  "Dedos da mão esquerda": { x: 0.80, y: 0.585, side: "right", short: "DEDOS MÃO E" },
  "Coxa direita":    { x: 0.43, y: 0.60,  side: "left",  short: "COXA D" },
  "Coxa esquerda":   { x: 0.57, y: 0.60,  side: "right", short: "COXA E" },
  "Joelho direito":  { x: 0.43, y: 0.72,  side: "left",  short: "JOELHO D" },
  "Joelho esquerdo": { x: 0.57, y: 0.72,  side: "right", short: "JOELHO E" },
  "Perna direita":   { x: 0.43, y: 0.82,  side: "left",  short: "PERNA D" },
  "Perna esquerda":  { x: 0.57, y: 0.82,  side: "right", short: "PERNA E" },
  "Pé direito":      { x: 0.45, y: 0.955, side: "left",  short: "PÉ D" },
  "Pé esquerdo":     { x: 0.55, y: 0.955, side: "right", short: "PÉ E" },
  "Dedos do pé":          { x: 0.50, y: 0.985, side: "right", short: "DEDOS PÉ" }, // legado
  "Dedos do pé direito":  { x: 0.42, y: 0.985, side: "left",  short: "DEDOS PÉ D" },
  "Dedos do pé esquerdo": { x: 0.58, y: 0.985, side: "right", short: "DEDOS PÉ E" },
  "Múltiplas":       { x: 0.50, y: 0.50,  side: "right", short: "MÚLTIPLAS" },
};

/** Cor da bolha conforme intensidade (0–1): amarelo → laranja → vermelho */
function bubbleColor(intensity: number) {
  if (intensity < 0.25) return "rgba(250, 204, 21, 0.55)";   // amarelo
  if (intensity < 0.5)  return "rgba(251, 146, 60, 0.6)";    // laranja claro
  if (intensity < 0.75) return "rgba(249, 115, 22, 0.65)";   // laranja
  return "rgba(239, 68, 68, 0.7)";                            // vermelho
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
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
          {/* Bloco do corpo + bolhas/labels */}
          <div
            className="relative mx-auto"
            style={{ width: "100%", maxWidth: 320, aspectRatio: "3 / 4" }}
          >
            <img
              src={corpoFrente}
              alt="Diagrama do corpo humano"
              className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
              draggable={false}
            />

            {/* Bolhas + labels para cada parte com ocorrência */}
            {partesComDados.map(([parte, qtd]) => {
              const pos = POSICOES[parte];
              if (!pos) return null;
              const intensity = qtd / max;
              const pct = Math.round((qtd / total) * 100);
              const size = 28 + intensity * 42; // 28–70 px (mais compacto)

              return (
                <div key={parte}>
                  {/* Bolha centralizada no ponto */}
                  <div
                    className="absolute rounded-full pointer-events-none transition-all"
                    style={{
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      width: size,
                      height: size,
                      transform: "translate(-50%, -50%)",
                      background: `radial-gradient(circle, ${bubbleColor(intensity)} 0%, ${bubbleColor(intensity).replace(/[\d.]+\)$/, "0)")} 70%)`,
                      filter: "blur(0.5px)",
                    }}
                    title={`${parte}: ${qtd} (${pct}%)`}
                  />

                  {/* Label com seta sutil */}
                  <div
                    className="absolute pointer-events-none select-none"
                    style={{
                      left: pos.side === "left" ? `${pos.x * 100 - 14}%` : `${pos.x * 100 + 14}%`,
                      top: `${pos.y * 100}%`,
                      transform: `translate(${pos.side === "left" ? "-100%" : "0"}, -50%)`,
                      textAlign: pos.side === "left" ? "right" : "left",
                    }}
                  >
                    <div className="text-[10px] font-bold text-slate-800 leading-tight whitespace-nowrap">
                      {pos.short}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 leading-tight">
                      {pct}%
                    </div>
                  </div>
                </div>
              );
            })}
            {total === 0 && (
              <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
                <span className="text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
                  Sem ocorrências identificadas
                </span>
              </div>
            )}
          </div>

          {/* Ranking lateral */}
          <div className="w-full md:w-[220px] md:border-l md:pl-6 border-t md:border-t-0 pt-4 md:pt-0">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Ranking
              </div>
              {partesComDados.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  Nenhuma parte do corpo identificada ainda.
                </div>
              ) : (
              <div className="space-y-1.5">
                {partesComDados.slice(0, 10).map(([parte, qtd]) => {
                  const pct = Math.round((qtd / total) * 100);
                  const intensity = qtd / max;
                  return (
                    <div key={parte} className="flex items-center justify-between text-sm gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ background: bubbleColor(intensity).replace(/[\d.]+\)$/, "0.85)") }}
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