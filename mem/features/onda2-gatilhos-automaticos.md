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

### ✅ Item 3 — Mudança de cargo recalcula matriz (CONCLUÍDO)
Migração 20260707_175331:
- Trigger `trg_employee_role_change` AFTER UPDATE OF role_id, ghe_id em employees → `tg_employee_role_change()` SECURITY DEFINER, search_path=public, EXECUTE revogado de anon/authenticated.
- Idempotente: só dispara se role_id OU ghe_id realmente mudam.
- Insere linha em `employee_role_history` (role/ghe anterior+novo, changed_by=auth.uid(), changed_at, company_id).
- Calcula delta: cursos de training_matrix_role_courses do novo cargo que o funcionário nunca concluiu (training_matrix_entries.data_conclusao IS NOT NULL).
- Grava audit_logs action='mudanca_cargo' com metadata: employee_nome, role_anterior/novo (id+nome), ghe_anterior/novo (id+nome), cursos_delta (jsonb), qtd_cursos_pendentes.
- Matriz continua computada em tempo real (join role_courses × entries). Nenhuma linha "pendente" é criada — a tela já mostra o gap.

### ✅ Item 4 — C-01 Portaria bloqueia ex-funcionário (CONCLUÍDO)
Migração 20260707_183018:
- Estende `fechar_pendencias_ao_desligar()` pra também `UPDATE portaria_pessoas SET bloqueado=true, motivo_bloqueio='Desligado em DD/MM/YYYY — Nome'` matchando por CPF normalizado (só dígitos, len=11).
- Idempotente: só toca em registros com bloqueado=false.
- audit_logs action='desligamento_cascata' agora inclui `portaria_bloqueadas` no metadata.
- portaria_pessoas não tem FK pra employees (é cadastro genérico por CPF), por isso o match é por CPF.

### ✅ Item 5 — C-04.b Convocar exame MUDANCA_FUNCAO (CONCLUÍDO)
Migração 20260707_183613:
- Estende `tg_employee_role_change()` pra também INSERT em `convocacoes_exames` (janela='MUDANCA_FUNCAO', tipos_exame=['Exame Médico de Mudança de Função'], status=PENDENTE, data_limite=CURRENT_DATE).
- Só dispara quando role_id realmente muda (só GHE não gera exame). Ignora desligados.
- Idempotente: pula se já existe PENDENTE com janela=MUDANCA_FUNCAO pro funcionário.
- Observações da convocação explicam cargo anterior→novo + cita NR-07 7.5.1.II.
- Metadata do audit_log 'mudanca_cargo' ganha `convocacao_mudanca_funcao_id`.
- Aparece automaticamente no painel /app/sesmt/convocacoes-aso e no card Hoje.

## Onda 2 concluída ✅
Itens 1-3 + C-01 + C-04.b implementados. Próximo: C-10 (ASO DEMISSIONAL wizard), C-08 (ASO RETORNO_TRABALHO ao fechar acidente c/ afastamento).

## ⚠️ Pendente de teste pelo Francisco (avisar no próximo pedido de teste)
- Item 1 (Onda 2): desligar um funcionário e conferir se convocações PENDENTES viram CANCELADA + safety_overrides revogados. Ver audit_logs action='desligamento_cascata'.
- Item 2 (Onda 2): rodar manualmente `SELECT public.gerar_convocacoes_aso_automaticas();` no SQL Editor pra ver quantas criou hoje. Ou esperar 06h UTC (03h Brasília).
- Item 3 (Onda 2): trocar cargo (ou GHE) de um funcionário e conferir: linha nova em employee_role_history + audit_logs action='mudanca_cargo' com cursos_delta preenchido.
- C-01: desligar funcionário com CPF cadastrado em portaria_pessoas e conferir que a pessoa fica bloqueada + motivo preenchido. Ver `portaria_bloqueadas` no metadata do audit_logs.
- C-04.b: trocar o CARGO de um funcionário e conferir se aparece nova convocação PENDENTE janela=MUDANCA_FUNCAO em /app/sesmt/convocacoes-aso.