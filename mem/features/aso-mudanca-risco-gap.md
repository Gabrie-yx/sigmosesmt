---
name: ASO Mudança de Risco - gap de validação
description: Sistema não valida se houve mudança real de GHE/função ao registrar ASO de Mudança de Risco; sem histórico antes/depois atrelado ao ASO.
type: feature
---
# Gap: ASO de Mudança de Risco sem trava de consistência

Hoje, ao registrar um ASO com natureza **"Mudança de Risco Ocupacional"**, o sistema NÃO valida se de fato houve mudança de GHE/função na ficha do funcionário (compara `role_id`/`ghe_id` atual vs anterior).

## Implementações pendentes

1. **Validação on-submit**: ao escolher natureza "Mudança de Risco", exigir que o cargo/GHE atual seja diferente do registrado antes do último ASO. Bloquear gravação se igual (ou exigir justificativa).
2. **Histórico antes/depois**: gravar em `employee_role_history` (criar se não existir) o GHE/cargo **anterior** e **novo**, atrelado ao `employee_exam_id` que motivou a mudança. Rastreabilidade NR-7 / ISO 45001.

## Quando retomar
Pausado em 26/jun/2026. Retomar junto com o módulo de Medicina Ocupacional ou quando o usuário priorizar conformidade NR-7.