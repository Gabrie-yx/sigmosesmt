---
name: Pendências do projeto
description: Lista de tarefas pendentes acordadas com o usuário. Quando ele disser "listar pendencias", leia este arquivo e mostre o conteúdo.
type: feature
---

# Pendências

Quando o usuário disser **"listar pendencias"** (ou variações: "lista pendencias", "quais as pendencias", "o que tá pendente"), leia este arquivo e mostre apenas os itens com status `[ ]`.

## Itens

- [ ] **Gerador PDF de Avaliação de Eficácia (FORCP-GP-12)** — Form no app com os 10 itens pontuados (1-5), totalizador, plano de ação, assinaturas Superior/RH. Gera PDF pré-preenchido idêntico ao modelo homologado. Upload do PDF assinado em `training_anexos` (tipo EFICACIA). Padrão: seguir `src/lib/lista-presenca-pdf.ts`. Criar `src/lib/eficacia-treinamento-pdf.ts` + dialog no `cursos-ministrados-panel.tsx`.
- [ ] **Gerador PDF de Avaliação de Reação (FORCP-GP-16)** — Form 1:N por participante com fatores 1-4 (Conteúdo/Instrutor/Recursos), 3 perguntas abertas, escala final. Gera PDF pré-preenchido idêntico ao modelo homologado. Upload do PDF assinado em `training_anexos` (tipo REACAO). Criar `src/lib/reacao-treinamento-pdf.ts` + dialog no `cursos-ministrados-panel.tsx`.

## Como adicionar

`- [ ] **Título** — escopo, arquivos, padrão a seguir.`

## Como concluir

Trocar `[ ]` por `[x]` e mover para "Concluídas" com a data.

## Concluídas

(vazio)
