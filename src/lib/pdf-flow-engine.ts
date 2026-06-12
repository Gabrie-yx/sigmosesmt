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
 * Empacota blocos em páginas.
 *
 * Modo padrão: greedy first-fit preservando a ordem estrita.
 * Com `lookahead: true`: quando o próximo bloco da fila não cabe na página
 * atual, o motor procura entre os blocos seguintes algum que caiba antes de
 * virar a página — maximizando o aproveitamento sem deixar nenhum bloco de
 * fora. A ordem global é preservada o máximo possível (só "antecipa" um
 * bloco menor quando o maior travaria a página).
 *
 * @param blocks lista ordenada de blocos
 * @param capacity altura útil em mm da página (sem cabeçalho/rodapé fixo)
 * @param gap espaço em mm entre blocos
 */
export function packBlocksIntoPages<Ctx>(
  blocks: FlowBlock<Ctx>[],
  capacity: number,
  gap = 0,
  options: { lookahead?: boolean } = {},
): FlowPage<Ctx>[] {
  const { lookahead = false } = options;
  const pages: FlowPage<Ctx>[] = [];
  let current: FlowBlock<Ctx>[] = [];
  let used = 0;

  if (!lookahead) {
    for (const block of blocks) {
      const needs = block.height + (current.length > 0 ? gap : 0);
      if (used + needs > capacity && current.length > 0) {
        pages.push({ blocks: current, contentHeight: used });
        current = [];
        used = 0;
      }
      current.push(block);
      used += current.length === 1 ? block.height : needs;
    }
  } else {
    const remaining = [...blocks];
    while (remaining.length > 0) {
      // Procura o PRIMEIRO bloco da fila que caiba no espaço restante.
      const idx = remaining.findIndex((b) => {
        const needs = b.height + (current.length > 0 ? gap : 0);
        return used + needs <= capacity;
      });
      if (idx === -1) {
        if (current.length === 0) {
          // Bloco isolado maior que a página: força mesmo assim (caso degenerado).
          const b = remaining.shift()!;
          current.push(b);
          used = b.height;
        }
        pages.push({ blocks: current, contentHeight: used });
        current = [];
        used = 0;
        continue;
      }
      const [b] = remaining.splice(idx, 1);
      const needs = b.height + (current.length > 0 ? gap : 0);
      current.push(b);
      used += current.length === 1 ? b.height : needs;
    }
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
