import jsPDF from "jspdf";
import { gerarPdfRequisicaoDoc, type RcPdfReq, type RcPdfItem } from "./requisicao-compra-pdf";

export type MedItem = {
  descricao: string;
  apresentacao: string;
  unidade: string;
  quantidade: number | string;
  justificativa?: string;
};

/**
 * Lista padrão do ambulatório DMN — uso diário (analgésicos, antitérmicos,
 * antiácidos, colírios, curativos básicos, antissépticos).
 * Não inclui medicação controlada (Portaria 344/98) — esses dependem de
 * prescrição médica e não vão para requisição de uso livre.
 */
export const MEDICAMENTOS_AMBULATORIO_PADRAO: MedItem[] = [
  // Analgésicos / antitérmicos
  { descricao: "Dipirona Sódica 500mg",                 apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 4 },
  { descricao: "Paracetamol 750mg",                     apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 3 },
  { descricao: "Ibuprofeno 600mg",                      apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },
  { descricao: "Dorflex (Orfenadrina+Dipirona+Cafeína)",apresentacao: "Comprimido",     unidade: "CX c/ 30", quantidade: 3 },
  { descricao: "Buscopan Composto",                     apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },

  // Estômago / gastrite
  { descricao: "Omeprazol 20mg",                        apresentacao: "Cápsula",        unidade: "CX c/ 28", quantidade: 3 },
  { descricao: "Hidróxido de Alumínio + Magnésio",      apresentacao: "Suspensão 240ml",unidade: "FRASCO",   quantidade: 6 },
  { descricao: "Sais para Reidratação Oral",            apresentacao: "Sachê",          unidade: "UN",       quantidade: 20 },

  // Alergia
  { descricao: "Loratadina 10mg",                       apresentacao: "Comprimido",     unidade: "CX c/ 12", quantidade: 2 },

  // Olhos / vias aéreas
  { descricao: "Colírio Lubrificante (Lágrima Artif.)", apresentacao: "Frasco 15ml",    unidade: "FRASCO",   quantidade: 6 },
  { descricao: "Soro Fisiológico 0,9% — flaconete 5ml", apresentacao: "Flaconete",      unidade: "UN",       quantidade: 50 },
  { descricao: "Soro Fisiológico 0,9% — 250ml",         apresentacao: "Frasco",         unidade: "FRASCO",   quantidade: 8 },

  // Pele / uso tópico
  { descricao: "Sulfadiazina de Prata 1% (queimadura)", apresentacao: "Pomada 50g",     unidade: "TUBO",     quantidade: 3 },
  { descricao: "Diclofenaco Dietilamônio Gel",          apresentacao: "Bisnaga 60g",    unidade: "TUBO",     quantidade: 3 },
  { descricao: "Protetor Solar FPS 50+",                apresentacao: "Frasco 120ml",   unidade: "FRASCO",   quantidade: 8 },
  { descricao: "Repelente de Insetos (Icaridina)",      apresentacao: "Spray 100ml",    unidade: "UN",       quantidade: 6 },

  // Antissépticos
  { descricao: "Álcool Etílico 70% líquido",            apresentacao: "1 Litro",        unidade: "UN",       quantidade: 6 },
  { descricao: "Álcool Gel 70%",                        apresentacao: "Frasco 500ml",   unidade: "FRASCO",   quantidade: 8 },
  { descricao: "PVP-I Tópico (Iodopovidona)",           apresentacao: "Frasco 100ml",   unidade: "FRASCO",   quantidade: 4 },
  { descricao: "Clorexidina Aquosa 0,2%",               apresentacao: "Frasco 100ml",   unidade: "FRASCO",   quantidade: 4 },

  // Curativos
  { descricao: "Bandagem Adesiva (Band-Aid)",           apresentacao: "Caixa 35un",     unidade: "CX",       quantidade: 6 },
  { descricao: "Gaze Estéril 7,5 x 7,5 cm",             apresentacao: "Pacote c/ 10",   unidade: "PCT",      quantidade: 15 },
  { descricao: "Atadura de Crepe 10cm",                 apresentacao: "Rolo",           unidade: "UN",       quantidade: 15 },
  { descricao: "Esparadrapo 10cm x 4,5m",               apresentacao: "Rolo",           unidade: "UN",       quantidade: 6 },
  { descricao: "Micropore 25mm",                        apresentacao: "Rolo",           unidade: "UN",       quantidade: 6 },

  // Insumos / EPI ambulatório
  { descricao: "Luva de Procedimento (Nitrílica) — M",  apresentacao: "Caixa c/ 100",   unidade: "CX",       quantidade: 2 },
  { descricao: "Termômetro Digital",                    apresentacao: "Axilar",         unidade: "UN",       quantidade: 2 },
  { descricao: "Compressa Fria Instantânea",            apresentacao: "Bolsa descart.", unidade: "UN",       quantidade: 6 },
];

/**
 * Catálogo de sugestões para a busca rápida (não entra na lista padrão).
 * Permite adicionar variações de dose / itens comuns sem precisar digitar tudo.
 */
