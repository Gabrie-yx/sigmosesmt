# Painel de Templates de Documentos ISO 9001 — Caminho B

Retomando com foco: upload de PDFs homologados que ficam arquivados como referência oficial, sistema continua emitindo com o motor de código atual e sinaliza pendência quando uma nova revisão é enviada.

## Escopo desta entrega
Somente o **painel + fluxo de upload/versionamento**. Não vou mexer nos módulos que já emitem (OS, EPI, APR, PTE, PET, DDS etc.) — só passam a exibir um selo "Baseado em Rev.XX" no rodapé em uma etapa posterior.

## Rota e permissão
- Nova rota: `/app/configuracoes/templates-documentos`
- Link no menu **Configurações** (só ADMIN vê)
- Guard: `has_role(auth.uid(), 'admin')` — bloqueia hard tanto na UI quanto na RLS

## Banco (1 migração)

**`document_templates`** — 1 linha por FOR-SEG (catálogo fixo, seedado)
- `codigo` (ex: `FOR-SEG-01`), `nome`, `modulo_alvo`, `motor_render_id` (chave interna que o código de render usa), `descricao`, `ativo`

**`document_template_versions`** — histórico com soft delete
- `template_id` → `document_templates.id`
- `revisao` (int, auto-incrementa por template)
- `arquivo_path` (Storage), `arquivo_nome`, `arquivo_hash` (sha256), `tamanho_bytes`
- `motivo_alteracao` (texto)
- `status`: `EM_HOMOLOGACAO` | `HOMOLOGADA` | `SUPERSEDIDA`
- `homologada_em`, `homologada_por`
- `uploaded_at`, `uploaded_by`
- `deleted_at`, `deleted_by` (soft delete — nunca DELETE físico)

**`document_template_pendencias`** — fila de "motor precisa alinhar"
- `version_id`, `criado_em`, `prazo_sugerido` (upload + 15 dias), `resolvido_em`, `resolvido_por`, `nota`

**Storage bucket:** `templates-homologados` (privado, só ADMIN)

**RLS:** SELECT autenticado / INSERT-UPDATE só ADMIN via `has_role`. GRANTs incluídos.

## UI do painel

Layout tipo lista/tabela dos 15 FOR-SEG:

```text
┌─────────────────────────────────────────────────────────────┐
│ FOR-SEG-01  Ordem de Serviço          Rev.02 · Homologada   │
│                                       [Ver histórico] [↑ Nova revisão] │
├─────────────────────────────────────────────────────────────┤
│ FOR-SEG-04  Ficha de Entrega EPI      Rev.03 · ⚠ Pendente   │
│                                       Motor alinhando Rev.03 │
│                                       [Ver histórico] [↑ Nova revisão] │
├─────────────────────────────────────────────────────────────┤
│ FOR-SEG-11  Calendário CIPA           — sem modelo —        │
│                                       [↑ Enviar primeiro modelo] │
└─────────────────────────────────────────────────────────────┘
```

**Modal "Nova revisão":**
- Upload PDF (drag & drop, max 20 MB)
- Campo obrigatório: motivo da alteração
- Preview do PDF antes de confirmar
- Ao confirmar:
  1. Upload no Storage
  2. Calcula hash sha256
  3. Marca revisão anterior como `SUPERSEDIDA`
  4. Insere nova versão como `EM_HOMOLOGACAO`
  5. Cria pendência automática
  6. Toast: "Rev.XX arquivada. Pendência criada para o motor de render."

**Modal "Histórico":**
- Timeline das revisões (mais nova no topo)
- Cada card: revisão, quem subiu, quando, motivo, hash, badge status
- Botão "Baixar PDF" (signed URL)
- Botão "Restaurar" (só ADMIN) → reverte deleted_at e re-marca como HOMOLOGADA (o soft delete que você pediu)
- Botão "Arquivar" (soft delete) com confirmação

## Seed inicial
Popular `document_templates` com os 15 FOR-SEG do PROCO-SGI-SST-01 item 6.1 a 6.15, todos com `motor_render_id` mapeado para o código de render existente (ou `null` para os 4 que ainda não têm: FOR-SEG-10, 11, 12, 15).

## Fora do escopo agora (marcado como próxima onda)
- Selo "Baseado em Rev.XX" no rodapé de cada PDF emitido (só quando você aprovar)
- Painel de pendências consumindo `document_template_pendencias` na home
- Criação dos 4 módulos que faltam (FOR-SEG-10/11/12/15)

## Arquivos que vou criar/editar
- `supabase/migrations/...` — tabelas + bucket + RLS + seed
- `src/routes/app.configuracoes.templates-documentos.tsx` — painel
- `src/components/templates-documentos/` — cards, modais, histórico
- `src/lib/templates-documentos.functions.ts` — server fns (upload, versionar, soft-delete, restaurar)
- `src/lib/menu-catalog.ts` — link em Configurações (só ADMIN)

Aprovando isso eu já disparo a migração e o código na sequência.
