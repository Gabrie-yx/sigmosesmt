---
name: Onda 1 - Blindagem de Segurança (Bloco 1 do parecer)
description: Progresso das 3 tarefas críticas do Bloco 1 - endpoints de IA, bucket avatars privado, checagem de permissão em RPCs sensíveis. Retomar até finalizar.
type: feature
---

## Contexto
Parecer técnico da auditoria SIGMO (jul/2026) apontou 32 críticas. Bloco 1 do parecer = "portas abertas" — o que expõe o sistema agora. Trabalho aprovado pelo Francisco em 07/07/2026.

## Checklist

### ✅ Item 1 — Endpoints de IA fechados com auth
- `src/routes/api/sigmo-chat.ts` — POST agora exige Bearer token válido (`sb.auth.getClaims`) antes de chamar o LOVABLE_API_KEY.
- `src/routes/api/pgr-chat.ts` — idem.
- Cliente: `src/components/sigmo-chat.tsx` e `src/components/pgr/pgr-copilot.tsx` — `DefaultChatTransport.headers` async injeta o bearer da sessão Supabase.
- Motivo: sem isso, qualquer URL descoberta queimava crédito do gateway.

### 🟡 Item 2 — Bucket `avatars` privado + URLs assinadas (EM ANDAMENTO)
Estratégia em 2 fases pra não quebrar 17 telas de uma vez:

**Fase 2A (feita):**
- Helper `src/lib/signed-avatar-url.ts` — `signAvatarUrl(publicOrPath)`, `extractAvatarPath()`, `useSignedAvatarUrl(src)`. Cache in-memory por path, TTL 1h. Fallback gracioso pro valor original.
- Componente `src/components/signed-avatar-img.tsx` — `<SignedAvatarImg src={emp.foto_url} .../>` drop-in de `<img>`.
- Funciona tanto com bucket público (hoje) quanto privado (fim da onda) — Supabase aceita `createSignedUrl` em ambos.

**Fase 2B (PENDENTE) — trocar `<img src={foto_url}>` em todos os consumidores:**
- `src/components/employees/employee-quick-view.tsx` (linha 230)
- `src/components/employees/convocacao-exames-dialog.tsx` (linha 881)
- `src/components/portaria/nova-entrada-wizard.tsx` (linhas 470, 568, 587)
- `src/components/portaria/validar-saida-funcionario-drawer.tsx` (linhas 132, 155)
- `src/components/pgr/ghe-membros-dialog.tsx` (linha 214)
- `src/routes/app.employees.index.tsx` (linha 616)
- `src/routes/app.employees.$id.tsx` (linhas 343, 907)
- `src/routes/app.employees.desligados.tsx` (linha 126)
- `src/routes/app.employees.saidas.tsx` (linha 666, usa AvatarImage do shadcn — envolver com signed)
- `src/routes/app.pgr.tsx` (linha 257)
- `src/routes/app.companies.tsx` (linha 638)

**Fase 2C (PENDENTE) — PDFs que embutem a foto:**
- `src/routes/app.employees.$id.tsx` → função `loadEmployeePhotoDataUrl` (linha 200) precisa assinar antes do fetch.
- `src/lib/guia-encaminhamento-pdf.ts` (usa `foto_url` direto).
- `src/components/employees/guia-encaminhamento-dialog.tsx` (passa `foto_url` pro PDF gen).

**Fase 2D (PENDENTE) — flip do bucket:**
- `supabase--storage_update_bucket({ name: "avatars", public: false })`.
- Adicionar policy SELECT em `storage.objects` para `authenticated` (createSignedUrl exige que o usuário consiga ler).
- Testar 1 tela antes de flipar.

### 🟡 Item 3 — Checagem de permissão em RPCs "públicos" (PENDENTE)
- `marcarRcCotada` (`src/lib/rc-public.functions.ts`) é público POR DESIGN — fornecedor cota via link do e-mail sem login. Já tem: rate limit 5/1h por token, TTL 30 dias no `status_token`, guarda IP+UA. **Ação:** documentar essa exceção no código (comentário grande) e revisar se dá pra adicionar Turnstile/reCaptcha; sem risco imediato.
- `getRcByToken` — idem, público por design.
- Auditar todas as `.rpc()` chamadas do front que não passam por `requireSupabaseAuth` (rodar `rg "supabase.rpc\("` e checar cada uma).

## Comunicação eSocial
Registrado pelo Francisco: SIGMO hoje NÃO conversa com eSocial nem outros sistemas do governo. Tudo offline (import/export). Não é escopo desta onda — só nota histórica.

## Retomada
Próximo turno: Fase 2B + 2C + 2D + Item 3. Depois seguir pra Onda 2 (gatilhos de demissão/ASO/mudança de cargo — Bloco 2 do parecer).