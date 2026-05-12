export const NRS_LIST = [
  "NR-05",
  "NR-06",
  "NR-10",
  "NR-11",
  "NR-12",
  "NR-17",
  "NR-20",
  "NR-33",
  "NR-34",
  "NR-35",
] as const;

export const COMPANY_TYPES = ["CLT", "TERCEIRIZADO", "CONTRATANTE"] as const;

export const EMPLOYEE_STATUSES = ["ATIVO", "INATIVO", "AFASTADO"] as const;

export const TIPOS_EXAME = [
  "ASO Clínico",
  "Audiometria",
  "Espirometria",
  "Raio-X de Tórax OIT",
  "Acuidade Visual",
  "ECG",
  "EEG",
] as const;

export const NATUREZAS_EXAME = [
  "Admissional",
  "Periódico",
  "Retorno ao Trabalho",
  "Mudança de Risco Ocupacional",
  "Demissional",
  "Semestral",
] as const;

// Mapeia o rótulo exibido (employee_exams.natureza) → chave usada em roles.exames_por_natureza
export const NATUREZA_KEY_MAP: Record<string, "ADMISSIONAL" | "PERIODICO" | "RETORNO_TRABALHO" | "MUDANCA_RISCO" | "DEMISSIONAL" | "SEMESTRAL"> = {
  "Admissional": "ADMISSIONAL",
  "Periódico": "PERIODICO",
  "Retorno ao Trabalho": "RETORNO_TRABALHO",
  "Mudança de Risco Ocupacional": "MUDANCA_RISCO",
  "Mudança de Função": "MUDANCA_RISCO",
  "Demissional": "DEMISSIONAL",
  "Semestral": "SEMESTRAL",
};

export const PTE_RISCOS = [
  "Trabalho a Quente",
  "Espaço Confinado",
  "Trabalho em Altura",
  "Eletricidade Alta Tensão",
  "Limpeza de Tanque (Risco Biológico)",
] as const;

export const VACINAS_LIST = [
  "Tétano/Difteria (dT)",
  "Hepatite B",
  "Febre Amarela",
  "Tríplice Viral (SCR)",
  "Influenza",
  "COVID-19",
] as const;

// Vacinas obrigatórias quando o cargo tem risco biológico (PCMSO Rev.05)
export const VACINAS_RISCO_BIOLOGICO = ["Tétano/Difteria (dT)", "Hepatite B"] as const;

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

// Bairros oficiais de Manaus (64) — Prefeitura Municipal de Manaus, atualizado em 22/12/2025
// Fonte: https://pt.wikipedia.org/wiki/Lista_de_bairros_de_Manaus
export const BAIRROS_MANAUS = [
  "Adrianópolis",
  "Aleixo",
  "Alvorada",
  "Armando Mendes",
  "Betânia",
  "Cachoeirinha",
  "Centro",
  "Chapada",
  "Cidade de Deus",
  "Cidade Nova",
  "Colônia Antônio Aleixo",
  "Colônia Japonesa",
  "Colônia Oliveira Machado",
  "Colônia Santo Antônio",
  "Colônia Terra Nova",
  "Compensa",
  "Coroado",
  "Crespo",
  "Da Paz",
  "Distrito Industrial I",
  "Distrito Industrial II",
  "Dom Pedro",
  "Educandos",
  "Flores",
  "Gilberto Mestrinho",
  "Glória",
  "Japiim",
  "Jorge Teixeira",
  "Lago Azul",
  "Lírio do Vale",
  "Mauazinho",
  "Monte das Oliveiras",
  "Morro da Liberdade",
  "Nossa Senhora Aparecida",
  "Nossa Senhora das Graças",
  "Nova Cidade",
  "Nova Esperança",
  "Novo Aleixo",
  "Novo Israel",
  "Parque 10 de Novembro",
  "Petrópolis",
  "Planalto",
  "Ponta Negra",
  "Praça 14 de Janeiro",
  "Presidente Vargas",
  "Puraquequara",
  "Raiz",
  "Redenção",
  "Santa Etelvina",
  "Santa Luzia",
  "Santo Agostinho",
  "Santo Antônio",
  "São Francisco",
  "São Geraldo",
  "São Jorge",
  "São José Operário",
  "São Lázaro",
  "São Raimundo",
  "Tancredo Neves",
  "Tarumã",
  "Tarumã-Açu",
  "Vila Buriti",
  "Vila da Prata",
  "Zumbi dos Palmares",
] as const;

export const DOC_TYPES = [
  { key: "rg", label: "RG (Frente e Verso)", required: true },
  { key: "cpf", label: "CPF (Documento)", required: true },
  { key: "address", label: "Comprovante de Residência", required: true },
  { key: "mei", label: "Comprovante de MEI / CCMEI", required: false, onlyMei: true },
] as const;