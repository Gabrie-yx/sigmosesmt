export type OverlayField = {
  page?: number;
  top: number;
  x: number;
  maxW: number;
  size?: number;
  baselineOffset?: number;
  bold?: boolean;
  clear?: { x?: number; top?: number; width: number; height: number };
};

export type OverlayCheckbox = {
  page?: number;
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
      data_inicio:  { x: 45.61, top: 84.9, maxW: 64, size: 6.1, bold: true, baselineOffset: 1.5 },
      hora_inicio:  { x: 169.61, top: 84.9, maxW: 54, size: 6.1, bold: true, baselineOffset: 1.5 },
      data_fim:     { x: 283.61, top: 84.9, maxW: 64, size: 6.1, bold: true, baselineOffset: 1.5 },
      hora_fim:     { x: 381.61, top: 84.9, maxW: 54, size: 6.1, bold: true, baselineOffset: 1.5 },
      pt_numero:    { x: 494.61, top: 82.3, maxW: 56, size: 4.6, bold: true, baselineOffset: 1.4, clear: { x: 489.61, top: 79.8, width: 68, height: 12 } },
      // Identificação
      empresa:          { x: 87.61, top: 162.4, maxW: 206, size: 5.4, bold: true, baselineOffset: 1.5 },
      encarregado:      { x: 389.61, top: 162.4, maxW: 164, size: 5.4, bold: true, baselineOffset: 1.5 },
      local_descricao:  { x: 119.61, top: 173.0, maxW: 434, size: 5.3, baselineOffset: 1.5 },
      outros_atividade_texto: { x: 268.61, top: 135.2, maxW: 70, size: 5.4, baselineOffset: 1.6 },
      outros_risco_texto: { x: 406.61, top: 327.8, maxW: 140, size: 5.4, baselineOffset: 1.6 },
      outros_snna_texto: { x: 329.61, top: 395.2, maxW: 205, size: 5.4, baselineOffset: 1.6 },
      teste_atmosfera_horario: { x: 151.61, top: 511.5, maxW: 42, size: 5.4, baselineOffset: 1.6 },
      teste_atmosfera_percentual: { x: 47.61, top: 517.5, maxW: 26, size: 5.4, baselineOffset: 1.6 },
      designado_liberacao: { x: 396.61, top: 501.7, maxW: 135, size: 5.4, baselineOffset: 1.6 },
      responsavel_bloqueio: { x: 404.61, top: 735.7, maxW: 126, size: 5.4, baselineOffset: 1.6 },
    },
    checkboxes: {
      // Descrição das atividades a serem executadas
      movimentacao_cargas: { cx: 35.77, cy: 105.79 },
      manutencao_civil: { cx: 150.96, cy: 109.58 },
      gases_inflamaveis: { cx: 242.77, cy: 105.79 },
      altura_telhados: { cx: 321.17, cy: 105.79 },
      demolicao_escavacao: { cx: 418.17, cy: 109.38 },
      eletricidade: { cx: 512.77, cy: 109.38 },
      trabalho_quente: { cx: 47.57, cy: 131.79 },
      local_confinado: { cx: 153.57, cy: 127.99 },
      outros_atividade: { cx: 242.57, cy: 131.79 },
      // Mão-de-obra
      mao_interna: { cx: 318.57, cy: 138.18 },
      mao_externa: { cx: 359.58, cy: 138.18 },
      // Fim de semana / feriado
      fds_sim: { cx: 473.57, cy: 138.19 },
      fds_nao: { cx: 506.18, cy: 138.19 },
      // Área restrita
      area_restrita_sim: { cx: 80.58, cy: 147.99 },
      area_restrita_nao: { cx: 120.39, cy: 147.99 },
      ris_projecao_particulas: { cx: 33.57, cy: 209.2 },
      ris_produtos_inflamaveis: { cx: 33.57, cy: 217.8 },
      ris_choque_eletrico: { cx: 33.57, cy: 226.0 },
      ris_ruido_excessivo: { cx: 33.57, cy: 234.19 },
      ris_queda_diferenca_nivel: { cx: 33.57, cy: 244.8 },
      ris_piso_escorregadio: { cx: 33.57, cy: 255.6 },
      ris_contato_quimico_pele: { cx: 33.57, cy: 265.0 },
      ris_postura_inadequada: { cx: 33.57, cy: 274.79 },
      ris_vapores_organicos: { cx: 33.57, cy: 284.39 },
      ris_trabalho_sobre_telhado: { cx: 33.57, cy: 293.4 },
      ris_trabalho_eletrico_areas_classificadas: { cx: 33.57, cy: 301.8 },
      ris_contato_cantos_vivos: { cx: 33.57, cy: 312.8 },
      ris_risco_queimadura: { cx: 33.57, cy: 323.4 },
      ris_levantamento_peso: { cx: 207.57, cy: 209.2 },
      ris_queda_pta: { cx: 207.57, cy: 217.79 },
      ris_demolicao: { cx: 207.57, cy: 225.99 },
      ris_escavacao_desmoronamento: { cx: 207.57, cy: 234.2 },
      ris_queda_escada: { cx: 207.57, cy: 244.8 },
      ris_queda_andaimes: { cx: 207.57, cy: 255.6 },
      ris_radiacao_nao_ionizante: { cx: 207.57, cy: 265.0 },
      ris_fumos_metalicos: { cx: 207.57, cy: 274.79 },
      ris_trabalho_quente_faiscas: { cx: 207.57, cy: 284.4 },
      ris_manuseio_inflamaveis: { cx: 207.57, cy: 293.4 },
      ris_prensamento_membros: { cx: 207.57, cy: 301.8 },
      ris_animais_peconhentos: { cx: 207.57, cy: 312.8 },
      ris_tubulacao_cabos_enterrados: { cx: 207.57, cy: 323.4 },
      ris_uso_inadequado_ferramentas: { cx: 384.37, cy: 209.2 },
      ris_explosao_incendio: { cx: 384.37, cy: 217.79 },
      ris_exposicao_poeiras: { cx: 384.37, cy: 225.99 },
      ris_exposicao_gases_vapores: { cx: 384.37, cy: 234.2 },
      ris_manuseio_equipamento_guindar: { cx: 384.37, cy: 244.8 },
      ris_movimentacao_maquinas: { cx: 384.37, cy: 255.6 },
      ris_espaco_confinado: { cx: 384.37, cy: 265.0 },
      ris_expor_terceiros: { cx: 384.37, cy: 274.8 },
      ris_desmoronamento_soterramento: { cx: 384.37, cy: 284.4 },
      ris_condicoes_climaticas: { cx: 384.37, cy: 293.4 },
      ris_superficie_arestas: { cx: 384.37, cy: 301.8 },
      ris_radiacao_solar: { cx: 384.37, cy: 312.8 },
      ris_outros: { cx: 384.37, cy: 323.4 },
      snna_local_limpo_sinalizado: { cx: 33.57, cy: 343.8 },
      snna_equipe_conhece_emergencia: { cx: 33.57, cy: 351.99 },
      snna_rotas_fuga: { cx: 33.57, cy: 362.19 },
      snna_local_isolado: { cx: 33.57, cy: 372.99 },
      snna_ca_epi_validos: { cx: 33.57, cy: 382.19 },
      snna_apr_elaborada_entregue: { cx: 33.57, cy: 390.8 },
      snna_ambiente_protegido_vazamento: { cx: 307.37, cy: 343.8 },
      snna_trabalhadores_area_protegidos: { cx: 307.37, cy: 351.99 },
      snna_equipamentos_inspecionados: { cx: 307.37, cy: 362.19 },
      snna_fontes_energia_bloqueadas: { cx: 307.37, cy: 372.99 },
      snna_documentacoes_terceiros: { cx: 307.37, cy: 382.19 },
      snna_outros: { cx: 307.37, cy: 390.8 },
      hot_materiais_combustiveis_controlados: { cx: 33.57, cy: 413.6 },
      hot_cenario_incendio_protegido: { cx: 307.37, cy: 413.6 },
      hot_cilindros_oxiacetileno_valvulas: { cx: 33.57, cy: 429.6 },
      hot_brigada_habilitada: { cx: 307.37, cy: 429.6 },
      hot_cilindros_manometro: { cx: 33.57, cy: 440.4 },
      hot_acendedor_macarico: { cx: 307.37, cy: 440.2 },
      hot_recipientes_purgados: { cx: 33.57, cy: 448.2 },
      hot_equipamentos_boas_condicoes: { cx: 307.37, cy: 447.6 },
      hot_cilindros_vertical_seguro: { cx: 33.57, cy: 456.2 },
      hot_fispq_solda: { cx: 307.37, cy: 456.2 },
      hot_epis_quente_adequados: { cx: 33.57, cy: 464.8 },
      hot_executante_qualificado: { cx: 307.37, cy: 464.8 },
      hot_vigilancia_incendio_presente: { cx: 33.57, cy: 477.8 },
      hot_local_limpo_sem_combustiveis: { cx: 307.37, cy: 474.8 },
      hot_iluminacao_prova_explosao: { cx: 33.57, cy: 489.8 },
      hot_sprinklers_funcionando: { cx: 307.37, cy: 489.8 },
      hot_teste_explosimetro: { cx: 33.57, cy: 498.0 },
      alt_condicoes_atmosfericas: { cx: 33.57, cy: 536.6 },
      alt_escadas_andaime_boas_condicoes: { cx: 33.57, cy: 543.8 },
      alt_envolvidos_condicoes_fisicas: { cx: 33.57, cy: 552.0 },
      alt_estabilidade_andaimes: { cx: 33.57, cy: 560.4 },
      alt_segunda_pessoa: { cx: 33.57, cy: 574.6 },
      alt_nr35_autorizados: { cx: 33.57, cy: 585.39 },
      alt_iluminacao_suficiente: { cx: 33.57, cy: 596.4 },
      alt_itens_seg_pta: { cx: 33.57, cy: 604.4 },
      alt_escadas_amarradas: { cx: 33.57, cy: 612.6 },
      alt_andaimes_rodas_travados: { cx: 33.57, cy: 620.8 },
      alt_fixar_pranchoes: { cx: 307.37, cy: 536.6 },
      alt_pontos_ancoragem: { cx: 307.37, cy: 543.2 },
      alt_afastados_rede_eletrica: { cx: 307.37, cy: 551.4 },
      alt_equipamentos_prevencao_queda: { cx: 307.37, cy: 559.6 },
      alt_telhas_sem_umidade: { cx: 307.37, cy: 574.2 },
      alt_andaimes_ancorados: { cx: 307.37, cy: 582.4 },
      alt_area_abaixo_isolada: { cx: 307.37, cy: 596.0 },
      alt_escada_acesso_guarda_corpo: { cx: 307.37, cy: 603.8 },
      alt_clima_area_externa: { cx: 307.37, cy: 612.0 },
      alt_plano_resgate: { cx: 307.37, cy: 620.8 },
      ele_fontes_desenergizadas: { cx: 33.57, cy: 651.8 },
      ele_fontes_bloqueadas: { cx: 33.57, cy: 658.6 },
      ele_teste_ausencia_tensao: { cx: 33.57, cy: 666.4 },
      ele_sinalizada_fonte: { cx: 33.57, cy: 677.2 },
      ele_roupas_obrigatorias: { cx: 33.57, cy: 690.6 },
      ele_recomendacoes_seccionamento: { cx: 33.57, cy: 704.2 },
      ele_nr10_sep_autorizados: { cx: 33.57, cy: 715.4 },
      ele_paineis_bloqueados: { cx: 33.57, cy: 723.4 },
      ele_local_condicoes_ideais: { cx: 33.57, cy: 731.6 },
      ele_equipamentos_aterrados: { cx: 307.37, cy: 651.8 },
      ele_dois_eletricistas: { cx: 307.37, cy: 658.4 },
      ele_materiais_metalicos_afastados: { cx: 307.37, cy: 665.8 },
      ele_portas_subestacao_abertas: { cx: 307.37, cy: 674.2 },
      ele_livre_energia_residual: { cx: 307.37, cy: 687.4 },
      ele_chave_geral_bloqueada: { cx: 307.37, cy: 701.0 },
      ele_ferramentas_isolamento: { cx: 307.37, cy: 714.6 },
      ele_iluminacao_suficiente: { cx: 307.37, cy: 723.4 },
    },
  },
};

export function hasOverlay(codigo: string): boolean {
  return Boolean(OVERLAY_MAPS[codigo]);
}