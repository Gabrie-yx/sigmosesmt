export type OverlayField = {
  page?: number;
  top: number;
  x: number;
  maxW: number;
  size?: number;
  baselineOffset?: number;
  bold?: boolean;
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
      data_inicio:  { x:  54, top: 84.6, maxW: 64, size: 7, bold: true, baselineOffset: 1.8 },
      hora_inicio:  { x: 178, top: 84.6, maxW: 54, size: 7, bold: true, baselineOffset: 1.8 },
      data_fim:     { x: 292, top: 84.6, maxW: 64, size: 7, bold: true, baselineOffset: 1.8 },
      hora_fim:     { x: 390, top: 84.6, maxW: 54, size: 7, bold: true, baselineOffset: 1.8 },
      pt_numero:    { x: 501, top: 81.7, maxW: 48, size: 6.2, bold: true, baselineOffset: 1.8 },
      // Identificação
      empresa:          { x:  92, top: 162.2, maxW: 210, size: 6.2, bold: true, baselineOffset: 1.8 },
      encarregado:      { x: 392, top: 162.2, maxW: 170, size: 6.2, bold: true, baselineOffset: 1.8 },
      local_descricao:  { x:  92, top: 172.8, maxW: 470, size: 6.2, baselineOffset: 1.8 },
      outros_atividade_texto: { x: 277, top: 135.2, maxW: 70, size: 5.4, baselineOffset: 1.6 },
      outros_risco_texto: { x: 415, top: 327.8, maxW: 140, size: 5.4, baselineOffset: 1.6 },
      outros_snna_texto: { x: 338, top: 395.2, maxW: 205, size: 5.4, baselineOffset: 1.6 },
      teste_atmosfera_horario: { x: 160, top: 511.5, maxW: 42, size: 5.4, baselineOffset: 1.6 },
      teste_atmosfera_percentual: { x: 56, top: 517.5, maxW: 26, size: 5.4, baselineOffset: 1.6 },
      designado_liberacao: { x: 405, top: 501.7, maxW: 135, size: 5.4, baselineOffset: 1.6 },
      responsavel_bloqueio: { x: 413, top: 735.7, maxW: 126, size: 5.4, baselineOffset: 1.6 },
    },
    checkboxes: {
      // Descrição das atividades a serem executadas
      movimentacao_cargas: { cx:  44.2, cy: 113.1 },
      manutencao_civil:    { cx: 159.4, cy: 116.9 },
      gases_inflamaveis:   { cx: 251.2, cy: 113.1 },
      altura_telhados:     { cx: 329.6, cy: 113.1 },
      demolicao_escavacao: { cx: 426.6, cy: 116.7 },
      eletricidade:        { cx: 521.2, cy: 116.7 },
      trabalho_quente:     { cx:  56.0, cy: 139.1 },
      local_confinado:     { cx: 162.0, cy: 135.3 },
      outros_atividade:    { cx: 251.0, cy: 139.1 },
      // Mão-de-obra
      mao_interna:         { cx: 327.0, cy: 145.5 },
      mao_externa:         { cx: 368.0, cy: 145.5 },
      // Fim de semana / feriado
      fds_sim:             { cx: 482.0, cy: 145.5 },
      fds_nao:             { cx: 514.6, cy: 145.5 },
      // Área restrita
      area_restrita_sim:   { cx:  89.0, cy: 155.3 },
      area_restrita_nao:   { cx: 128.8, cy: 155.3 },
      ris_projecao_particulas: { cx: 42.0, cy: 216.7 },
      ris_produtos_inflamaveis: { cx: 42.0, cy: 225.3 },
      ris_choque_eletrico: { cx: 42.0, cy: 233.5 },
      ris_ruido_excessivo: { cx: 42.0, cy: 241.7 },
      ris_queda_diferenca_nivel: { cx: 42.0, cy: 252.3 },
      ris_piso_escorregadio: { cx: 42.0, cy: 263.1 },
      ris_contato_quimico_pele: { cx: 42.0, cy: 272.5 },
      ris_postura_inadequada: { cx: 42.0, cy: 282.3 },
      ris_vapores_organicos: { cx: 42.0, cy: 291.9 },
      ris_trabalho_sobre_telhado: { cx: 42.0, cy: 300.9 },
      ris_trabalho_eletrico_areas_classificadas: { cx: 42.0, cy: 309.3 },
      ris_contato_cantos_vivos: { cx: 42.0, cy: 320.3 },
      ris_risco_queimadura: { cx: 42.0, cy: 330.9 },
      ris_levantamento_peso: { cx: 216.0, cy: 216.7 },
      ris_queda_pta: { cx: 216.0, cy: 225.3 },
      ris_demolicao: { cx: 216.0, cy: 233.5 },
      ris_escavacao_desmoronamento: { cx: 216.0, cy: 241.7 },
      ris_queda_escada: { cx: 216.0, cy: 252.3 },
      ris_queda_andaimes: { cx: 216.0, cy: 263.1 },
      ris_radiacao_nao_ionizante: { cx: 216.0, cy: 272.5 },
      ris_fumos_metalicos: { cx: 216.0, cy: 282.3 },
      ris_trabalho_quente_faiscas: { cx: 216.0, cy: 291.9 },
      ris_manuseio_inflamaveis: { cx: 216.0, cy: 300.9 },
      ris_prensamento_membros: { cx: 216.0, cy: 309.3 },
      ris_animais_peconhentos: { cx: 216.0, cy: 320.3 },
      ris_tubulacao_cabos_enterrados: { cx: 216.0, cy: 330.9 },
      ris_uso_inadequado_ferramentas: { cx: 392.8, cy: 216.7 },
      ris_explosao_incendio: { cx: 392.8, cy: 225.3 },
      ris_exposicao_poeiras: { cx: 392.8, cy: 233.5 },
      ris_exposicao_gases_vapores: { cx: 392.8, cy: 241.7 },
      ris_manuseio_equipamento_guindar: { cx: 392.8, cy: 252.3 },
      ris_movimentacao_maquinas: { cx: 392.8, cy: 263.1 },
      ris_espaco_confinado: { cx: 392.8, cy: 272.5 },
      ris_expor_terceiros: { cx: 392.8, cy: 282.3 },
      ris_desmoronamento_soterramento: { cx: 392.8, cy: 291.9 },
      ris_condicoes_climaticas: { cx: 392.8, cy: 300.9 },
      ris_superficie_arestas: { cx: 392.8, cy: 309.3 },
      ris_radiacao_solar: { cx: 392.8, cy: 320.3 },
      ris_outros: { cx: 392.8, cy: 330.9 },
      snna_local_limpo_sinalizado: { cx: 42.0, cy: 351.3 },
      snna_equipe_conhece_emergencia: { cx: 42.0, cy: 359.5 },
      snna_rotas_fuga: { cx: 42.0, cy: 369.7 },
      snna_local_isolado: { cx: 42.0, cy: 380.5 },
      snna_ca_epi_validos: { cx: 42.0, cy: 389.7 },
      snna_apr_elaborada_entregue: { cx: 42.0, cy: 398.3 },
      snna_ambiente_protegido_vazamento: { cx: 315.8, cy: 351.3 },
      snna_trabalhadores_area_protegidos: { cx: 315.8, cy: 359.5 },
      snna_equipamentos_inspecionados: { cx: 315.8, cy: 369.7 },
      snna_fontes_energia_bloqueadas: { cx: 315.8, cy: 380.5 },
      snna_documentacoes_terceiros: { cx: 315.8, cy: 389.7 },
      snna_outros: { cx: 315.8, cy: 398.3 },
      hot_materiais_combustiveis_controlados: { cx: 42.0, cy: 421.1 },
      hot_cenario_incendio_protegido: { cx: 315.8, cy: 421.1 },
      hot_cilindros_oxiacetileno_valvulas: { cx: 42.0, cy: 437.1 },
      hot_brigada_habilitada: { cx: 315.8, cy: 437.1 },
      hot_cilindros_manometro: { cx: 42.0, cy: 447.9 },
      hot_acendedor_macarico: { cx: 315.8, cy: 447.7 },
      hot_recipientes_purgados: { cx: 42.0, cy: 455.7 },
      hot_equipamentos_boas_condicoes: { cx: 315.8, cy: 455.1 },
      hot_cilindros_vertical_seguro: { cx: 42.0, cy: 463.7 },
      hot_fispq_solda: { cx: 315.8, cy: 463.7 },
      hot_epis_quente_adequados: { cx: 42.0, cy: 472.3 },
      hot_executante_qualificado: { cx: 315.8, cy: 472.3 },
      hot_vigilancia_incendio_presente: { cx: 42.0, cy: 485.3 },
      hot_local_limpo_sem_combustiveis: { cx: 315.8, cy: 482.3 },
      hot_iluminacao_prova_explosao: { cx: 42.0, cy: 497.3 },
      hot_sprinklers_funcionando: { cx: 315.8, cy: 497.3 },
      hot_teste_explosimetro: { cx: 42.0, cy: 505.5 },
      alt_condicoes_atmosfericas: { cx: 42.0, cy: 544.1 },
      alt_escadas_andaime_boas_condicoes: { cx: 42.0, cy: 551.3 },
      alt_envolvidos_condicoes_fisicas: { cx: 42.0, cy: 559.5 },
      alt_estabilidade_andaimes: { cx: 42.0, cy: 567.9 },
      alt_segunda_pessoa: { cx: 42.0, cy: 582.1 },
      alt_nr35_autorizados: { cx: 42.0, cy: 592.9 },
      alt_iluminacao_suficiente: { cx: 42.0, cy: 603.9 },
      alt_itens_seg_pta: { cx: 42.0, cy: 611.9 },
      alt_escadas_amarradas: { cx: 42.0, cy: 620.1 },
      alt_andaimes_rodas_travados: { cx: 42.0, cy: 628.3 },
      alt_fixar_pranchoes: { cx: 315.8, cy: 544.1 },
      alt_pontos_ancoragem: { cx: 315.8, cy: 550.7 },
      alt_afastados_rede_eletrica: { cx: 315.8, cy: 558.9 },
      alt_equipamentos_prevencao_queda: { cx: 315.8, cy: 567.1 },
      alt_telhas_sem_umidade: { cx: 315.8, cy: 581.7 },
      alt_andaimes_ancorados: { cx: 315.8, cy: 589.9 },
      alt_area_abaixo_isolada: { cx: 315.8, cy: 603.5 },
      alt_escada_acesso_guarda_corpo: { cx: 315.8, cy: 611.3 },
      alt_clima_area_externa: { cx: 315.8, cy: 619.5 },
      alt_plano_resgate: { cx: 315.8, cy: 628.3 },
      ele_fontes_desenergizadas: { cx: 42.0, cy: 659.3 },
      ele_fontes_bloqueadas: { cx: 42.0, cy: 666.1 },
      ele_teste_ausencia_tensao: { cx: 42.0, cy: 673.9 },
      ele_sinalizada_fonte: { cx: 42.0, cy: 684.7 },
      ele_roupas_obrigatorias: { cx: 42.0, cy: 698.1 },
      ele_recomendacoes_seccionamento: { cx: 42.0, cy: 711.7 },
      ele_nr10_sep_autorizados: { cx: 42.0, cy: 722.9 },
      ele_paineis_bloqueados: { cx: 42.0, cy: 730.9 },
      ele_local_condicoes_ideais: { cx: 42.0, cy: 739.1 },
      ele_equipamentos_aterrados: { cx: 315.8, cy: 659.3 },
      ele_dois_eletricistas: { cx: 315.8, cy: 665.9 },
      ele_materiais_metalicos_afastados: { cx: 315.8, cy: 673.3 },
      ele_portas_subestacao_abertas: { cx: 315.8, cy: 681.7 },
      ele_livre_energia_residual: { cx: 315.8, cy: 694.9 },
      ele_chave_geral_bloqueada: { cx: 315.8, cy: 708.5 },
      ele_ferramentas_isolamento: { cx: 315.8, cy: 722.1 },
      ele_iluminacao_suficiente: { cx: 315.8, cy: 730.9 },
    },
  },
};

export function hasOverlay(codigo: string): boolean {
  return Boolean(OVERLAY_MAPS[codigo]);
}