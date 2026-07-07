---
name: Onda 2 - Gatilhos automáticos (Bloco 2 do parecer)
description: Progresso dos gatilhos automáticos - demissão fecha pendências, ASO vencido bloqueia, mudança de cargo recalcula matriz. Retomar até finalizar.
type: feature
---

## Checklist

### ✅ Item 1 — Demissão fecha pendências em cascata (CONCLUÍDO)
Migração 20260707_173817:
- Trigger `trg_fechar_pendencias_ao_desligar` em `employees` AFTER UPDATE OF data_desligamento.
- Dispara só na transição NULL → preenchido (reativar+desligar de novo não repete).
- Função `fechar_pendencias_ao_desligar()` SECURITY DEFINER, search_path=public, EXECUTE revogado de anon/authenticated.
- Cascata: convocacoes_exames PENDENTE→CANCELADA (com obs), safety_overrides ativos→revoked_at=now, log em audit_logs (action='desligamento_cascata').
- NÃO mexe em EPI (wizard já trata via desligamento_pacotes) nem em training_matrix_entries (histórico).

### ✅ Item 2 — Convocação automática de ASO (CONCLUÍDO)
Migração 20260707_174357:
- Função `gerar_convocacoes_aso_automaticas()` SECURITY DEFINER, search_path=public, EXECUTE revogado de anon/authenticated.
- pg_cron job `aso-convocacao-diaria` (id 4) roda `0 6 * * *` (06h UTC / 03h Brasília).
- Regras: (a) ASO Clínico vencido ou vencendo em ≤30d → cria convocação PENDENTE com janela=data_vencimento; (b) admissional pendente >30d sem exame nem convocação → cria PENDENTE com limite CURRENT_DATE+15d.
- Idempotente: pula quem já tem PENDENTE aberta. Ignora desligados.
- Alimenta card "Hoje" do TST + painel de convocações. Bloqueio na portaria continua no safety-engine.
- Log em audit_logs (action='aso_convocacao_automatica') só quando cria algo.

### ⏳ Item 3 — Mudança de cargo recalcula matriz de treinamento
Trigger em employee_role_history: quando cargo muda, calcular delta entre training_matrix_role_courses do cargo antigo x novo e criar convocações de treinamento para o delta.

## Retomada
Próximo turno: Item 3 (mudança de cargo recalcula matriz de treinamento).

## ⚠️ Pendente de teste pelo Francisco (avisar no próximo pedido de teste)
- Item 1 (Onda 2): desligar um funcionário e conferir se convocações PENDENTES viram CANCELADA + safety_overrides revogados. Ver audit_logs action='desligamento_cascata'.
- Item 2 (Onda 2): rodar manualmente `SELECT public.gerar_convocacoes_aso_automaticas();` no SQL Editor pra ver quantas criou hoje. Ou esperar 06h UTC (03h Brasília).