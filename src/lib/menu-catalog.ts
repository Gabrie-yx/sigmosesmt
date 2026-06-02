import type { AppModule } from "@/hooks/use-auth";

export type MenuEntry = {
  key: string; // = rota base (ex.: "/app/aprs"). Funciona como identificador único.
  label: string;
  module: AppModule;
};

// Fonte única de verdade dos menus controláveis por permissão granular.
// Chave = rota base. Tem que bater com o que aparece na sidebar e no guard.
export const MENU_CATALOG: MenuEntry[] = [
  // ----- SESMT -----
  { key: "/app/painel", label: "Painel de Indicadores", module: "sesmt" },
  { key: "/app/sesmt/procedimentos", label: "Procedimentos / POPs", module: "sesmt" },
  { key: "/app/matriz-treinamento", label: "Matriz de Treinamento", module: "sesmt" },
  { key: "/app/sesmt/docs", label: "Documentos SESMT", module: "sesmt" },
  { key: "/app/sesmt/guia-documentos", label: "Guia: Onde encontrar laudos?", module: "sesmt" },
  { key: "/app/controle-documentos", label: "Controle de Documentos", module: "sesmt" },
  { key: "/app/extintores", label: "Controle de Extintores", module: "sesmt" },
  { key: "/app/sesmt/requisicoes", label: "Requisições de Compra", module: "sesmt" },
  { key: "/app/dds", label: "DDS — Diálogo de Segurança", module: "sesmt" },
  { key: "/app/aprs", label: "APRs — Análise de Risco", module: "sesmt" },
  { key: "/app/ptes", label: "PTEs — Permissão de Trabalho", module: "sesmt" },
  { key: "/app/oss", label: "OSS — Ordens de Serviço (NR-01)", module: "sesmt" },
  { key: "/app/trainings", label: "Treinamentos & NRs", module: "sesmt" },
  { key: "/app/sesmt/equipamentos-moveis", label: "Checklist de Equipamentos", module: "sesmt" },
  { key: "/app/sesmt/terceiros", label: "Painel de Terceiros", module: "sesmt" },
  { key: "/app/relatorios/reincidencia-epi", label: "Reincidência de EPI", module: "sesmt" },
  { key: "/app/ncs", label: "Não Conformidades", module: "sesmt" },
  { key: "/app/incidentes", label: "Incidentes / Investigação", module: "sesmt" },
  { key: "/app/acoes", label: "Plano de Ações (5W2H)", module: "sesmt" },
  { key: "/app/employees", label: "Funcionários", module: "sesmt" },
  { key: "/app/cascos", label: "Cascos / Embarcações", module: "sesmt" },
  { key: "/app/companies", label: "Empresas / Contratadas", module: "sesmt" },
  { key: "/app/roles", label: "Cargos & Matriz de Riscos", module: "sesmt" },
  { key: "/app/matriz-riscos", label: "Matriz de Riscos (PGR/LTCAT)", module: "sesmt" },
  { key: "/app/pgr", label: "PGR — Programa de Riscos (NR-01)", module: "sesmt" },

  // ----- ESTOQUE -----
  { key: "/app/estoque", label: "Estoque de EPIs", module: "estoque" },

  // ----- PRODUÇÃO -----
  { key: "/app/producao/painel-lista-tecnica", label: "Dashboard Dinâmico", module: "producao" },
  { key: "/app/producao/criar-ordem", label: "Criar Nova Ordem", module: "producao" },
  { key: "/app/producao/ordens", label: "Ordens de Produção", module: "producao" },
  { key: "/app/producao/base-materia-prima", label: "Base Matéria-Prima", module: "producao" },
  { key: "/app/producao/tipos-produto", label: "Tipos de Produto", module: "producao" },
  { key: "/app/producao/lista-tecnica", label: "Lista Técnica", module: "producao" },
  { key: "/app/producao/expedicao", label: "Expedição", module: "producao" },

  // ----- USUÁRIOS -----
  { key: "/app/users", label: "Usuários", module: "usuarios" },
  { key: "/app/audit", label: "Auditoria do Sistema", module: "usuarios" },
];

export const MENU_BY_KEY: Record<string, MenuEntry> = Object.fromEntries(
  MENU_CATALOG.map((m) => [m.key, m]),
);

export function menusForModule(module: AppModule): MenuEntry[] {
  return MENU_CATALOG.filter((m) => m.module === module);
}

// Resolve qual menu_key corresponde a uma rota (faz prefix match com o key mais longo).
export function menuKeyForPath(pathname: string): string | null {
  const matches = MENU_CATALOG
    .filter((m) => pathname === m.key || pathname.startsWith(m.key + "/"))
    .sort((a, b) => b.key.length - a.key.length);
  return matches[0]?.key ?? null;
}