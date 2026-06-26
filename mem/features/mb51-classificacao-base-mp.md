---
name: MB51 classificação — Base MP é fonte da verdade
description: Regra de classificação de materiais no painel de produção; Base MP sempre vence sobre classificacao_mb51.
type: constraint
---

# Regra inviolável — resolveTipo (src/lib/mb51-parser.ts)

Se o material existe em producao_base_materia_prima, o tipo cadastrado é a fonte da verdade ABSOLUTA — inclusive quando vale "OUTROS".

Ordem de resolução:
1. baseMp.get(material) → se existir, retorna (mesmo "OUTROS").
2. Material sem cadastro: inferTipoByText(descricao).
3. Último recurso: inferTipoByText(classificacao_mb51).

Por quê: classificacao_mb51 é digitada pelo operador linha a linha e erra com frequência. Caso real: "CORRENTE SOLD ZINC 6MM" (Base MP = OUTROS) aparecia classificada como "Gás" em alguns movimentos e caía no card de GÁS no painel.

Não faça:
- Tratar "OUTROS" da Base MP como genérico e cair em fallback.
- Misturar descricao + classificacao_mb51 num texto único para inferência.
- Usar classificacao_mb51 como reforço quando o material já tem cadastro.

Se um material está no card errado: corrija o tipo em producao_base_materia_prima, não mexa em resolveTipo.
