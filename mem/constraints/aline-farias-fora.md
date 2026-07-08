---
name: Aline Farias fora do quadro
description: Substituir sempre "Aline Farias de Oliveira" por "Francisco Bandeira Almeida" em qualquer import (CAL, PGR, PA, matriz).
type: constraint
---
Aline Farias de Oliveira NÃO faz mais parte do quadro da empresa. O TST atual é Francisco Bandeira Almeida.

Regra: qualquer parser/importador de planilha (CAL Requisitos, CAL Plano de Ação, PGR, matriz de treinamento, etc.) deve normalizar responsável/gestor/execução — se o nome contiver "aline" + "farias" (case/acentos ignorados), gravar "Francisco Bandeira Almeida" no lugar. Nunca reintroduzir o nome antigo, mesmo se a planilha do cliente ainda o trouxer.

**Why:** Usuário já reforçou 3+ vezes e vinha aparecendo de novo a cada reimport.
**How to apply:** Sanitizar no parser (`src/lib/cal-parser.ts` já tem `sanitizeResponsavel`) e/ou no import (`src/routes/app.cal.planos.tsx`) antes do insert/update.