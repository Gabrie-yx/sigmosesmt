/**
 * Motor de paginação por blocos empilháveis para jsPDF.
 *
 * Ideia:
 *  - Você define uma lista de "blocos" (cada um sabe sua altura em mm e como se desenhar).
 *  - O motor empilha blocos numa página até esgotar a capacidade útil,
 *    quebra pra próxima página e repete.
 *  - Blocos atômicos (default) NUNCA são quebrados entre páginas. Se sozinhos
 *    não couberem numa página inteira, é responsabilidade de quem montou
 *    pré-dividi-los (ex: tabela em partes).
 *  - O motor não desenha cabeçalho/rodapé fixo: ele só faz o flow do miolo
 *    e te entrega as páginas montadas. Cabeçalho/rodapé fica por conta do
 *    chamador (ex: assinatura ancorada no rodapé).
 */

export type FlowBlock<Ctx = unknown> = {
  /** Altura em mm que o bloco ocupa. */
  height: number;
  /** Desenha o bloco a partir da coordenada (x, y) informada. */
  draw: (ctx: { x: number; y: number; pageIndex: number; pageTotal: number; userCtx: Ctx }) => void;
  /** Metadado livre — útil pra montar rodapé que reflete o conteúdo da página. */
  meta?: Record<string, unknown>;
};

export type FlowPage<Ctx = unknown> = {
  blocks: FlowBlock<Ctx>[];
  /** Soma das alturas dos blocos + gaps. */
  contentHeight: number;
};

/**
 * Empacota blocos em páginas (greedy first-fit, mantendo ordem).
 *
 * @param blocks lista ordenada de blocos
 * @param capacity altura útil em mm da página (sem cabeçalho/rodapé fixo)
 * @param gap espaço em mm entre blocos
 */
export function packBlocksIntoPages<Ctx>(
  blocks: FlowBlock<Ctx>[],
  capacity: number,
  gap = 0,
): FlowPage<Ctx>[] {
  const pages: FlowPage<Ctx>[] = [];
  let current: FlowBlock<Ctx>[] = [];
  let used = 0;

  for (const block of blocks) {
    const needs = block.height + (current.length > 0 ? gap : 0);
    if (used + needs > capacity && current.length > 0) {
      pages.push({ blocks: current, contentHeight: used });
      current = [];
      used = 0;
    }
    // Mesmo blocos maiores que a capacidade entram sozinhos numa página
    // (o overflow visual fica a cargo do chamador resolver via pré-divisão).
    current.push(block);
    used += current.length === 1 ? block.height : needs;
  }
  if (current.length > 0) {
    pages.push({ blocks: current, contentHeight: used });
  }
  return pages;
}

/**
 * Desenha as páginas resultantes. Para cada página chama `onPage` antes/depois
 * (útil pra cabeçalho/rodapé fixo, paginação, assinatura).
 */
export function drawFlowPages<Ctx>(args: {
  pages: FlowPage<Ctx>[];
  startY: number;
  x: number;
  gap: number;
  userCtx: Ctx;
  beforePage?: (pageIndex: number, pageTotal: number, page: FlowPage<Ctx>) => void;
  afterPage?: (pageIndex: number, pageTotal: number, page: FlowPage<Ctx>) => void;
  newPage: () => void;
}): void {
  const { pages, startY, x, gap, userCtx, beforePage, afterPage, newPage } = args;
  pages.forEach((page, i) => {
    if (i > 0) newPage();
    beforePage?.(i, pages.length, page);
    let y = startY;
    page.blocks.forEach((b, idx) => {
      if (idx > 0) y += gap;
      b.draw({ x, y, pageIndex: i, pageTotal: pages.length, userCtx });
      y += b.height;
    });
    afterPage?.(i, pages.length, page);
  });
}
