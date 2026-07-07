---
name: Transferência de funcionário entre empresas
description: admin/moderador transfere funcionário; APRs/PTEs abertas reatribuídas ou arquivadas; histórico com motivo.
type: feature
---

- Server fn `transferEmployee` em src/lib/employees-transfer.functions.ts (só admin/moderador). Wizard 3 passos em `TransferirEmpresaDialog`.
- Cada APR (apr_assinaturas.employee_id) e PTE (ptes.employee_id) aberto exige decisão: REASSIGN (colega ativo da empresa antiga) ou ARCHIVE (aprs/ptes.status='CANCELADA' + cancelada_em/motivo/por).
- ASO/vacinas/atestados não mexem (do funcionário). GHE segue (pgr_ghe é global, sem company_id).
- Motivo obrigatório (>=5). Grava em employee_company_history (contadores + alerta GHE).
- Botão roxo "Transferir" no header da ficha (app.employees.$id.tsx), admin/moderador, quando não desligado.
