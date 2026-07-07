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

### ⏳ Item 2 — ASO vencido bloqueia portaria
Safety-engine já bloqueia com override do supervisor. Falta: cronjob diário que marca funcionários com ASO vencido e dispara notificação pro TST.

### ⏳ Item 3 — Mudança de cargo recalcula matriz de treinamento
Trigger em employee_role_history: quando cargo muda, calcular delta entre training_matrix_role_courses do cargo antigo x novo e criar convocações de treinamento para o delta.

## Retomada
Próximo turno: Item 2 (ASO vencido) — precisa de cronjob (pg_cron) + tabela de bloqueios ou flag em employees.