import type { Box, BoxMap } from "@/lib/template-field-schemas";
import { getTemplateSchema } from "@/lib/template-field-schemas";
import type { Raster } from "@/lib/template-map-refine";

/**
 * Mapeamento automático DETERMINÍSTICO (sem IA, sem internet):
 * 1) lê os textos impressos no PDF com a posição exata de cada um (rótulos);
 * 2) olha os pixels da página para achar as linhas da tabela e as bordas das células;
 * 3) cada campo é ancorado no seu rótulo e encaixado na célula real.
 * Coordenadas em pontos da CropBox, origem no canto superior-esquerdo.
 */

export type TextItem = { str: string; n: string; x: number; y: number; w: number; h: number }; // y = linha de base
export type DetectResult = { map: BoxMap; detectados: number; total: number; faltando: string[] };

export function normTxt(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "O")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function geo(r: Raster, pageW: number) {
  const s = r.width / pageW;
  const darkPx = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return false;
    const i = (y * r.width + x) * r.channels;
    const g = r.channels >= 3 ? r.data[i] * 0.3 + r.data[i + 1] * 0.59 + r.data[i + 2] * 0.11 : r.data[i];
    return g < 170;
  };
  const hFrac = (yPx: number, x0: number, x1: number) => {
    const a = Math.round(x0 * s), b = Math.round(x1 * s);
    let n = 0, t = 0;
    for (let x = a; x <= b; x++) { t++; if (darkPx(x, yPx)) n++; }
    return t ? n / t : 0;
  };
  const vFrac = (xPx: number, y0: number, y1: number) => {
    const a = Math.round(y0 * s), b = Math.round(y1 * s);
    let n = 0, t = 0;
    for (let y = a; y <= b; y++) { t++; if (darkPx(xPx, y)) n++; }
    return t ? n / t : 0;
  };
  /** Primeira linha horizontal encontrada andando de yFrom até yTo (pontos). */
  const findH = (yFrom: number, yTo: number, x0: number, x1: number, thr = 0.85): number | null => {
    const a = Math.round(yFrom * s), b = Math.round(yTo * s), d = b >= a ? 1 : -1;
    for (let y = a; d > 0 ? y <= b : y >= b; y += d) if (hFrac(y, x0, x1) >= thr) return y / s;
    return null;
  };
  /** Primeira linha vertical encontrada andando de xFrom até xTo (pontos). */
  const findV = (xFrom: number, xTo: number, y0: number, y1: number, thr = 0.8): number | null => {
    const a = Math.round(xFrom * s), b = Math.round(xTo * s), d = b >= a ? 1 : -1;
    for (let x = a; d > 0 ? x <= b : x >= b; x += d) if (vFrac(x, y0, y1) >= thr) return x / s;
    return null;
  };
  /** Todas as verticais na faixa [y0,y1], agrupadas (pontos). */
  const allV = (y0: number, y1: number, thr = 0.85) => {
    const xs: number[] = [];
    let run: number[] = [];
    for (let x = 0; x < r.width; x++) {
      if (vFrac(x, y0, y1) >= thr) run.push(x);
      else if (run.length) { xs.push((run[0] + run[run.length - 1]) / 2 / s); run = []; }
    }
    if (run.length) xs.push((run[0] + run[run.length - 1]) / 2 / s);
    return xs;
  };
  /** Blocos de colunas com tinta numa faixa (pontos). */
  const inkRuns = (x0: number, x1: number, y0: number, y1: number) => {
    const runs: Array<[number, number]> = [];
    let start: number | null = null;
    const ya = Math.round(y0 * s), yb = Math.round(y1 * s);
    const xa = Math.round(x0 * s), xb = Math.round(x1 * s);
    for (let x = xa; x <= xb; x++) {
      let ink = false;
      for (let y = ya; y <= yb; y++) if (darkPx(x, y)) { ink = true; break; }
      if (ink && start === null) start = x;
      if (!ink && start !== null) { runs.push([start / s, (x - 1) / s]); start = null; }
    }
    if (start !== null) runs.push([start / s, xb / s]);
    return runs;
  };
  /** Todas as horizontais na faixa [x0,x1] entre y0 e y1, agrupadas (pontos). */
  const allH = (x0: number, x1: number, y0: number, y1: number, thr = 0.85) => {
    const ys: number[] = [];
    let run: number[] = [];
    const a = Math.round(y0 * s), b = Math.round(y1 * s);
    for (let y = a; y <= b; y++) {
      if (hFrac(y, x0, x1) >= thr) run.push(y);
      else if (run.length) { ys.push((run[0] + run[run.length - 1]) / 2 / s); run = []; }
    }
    if (run.length) ys.push((run[0] + run[run.length - 1]) / 2 / s);
    return ys;
  };
  /** Pula o fundo colorido do rótulo (célula sombreada) andando para a direita. */
  const skipShade = (xFrom: number, cy: number, maxX: number) => {
    const yPx = Math.round(cy * s);
    const light = (x: number) => {
      const i = (yPx * r.width + x) * r.channels;
      const g = r.channels >= 3 ? r.data[i] * 0.3 + r.data[i + 1] * 0.59 + r.data[i + 2] * 0.11 : r.data[i];
      return g < 248;
    };
    let x = Math.round(xFrom * s);
    const end = Math.round(maxX * s);
    let lastShade = x;
    for (; x < end; x++) {
      // aceita letras escuras dentro da célula; para no primeiro trecho branco de 2pt
      let white = true;
      for (let k = 0; k < Math.round(2 * s); k++) if (light(x + k)) { white = false; break; }
      if (white) break;
      lastShade = x;
    }
    return lastShade / s;
  };
  return { findH, findV, allV, allH, inkRuns, skipShade };
}

