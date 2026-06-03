import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Acid = { parte_corpo_atingida?: string | null; tipo?: string };

// Mapeamento parte do corpo (banco) → id do SVG
const PARTE_TO_ID: Record<string, string[]> = {
  "Cabeça": ["cabeca"],
  "Olho direito": ["olho-d"],
  "Olho esquerdo": ["olho-e"],
  "Face": ["face"],
  "Pescoço": ["pescoco"],
  "Ombro direito": ["ombro-d", "ombro-d-back"],
  "Ombro esquerdo": ["ombro-e", "ombro-e-back"],
  "Tórax": ["torax"],
  "Abdômen": ["abdomen"],
  "Coluna": ["coluna"],
  "Braço direito": ["braco-d", "braco-d-back"],
  "Braço esquerdo": ["braco-e", "braco-e-back"],
  "Mão direita": ["mao-d", "mao-d-back"],
  "Mão esquerda": ["mao-e", "mao-e-back"],
  "Dedos da mão": ["mao-d", "mao-e", "mao-d-back", "mao-e-back"],
  "Quadril": ["quadril", "quadril-back"],
  "Coxa direita": ["coxa-d", "coxa-d-back"],
  "Coxa esquerda": ["coxa-e", "coxa-e-back"],
  "Joelho direito": ["joelho-d"],
  "Joelho esquerdo": ["joelho-e"],
  "Perna direita": ["perna-d", "perna-d-back"],
  "Perna esquerda": ["perna-e", "perna-e-back"],
  "Pé direito": ["pe-d", "pe-d-back"],
  "Pé esquerdo": ["pe-e", "pe-e-back"],
  "Dedos do pé": ["pe-d", "pe-e", "pe-d-back", "pe-e-back"],
  "Múltiplas": [],
};

function heatColor(intensity: number) {
  // 0..1 → verde-claro → amarelo → laranja → vermelho
  if (intensity <= 0) return "hsl(210, 20%, 92%)";
  if (intensity < 0.25) return "hsl(48, 95%, 75%)";
  if (intensity < 0.5) return "hsl(35, 92%, 60%)";
  if (intensity < 0.75) return "hsl(20, 90%, 55%)";
  return "hsl(0, 80%, 50%)";
}

