// Cruza MENU_CATALOG com HELP_TOPICS para descobrir automaticamente
// quais menus/rotas do SIGMO ainda não têm tópico de ajuda escrito.
// Assim, quando um módulo novo entra (ex.: Compras), o Painel Ajuda:
//   1) NUNCA fica "vazio" — mostra um card auto-stub com a rota certa.
//   2) Loga um aviso no console em DEV pra lembrar o dev de escrever a doc.
import { MENU_CATALOG, type MenuEntry } from "@/lib/menu-catalog";
import { HELP_TOPICS, type HelpTopic } from "@/lib/help-content";

/** Um menu está "coberto" quando existe um tópico cuja rota bate exatamente
 * ou começa com a rota do menu (prefix match). */
export function isMenuCovered(menu: MenuEntry, topics: HelpTopic[] = HELP_TOPICS) {
  return topics.some((t) => {
    if (!t.rota) return false;
    return t.rota === menu.key || t.rota.startsWith(menu.key + "/");
  });
}

export function findTopicForMenu(menu: MenuEntry, topics: HelpTopic[] = HELP_TOPICS) {
  return topics.find(
    (t) => t.rota && (t.rota === menu.key || t.rota.startsWith(menu.key + "/")),
  );
}

export function getMenusSemAjuda(): MenuEntry[] {
  return MENU_CATALOG.filter((m) => !isMenuCovered(m));
}

/** Chamado uma vez em DEV pelo help-content — não polui produção. */
let warned = false;
export function avisarMenusSemAjuda() {
  if (warned || !import.meta.env.DEV) return;
  warned = true;
  const faltando = getMenusSemAjuda();
  if (faltando.length === 0) {
    console.info(
      `%c[SIGMO Help] ✓ Todos os ${MENU_CATALOG.length} menus têm tópico de ajuda.`,
      "color: #16a34a; font-weight: bold",
    );
    return;
  }
  console.groupCollapsed(
    `%c[SIGMO Help] ⚠ ${faltando.length}/${MENU_CATALOG.length} menus sem tópico de ajuda`,
    "color: #b45309; font-weight: bold",
  );
  faltando.forEach((m) => {
    console.log(`  • ${m.label}  →  rota ${m.key}  (módulo: ${m.module})`);
  });
  console.log(
    "%cAdicione um HelpTopic em src/lib/help-content.ts com rota: '" +
      faltando[0].key +
      "' para cobrir.",
    "color: #6b7280",
  );
  console.groupEnd();
}