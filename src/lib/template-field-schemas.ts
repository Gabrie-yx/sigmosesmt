/**
 * Esquemas de campos por template homologado + mapa padrão.
 * O mapa de cada revisão (overlay_map) é gerado automaticamente pelo próprio
 * sistema (leitura dos rótulos + linhas do PDF, sem IA — template-map-detect.ts)
 * quando um PDF novo sobe e pode ser ajustado visualmente no painel.
 * Coordenadas em pontos PDF, origem no canto superior-esquerdo.
 */

export type Box = { x: number; top: number; w: number; h: number };
export type BoxMap = { pageW: number; pageH: number; boxes: Record<string, Box> };

export type FieldKind = "text" | "check" | "sig" | "row" | "col";
export type FieldDef = { key: string; label: string; kind: FieldKind; hint: string; /** Página do PDF (1 por padrão). */ page?: number };

export type TemplateSchema = { codigo: string; nome: string; fields: FieldDef[]; defaultMap?: BoxMap; /** Revisão em que o defaultMap foi medido e conferido. */ defaultMapRevisao?: number };

const RC_FIELDS: FieldDef[] = [
  { key: "data", label: "Data", kind: "text", hint: "espaço em branco à direita do rótulo 'DATA:' (linha da classificação)" },
  { key: "numero", label: "Nº do pedido", kind: "text", hint: "espaço em branco após 'Nº DO PEDIDO:'" },
  { key: "solicitante", label: "Solicitante", kind: "text", hint: "espaço em branco após 'SOLICITANTE:'" },
  { key: "setor", label: "Setor", kind: "text", hint: "espaço em branco após 'SETOR:'" },
  { key: "fornecedor", label: "Fornecedor", kind: "text", hint: "espaço em branco após 'FORNECEDOR:'" },
  { key: "obra_construcao", label: "Obra em construção", kind: "text", hint: "espaço após 'OBRA CONSTRUÇÃO' ou o '( )' para marcar X" },
  { key: "obra_manutencao", label: "Obra em manutenção", kind: "text", hint: "espaço após 'OBRA MANUTENÇÃO' ou o '( )' para marcar X" },
  { key: "chk_material", label: "( ) Material", kind: "check", hint: "parênteses vazios logo após a palavra 'MATERIAL'" },
  { key: "chk_servico", label: "( ) Serviço", kind: "check", hint: "parênteses vazios logo após a palavra 'SERVIÇO'" },
  { key: "row_first", label: "1ª linha de itens", kind: "row", hint: "primeira linha de dados da tabela de itens (linha 01), largura total da tabela" },
  { key: "row_last", label: "Última linha de itens", kind: "row", hint: "última linha de dados da tabela de itens, largura total da tabela" },
  { key: "col_item", label: "Coluna ITEM", kind: "col", hint: "coluna 'ITEM', apenas na altura da 1ª linha de dados" },
  { key: "col_desc", label: "Coluna DESCRIÇÃO", kind: "col", hint: "coluna 'DESCRIÇÃO', apenas na altura da 1ª linha de dados" },
  { key: "col_qtde", label: "Coluna QTDE", kind: "col", hint: "coluna 'QTDE', apenas na altura da 1ª linha de dados" },
  { key: "col_unid", label: "Coluna UNID.", kind: "col", hint: "coluna 'UNID.', apenas na altura da 1ª linha de dados" },
  { key: "col_obs", label: "Coluna OBSERVAÇÃO", kind: "col", hint: "coluna 'OBSERVAÇÃO', apenas na altura da 1ª linha de dados" },
  { key: "sig_solicitante", label: "Assinatura solicitante", kind: "sig", hint: "área em branco do quadro 'ASSINATURA SOLICITANTE' (sem o título e sem a linha DATA)" },
  { key: "sig_supervisor", label: "Assinatura supervisor", kind: "sig", hint: "área em branco do quadro 'ASSINATURA SUPERVISOR GERAL'" },
  { key: "sig_compras", label: "Assinatura compras", kind: "sig", hint: "área em branco do quadro 'ASSINATURA ANALISTA DE COMPRAS'" },
  { key: "data_solicitante", label: "Data (solicitante)", kind: "text", hint: "espaço após 'DATA:' embaixo do quadro do solicitante" },
  { key: "data_supervisor", label: "Data (supervisor)", kind: "text", hint: "espaço após 'DATA:' embaixo do quadro do supervisor" },
  { key: "data_compras", label: "Data (compras)", kind: "text", hint: "espaço após 'DATA:' embaixo do quadro de compras" },
];

/** Medido à mão na Rev.01 do FOR-SEG-03 — usado só se a revisão não tiver mapa. */
const RC_DEFAULT: BoxMap = {
  pageW: 554.4,
  pageH: 513.12,
  boxes: {
    data: { x: 309, top: 77, w: 236, h: 14 },
    numero: { x: 362, top: 98, w: 183, h: 14 },
    solicitante: { x: 70, top: 98, w: 209, h: 14 },
    setor: { x: 44, top: 117, w: 235, h: 14 },
    fornecedor: { x: 345, top: 117, w: 200, h: 14 },
    obra_construcao: { x: 116, top: 137, w: 163, h: 14 },
    obra_manutencao: { x: 386, top: 137, w: 159, h: 14 },
    chk_material: { x: 176.5, top: 80.2, w: 8, h: 8 },
    chk_servico: { x: 227.3, top: 80.2, w: 8, h: 8 },
    row_first: { x: 10, top: 175, w: 538, h: 20.5 },
    row_last: { x: 10, top: 359.7, w: 538, h: 20.5 },
    col_item: { x: 10, top: 175, w: 39, h: 20.5 },
    col_desc: { x: 50, top: 175, w: 268, h: 20.5 },
    col_qtde: { x: 320.6, top: 175, w: 50, h: 20.5 },
    col_unid: { x: 371, top: 175, w: 50, h: 20.5 },
    col_obs: { x: 423, top: 175, w: 123, h: 20.5 },
    sig_solicitante: { x: 10, top: 420, w: 179, h: 50 },
    sig_supervisor: { x: 190, top: 420, w: 178, h: 50 },
    sig_compras: { x: 370, top: 420, w: 177, h: 50 },
    data_solicitante: { x: 38, top: 475, w: 140, h: 13 },
    data_supervisor: { x: 218, top: 475, w: 140, h: 13 },
    data_compras: { x: 398, top: 475, w: 140, h: 13 },
  },
};

