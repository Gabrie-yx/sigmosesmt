---
name: Produção - Distribuição de Orçamentos entre Balsas
description: Lógica acordada para upload de orçamentos e distribuição de matéria-prima entre balsas/cascos existentes. Quando o usuário falar em "distribuir orçamento", "pool de orçamentos", "dividir materiais entre balsas" ou "subir orçamento de produção", consultar este arquivo.
type: feature
---

# Distribuição de Orçamentos entre Balsas

## Contexto
Usuário sobe N orçamentos (PDF/XLSX) com materiais, classes, tipos e quantitativos (sem se preocupar com valores). O sistema deve distribuir a matéria-prima entre balsas/cascos já existentes no sistema. Hoje há 4 balsas novas; o destino exato de cada material será definido depois do upload.

## Decisões do usuário
- **Critério de divisão**: 50/50 por quantidade (cada material é dividido igualmente entre as balsas escolhidas).
- **Identificação das balsas**: já existem no sistema (selecionar entre os cascos cadastrados, podendo ser 2, 3 ou 4).
- **Formato**: nova tela/fluxo no app (não apenas Excel). Precisa ser prático "subir" orçamento e ter essa visão.
- **Momento**: ainda NÃO implementar. Usuário pediu para apenas registrar a lógica e aguardar.

## Fluxo proposto em 2 etapas

### Etapa 1 — Pool de orçamentos (upload + consolidação)
- Upload de N orçamentos para um "pool" ainda não vinculado a casco.
- Consolida em tabela única: `material | classe | tipo | qtd total | orçamentos de origem`.
- Permite revisar/editar antes de distribuir.

### Etapa 2 — Distribuição
- Escolher quantas balsas (2, 3 ou 4) e quais cascos.
- "Distribuir igualitariamente" divide cada item pela qtd de balsas escolhidas.
- Preview lado a lado com ajuste manual permitido.
- "Confirmar" → grava vinculado a cada casco (reusa `producao_lista_tecnica`).

## Tabelas previstas (quando implementar)
- `producao_orcamentos` (pool: id, nome, arquivo, data, status)
- `producao_orcamento_itens` (material, classe, tipo, qtd, orcamento_id)
- `producao_distribuicoes` (id, data, cascos_destino[])
- `producao_distribuicao_itens` (link item ↔ casco ↔ qtd alocada)

## Racional
- Desacopla "subir orçamento" de "escolher casco" (destino nem sempre conhecido na hora do upload).
- Permite uploads cumulativos no pool.
- Reusa estrutura de lista técnica existente.
- Auditavelmente rastreável (qual orçamento gerou qual alocação).
