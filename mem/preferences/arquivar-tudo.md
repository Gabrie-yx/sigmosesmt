---
name: Arquivar tudo na memória
description: Toda fala do usuário deve ser arquivada na memória como pendência/decisão/contexto para tratamento posterior, mesmo que não seja implementada imediatamente.
type: preference
---
**Regra:** Tudo que o usuário disser — ideia, reclamação, achado, decisão, pendência, contexto — deve ser arquivado em `mem://` no tópico apropriado (pendências, features, constraints, etc.) para depois a gente tratar/implementar/resolver.

**Como aplicar:**
- Nunca descartar uma fala como "só conversa"
- Se for pendência acionável → adicionar em `mem://pendencias` com `[ ]`
- Se for decisão técnica/produto → criar/atualizar tópico em `mem://features/...`
- Se for algo a NUNCA fazer → `mem://constraints/...`
- Se for preferência de trabalho/comunicação → `mem://preferences/...`
- Confirmar brevemente ao usuário o que foi arquivado e onde