const FICHA_FIELDS: FieldDef[] = [
  { key: "empresa", label: "Empresa", kind: "text", hint: "após 'Empresa:'" },
  { key: "admissao", label: "Data de admissão", kind: "text", hint: "após 'Data de Admissão:'" },
  { key: "nome", label: "Nome", kind: "text", hint: "após 'Nome:'" },
  { key: "demissao", label: "Data de demissão", kind: "text", hint: "após 'Data de Demissão:'" },
  { key: "funcao", label: "Função", kind: "text", hint: "após 'Função:'" },
  { key: "matricula", label: "Matrícula", kind: "text", hint: "após 'Matrícula:'" },
  { key: "folha", label: "Folha", kind: "text", hint: "após 'Folha:'" },
  { key: "empresa_termo", label: "Empresa (termo)", kind: "text", hint: "lacuna 'recebi da empresa ____'" },
  { key: "local_data", label: "Local e data", kind: "text", hint: "linha após 'Local e Data:'" },
  { key: "sig_empregado", label: "Assinatura do empregado", kind: "sig", hint: "acima da linha 'Assinatura do Empregado:'" },
  { key: "p2_row_first", label: "1ª linha de entregas", kind: "row", hint: "primeira linha da grade", page: 2 },
  { key: "p2_row_last", label: "Última linha de entregas", kind: "row", hint: "última linha da grade", page: 2 },
  { key: "p2_col_qt", label: "Coluna QT", kind: "col", hint: "", page: 2 },
  { key: "p2_col_und", label: "Coluna UND", kind: "col", hint: "", page: 2 },
  { key: "p2_col_espec", label: "Coluna Especificação", kind: "col", hint: "", page: 2 },
  { key: "p2_col_ca", label: "Coluna CA", kind: "col", hint: "", page: 2 },
  { key: "p2_col_ass_emp", label: "Coluna Assinatura empregado", kind: "col", hint: "", page: 2 },
  { key: "p2_col_data_entrega", label: "Coluna Data entrega", kind: "col", hint: "", page: 2 },
  { key: "p2_col_motivo", label: "Coluna Motivo", kind: "col", hint: "", page: 2 },
  { key: "p2_col_data_devol", label: "Coluna Data devolução", kind: "col", hint: "", page: 2 },
  { key: "p2_col_ass_receb", label: "Coluna Assinatura recebedor", kind: "col", hint: "", page: 2 },
];

const DDS_FIELDS: FieldDef[] = [
  { key: "empresa", label: "Empresa", kind: "text", hint: "após 'EMPRESA:' (cobre o nome impresso)" },
  { key: "local_setor", label: "Local / Setor", kind: "text", hint: "após 'LOCAL / SETOR:'" },
  { key: "data", label: "Data (semana)", kind: "text", hint: "após 'DATA:'" },
  { key: "assuntos", label: "Códigos dos assuntos", kind: "text", hint: "faixa 'CÓDIGO DOS ASSUNTOS…', à direita do título" },
  { key: "row_first", label: "1ª linha de funcionários", kind: "row", hint: "linha 1 da tabela" },
  { key: "row_last", label: "Última linha de funcionários", kind: "row", hint: "última linha da tabela" },
  { key: "col_nome", label: "Coluna Nome", kind: "col", hint: "" },
  { key: "col_funcao", label: "Coluna Função", kind: "col", hint: "" },
  { key: "sig_encarregado", label: "Assinatura encarregado", kind: "sig", hint: "acima da linha 'ENCARREGADO / DESIGNADO'" },
  { key: "sig_sesmt", label: "Assinatura SESMT", kind: "sig", hint: "acima da linha 'SESMT'" },
  { key: "sig_gerente", label: "Assinatura gerente", kind: "sig", hint: "acima da linha 'GERENTE DE CONTRATO'" },
];

export const TEMPLATE_SCHEMAS: Record<string, TemplateSchema> = {
  "FOR-SEG-03": { codigo: "FOR-SEG-03", nome: "Requisição de Compra", fields: RC_FIELDS, defaultMap: RC_DEFAULT, defaultMapRevisao: 1 },
  "FOR-SEG-02": { codigo: "FOR-SEG-02", nome: "Ficha de Entrega de EPI", fields: FICHA_FIELDS },
  "FOR-SEG-06": { codigo: "FOR-SEG-06", nome: "Lista de Presença DDS", fields: DDS_FIELDS },
};

export function getTemplateSchema(codigo: string): TemplateSchema | null {
  return TEMPLATE_SCHEMAS[codigo] ?? null;
}

/** Garante que o mapa tem todas as chaves do esquema (completa com o padrão). */
export function isBoxMap(m: unknown): m is BoxMap {
  return !!m && typeof m === "object" && "boxes" in (m as any) && "pageW" in (m as any);
}