export const MEDICAMENTOS_SUGESTOES: MedItem[] = [
  { descricao: "Dipirona Sódica 1g",                    apresentacao: "Comprimido",     unidade: "CX c/ 10", quantidade: 2 },
  { descricao: "Dipirona Gotas 500mg/ml",               apresentacao: "Frasco 10ml",    unidade: "FRASCO",   quantidade: 4 },
  { descricao: "Paracetamol 500mg",                     apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },
  { descricao: "Paracetamol Gotas 200mg/ml",            apresentacao: "Frasco 15ml",    unidade: "FRASCO",   quantidade: 2 },
  { descricao: "Nimesulida 100mg",                      apresentacao: "Comprimido",     unidade: "CX c/ 12", quantidade: 2 },
  { descricao: "Cetoprofeno 100mg",                     apresentacao: "Comprimido",     unidade: "CX c/ 10", quantidade: 2 },
  { descricao: "Buscopan Simples 10mg",                 apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },
  { descricao: "Plasil (Metoclopramida 10mg)",          apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },
  { descricao: "Ranitidina 150mg",                      apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },
  { descricao: "Pantoprazol 40mg",                      apresentacao: "Comprimido",     unidade: "CX c/ 14", quantidade: 2 },
  { descricao: "Loratadina Xarope",                     apresentacao: "Frasco 100ml",   unidade: "FRASCO",   quantidade: 2 },
  { descricao: "Dexclorfeniramina 2mg",                 apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },
  { descricao: "Cetoconazol Creme 2%",                  apresentacao: "Bisnaga 30g",    unidade: "TUBO",     quantidade: 2 },
  { descricao: "Hidrocortisona Creme 1%",               apresentacao: "Bisnaga 30g",    unidade: "TUBO",     quantidade: 2 },
  { descricao: "Cânfora + Mentol (gelol)",              apresentacao: "Bisnaga 30g",    unidade: "TUBO",     quantidade: 2 },
  { descricao: "Água Oxigenada 10vol",                  apresentacao: "Frasco 100ml",   unidade: "FRASCO",   quantidade: 4 },
  { descricao: "Luva de Procedimento (Nitrílica) — P",  apresentacao: "Caixa c/ 100",   unidade: "CX",       quantidade: 1 },
  { descricao: "Luva de Procedimento (Nitrílica) — G",  apresentacao: "Caixa c/ 100",   unidade: "CX",       quantidade: 1 },
  { descricao: "Máscara Cirúrgica Tripla",              apresentacao: "Caixa c/ 50",    unidade: "CX",       quantidade: 4 },
  { descricao: "Algodão Hidrófilo",                     apresentacao: "Pacote 500g",    unidade: "PCT",      quantidade: 2 },
  { descricao: "Cotonete (Hastes Flexíveis)",           apresentacao: "Caixa c/ 75",    unidade: "CX",       quantidade: 2 },
  { descricao: "Tesoura para Curativo",                 apresentacao: "Inox",           unidade: "UN",       quantidade: 1 },
  { descricao: "Pinça Anatômica",                       apresentacao: "Inox",           unidade: "UN",       quantidade: 1 },
  { descricao: "Esfigmomanômetro Aneróide",             apresentacao: "Adulto",         unidade: "UN",       quantidade: 1 },
  { descricao: "Estetoscópio Duosson",                  apresentacao: "Adulto",         unidade: "UN",       quantidade: 1 },
  { descricao: "Oxímetro de Pulso Portátil",            apresentacao: "Dedo",           unidade: "UN",       quantidade: 1 },
  { descricao: "Soro Glicosado 5% — 500ml",             apresentacao: "Frasco",         unidade: "FRASCO",   quantidade: 4 },
];

export type RequisicaoMedicamentosOpts = {
  numero?: string;
  setor?: string;
  solicitante: string;
  responsavelTST?: string;
  responsavelAprovador?: string;
  observacoes?: string;
  itens: MedItem[];
  assinaturaSolicitanteDataUrl?: string;
  assinaturaSolicitanteHeightMm?: number;
};

/**
 * Gera o PDF da Requisição de Medicamentos usando EXATAMENTE o mesmo layout
 * homologado FOR-COMP-03 (padrão ISO 9001) das demais requisições de compra.
 * Isso mantém uma única forma de documento para material, serviço e medicamentos.
 */
export async function buildRequisicaoMedicamentosPdf(
  opts: RequisicaoMedicamentosOpts,
): Promise<jsPDF> {
  const hojeIso = new Date().toISOString().slice(0, 10);
  const req: RcPdfReq = {
    id: "med",
    numero: opts.numero ?? "",
    titulo: "REQUISIÇÃO DE MEDICAMENTOS / INSUMOS DE AMBULATÓRIO",
    data_requisicao: hojeIso,
    classificacao: "MEDICAMENTOS",
    solicitante: opts.solicitante,
    setor: opts.setor ?? "SESMT — Ambulatório",
    fornecedor: null,
    obra_construcao: null,
    obra_manutencao: null,
    codigo_formulario: "03",
    revisao: "01",
    data_revisao: hojeIso,
    pagina: "01/01",
    status: "PENDENTE",
    signature_solicitante: opts.assinaturaSolicitanteDataUrl ?? null,
    signature_solicitante_height: opts.assinaturaSolicitanteHeightMm ?? 18,
    cotador_nome: opts.responsavelAprovador ?? null,
  };

  const itens: RcPdfItem[] = opts.itens.map((it, idx) => {
    const descCompleta = it.apresentacao
      ? `${it.descricao} — ${it.apresentacao}`
      : it.descricao;
    const obsBase = it.justificativa?.trim() || "Reposição de estoque";
    return {
      item_numero: idx + 1,
      descricao: descCompleta,
      quantidade: it.quantidade,
      unidade: it.unidade,
      observacao: obsBase,
    };
  });

  return gerarPdfRequisicaoDoc(req, itens, []);
}

export async function downloadRequisicaoMedicamentosPdf(opts: RequisicaoMedicamentosOpts) {
  const doc = await buildRequisicaoMedicamentosPdf(opts);
  doc.save(`requisicao-medicamentos-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function previewRequisicaoMedicamentosPdf(
  opts: RequisicaoMedicamentosOpts,
): Promise<string> {
  const doc = await buildRequisicaoMedicamentosPdf(opts);
  return doc.output("dataurlstring");
}