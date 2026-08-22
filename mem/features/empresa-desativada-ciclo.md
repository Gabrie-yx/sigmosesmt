---
name: Ciclo de vida da empresa (ATIVA/DESATIVADA)
description: Empresa sem funcionário ativo vai automaticamente para DESATIVADA; reativação manual (admin/moderador) ou automática ao vincular funcionário ativo.
type: feature
---
- `companies.status` = ATIVA | DESATIVADA, + data/motivo de desativação e reativação.
- Trigger `employees_status_empresa` (insert/update de status ou company_id/delete) chama `recalcular_status_empresa`:
  - 0 funcionários ATIVO → DESATIVADA (motivo automático "Sem efetivo ativo").
  - ≥1 ATIVO → volta a ATIVA automaticamente (inclusive por transferência ou reativação de funcionário).
- RPCs `desativar_empresa` / `reativar_empresa` (admin ou moderador, justificativa mín. 5 chars). Desativar manual bloqueado se houver ativos.
- UI: `/app/companies` tem toggle "Desativadas (n)" separando as seções, badge DESATIVADA no card, e botão Desativar/Reativar no cabeçalho (admin).
- Seletores de admissão (new-employee-dialog) e transferência excluem empresas DESATIVADA.