/** Detector da Requisição de Compra (FOR-SEG-03 / FOR-COMP 03). */
export function detectRC(items: TextItem[], r: Raster, pageW: number, pageH: number): DetectResult {
  const g = geo(r, pageW);
  const boxes: Record<string, Box> = {};
  const cyOf = (it: TextItem) => it.y - it.h * 0.33;
  const sameLine = (a: TextItem, b: TextItem) => Math.abs(a.y - b.y) < Math.max(2.5, a.h * 0.3);
  const find = (re: RegExp, pred: (it: TextItem) => boolean = () => true) =>
    items.filter((it) => re.test(it.n) && pred(it)).sort((a, b) => a.y - b.y || a.x - b.x);

  /** X do fim do trecho casado pelo regex dentro do item (estimativa proporcional). */
  const endOf = (it: TextItem, re: RegExp) => {
    const m = re.exec(it.n);
    if (!m) return it.x + it.w;
    const end = m.index + m[0].length;
    return end >= it.n.length ? it.x + it.w : it.x + (it.w * end) / it.n.length;
  };

  /** Campo de texto: área em branco à direita do rótulo, encaixada na célula. */
  const textAfter = (it: TextItem, re: RegExp, rightLimit?: number): Box => {
    const x0 = endOf(it, re) + 2;
    const cy = cyOf(it);
    const p0 = x0 + 1, p1 = Math.min(x0 + 24, pageW - 1);
    const top = g.findH(cy, cy - 20, p0, p1) ?? cy - 7.5;
    const bot = g.findH(cy, cy + 20, p0, p1) ?? cy + 7.5;
    const next = items
      .filter((o) => o !== it && sameLine(o, it) && o.x > x0 + 1)
      .sort((a, b) => a.x - b.x)[0];
    const limit = Math.min(rightLimit ?? pageW - 5, next ? next.x - 2 : pageW - 5);
    const right = g.findV(x0 + 1, limit, top + 2, bot - 2) ?? limit;
    return { x: x0, top: top + 1, w: Math.max(8, right - x0 - 1.5), h: Math.max(6, bot - top - 2) };
  };

  /** Miolo de "( )" depois da palavra-chave (mesmo item ou item seguinte da linha). */
  const paren = (it: TextItem, kw: RegExp): Box | null => {
    const m = kw.exec(it.n);
    if (!m) return null;
    const oi = it.n.indexOf("(", m.index + m[0].length - 1);
    if (oi < 0) return null;
    const cw = it.w / it.n.length;
    const openR = oi === it.n.length - 1 ? it.x + it.w : it.x + (oi + 1) * cw;
    let closeX: number | null = null;
    const ci = it.n.indexOf(")", oi);
    if (ci > 0) closeX = it.x + ci * cw;
    else {
      const nx = items
        .filter((o) => o !== it && sameLine(o, it) && o.x >= openR - 2 && o.n.startsWith(")"))
        .sort((a, b) => a.x - b.x)[0];
      if (nx) closeX = nx.x;
    }
    closeX ??= openR + 12;
    const cy = cyOf(it);
    // Refino nos pixels: dois traços finos = "(" e ")"; o miolo é o vão entre eles.
    const runs = g.inkRuns(openR - 7, closeX + 7, cy - 2.5, cy + 2.5);
    const estMid = (openR + closeX) / 2;
    let best: Box | null = null, bestD = Infinity;
    for (let i = 0; i + 1 < runs.length; i++) {
      const a = runs[i], c = runs[i + 1];
      const gap = c[0] - a[1];
      if (a[1] - a[0] < 3.5 && c[1] - c[0] < 3.5 && gap >= 2.5 && gap <= 25) {
        const d = Math.abs((a[1] + c[0]) / 2 - estMid);
        if (d < bestD) { bestD = d; best = { x: a[1] + 0.6, top: cy - 4, w: Math.max(3, gap - 1.2), h: 8 }; }
      }
    }
    return best ?? { x: openR + 0.5, top: cy - 4, w: Math.max(3, closeX - openR - 1), h: 8 };
  };

  // ---- Tabela de itens ----
  const hItem = find(/^ITEM$/)[0] ?? find(/^ITENS?\b/)[0];
  const yH = hItem?.y ?? pageH * 0.3;

  // ---- Cabeçalho ----
  const lClass = find(/CLASSIFICA/, (it) => it.y < yH)[0];
  const lMat = find(/\bMATERIAL\s*\(/, (it) => it.y < yH)[0];
  const lServ = find(/\bSERVICO\s*\(/, (it) => it.y < yH)[0];
  if (lMat) { const b = paren(lMat, /\bMATERIAL\s*\(/); if (b) boxes.chk_material = b; }
  if (lServ) { const b = paren(lServ, /\bSERVICO\s*\(/); if (b) boxes.chk_servico = b; }

  const datasCab = find(/^DATA\s*:?$|^DATA\s*:/, (it) => it.y < yH && it.n.replace(/[^0-9]/g, "").length === 0);
  const lData = (lClass && datasCab.find((d) => sameLine(d, lClass))) ?? datasCab.sort((a, b) => b.y - a.y)[0];
  if (lData) boxes.data = textAfter(lData, /DATA\s*:?/);

  const reNum = /\b(N\s*O|NUMERO|NRO?)\.?\s*D[OA]\s*(PEDIDO|REQUISICAO)\s*:?/;
  const lNum = find(reNum, (it) => it.y < yH)[0];
  if (lNum) boxes.numero = textAfter(lNum, reNum);

  const simples: Array<[string, RegExp]> = [
    ["solicitante", /^SOLICITANTE\s*:?/],
    ["setor", /^SETOR\s*:?/],
    ["fornecedor", /^FORNECEDOR\s*:?/],
  ];
  for (const [k, re] of simples) {
    const it = find(re, (o) => o.y < yH)[0];
    if (it) boxes[k] = textAfter(it, re);
  }
  const obras: Array<[string, RegExp]> = [
    ["obra_construcao", /OBRA\s*(EM\s*)?CONSTRUCAO\s*:?/],
    ["obra_manutencao", /OBRA\s*(EM\s*)?MANUTENCAO\s*:?/],
  ];
  for (const [k, re] of obras) {
    const it = find(re, (o) => o.y < yH)[0];
    if (!it) continue;
    // Rev. nova usa "( )" (marcar X); revisões antigas têm espaço para escrever.
    const ck = paren(it, new RegExp(re.source.replace("\\s*:?", "") + "\\s*\\("));
    boxes[k] = ck ?? textAfter(it, re);
  }

  if (hItem) {
    const nums = items
      .filter((it) => /^\d{1,3}$/.test(it.n) && it.y > yH + 2 && it.x + it.w / 2 > hItem.x - 15 && it.x + it.w / 2 < hItem.x + hItem.w + 15)
      .sort((a, b) => a.y - b.y);
    const seq: TextItem[] = [];
    for (const it of nums) if (Number(it.n) === seq.length + 1) seq.push(it);
    if (seq.length >= 2) {
      const pitch = (seq[seq.length - 1].y - seq[0].y) / (seq.length - 1);
      const px0 = hItem.x, px1 = hItem.x + Math.max(20, hItem.w);
      const rowBand = (it: TextItem) => {
        const cy = cyOf(it);
        const top = g.findH(cy, cy - pitch * 0.9, px0, px1) ?? cy - pitch / 2;
        const bot = g.findH(cy, cy + pitch * 0.9, px0, px1) ?? cy + pitch / 2;
        return { top, bot };
      };
      const r1 = rowBand(seq[0]);
      const rn = rowBand(seq[seq.length - 1]);
      let vs = g.allV(r1.top + 1.5, r1.bot - 1.5).filter((x) => x > 2 && x < pageW - 2);
      const labels: Array<[string, RegExp]> = [
        ["col_item", /^ITEM$/],
        ["col_desc", /^DESCRI/],
        ["col_qtde", /^QU?A?N?TD?E?\.?$|^QTD/],
        ["col_unid", /^UN(ID)?(ADE)?\.?$/],
        ["col_obs", /^OBS/],
      ];
      const hdr = labels.map(([k, re]) => [k, find(re, (it) => Math.abs(it.y - yH) < 6)[0]] as const);
      if (vs.length < 3) {
        // Sem grade detectável: usa o início de cada título como borda.
        vs = hdr.filter(([, it]) => it).map(([, it]) => it!.x - 3).sort((a, b) => a - b);
        vs.push(pageW - 15);
      }
      const tL = vs[0], tR = vs[vs.length - 1];
      boxes.row_first = { x: tL, top: r1.top, w: tR - tL, h: r1.bot - r1.top };
      boxes.row_last = { x: tL, top: rn.top, w: tR - tL, h: rn.bot - rn.top };
      for (const [k, it] of hdr) {
        if (!it) continue;
        const cx = it.x + Math.min(it.w, 30) / 2;
        let j = -1;
        for (let i = 0; i + 1 < vs.length; i++) if (vs[i] <= cx && cx < vs[i + 1]) j = i;
        if (j < 0) continue;
        boxes[k] = { x: vs[j], top: r1.top, w: vs[j + 1] - vs[j], h: r1.bot - r1.top };
      }
    }
  }

  // ---- Assinaturas + datas ----
  const sigs: Array<[string, string, RegExp]> = [
    ["sig_solicitante", "data_solicitante", /ASS(\.|INATURA)?\s*(DO\s*)?SOLICITANTE/],
    ["sig_supervisor", "data_supervisor", /ASS(\.|INATURA)?\s*(DO\s*)?SUPERVISOR/],
    ["sig_compras", "data_compras", /ASS(\.|INATURA)?\s*(DO\s*|DA\s*)?(ANALISTA|COMPRAS)/],
  ];
  for (const [sk, dk, re] of sigs) {
    const lab = find(re, (it) => it.y > yH)[0];
    if (!lab) continue;
    const ly = lab.y;
    const b0 = ly + 6, b1 = ly + 26;
    const left = g.findV(lab.x - 1, 0, b0, b1) ?? lab.x - 20;
    const right = g.findV(lab.x + lab.w + 1, pageW, b0, b1) ?? lab.x + lab.w + 20;
    const dat = find(/^DATA\s*:?/, (it) => it.y > ly + 8 && it.x >= left - 2 && it.x < right)[0];
    let bottom = dat ? dat.y - dat.h - 1 : ly + 60;
    if (dat) {
      const line = g.findH(cyOf(dat) - 5, ly + 12, left + 3, Math.min(right - 3, left + 30));
      if (line) bottom = line;
    }
    const top = ly + 3;
    boxes[sk] = { x: left + 2, top, w: right - left - 4, h: Math.max(10, bottom - top - 2) };
    if (dat) boxes[dk] = textAfter(dat, /^DATA\s*:?/, right);
  }

  const schema = getTemplateSchema("FOR-SEG-03")!;
  const round = (n: number) => Math.round(n * 10) / 10;
  const out: Record<string, Box> = {};
  for (const [k, b] of Object.entries(boxes)) out[k] = { x: round(b.x), top: round(b.top), w: round(b.w), h: round(b.h) };
  const faltando = schema.fields.filter((f) => !out[f.key]).map((f) => f.label);
  return {
    map: { pageW: round(pageW), pageH: round(pageH), boxes: out },
    detectados: schema.fields.length - faltando.length,
    total: schema.fields.length,
    faltando,
  };
}

export type PageData = { items: TextItem[]; raster: Raster; w: number; h: number };
type Detector = (pages: PageData[]) => DetectResult;

function finalizar(codigo: string, boxes: Record<string, Box>, pageW: number, pageH: number): DetectResult {
  const schema = getTemplateSchema(codigo)!;
  const round = (n: number) => Math.round(n * 10) / 10;
  const out: Record<string, Box> = {};
  for (const [k, b] of Object.entries(boxes)) out[k] = { x: round(b.x), top: round(b.top), w: round(b.w), h: round(b.h) };
  const faltando = schema.fields.filter((f) => !out[f.key]).map((f) => f.label);
  return { map: { pageW: round(pageW), pageH: round(pageH), boxes: out }, detectados: schema.fields.length - faltando.length, total: schema.fields.length, faltando };
}

/**
 * Ficha de Entrega de EPI (FOR-SEG-02). Página 1 = cabeçalho + termo;
 * página 2 = grade de entregas. Chaves "p2_*" pertencem à página 2.
 */
export function detectFicha(pages: PageData[]): DetectResult {
  const [P1, P2] = pages;
  const boxes: Record<string, Box> = {};
  const W = P1.w, H = P1.h;
  {
    const g = geo(P1.raster, P1.w);
    const items = P1.items;
    const find = (re: RegExp) => items.filter((it) => re.test(it.n)).sort((a, b) => a.y - b.y || a.x - b.x)[0];
    const sameLine = (a: TextItem, b: TextItem) => Math.abs(a.y - b.y) < 3;
    const endOf = (it: TextItem, re: RegExp) => {
      const m = re.exec(it.n);
      if (!m) return it.x + it.w;
      const e = m.index + m[0].length;
      return e >= it.n.length ? it.x + it.w : it.x + (it.w * e) / it.n.length;
    };
    const cab: Array<[string, RegExp]> = [
      ["empresa", /^EMPRESA\s*:/],
      ["admissao", /^DATA DE ADMISSAO\s*:/],
      ["nome", /^NOME\s*:/],
      ["demissao", /^DATA DE DEMISSAO\s*:/],
      ["funcao", /^FUNCAO\s*:/],
      ["matricula", /^MATRICULA\s*:/],
      ["folha", /^FOLHA\s*:/],
    ];
    for (const [k, re] of cab) {
      const it = find(re);
      if (!it) continue;
      const cy = it.y - it.h * 0.33;
      const next = items.filter((o) => o !== it && sameLine(o, it) && o.x > it.x + it.w).sort((a, b) => a.x - b.x)[0];
      const limit = next ? next.x - 4 : W - 12;
      const x0 = g.skipShade(endOf(it, re) + 0.5, cy, limit) + 2;
      const right = g.findV(x0 + 1, limit, cy - 4, cy + 4) ?? limit;
      boxes[k] = { x: x0, top: cy - 7, w: Math.max(10, right - x0 - 2), h: 14 };
    }
    // Lacuna "recebi da empresa ____," no termo.
    const reEmp = /RECEBI DA EMPRESA\s*/;
    const lt = find(reEmp);
    if (lt) {
      const x0 = endOf(lt, reEmp);
      const cw = lt.w / lt.n.length;
      const m = /_{3,}/.exec(lt.n);
      const virg = lt.n.indexOf(",", lt.n.search(reEmp) + 10);
      const x1 = m ? lt.x + (m.index + m[0].length) * cw : virg > 0 ? lt.x + virg * cw : x0 + 140;
      boxes.empresa_termo = { x: x0, top: lt.y - 10, w: Math.max(40, x1 - x0), h: 12 };
    }
    const reLocal = /^LOCAL E DATA\s*:\s*/;
    const ll = find(reLocal);
    if (ll) { const x0 = endOf(ll, reLocal); boxes.local_data = { x: x0, top: ll.y - 11, w: ll.x + ll.w - x0, h: 13 }; }
    const reAss = /^ASSINATURA DO EMPREGADO\s*:\s*/;
    const la = find(reAss);
    if (la) { const x0 = endOf(la, reAss); boxes.sig_empregado = { x: x0, top: la.y - 24, w: la.x + la.w - x0, h: 26 }; }
  }
  if (P2) {
    const g = geo(P2.raster, P2.w);
    const items = P2.items;
    const find = (re: RegExp) => items.filter((it) => re.test(it.n)).sort((a, b) => a.y - b.y || a.x - b.x)[0];
    const qt = find(/^QT$/);
    if (qt) {
      const hdrBottom = Math.max(...items.filter((it) => Math.abs(it.y - qt.y) < 14).map((it) => it.y)) + 2;
      const ys = g.allH(qt.x - 2, qt.x + qt.w + 2, hdrBottom, P2.h - 2).filter((y) => y > hdrBottom);
      if (ys.length >= 3) {
        const r1 = [ys[0], ys[1]] as const;
        const rn = [ys[ys.length - 2], ys[ys.length - 1]] as const;
        const vs = g.allV(r1[0] + 1.5, r1[1] - 1.5).filter((x) => x > 2 && x < P2.w - 2);
        const tL = vs[0], tR = vs[vs.length - 1];
        boxes.p2_row_first = { x: tL, top: r1[0], w: tR - tL, h: r1[1] - r1[0] };
        boxes.p2_row_last = { x: tL, top: rn[0], w: tR - tL, h: rn[1] - rn[0] };
        const cols: Array<[string, TextItem | undefined]> = [
          ["p2_col_qt", qt],
          ["p2_col_und", find(/^UND$/)],
          ["p2_col_espec", find(/^ESPECIFICACAO$/)],
          ["p2_col_ca", find(/^CA$/)],
          ["p2_col_ass_emp", find(/^ASSINATURA DO EMPREGADO$/)],
          ["p2_col_data_entrega", find(/^ENTREGA$/)],
          ["p2_col_motivo", find(/^SUBSTITUICAO$/)],
          ["p2_col_data_devol", find(/^DEVOLUCAO$/)],
          ["p2_col_ass_receb", find(/^RECEBEDOR$/)],
        ];
        for (const [k, it] of cols) {
          if (!it) continue;
          const cx = it.x + it.w / 2;
          for (let i = 0; i + 1 < vs.length; i++) if (vs[i] <= cx && cx < vs[i + 1]) boxes[k] = { x: vs[i], top: r1[0], w: vs[i + 1] - vs[i], h: r1[1] - r1[0] };
        }
      }
    }
  }
  return finalizar("FOR-SEG-02", boxes, W, H);
}

const DETECTORES: Record<string, Detector> = {
  "FOR-SEG-03": (p) => detectRC(p[0].items, p[0].raster, p[0].w, p[0].h),
  "FOR-SEG-02": detectFicha,
};

export function temDetector(codigo: string) {
  return !!DETECTORES[codigo];
}

/** Executa no navegador: lê textos + pixels da 1ª página e aplica o detector do template. */
export async function detectarMapaPdf(codigo: string, bytes: Uint8Array): Promise<DetectResult> {
  const det = DETECTORES[codigo];
  if (!det) throw new Error(`Sem detector automático para ${codigo}.`);
  const pdfjs = await import("pdfjs-dist");
  // @ts-ignore — Vite entrega o worker como URL.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const doc = await task.promise;
    const pages: PageData[] = [];
    for (let pn = 1; pn <= Math.min(doc.numPages, 2); pn++) {
      const page = await doc.getPage(pn);
      const vp1 = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const [x, y] = vp1.convertToViewportPoint(it.transform[4], it.transform[5]);
        const h = it.height || Math.hypot(it.transform[2], it.transform[3]) || 10;
        items.push({ str: it.str, n: normTxt(it.str), x, y, w: it.width, h });
      }
      if (pn === 1 && items.length < 5) {
        throw new Error("Este PDF não tem texto legível (parece imagem/escaneado). Exporte o formulário direto do Excel/Word como PDF e suba de novo.");
      }
      const S = 3;
      const vp = page.getViewport({ scale: S });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true } as any) as CanvasRenderingContext2D;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas, background: "#ffffff" } as any).promise;
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      pages.push({ items, raster: { data: d.data, width: d.width, height: d.height, channels: 4 }, w: vp1.width, h: vp1.height });
    }
    return det(pages);
  } finally {
    await task.destroy();
  }
}
