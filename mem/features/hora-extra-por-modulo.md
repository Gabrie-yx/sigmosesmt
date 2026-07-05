---
name: Hora extra por módulo
description: Regra de negócio das horas extras: cada ficha pertence ao módulo de origem e indeferida volta ao solicitante/módulo.
type: feature
---

**Regra:** Horas extras devem ser tratadas dentro do respectivo módulo de origem (`almoxarifado`, `manutencao`, `mecanica`, `eletrica`, `producao`, `compras`, `portaria` etc.), não no painel SESMT.

**Indeferimento:** quando o Administrativo/Supervisor indeferir, a ficha fica `INDEFERIDA`, guarda `motivo_indeferimento` e volta ao módulo solicitante para correção/reenovio. Ao reenviar, volta para `PENDENTE` e limpa o motivo da recusa.

**SESMT:** não mexer no painel SESMT para resolver fluxo de hora extra por módulo; o SESMT não deve virar caixa geral desse processo.