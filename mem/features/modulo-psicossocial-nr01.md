---
name: Módulo Psicossocial NR-01 (Fase 1 entregue)
description: Módulo nativo de avaliação de risco psicossocial no SIGMO — matriz 5×5, instrumento anônimo, blindagem LGPD. White-label (qualquer CNAE).
type: feature
---

# Módulo Psicossocial NR-01 — Fase 1 (entregue 12/07/2026)

Antecipado antes da Rev.06 do PGR chegar. Base: NR-01 (Portaria MTP 1.419/2024, fiscalização punitiva desde 26/05/2026) + ISO 45003:2021 + Guia MTE 2025.

## O que foi entregue

### Banco (migration 12/07/2026)
- Categoria `PSICOSSOCIAL` adicionada ao CHECK de `pgr_inventario_riscos.categoria`.
- `catalogo_perigos_psicossociais` — 8 dimensões (DEMANDAS, CONTROLE, APOIO, RECOMPENSA, PAPEL_MUDANCA, RELACOES, VIOLENCIA, INTERFACE), ~29 perigos com agravo/fonte/controles/ref ISO 45003. Seed universal.
- `psico_campanhas` (título, GHEs, período, min_respondentes=5, contadores).
- `psico_tokens` (hash SHA-256 do token, single-use, `expira_em`, sem user_id).
- `psico_respostas` (`ghe_id`, dimensao, item_codigo, valor 1-5, faixa etária/tempo em faixas — **JAMAIS user_id**).
- `psico_consentimentos` (hash do token, versão do termo, ip_hash/ua_hash — separado das respostas).
- View `v_psico_agregado_ghe_dim` com `security_invoker=true` e supressão automática se n < `min_respondentes`.
- Triggers atualizam contadores de campanha.

### Backend
- `src/routes/api/public/psico.$hash.ts` — GET valida token (rota pública, sem auth).
- `src/routes/api/public/psico.submit.ts` — POST recebe respostas anônimas, marca token como usado, grava consentimento separado. Zod valida payload. IP/UA em hash (não reversível).

### Frontend
- `src/routes/psico.$token.tsx` — página pública mobile-first para o colaborador responder pelo celular. Tela de consentimento LGPD antes do formulário. Escala Likert 1-5 grande, tocável.
- `src/routes/app.psicossocial.tsx` — dashboard admin, 4 abas: Catálogo · Campanhas · Diagnóstico · Instrumento. Ao criar campanha, gera N tokens e mostra os links em claro **uma única vez**.
- `src/lib/psico-instrument.ts` — 26 itens HSE-IT BR + assédio/ISO 45003, escala Likert, `scoreRisco` (inverte itens invertidos), `classifyDimensao`.
- Menu-catalog: `/app/psicossocial` — módulo `sesmt`.

## Diferencial vs concorrentes (PrismaNR, NR1.AI, COPSOQ-SaaS, etc.)
Escolhi **HSE Indicator Tool BR (uso livre)** em vez de COPSOQ III pra evitar zona cinza de licenciamento. COPSOQ fica pra fase 2 com licença explícita.

## Não entrou nesta rodada (roadmap)
- Widget "sinal cruzado" (score × absenteísmo × CID F × acidentes × rotatividade) — depende de PCMSO Rev.06.
- Plano de ação 5W2H específico psicossocial ligado a `pgr_plano_acao` — precisa juntar inventário psicossocial primeiro.
- IA para respostas abertas — só campos fechados nesta rodada.
- Benchmarking setorial por CNAE.
- Integração com aba PSICOSSOCIAL no `/app/pgr`.

## Pegadinhas resolvidas
- Anonimato garantido por design: sem user_id nas respostas, sem cookie, IP/UA em hash unidirecional, token single-use.
- Supressão n<5 na view, com `security_invoker=true` (não é view SECURITY DEFINER — segue a permissão do usuário que consulta).
- Modal de tokens em claro só aparece uma vez após criação — depois o servidor só tem o hash.

## Base legal / referências
- NR-01 item 1.5 (GRO/PGR) — riscos psicossociais obrigatórios desde 26/05/2025, fiscalização punitiva 26/05/2026.
- Portaria MTP 1.419/2024.
- Guia MTE 2025 "Fatores de Riscos Psicossociais Relacionados ao Trabalho".
- ISO 45003:2021.
- LGPD Art. 5º II (dado sensível de saúde) — base legal: obrigação regulatória + consentimento.