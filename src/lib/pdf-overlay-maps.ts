export type OverlayField = {
  top: number;
  x: number;
  maxW: number;
  size?: number;
  baselineOffset?: number;
  bold?: boolean;
};

export type OverlayCheckbox = {
  cx: number;
  cy: number;
  size?: number;
};

export type OverlayMap = {
  label: string;
  pageHeight: number;
  fields: Record<string, OverlayField>;
  checkboxes?: Record<string, OverlayCheckbox>;
};

/**
 * Registro central de mapeamento de campos por template homologado.
 * Adicione novos códigos aqui à medida que o PDF-mãe for subido no
 * painel de templates e as coordenadas forem medidas.
 *
 * pdf-lib usa origem no canto inferior-esquerdo; aqui usamos "top"
 * (distância do topo, mais intuitiva). O motor converte em runtime.
 */
export const OVERLAY_MAPS: Record<string, OverlayMap> = {
  "FORCP-GP-16": {
    label: "Avaliação de Reação do Treinamento",
    pageHeight: 841.8,
    fields: {
      empresa:      { x: 130, top: 166.6, maxW: 420, size: 9 },
      treinamento:  { x: 130, top: 181.8, maxW: 245, size: 9 },
      cargaHoraria: { x: 456, top: 181.8, maxW:  90, size: 9 },
      data:         { x: 130, top: 197.0, maxW:  80, size: 9 },
      instrutor:    { x: 130, top: 212.2, maxW: 180, size: 9 },
      instituicao:  { x: 436, top: 212.2, maxW: 118, size: 9 },
    },
    checkboxes: {
      interno: { cx: 301.6, cy: 189.3 },
      externo: { cx: 369.9, cy: 189.3 },
    },
  },
  "FOR-SEG-04": {
    label: "Permissão de Trabalho Especial — PTE",
    pageHeight: 841.8,
    fields: {
      // Cabeçalho — data/hora início, data/hora fim e nº do PT
      data_inicio:  { x:  45, top: 82, maxW: 95, size: 9, bold: true },
      hora_inicio:  { x: 170, top: 82, maxW: 90, size: 9, bold: true },
      data_fim:     { x: 285, top: 82, maxW: 70, size: 9, bold: true },
      hora_fim:     { x: 382, top: 82, maxW: 80, size: 9, bold: true },
      pt_numero:    { x: 497, top: 82, maxW: 55, size: 9, bold: true },
      // Identificação
      empresa:          { x:  90, top: 158, maxW: 200, size: 9 },
      encarregado:      { x: 390, top: 158, maxW: 160, size: 9 },
      local_descricao:  { x:  32, top: 180, maxW: 520, size: 9 },
    },
    checkboxes: {
      // Descrição das atividades a serem executadas
      movimentacao_cargas: { cx:  35.7, cy: 106 },
      manutencao_civil:    { cx: 151.0, cy: 110 },
      gases_inflamaveis:   { cx: 242.7, cy: 106 },
      altura_telhados:     { cx: 321.1, cy: 106 },
      demolicao_escavacao: { cx: 417.1, cy: 110 },
      eletricidade:        { cx: 512.7, cy: 110 },
      trabalho_quente:     { cx:  47.5, cy: 132 },
      local_confinado:     { cx: 153.5, cy: 128 },
      outros_atividade:    { cx: 242.5, cy: 132 },
      // Mão-de-obra
      mao_interna:         { cx: 318.5, cy: 138 },
      mao_externa:         { cx: 359.5, cy: 138 },
      // Fim de semana / feriado
      fds_sim:             { cx: 473.5, cy: 138 },
      fds_nao:             { cx: 506.1, cy: 138 },
      // Área restrita
      area_restrita_sim:   { cx:  81.3, cy: 148 },
      area_restrita_nao:   { cx: 120.4, cy: 148 },
    },
  },
};

export function hasOverlay(codigo: string): boolean {
  return Boolean(OVERLAY_MAPS[codigo]);
}