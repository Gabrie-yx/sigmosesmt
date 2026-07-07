import { z } from "zod";

export const APP_MODULES = {
  sesmt: "SESMT",
  estoque: "Estoque",
  producao: "Produção",
  manutencao: "Manutenção",
  portaria: "Portaria",
  eletrica: "Elétrica",
  mecanica: "Mecânica",
  usuarios: "Usuários",
  compras: "Compras",
  administrativo: "Administrativo",
  almoxarifado: "Almoxarifado",
} as const;

export type AppModule = keyof typeof APP_MODULES;

export const APP_MODULE_VALUES = Object.keys(APP_MODULES) as [AppModule, ...AppModule[]];

export const APP_ROLES = {
  admin: {
    label: "Administrador",
    desc: "Acesso total + gerencia usuários (MFA obrigatório)",
  },
  moderador: {
    label: "Moderador",
    desc: "Edita + aprova/revoga ações sensíveis (MFA obrigatório)",
  },
  editor: {
    label: "Editor",
    desc: "Cria e edita registros nos módulos liberados",
  },
  viewer: {
    label: "Visualizador",
    desc: "Somente leitura nos módulos liberados",
  },
  compras: {
    label: "Compras",
    desc: "Opera RCs, cota fornecedores e envia requisições cotadas",
  },
  tst: {
    label: "Técnico de Segurança (TST)",
    desc: "Opera SESMT, valida saídas de funcionários e libera módulos regulatórios",
  },
  porteiro: {
    label: "Porteiro",
    desc: "Registra entradas/saídas na Portaria e valida saída de funcionários",
  },
} as const;

export type AppRole = keyof typeof APP_ROLES | "extra_sabado_marcador";

export const MANAGED_APP_ROLE_VALUES = Object.keys(APP_ROLES) as [AppRole, ...AppRole[]];

export const appModuleSchema = z.enum(APP_MODULE_VALUES);
export const managedAppRoleSchema = z.enum(MANAGED_APP_ROLE_VALUES);

export function moduleLabel(module: string) {
  return APP_MODULES[module as AppModule] ?? module;
}