export function CorpoHumanoAcidentes({ acidentes }: { acidentes: Acid[] }) {
  const [hover, setHover] = useState<string | null>(null);

  const { contagem, maxQtd } = useMemo(() => {
    const c: Record<string, number> = {};
    acidentes.forEach(a => {
      const parte = a.parte_corpo_atingida;
      if (!parte) return;
      c[parte] = (c[parte] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(c));
    return { contagem: c, maxQtd: max };
  }, [acidentes]);

  // mapa id-svg → {parte, qtd, intensity}
  const idMap = useMemo(() => {
    const m: Record<string, { parte: string; qtd: number; intensity: number }> = {};
    Object.entries(PARTE_TO_ID).forEach(([parte, ids]) => {
      const qtd = contagem[parte] || 0;
      const intensity = qtd / maxQtd;
      ids.forEach(id => {
        if (!m[id] || m[id].qtd < qtd) m[id] = { parte, qtd, intensity };
      });
    });
    return m;
  }, [contagem, maxQtd]);

  const fillOf = (id: string) => {
    const info = idMap[id];
    if (!info) return "hsl(210, 20%, 92%)";
    return heatColor(info.intensity);
  };

  const partesOrdenadas = useMemo(
    () => Object.entries(contagem).sort((a, b) => b[1] - a[1]),
    [contagem]
  );

  const totalMapeado = partesOrdenadas.reduce((s, [, q]) => s + q, 0);

  const handleClick = (id: string) => {
    const info = idMap[id];
    if (info) setHover(info.parte);
  };

  // Estilo comum dos shapes
  const shapeProps = (id: string) => ({
    onMouseEnter: () => setHover(idMap[id]?.parte || null),
    onClick: () => handleClick(id),
    style: { cursor: idMap[id] ? "pointer" : "default", transition: "filter 200ms" },
    stroke: "hsl(215, 25%, 35%)",
    strokeWidth: 0.8,
    fill: fillOf(id),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Mapa de lesões — corpo humano</span>
          <span className="text-xs font-normal text-muted-foreground">
            {totalMapeado} {totalMapeado === 1 ? "registro" : "registros"} mapeado(s)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-[1fr_240px] gap-6">
          {/* SVGs frente + costas */}
          <div className="flex justify-center gap-4">
            {/* ============ FRENTE ============ */}
            <div className="flex flex-col items-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Frente</div>
              <svg viewBox="0 0 100 220" className="w-32 md:w-40" onMouseLeave={() => setHover(null)}>
                {/* Cabeça */}
                <ellipse cx="50" cy="14" rx="11" ry="13" {...shapeProps("cabeca")} />
                {/* Olhos */}
                <ellipse cx="46" cy="12" rx="1.6" ry="1" {...shapeProps("olho-e")} />
                <ellipse cx="54" cy="12" rx="1.6" ry="1" {...shapeProps("olho-d")} />
                {/* Face (sobreposta levemente) */}
                <ellipse cx="50" cy="18" rx="6" ry="3" fillOpacity={0.001} {...shapeProps("face")} />
                {/* Pescoço */}
                <rect x="46" y="26" width="8" height="6" rx="2" {...shapeProps("pescoco")} />
                {/* Tórax */}
                <path d="M30 34 Q50 30 70 34 L68 70 Q50 75 32 70 Z" {...shapeProps("torax")} />
                {/* Abdômen */}
                <path d="M32 70 Q50 75 68 70 L66 95 Q50 100 34 95 Z" {...shapeProps("abdomen")} />
                {/* Quadril */}
                <path d="M34 95 Q50 100 66 95 L68 112 Q50 118 32 112 Z" {...shapeProps("quadril")} />
                {/* Ombros */}
                <ellipse cx="28" cy="38" rx="6" ry="5" {...shapeProps("ombro-e")} />
                <ellipse cx="72" cy="38" rx="6" ry="5" {...shapeProps("ombro-d")} />
                {/* Braços */}
                <path d="M22 40 L26 75 L21 78 L17 42 Z" {...shapeProps("braco-e")} />
                <path d="M78 40 L74 75 L79 78 L83 42 Z" {...shapeProps("braco-d")} />
                {/* Mãos */}
                <ellipse cx="20" cy="85" rx="4" ry="6" {...shapeProps("mao-e")} />
                <ellipse cx="80" cy="85" rx="4" ry="6" {...shapeProps("mao-d")} />
                {/* Coxas */}
                <path d="M34 114 L40 155 L48 155 L48 116 Z" {...shapeProps("coxa-e")} />
                <path d="M66 114 L60 155 L52 155 L52 116 Z" {...shapeProps("coxa-d")} />
                {/* Joelhos */}
                <ellipse cx="43" cy="160" rx="5" ry="4" {...shapeProps("joelho-e")} />
                <ellipse cx="57" cy="160" rx="5" ry="4" {...shapeProps("joelho-d")} />
                {/* Pernas */}
                <path d="M39 165 L41 200 L48 200 L47 165 Z" {...shapeProps("perna-e")} />
                <path d="M61 165 L59 200 L52 200 L53 165 Z" {...shapeProps("perna-d")} />
                {/* Pés */}
                <ellipse cx="42" cy="208" rx="5" ry="4" {...shapeProps("pe-e")} />
                <ellipse cx="58" cy="208" rx="5" ry="4" {...shapeProps("pe-d")} />
              </svg>
            </div>

            {/* ============ COSTAS ============ */}
            <div className="flex flex-col items-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Costas</div>
              <svg viewBox="0 0 100 220" className="w-32 md:w-40" onMouseLeave={() => setHover(null)}>
                {/* Cabeça (parte de trás) */}
                <ellipse cx="50" cy="14" rx="11" ry="13" {...shapeProps("cabeca")} />
                {/* Pescoço */}
                <rect x="46" y="26" width="8" height="6" rx="2" {...shapeProps("pescoco")} />
                {/* Tórax/dorso (com coluna no meio) */}
                <path d="M30 34 Q50 30 70 34 L68 70 Q50 75 32 70 Z" {...shapeProps("torax")} />
                {/* Coluna */}
                <rect x="48.5" y="34" width="3" height="65" rx="1" {...shapeProps("coluna")} />
                {/* Abdômen (lombar) */}
                <path d="M32 70 Q50 75 68 70 L66 95 Q50 100 34 95 Z" fillOpacity={0.99} {...shapeProps("abdomen")} />
                {/* Quadril costas */}
                <path d="M34 95 Q50 100 66 95 L68 112 Q50 118 32 112 Z" {...shapeProps("quadril-back")} />
                {/* Ombros */}
                <ellipse cx="28" cy="38" rx="6" ry="5" {...shapeProps("ombro-e-back")} />
                <ellipse cx="72" cy="38" rx="6" ry="5" {...shapeProps("ombro-d-back")} />
                {/* Braços */}
                <path d="M22 40 L26 75 L21 78 L17 42 Z" {...shapeProps("braco-e-back")} />
                <path d="M78 40 L74 75 L79 78 L83 42 Z" {...shapeProps("braco-d-back")} />
                {/* Mãos */}
                <ellipse cx="20" cy="85" rx="4" ry="6" {...shapeProps("mao-e-back")} />
                <ellipse cx="80" cy="85" rx="4" ry="6" {...shapeProps("mao-d-back")} />
                {/* Coxas (panturrilha posterior visual) */}
                <path d="M34 114 L40 155 L48 155 L48 116 Z" {...shapeProps("coxa-e-back")} />
                <path d="M66 114 L60 155 L52 155 L52 116 Z" {...shapeProps("coxa-d-back")} />
                {/* Pernas (panturrilha) */}
                <path d="M39 158 L41 200 L48 200 L47 158 Z" {...shapeProps("perna-e-back")} />
                <path d="M61 158 L59 200 L52 200 L53 158 Z" {...shapeProps("perna-d-back")} />
                {/* Pés */}
                <ellipse cx="42" cy="208" rx="5" ry="4" {...shapeProps("pe-e-back")} />
                <ellipse cx="58" cy="208" rx="5" ry="4" {...shapeProps("pe-d-back")} />
              </svg>
            </div>
          </div>

          {/* Painel lateral */}
          <div className="space-y-3">
            {/* Hover detail */}
            <div className="rounded-lg border bg-muted/30 p-3 min-h-[78px]">
              {hover ? (
                <>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Selecionado</div>
                  <div className="text-lg font-bold mt-0.5">{hover}</div>
                  <div className="text-sm text-muted-foreground">
                    {contagem[hover] || 0} ocorrência(s)
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  Passe o mouse sobre o corpo para ver detalhes.
                </div>
              )}
            </div>

            {/* Legenda */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Intensidade</div>
              <div className="flex items-center gap-1">
                {[0, 0.2, 0.4, 0.6, 0.85].map((v, i) => (
                  <div key={i} className="h-3 flex-1 rounded-sm" style={{ background: heatColor(v) }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0</span><span>{maxQtd}</span>
              </div>
            </div>

            {/* Ranking */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Top partes</div>
              <div className="space-y-1">
                {partesOrdenadas.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">Sem registros.</div>
                ) : partesOrdenadas.slice(0, 6).map(([parte, qtd]) => (
                  <button
                    key={parte}
                    onMouseEnter={() => setHover(parte)}
                    className="w-full flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: heatColor(qtd / maxQtd) }} />
                      <span className="truncate">{parte}</span>
                    </div>
                    <span className="font-mono font-semibold">{qtd}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}