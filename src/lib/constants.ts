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
  "Mudança de Função",
  "Demissional",
] as const;

export const PTE_RISCOS = [
  "Trabalho a Quente",
  "Espaço Confinado",
  "Trabalho em Altura",
  "Eletricidade Alta Tensão",
] as const;

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

export const DOC_TYPES = [
  { key: "rg", label: "RG (Frente e Verso)", required: true },
  { key: "cpf", label: "CPF (Documento)", required: true },
  { key: "address", label: "Comprovante de Residência", required: true },
  { key: "mei", label: "Comprovante de MEI / CCMEI", required: false, onlyMei: true },
] as const;