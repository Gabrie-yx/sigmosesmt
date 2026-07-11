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
};

export function hasOverlay(codigo: string): boolean {
  return Boolean(OVERLAY_MAPS[codigo]);
}