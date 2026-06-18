// Dados institucionais da empresa para cabeçalhos de relatórios/PDF.
// Centralizado aqui para manter consistência em todos os documentos.
// Atualize endereço/contato conforme necessário — o restante dos PDFs
// que usam drawPdfHeader herdam automaticamente.

export const EMPRESA_INFO = {
  razao_social: "DMN ESTALEIRO DA AMAZÔNIA LTDA",
  cnpj: "13.378.697/0001-80",
  endereco: "Estrada do Brasileirinho, s/nº — Distrito Industrial II",
  cidade_uf_cep: "Manaus / AM — CEP 69.082-200",
  contato: "sesmt@dmnestaleiro.com.br",
} as const;

export type EmpresaInfo = typeof EMPRESA_INFO;
