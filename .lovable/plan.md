
# Matriz de Controle de Documentos

Módulo único para registrar, tratar e acompanhar qualquer documento/demanda que chega — com catálogo de documentos recorrentes que geram pendência automática antes do vencimento.

## Estrutura de dados

### `controle_doc_categorias` (catálogo simples, editável)
- `codigo`, `nome`, `criticidade_sugerida` (CRITICA/ALTA/MEDIA/BAIXA), `ativo`
- Seeds iniciais: DOCUMENTO_LEGAL (crítica), LICENCA (crítica), CERTIFICADO (alta), RELATORIO (média), FORMULARIO (baixa), OUTRO (média)

### `controle_doc_recorrentes` (catálogo de docs com vencimento)
- `nome` (ex: "AVCB Estaleiro", "Licença Ambiental DMN")
- `categoria_id`, `criticidade`, `responsavel_id`
- `periodicidade_meses` (12, 24, etc.)
- `dias_aviso_previo` (default 30)
- `proxima_validade` (data)
- `ativo`, `observacoes`
- **Job diário** verifica `proxima_validade - dias_aviso_previo <= hoje` e abre entrada automática em `controle_documentos` se ainda não existe uma aberta pra esse recorrente no ciclo

### `controle_documentos` (a matriz principal)
- `numero` (CD-2026-001, sequencial)
- `titulo`, `descricao`
- `origem` (EMAIL, WHATSAPP, OFICIO, AUDITORIA, INTERNO, RECORRENTE_AUTO)
- `remetente_nome`, `remetente_contato`
- `data_recebimento`, `prazo`, `data_resolucao`
- `categoria_id`
- `criticidade` (manual, pré-preenchida da categoria)
- `responsavel_id` (employee — entra nas Minhas Pendências dele)
- `tratativa` (texto: o que será feito)
- `status` (RECEBIDO, EM_ANALISE, EM_TRATATIVA, AGUARDANDO_TERCEIRO, RESOLVIDO, CANCELADO)
- `terceiro_nome`, `terceiro_followup_em` (quando AGUARDANDO_TERCEIRO)
- `recorrente_id` (FK opcional — quando gerado pelo catálogo recorrente)
- `observacao_fechamento`
- `tags` (text[])

### `controle_doc_anexos` (1:N)
- `documento_id`, `file_path`, `tipo` (ORIGEM, REFERENCIA, EVIDENCIA_RESOLUCAO), `descricao`, `uploaded_at`, `uploaded_by`

### `controle_doc_historico` (auditoria via trigger)
- `documento_id`, `campo`, `valor_anterior`, `valor_novo`, `alterado_por`, `alterado_em`
- Trigger AFTER UPDATE registra mudanças de status, responsável, prazo, criticidade

### Storage
- Bucket `controle-documentos` (privado), pasta por `documento_id`

## Telas

### `/app/controle-documentos` — lista + kanban
- Toggle Lista / Kanban (colunas por status)
- Filtros: status, criticidade, categoria, responsável, origem, tag, busca, "vencendo em X dias", "vencidos"
- Cards com badge de criticidade colorida e "VENCE EM 3D" / "VENCIDO"
- Botão **Nova entrada** → dialog com upload (drag-drop múltiplo do e-mail/PDFs), preenche e sugere criticidade pela categoria
- Botão **Documentos recorrentes** → gerenciar catálogo
- Indicador no topo: total abertos, vencidos, resolvidos no mês, tempo médio de resolução

### `/app/controle-documentos/$id` — detalhe
- Cabeçalho com numero, criticidade, status, prazo
- Tabs: **Tratativa** (descrição + tratativa editável + atualizar status + anexar evidência) · **Anexos** (timeline de uploads por tipo) · **Histórico** (mudanças automáticas)
- Botão "Marcar como RESOLVIDO" abre dialog pedindo evidência + observação de fechamento e grava `data_resolucao = now()`; se vier de recorrente, atualiza `proxima_validade += periodicidade_meses`

### `/app/controle-documentos/recorrentes` — catálogo recorrente
- CRUD de docs com vencimento, com indicador "próximo vencimento em X dias"

## Integrações
- **Minhas Pendências** (`use-pendencias`): incluir documentos abertos atribuídos ao usuário logado
- **Sidebar**: novo item "Controle de Documentos" em SST/Admin
- **Command palette**: ação rápida "Nova entrada de documento"

## Job de alertas (pg_cron diário 06:00)
- Chama `/api/public/controle-documentos/gerar-recorrentes` que:
  - Para cada `controle_doc_recorrentes` ativo com `proxima_validade - dias_aviso_previo <= hoje` e sem entrada aberta vinculada, cria entrada em `controle_documentos` com origem=RECORRENTE_AUTO, prazo=proxima_validade
- Autenticação: header `apikey` com anon key

## RLS
- SELECT: authenticated (true)
- INSERT/UPDATE: `is_editor(auth.uid())`
- DELETE: `has_role(auth.uid(), 'admin')`
- Storage: idem aos demais buckets do projeto

## Detalhes técnicos
- Numeração: function `gerar_numero_controle_doc()` com sequence anual
- Trigger BEFORE INSERT preenche `numero`, `criticidade` (da categoria se NULL), `prazo` (se NULL e veio de recorrente)
- Trigger AFTER UPDATE alimenta `controle_doc_historico`
- Query principal usa `react-query` com invalidate em todas as mutações
- PDF de relatório mensal: `src/lib/controle-doc-relatorio-pdf.ts` (lista vencidos, resolvidos, tempo médio por categoria)

## Entregas em ordem
1. Migration: tabelas + bucket + RLS + triggers + seeds de categorias
2. Lista + filtros + dialog de nova entrada com upload
3. Detalhe com tabs (tratativa, anexos, histórico)
4. Catálogo de recorrentes (CRUD)
5. Endpoint público + cron job de geração automática
6. Integração com Minhas Pendências e Sidebar
7. Relatório PDF mensal
