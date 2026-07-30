# SIGMO offline: arquitetura + piloto extintores

O SIGMO hoje é um PWA "instalável" (tem manifesto e ícones), mas não tem service worker nem cache de dados. Vamos transformá-lo em um app offline-first: a app shell continua carregando sem internet, os dados ficam guardados localmente, e uma fila de sincronização envia as mudanças quando o celular reconectar.

## Escopo

- **Arquitetura geral** pronta para todos os módulos do SIGMO.
- **Piloto funcional** no módulo de extintores (listagem, inspeção, fotos e sincronização).
- **Outros módulos** entram depois, módulo a módulo, reaproveitando a mesma camada offline.

## Fase 1 — PWA com cache offline da app shell

Objetivo: o SIGMO abre mesmo sem internet.

- Adicionar `vite-plugin-pwa` com `generateSW` (não escrever SW manualmente).
- Configurar Workbox para:
  - Navegações HTML: `NetworkFirst` (nunca cache-first em páginas).
  - Assets com hash (JS/CSS/imagens): `CacheFirst`.
  - Ícones e manifest: `CacheFirst`.
- Criar wrapper de registro do service worker (`src/lib/pwa-register.ts`) que **nunca** registra em:
  - dev/preview do Lovable,
  - iframes,
  - hostnames de preview (`id-preview--`, `lovableproject.com`, etc.),
  - URL com `?sw=off`.
- O wrapper também desregistra SWs antigos se estiver em ambiente de preview.
- Garantir que o SW gerado seja `/sw.js` e use `registerType: "autoUpdate"`.

## Fase 2 — Camada offline-first de dados

Objetivo: dados do SIGMO disponíveis localmente quando o dispositivo perde sinal.

- Adicionar `idb` como dependência (IndexedDB com API moderna).
- Criar `src/lib/offline-db.ts` com um schema IndexedDB genérico:
  - `store`: tabelas de cache (ex: `extintores`, `extintor_inspecoes`).
  - `sync_queue`: fila de mutações pendentes.
  - `files`: cache de fotos/arquivos offline.
- Integrar `persistQueryClient` (TanStack Query) para manter o cache de queries no IndexedDB automaticamente.
- Criar hook `useIsOnline()` usando `navigator.onLine` + eventos `online`/`offline`.
- Criar helper `offlineQueryOptions` que, quando offline, lê do cache local e nunca dispara requisição que falharia.

## Fase 3 — Fila de sincronização em background

Objetivo: quando o sinal voltar, o SIGMO envia automaticamente o que foi feito offline.

- Criar `src/lib/sync-queue.ts` para registrar mutações pendentes:
  - `INSERT`, `UPDATE`, `DELETE`.
  - Dados da entidade + timestamp + id local temporário.
- Criar server function `syncOfflineQueue()` que roda quando o app volta a ficar online e envia a fila para o Supabase.
- Lidar com fotos: salvar em cache local (`files` do IndexedDB) e enviar depois para o bucket `extintores-inspecoes`.
- Implementar retry com backoff e notificação de conflitos ao usuário quando a sync falhar.
- Usar `navigator.serviceWorker.ready` + `Background Sync` API quando disponível; fallback para sync manual ao detectar `online`.

## Fase 4 — Piloto em extintores

Objetivo: o fiscal pode inspecionar extintores no pátio sem sinal e tudo sincroniza depois.

- Refatorar `src/routes/app.extintores.tsx` para usar a camada offline:
  - Cachear lista de `extintores` e `extintor_inspecoes`.
  - Permitir leitura da lista sem internet.
- Adicionar inspeção offline:
  - Form salva inspeção no IndexedDB quando offline.
  - Fotos da inspeção armazenadas localmente e enviadas depois.
- Sincronização automática:
  - Quando online, enviar inspeções pendentes.
  - Atualizar lista local após sync bem-sucedido.
- UX:
  - Badge "offline" no header.
  - Toast/alerta quando há dados pendentes para sincronizar.
  - Botão manual "Sincronizar agora".

## Fase 5 — Testes e expansão

- Testar em mobile (devTools network offline + celular real se possível).
- Verificar que o preview do Lovable não quebra (SW não registra em preview).
- Documentar padrão para aplicar nos próximos módulos (PGR, APR, compras, etc.).
- Expansão módulo a módulo após aprovação do piloto.

## Tecnologias

- `vite-plugin-pwa` (Workbox `generateSW`).
- `idb` (IndexedDB).
- `persistQueryClient` do TanStack Query.
- TanStack `createServerFn` para sync com Supabase.
- Service Worker + Background Sync API.

## Restrições e cuidados

- Nunca registrar o SW no preview do Lovable para evitar cache stale.
- Nunca usar cache-first para navegação HTML.
- Service-role key continua server-only; sync acontece via `requireSupabaseAuth` (usuário autenticado).
- Fotos grandes: armazenar localmente e enviar em chunks/por fila, nunca na requisição principal.
- Conflitos de sync: mostrar ao usuário e permitir resolver manualmente.

## Resultado esperado

O SIGMO vira um app PWA offline-first: a app abre sem internet, dados críticos ficam disponíveis, e o que foi alterado no campo sincroniza automaticamente quando o celular reconectar. O piloto de extintores valida a arquitetura antes de escalar para todo o sistema.