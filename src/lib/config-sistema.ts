// Centro de Configuração do SIGMO — o que varia de empresa para empresa.
// Regra: nada aqui é lei. Leis (NR, cálculos, assinaturas) ficam no núcleo fixo.

import type { AppModule } from "@/lib/access-control";

export type RotuloKey =
  | "casco"
  | "setor"
  | "frente"
  | "empresa"
  | "funcionario";

export type RotuloDef = {
  key: RotuloKey;
  descricao: string;
  singular: string;
  plural: string;
  exemplos: string;
};

export const ROTULOS_PADRAO: RotuloDef[] = [
  {
    key: "casco",
    descricao: "Unidade operacional (onde o trabalho acontece)",
    singular: "Casco / Embarcação",
    plural: "Cascos / Embarcações",
    exemplos: "Loja, Obra, Pista, Planta, Frota, Unidade",
  },
  {
    key: "setor",
    descricao: "Divisão interna da empresa",
    singular: "Setor",
    plural: "Setores",
    exemplos: "Área, Departamento, Célula",
  },
  {
    key: "frente",
    descricao: "Frente de serviço / contrato",
    singular: "Frente de Serviço",
    plural: "Frentes de Serviço",
    exemplos: "Contrato, Projeto, Rota, Turma",
  },
  {
    key: "empresa",
    descricao: "Organização cadastrada",
    singular: "Empresa",
    plural: "Empresas",
    exemplos: "Cliente, Filial, Unidade de Negócio",
  },
  {
    key: "funcionario",
    descricao: "Pessoa vinculada",
    singular: "Funcionário",
    plural: "Funcionários",
    exemplos: "Colaborador, Motorista, Aluno, Servidor",
  },
];

export type Genero = "o" | "a";
export type RotulosMap = Partial<
  Record<RotuloKey, { singular?: string; plural?: string; genero?: Genero }>
>;
export type ModulosMap = Partial<Record<AppModule, boolean>>;

export type EmpresaConfig = {
  id?: string;
  company_id: string | null;
  ramo: string | null;
  rotulos: RotulosMap;
  modulos: ModulosMap;
};

export const CONFIG_VAZIA: EmpresaConfig = {
  company_id: null,
  ramo: null,
  rotulos: {},
  modulos: {},
};

export function rotuloDe(
  cfg: Pick<EmpresaConfig, "rotulos">,
  key: RotuloKey,
  forma: "singular" | "plural" = "singular",
): string {
  const padrao = ROTULOS_PADRAO.find((r) => r.key === key)!;
  const custom = cfg.rotulos?.[key]?.[forma];
  const txt = (custom ?? "").trim();
  return txt || padrao[forma];
}

// ---- Módulos que podem ser ligados/desligados na nuvem ----
// SESMT e Usuários são núcleo: nunca desligam.
export const MODULOS_FIXOS: AppModule[] = ["sesmt", "usuarios"];

export const MODULOS_CONFIGURAVEIS: { key: AppModule; label: string; descricao: string }[] = [
  { key: "estoque", label: "Estoque", descricao: "Estoque de EPIs e fichas mensais" },
  { key: "almoxarifado", label: "Almoxarifado", descricao: "Entrega de EPI e fila de autorizações" },
  { key: "producao", label: "Produção", descricao: "Ordens, lista técnica e expedição" },
  { key: "compras", label: "Compras", descricao: "Requisições, cotações e fornecedores" },
  { key: "administrativo", label: "Administrativo", descricao: "Ponto, hora extra e requisições" },
  { key: "manutencao", label: "Manutenção", descricao: "Elétrica e mecânica" },
  { key: "portaria", label: "Portaria", descricao: "Controle de entrada, visitas e saídas" },
  { key: "cozinha", label: "Cozinha", descricao: "Refeições e controle da cozinha" },
];

// Enquanto ninguém configurar nada, vale este padrão (estado atual da nuvem).
export const MODULOS_PADRAO: ModulosMap = {
  estoque: true,
  almoxarifado: true,
  producao: false,
  compras: false,
  administrativo: false,
  manutencao: false,
  portaria: false,
  cozinha: false,
};

export function moduloLigado(cfg: Pick<EmpresaConfig, "modulos">, m: AppModule): boolean {
  if (MODULOS_FIXOS.includes(m)) return true;
  const v = cfg.modulos?.[m];
  if (typeof v === "boolean") return v;
  return MODULOS_PADRAO[m] === true;
}

// ---- Pacotes de ramo (semente: só sugere, nunca sobrescreve sozinho) ----
export type PacoteRamo = {
  key: string;
  nome: string;
  rotulos: RotulosMap;
  modulos: ModulosMap;
  nrs: string[];
};

export const PACOTES_RAMO: PacoteRamo[] = [
  {
    key: "estaleiro",
    nome: "Estaleiro / Construção Naval",
    rotulos: { casco: { singular: "Casco / Embarcação", plural: "Cascos / Embarcações" } },
    modulos: { estoque: true, almoxarifado: true, producao: true },
    nrs: ["NR-01", "NR-06", "NR-33", "NR-34", "NR-35", "NR-10", "NR-12"],
  },
  {
    key: "transporte",
    nome: "Transporte Terrestre",
    rotulos: {
      casco: { singular: "Frota / Veículo", plural: "Frota / Veículos" },
      frente: { singular: "Rota", plural: "Rotas" },
      funcionario: { singular: "Motorista", plural: "Motoristas" },
    },
    modulos: { estoque: true, almoxarifado: true },
    nrs: ["NR-01", "NR-06", "NR-07", "NR-11", "NR-17", "NR-20"],
  },
  {
    key: "industria",
    nome: "Indústria / Fabricação",
    rotulos: {
      casco: { singular: "Planta / Linha", plural: "Plantas / Linhas" },
      setor: { singular: "Área", plural: "Áreas" },
    },
    modulos: { estoque: true, almoxarifado: true, producao: true },
    nrs: ["NR-01", "NR-06", "NR-10", "NR-12", "NR-13", "NR-17"],
  },
  {
    key: "construcao",
    nome: "Construção Civil",
    rotulos: {
      casco: { singular: "Obra", plural: "Obras" },
      frente: { singular: "Frente de Serviço", plural: "Frentes de Serviço" },
    },
    modulos: { estoque: true, almoxarifado: true },
    nrs: ["NR-01", "NR-06", "NR-18", "NR-35", "NR-10", "NR-12"],
  },
  {
    key: "comercio",
    nome: "Comércio / Varejo",
    rotulos: {
      casco: { singular: "Loja", plural: "Lojas" },
      funcionario: { singular: "Colaborador", plural: "Colaboradores" },
    },
    modulos: { estoque: true },
    nrs: ["NR-01", "NR-06", "NR-17", "NR-23", "NR-24"],
  },
  {
    key: "educacao",
    nome: "Escola / Formação Técnica",
    rotulos: {
      casco: { singular: "Unidade / Campus", plural: "Unidades / Campi" },
      setor: { singular: "Departamento", plural: "Departamentos" },
      funcionario: { singular: "Colaborador", plural: "Colaboradores" },
    },
    modulos: { estoque: true },
    nrs: ["NR-01", "NR-06", "NR-10", "NR-17", "NR-23"],
  },
  {
    key: "saude",
    nome: "Saúde / Hospitalar",
    rotulos: {
      casco: { singular: "Unidade", plural: "Unidades" },
      setor: { singular: "Ala / Setor", plural: "Alas / Setores" },
    },
    modulos: { estoque: true, almoxarifado: true },
    nrs: ["NR-01", "NR-06", "NR-32", "NR-17", "NR-23"],
  },
];
