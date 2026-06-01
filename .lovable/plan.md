## Escopo

Reformular o módulo **Usuários** com 3 capacidades novas, mantendo tudo que já funciona (convidar, editar papel, excluir, convites pendentes, acesso de investidor).

---

## 1. Suspender / Reativar usuário

**O que muda pra você:**
- Botão "Suspender" na linha do usuário (ao lado de excluir).
- Ao clicar: dialog perguntando "Indefinido" ou "Por X dias" (7 / 30 / 90 ou custom).
- Usuário suspenso aparece com badge cinza "Suspenso até DD/MM/AAAA" e não consegue mais logar.
- Botão "Reativar" volta o acesso na hora.

**Técnico:** usa `supabaseAdmin.auth.admin.updateUserById(id, { ban_duration })`. Nada novo no schema — o próprio Supabase Auth guarda isso em `auth.users.banned_until`.

---

## 2. Granularidade por menu (sub-páginas)

Hoje você libera **módulos inteiros** (SESMT, Estoque, Produção…). Vou adicionar uma camada extra: dentro de cada módulo, você marca quais **menus** o usuário pode abrir.

**Comportamento:**
- Se o usuário tem o módulo SESMT liberado mas nenhum menu específico marcado → acesso a **todos** os menus do SESMT (compatibilidade — não quebra ninguém).
- Se você marcar menus específicos → só esses ficam visíveis e acessíveis. O resto some da sidebar e bloqueia a rota.
- Admin: acesso total automático (como hoje).

**Menus que vou mapear** (baseado na sidebar atual):
- **SESMT**: Painel, Empresas, Cargos/Riscos, Colaboradores, Treinamentos, Cascos, PTEs, APRs, DDS, Equipamentos Móveis, Procedimentos, Terceiros, Documentos SESMT, Estoque SESMT, Estoque EPI, Extintores, NCs, Incidentes, Ações, Matriz Riscos, Matriz Treinamento, Relatórios, Controle Documentos
- **Estoque**: Painel Estoque, EPI, SESMT
- **Produção**: Ordens, Criar Ordem, Expedição, Tipos de Produto, Base Matéria-Prima, Lista Técnica, Painel Lista Técnica
- **Usuários**: Usuários, Auditoria

**Técnico:** nova tabela `user_menu_access (user_id, menu_key, enabled)`. Hook `useAuth` ganha `hasMenu(key)`. `ModuleRouteGuard` passa a checar menu também. `AppSidebar` filtra itens pelo `hasMenu`.

---

## 3. Histórico de auditoria do módulo

**O que muda pra você:**
- Nova aba "Histórico" na página Usuários.
- Lista cronológica: "Fulano convidou ciclano@email.com como Editor em 01/06 14:32", "Fulano alterou papel de X para Moderador", "Fulano suspendeu Y por 30 dias", "Fulano liberou menus APRs e PTEs para Z", etc.
- Filtros: por usuário-alvo, por tipo de ação, por período.

**Técnico:** reutiliza tabela `audit_logs` existente. Como `user_roles` e `user_module_access` já têm triggers de auditoria (presumido — verificar), adiciono trigger na nova `user_menu_access` e em ações via server-fn (insert manual no audit_logs com `action='SUSPEND'`, `action='UNSUSPEND'`, etc.).

---

## Mudanças resumidas

**Banco (1 migration):**
- Criar tabela `user_menu_access` com RLS e grants.
- Trigger `log_audit_event` na nova tabela.
- (Verificar se `user_roles` e `user_module_access` já têm trigger de auditoria; se não, adicionar.)

**Server functions (`src/lib/users.functions.ts`):**
- `suspendUser({ user_id, days | indefinite })` — novo
- `unsuspendUser({ user_id })` — novo
- `updateUserMenus({ user_id, menus[] })` — novo
- `listUsersAdmin` — passa a retornar `banned_until` e `menus[]` por usuário
- `listUserAuditLogs({ filters })` — novo

**Frontend:**
- `src/hooks/use-auth.ts` → adiciona `menus[]` + `hasMenu(key)`.
- `src/components/module-guard.tsx` → checa menu key além de módulo.
- `src/components/app-sidebar.tsx` → filtra itens por `hasMenu`.
- `src/routes/app.users.tsx` → tabela com coluna Status (Ativo/Suspenso), botão Suspender/Reativar, dialog "Editar permissões" ganha seleção de menus agrupados por módulo, nova aba "Histórico".
- `src/lib/menu-catalog.ts` (novo) → fonte única de verdade da lista de menus + label + módulo pai.

---

## O que NÃO entra nessa rodada

- Edição de e-mail/nome do usuário (Supabase Auth tem fluxo próprio; se precisar, falo depois).
- Recuperação de senha forçada (admin → "forçar reset"). Posso adicionar se quiser.
- Logs históricos retroativos (só começo a registrar daqui pra frente — o que já existe fica).

---

Posso seguir com isso? Se quiser ajustar algo (mais/menos menus, outras ações no histórico, prazos diferentes de suspensão), me avisa antes que eu mando bala.