import { renderOverlay, preloadTemplate } from "@/lib/pdf-overlay-engine";

export type ReacaoTreinamentoParams = {
  empresa?: string;
  data: string; // dd/mm/yyyy
  tipo: "INTERNO" | "EXTERNO" | "";
  instrutor: string;
  instituicao: string;
  treinamento?: string;
  cargaHoraria?: string;
  tstNome?: string;
  tstAssinaturaDataUrl?: string | null;
  codigo?: string;
  revisao?: string;
  dataDocumento?: string;
  /** Bytes do PDF-template já baixados (evita 1 request por cópia num lote) */
  templatePdfBytes?: Uint8Array;
};

/**
 * Avaliação de Reação (FORCP-GP-16) — hoje é só um wrapper fino do motor
 * genérico de overlay. Bordas, cabeçalho, tabela e rodapé vêm do PDF-mãe
 * homologado. Se o layout mudar numa nova revisão, ajuste as coordenadas
 * em src/lib/pdf-overlay-maps.ts — este arquivo não precisa mudar.
 */
export async function gerarAvaliacaoReacao(p: ReacaoTreinamentoParams): Promise<Blob> {
  return renderOverlay({
    codigo: "FORCP-GP-16",
    templatePdfBytes: p.templatePdfBytes,
    fields: {
      empresa: p.empresa,
      treinamento: p.treinamento,
      cargaHoraria: p.cargaHoraria,
      data: p.data,
      instrutor: p.instrutor,
      instituicao: p.instituicao,
    },
    checkboxes: {
      interno: p.tipo === "INTERNO",
      externo: p.tipo === "EXTERNO",
    },
  });
}

/** Baixa o template uma vez pra reaproveitar em geração em lote. */
export async function preloadTemplateReacao(): Promise<Uint8Array> {
  return preloadTemplate("FORCP-GP-16");
}