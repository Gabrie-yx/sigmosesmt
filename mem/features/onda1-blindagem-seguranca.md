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

### ✅ Item 2 — Bucket `avatars` privado + URLs assinadas (CONCLUÍDO)
Estratégia em 4 fases executadas:

**Fase 2A (feita):**
- Helper `src/lib/signed-avatar-url.ts` — `signAvatarUrl(publicOrPath)`, `extractAvatarPath()`, `useSignedAvatarUrl(src)`. Cache in-memory por path, TTL 1h. Fallback gracioso pro valor original.
- Componente `src/components/signed-avatar-img.tsx` — `<SignedAvatarImg src={emp.foto_url} .../>` drop-in de `<img>`.
- Funciona tanto com bucket público (hoje) quanto privado (fim da onda) — Supabase aceita `createSignedUrl` em ambos.

**Fase 2B (feita):** trocado `<img src={foto_url}>` por `<SignedAvatarImg>` em 11 arquivos (employee-quick-view, convocacao-exames-dialog, nova-entrada-wizard, validar-saida-funcionario-drawer, ghe-membros-dialog, app.employees.index, app.employees.$id, app.employees.desligados, app.pgr, app.companies). O `saidas.tsx` usa `<SignedAvatarImage>` (variante do shadcn AvatarImage).

**Fase 2C (feita):** `loadEmployeePhotoDataUrl` em `src/lib/employee-ficha-pdf.ts` agora chama `signAvatarUrl` antes do fetch — cobre a ficha do funcionário. `guia-encaminhamento-pdf.ts` declara `foto_url` no tipo mas não embute imagem no PDF (só metadata), então nada a mudar lá.

**Fase 2D (feita):**
- Policy `avatars_select_authenticated` criada em `storage.objects` (SELECT pra role `authenticated`) via migração — obrigatório pra `createSignedUrl` funcionar.
- Bucket `avatars` flipado pra `public: false` via `supabase--storage_update_bucket`.
- URLs públicas antigas (`/object/public/avatars/...`) agora dão 400. Todo consumo passa por `signAvatarUrl` (TTL 1h, cache in-memory).

### 🟡 Item 3 — Checagem de permissão em RPCs "públicos" (PENDENTE)
- `marcarRcCotada` (`src/lib/rc-public.functions.ts`) é público POR DESIGN — fornecedor cota via link do e-mail sem login. Já tem: rate limit 5/1h por token, TTL 30 dias no `status_token`, guarda IP+UA. **Ação:** documentar essa exceção no código (comentário grande) e revisar se dá pra adicionar Turnstile/reCaptcha; sem risco imediato.
- `getRcByToken` — idem, público por design.
- Auditar todas as `.rpc()` chamadas do front que não passam por `requireSupabaseAuth` (rodar `rg "supabase.rpc\("` e checar cada uma).

## Comunicação eSocial
Registrado pelo Francisco: SIGMO hoje NÃO conversa com eSocial nem outros sistemas do governo. Tudo offline (import/export). Não é escopo desta onda — só nota histórica.

## Retomada
Próximo turno: Fase 2B + 2C + 2D + Item 3. Depois seguir pra Onda 2 (gatilhos de demissão/ASO/mudança de cargo — Bloco 2 do parecer).