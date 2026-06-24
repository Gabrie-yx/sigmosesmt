---
name: Padrão Modal-First
description: Antes de criar rota nova, abrir como modal/sheet/drawer sobre a tela contextual. Rotas só quando justificado.
type: preference
---
Padrão oficial do SIGMO: **Modal-First**.

Antes de criar rota nova, perguntar: "isso pode ser um modal/sheet/drawer sobre a tela contextual onde a ação nasce?"

**Se sim → modal/sheet/drawer.**

**Rota nova só quando:**
- Fluxo longo (wizard de 3+ passos)
- Precisa URL compartilhável (ex.: `/employees/$id`)
- Relatório que vira print/PDF dedicado
- Módulo top-level do menu (PGR, APRs, Funcionários, etc.)

**Por quê:** ISO 9001/45001 não exige telas separadas — exige rastreabilidade documentada. Modal mantém contexto, reduz cliques, evita explosão de rotas.

**Não viola:** tema escuro oficial, Cargos/Funções, qualquer regra visual existente.