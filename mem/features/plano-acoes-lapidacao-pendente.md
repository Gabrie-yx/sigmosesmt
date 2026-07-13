---
name: Plano de Ações 5W2H — lapidação pendente
description: Pausa no módulo Plano de Ações. Integração NC-inspeção↔5W2H já feita (migration + trigger + backfill) e cards compactados/clicáveis. Falta polir UX antes de considerar fechado.
type: feature
---

## Já entregue
- Migration `20260713231325`: coluna `inspecao_nc_plano_id` em `plano_acoes` + trigger `sync_inspecao_plano_to_5w2h` em `inspecao_ncs_planos` + backfill dos planos existentes. Origem = `INSPECAO_SST`, cascade delete.
- `src/routes/app.acoes.tsx`: cards compactos, card inteiro clicável (abre edição), botões Concluir/Eficácia/Excluir como ícones com stopPropagation.

## Pendente pra retomar
1. Chip visual "Origem: Inspeção SST" no card do 5W2H quando `origem_acao = INSPECAO_SST`, com link direto pra inspeção de origem (`/app/sesmt/inspecoes/$id`).
2. Validar em produção se os planos criados/editados em NC de inspeção estão realmente aparecendo no menu Plano de Ações (sanity check com usuário).
3. Revisar cores/paineis/pills do detalhe da inspeção (`app.sesmt.inspecoes.$id.tsx`) — já teve uma passada, mas confirmar que nada mais está fora do design system.
4. Avaliar se faz sentido bloquear edição do plano no 5W2H quando origem = inspeção (pra forçar edição na tela da NC) ou permitir edição bidirecional.

## Ativar quando
Usuário voltar ao tema Plano de Ações / NC de inspeção.