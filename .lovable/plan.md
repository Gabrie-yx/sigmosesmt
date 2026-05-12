# Reforço de segurança + novo módulo Usuários

## 1. Banco de dados (migração)

### 1.1. Novo papel `viewer` e renomeação
- `app_role` hoje tem `admin` e `tst`. Vamos para: `admin`, `moderador`, `editor`, `viewer`.
- Mantemos `tst` como alias durante a transição (não removemos do enum agora para não quebrar dados).
- `is_editor()` passa a aceitar `admin`, `moderador`, `editor`.
- Nova função `is_moderator()` → `admin` ou `moderador` (para ações de aprovação/revogação).
- Nova função `is_viewer_or_above()` → qualquer papel ativo (usada para SELECT).

### 1.2. Acesso por módulo (on/off)
Nova tabela `user_module_access`:
- `user_id`, `module` (enum: `sesmt`, `estoque`, `producao`, `manutencao`, `portaria`, `usuarios`), `enabled`.
- RLS: só admin gerencia; usuário lê o próprio.
- Função `has_module_access(_user_id, _module)` SECURITY DEFINER.
- Admin sempre tem acesso a todos os módulos (bypass na função).

### 1.3. Convites
Tabela `user_invites`:
- `email`, `full_name`, `role`, `modules` (array), `invited_by`, `accepted_at`, `expires_at`.
- RLS: só admin lê/escreve.
- Edge Function `invite-user` chama `supabaseAdmin.auth.admin.inviteUserByEmail()` e cria registros em `user_roles` + `user_module_access` ao aceitar (via trigger em `auth.users` no INSERT).

### 1.4. MFA enforcement
- Função `requires_mfa(_user_id)` retorna true se papel ∈ {admin, moderador}.
- RLS sensíveis (`user_roles`, `user_module_access`, `audit_logs`, `safety_overrides`, `temp_admins`) passam a checar `auth.jwt()->>'aal' = 'aal2'` quando `requires_mfa()` for true.

### 1.5. Auditoria de login (opcional, fica para próxima)
Não nesta etapa para não inflar.

## 2. Edge Functions

### 2.1. `invite-user` (nova)
- Recebe: `{ email, full_name, role, modules[] }`.
- Verifica chamador é admin (via JWT + `has_role`).
- Chama `auth.admin.inviteUserByEmail(email, { data: { full_name } })`.
- Insere em `user_invites` com `role` e `modules` pendentes.
- Trigger `handle_new_user` (já existe) cria profile; vamos estender para aplicar invite pendente: ler `user_invites` por email, criar `user_roles` e `user_module_access`, marcar `accepted_at`.

### 2.2. `delete-user` (nova)
- Admin remove usuário: apaga de `user_roles`, `user_module_access` e `auth.users` via service role.

## 3. Frontend

### 3.1. Página `/app/usuarios` (refatorar)
- Lista usuários com: nome, email, papel, módulos (chips), MFA status, último acesso.
- Botão **"Convidar usuário"** abre modal:
  - Nome completo, Email, Papel (radio), Módulos (checkboxes).
  - Submete para `invite-user`.
- Ações por linha: Editar papel/módulos, Reenviar convite, Remover.
- Filtros: papel, módulo, status (ativo/pendente).

### 3.2. Guard de módulo
- Hook `useModuleAccess(module)` busca `user_module_access` do usuário logado.
- `<ModuleGuard module="sesmt">` envolve rotas — redireciona para `/app` com toast se sem acesso.
- Aplicar em `/app/sesmt/*`, `/app/estoque/*`, `/app/producao/*`, `/app/manutencao/*`, `/app/portaria/*`, `/app/usuarios`.
- Header esconde itens de menu sem acesso.

### 3.3. MFA enrollment
- Página `/app/conta/seguranca`:
  - Status MFA (enrolled/não).
  - Botão "Ativar 2FA" → QR code (TOTP via `supabase.auth.mfa.enroll`).
  - Verificação com código de 6 dígitos.
- Banner global obrigatório: se `role ∈ {admin, moderador}` e sem MFA, redireciona para `/app/conta/seguranca` em todas as rotas exceto essa.

### 3.4. Login
- Após `signInWithPassword`, checar `aal`. Se papel exige MFA e `aal=aal1`, mostrar tela de challenge TOTP.

### 3.5. Página de aceite de convite
- Rota pública `/aceitar-convite` (já tratada pelo Supabase via redirect do email — só precisamos garantir que `/reset-password` ou similar exista para definir senha).

## 4. Considerações sobre papéis

- **Admin**: tudo, gerencia usuários, MFA obrigatório.
- **Moderador**: edita + aprova/revoga (ex.: aprovar requisição de compra, revogar safety_override), MFA obrigatório.
- **Editor**: cria/edita registros nos módulos liberados, sem aprovações.
- **Visualizador**: somente leitura nos módulos liberados.

## 5. Ordem de execução

1. Migração SQL (enum, funções, tabelas, RLS).
2. Edge Functions `invite-user` e `delete-user`.
3. Refactor da página de Usuários (UI nova com convite + módulos).
4. ModuleGuard + esconder itens do header.
5. Página de segurança com MFA + banner obrigatório.
6. Ajuste no fluxo de login para challenge MFA.

## Detalhes técnicos
- Enum `app_role`: `ALTER TYPE app_role ADD VALUE 'moderador'; ADD VALUE 'editor'; ADD VALUE 'viewer';` (o valor `tst` permanece, depreciado — `is_editor` passa a aceitar editor/moderador/admin).
- `audit_logs` ganha trigger em `auth.users` para login? Não — Supabase já loga isso internamente; deixamos para depois.
- MFA: `supabase.auth.mfa.enroll({ factorType: 'totp' })` + `challenge` + `verify`. RLS checa `(auth.jwt()->>'aal')::text = 'aal2'`.
- Convite: o `inviteUserByEmail` envia email padrão do Supabase com link para definir senha; precisamos garantir que a URL de redirect aponte para uma rota de definição de senha (já temos `/reset-password`? verificar e criar se faltar).

## Riscos
- Quebrar acesso atual: usuários `tst` continuam funcionando porque `is_editor` mantém aceitação.
- MFA obrigatório pode trancar admins fora — vamos liberar 7 dias de carência mostrando banner antes de bloquear.
