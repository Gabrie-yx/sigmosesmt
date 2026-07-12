---
name: NAO_MEI renomeado para CLT
description: tipo_cadastro em employees aceita só MEI/CLT/AVULSO. Default AVULSO. Trigger seta MEI se empresa é DMN.
type: feature
---

- Migration 2026-07-07: UPDATE NAO_MEI→CLT (39 registros); CHECK (MEI/CLT/AVULSO); DEFAULT 'AVULSO'; trigger `employees_default_tipo_cadastro` BEFORE INSERT que aplica MEI quando companies.type='CLT' (DMN) e AVULSO caso contrário — só se o valor vier NULL ou default.
- Trigger nunca bloqueia override manual pelo usuário.
- Sweep de código: constants, form (new-employee-dialog), ficha ($id), employee-ficha-pdf, backup, matriz-treinamento sem NAO_MEI.

Status: **CONCLUÍDO** (migration + sweep de código aplicados). Não listar como pendente.
