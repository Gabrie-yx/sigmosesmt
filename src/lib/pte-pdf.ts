import { renderOverlay, preloadTemplate } from "@/lib/pdf-overlay-engine";
import type { PtTipo } from "@/lib/constants";

export type PtePdfParams = {
  numero?: string;
  data_inicio?: string;   // dd/mm/yyyy
  hora_inicio?: string;
  data_fim?: string;
  hora_fim?: string;
  empresa?: string;
  encarregado?: string;
  local_descricao?: string;
  tipo_pt?: PtTipo;
  mao_obra?: "INTERNA" | "EXTERNA" | null;
  fim_de_semana?: boolean | null;
  area_restrita?: boolean | null;
  atividades?: {
    movimentacao_cargas?: boolean;
    manutencao_civil?: boolean;
    gases_inflamaveis?: boolean;
    altura_telhados?: boolean;
    demolicao_escavacao?: boolean;
    eletricidade?: boolean;
    outros?: boolean;
  };
};

/**
 * Permissão de Trabalho Especial (FOR-SEG-04) — usa o PDF-mãe homologado
 * subido pelo painel de Templates e escreve só os campos variáveis por cima.
 */
export async function gerarPtePdf(p: PtePdfParams): Promise<Blob> {
  const tipo = p.tipo_pt;
  return renderOverlay({
    codigo: "FOR-SEG-04",
    fields: {
      pt_numero: p.numero,
      data_inicio: p.data_inicio,
      hora_inicio: p.hora_inicio,
      data_fim: p.data_fim,
      hora_fim: p.hora_fim,
      empresa: p.empresa,
      encarregado: p.encarregado,
      local_descricao: p.local_descricao,
    },
    checkboxes: {
      movimentacao_cargas: p.atividades?.movimentacao_cargas || tipo === "PTI",
      manutencao_civil:    p.atividades?.manutencao_civil,
      gases_inflamaveis:   p.atividades?.gases_inflamaveis,
      altura_telhados:     p.atividades?.altura_telhados || tipo === "PTA",
      demolicao_escavacao: p.atividades?.demolicao_escavacao,
      eletricidade:        p.atividades?.eletricidade || tipo === "PTEL",
      trabalho_quente:     tipo === "PTQ",
      local_confinado:     tipo === "PET",
      outros_atividade:    p.atividades?.outros,
      mao_interna: p.mao_obra === "INTERNA",
      mao_externa: p.mao_obra === "EXTERNA",
      fds_sim: p.fim_de_semana === true,
      fds_nao: p.fim_de_semana === false,
      area_restrita_sim: p.area_restrita === true,
      area_restrita_nao: p.area_restrita === false,
    },
  });
}

export async function preloadTemplatePte(): Promise<Uint8Array> {
  return preloadTemplate("FOR-SEG-04");
}