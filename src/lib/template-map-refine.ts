import type { Box, BoxMap, FieldDef } from "@/lib/template-field-schemas";

/**
 * Ajuste fino geométrico do mapa sugerido pela IA, olhando os pixels da página:
 * encaixa cada caixa nas bordas reais das células, pula o texto do rótulo
 * e acha os parênteses dos checkboxes. Função pura (testável fora do browser).
 */
export type Raster = { data: Uint8ClampedArray | Uint8Array; width: number; height: number; channels: number };

export function refineMap(map: BoxMap, fields: FieldDef[], r: Raster): BoxMap {
  const s = r.width / map.pageW; // px por ponto
  const dark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return false;
    const i = (Math.round(y) * r.width + Math.round(x)) * r.channels;
    return r.data[i] * 0.3 + r.data[i + 1] * 0.59 + r.data[i + 2] * 0.11 < 150;
  };
  const P = (pt: number) => pt * s;
  const T = (px: number) => px / s;

  // Linhas horizontais: fração de pixels escuros num trecho horizontal
  const hFrac = (y: number, x0: number, x1: number) => {
    let n = 0, t = 0;
    for (let x = x0; x <= x1; x += 1) { t++; if (dark(x, y)) n++; }
    return t ? n / t : 0;
  };
  const vFrac = (x: number, y0: number, y1: number) => {
    let n = 0, t = 0;
    for (let y = y0; y <= y1; y += 1) { t++; if (dark(x, y)) n++; }
    return t ? n / t : 0;
  };

  /** Linha horizontal mais próxima de yPt dentro de ±rangePt, medida no trecho [x0,x1]. */
  const nearestH = (yPt: number, x0Pt: number, x1Pt: number, rangePt: number, dir: -1 | 0 | 1 = 0) => {
    let best: number | null = null, bestD = Infinity;
    for (let y = Math.floor(P(yPt - rangePt)); y <= Math.ceil(P(yPt + rangePt)); y++) {
      if (dir === -1 && T(y) > yPt) continue;
      if (dir === 1 && T(y) < yPt) continue;
      if (hFrac(y, P(x0Pt), P(x1Pt)) > 0.75) {
        const d = Math.abs(T(y) - yPt);
        if (d < bestD) { bestD = d; best = T(y); }
      }
    }
    return best;
  };
  const nearestV = (xPt: number, y0Pt: number, y1Pt: number, rangePt: number, dir: -1 | 0 | 1 = 0) => {
    let best: number | null = null, bestD = Infinity;
    for (let x = Math.floor(P(xPt - rangePt)); x <= Math.ceil(P(xPt + rangePt)); x++) {
      if (dir === -1 && T(x) > xPt) continue;
      if (dir === 1 && T(x) < xPt) continue;
      if (vFrac(x, P(y0Pt), P(y1Pt)) > 0.75) {
        const d = Math.abs(T(x) - xPt);
        if (d < bestD) { bestD = d; best = T(x); }
      }
    }
    return best;
  };

  /** Encaixa a caixa na célula que contém o seu centro. */
  const snapCell = (b: Box, retry = true): Box => {
    const cx = b.x + b.w / 2, cy = b.top + b.h / 2;
    const span = Math.max(20, b.w * 0.4);
    const top = nearestH(cy, cx - span / 2, cx + span / 2, Math.max(14, b.h), -1) ?? b.top;
    const bot = nearestH(cy, cx - span / 2, cx + span / 2, Math.max(14, b.h), 1) ?? b.top + b.h;
    const inner0 = top + 2, inner1 = bot - 2;
    const left = nearestV(b.x, inner0, inner1, 25) ?? b.x;
    const right = nearestV(b.x + b.w, inner0, inner1, 25) ?? b.x + b.w;
    if (right - left < 4 || bot - top < 4) return b;
    // célula baixa demais = centro caiu numa borda; tenta meia altura abaixo
    if (retry && bot - top < 11) return snapCell({ ...b, top: b.top + b.h / 2 }, false);
    return { x: left, top, w: right - left, h: bot - top };
  };

  /** Colunas com tinta na faixa vertical [y0,y1], agrupadas em blocos (em pontos). */
  const inkRuns = (x0: number, x1: number, y0: number, y1: number) => {
    const runs: Array<[number, number]> = [];
    let start: number | null = null;
    for (let x = Math.floor(P(x0)); x <= Math.ceil(P(x1)); x++) {
      let ink = false;
      for (let y = Math.floor(P(y0)); y <= Math.ceil(P(y1)); y++) if (dark(x, y)) { ink = true; break; }
      if (ink && start === null) start = x;
      if (!ink && start !== null) { runs.push([T(start), T(x - 1)]); start = null; }
    }
    if (start !== null) runs.push([T(start), x1]);
    return runs;
  };

  /** Dentro da célula, começa depois do rótulo (primeiro bloco de texto seguido de vão largo). */
  const afterLabel = (cell: Box): Box => {
    const pad = 1.5;
    const runs = inkRuns(cell.x + pad, cell.x + cell.w - pad, cell.top + pad, cell.top + cell.h - pad);
    if (!runs.length) return { ...cell, x: cell.x + 2, w: cell.w - 4 };
    let end = runs[0][1];
    for (let i = 1; i < runs.length; i++) {
      if (runs[i][0] - end > 7) break; // vão largo = fim do rótulo
      end = runs[i][1];
    }
    // rótulo que ocupa a célula inteira não é rótulo: mantém a célula
    if (end > cell.x + cell.w * 0.85) return cell;
    const x = end + 3;
    return { x, top: cell.top, w: cell.x + cell.w - x - 1, h: cell.h };
  };

  /** Acha "( )" perto da caixa sugerida e devolve o miolo dos parênteses. */
  const snapCheck = (b: Box): Box => {
    const cy = b.top + b.h / 2;
    const runs = inkRuns(b.x - 25, b.x + b.w + 25, cy - 3, cy + 3);
    let best: Box | null = null, bestD = Infinity;
    for (let i = 0; i + 1 < runs.length; i++) {
      const a = runs[i], c = runs[i + 1];
      const gap = c[0] - a[1];
      const narrow = a[1] - a[0] < 3.5 && c[1] - c[0] < 3.5;
      if (narrow && gap >= 3 && gap <= 12) {
        const mid = (a[1] + c[0]) / 2;
        const d = Math.abs(mid - (b.x + b.w / 2));
        if (d < bestD) { bestD = d; best = { x: a[1] + 0.5, top: cy - 4, w: Math.max(3, gap - 1), h: 8 }; }
      }
    }
    return best ?? b;
  };

  /** Área de assinatura: célula sem o título do topo. */
  const snapSig = (b: Box): Box => {
    const cell = snapCell(b);
    // procura a primeira faixa sem tinta logo depois do título
    let y = cell.top + 2;
    let sawInk = false;
    const stepPt = 1 / s;
    for (; y < cell.top + cell.h * 0.5; y += stepPt) {
      const row = inkRuns(cell.x + 3, cell.x + cell.w - 3, y, y).length > 0;
      if (row) sawInk = true;
      else if (sawInk) break;
    }
    const top = sawInk ? y + 2 : cell.top + 2;
    return { x: cell.x + 2, top, w: cell.w - 4, h: cell.top + cell.h - top - 2 };
  };

  const out: Record<string, Box> = {};
  for (const f of fields) {
    const b = map.boxes[f.key];
    if (!b) continue;
    try {
      if (f.kind === "text") out[f.key] = afterLabel(snapCell(b));
      else if (f.kind === "check") out[f.key] = snapCheck(b);
      else if (f.kind === "sig") out[f.key] = snapSig(b);
      else out[f.key] = snapCell(b);
    } catch {
      out[f.key] = b;
    }
  }
  // colunas da tabela ficam na altura exata da 1ª linha
  const rf = out["row_first"];
  if (rf) for (const f of fields) if (f.kind === "col" && out[f.key]) out[f.key] = { ...out[f.key], top: rf.top, h: rf.h };

  return { ...map, boxes: out };
}
