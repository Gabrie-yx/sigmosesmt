---
name: MB51 classificação — Base MP é fonte da verdade
description: Regra de classificação de materiais no painel de produção; Base MP vence e OUTROS é categoria residual saneada por descrição.
type: constraint
---

# Regra inviolável — resolveTipo / normalizeBaseMpTipo (src/lib/mb51-parser.ts)

Se o material existe em producao_base_materia_prima, a Base MP é a fonte da verdade. Porém **OUTROS é categoria residual**, não pode carregar materiais que pertencem claramente a FERRO/GÁS/SOLDA/TINTA.

Regra atual: ao montar o mapa da Base MP e ao importar nova Base MP, `normalizeBaseMpTipo(tipo, descricao)` saneia `OUTROS` pela descrição. Ex.: `DENVER`, `WELD`, `7018`, `SOLDA` → SOLDA; `INTERNATIONAL REDUTOR/GTA`, `DILUENTE`, `THINNER` → TINTA; `CARGA DE GAS` → GÁS; `TUBO`, `AÇO`, `PORCA`, `ASTM` → FERRO.

Ordem de resolução:
1. baseMp.get(material) já saneado → se existir, retorna.
2. Material sem cadastro: inferTipoByText(descricao).
3. Último recurso: inferTipoByText(classificacao_mb51).

Por quê: classificacao_mb51 é digitada pelo operador linha a linha e erra com frequência. Caso real: "CORRENTE SOLD ZINC 6MM" (Base MP = OUTROS) aparecia classificada como "Gás" em alguns movimentos e caía no card de GÁS no painel.

Não faça:
- Usar classificacao_mb51 para trocar categoria de material cadastrado.
- Misturar descricao + classificacao_mb51 num texto único para inferência.
- Deixar material claramente de TINTA/SOLDA/GÁS/FERRO dentro de OUTROS.

Caso real novo: vários materiais estavam cadastrados como OUTROS apesar da descrição clara (`ARAME TUBULAR WELD`, `DENVER BH 7018`, `SOLDA OK`, `INTERNATIONAL REDUTOR`, `CARGA DE GAS`, `TUBO DE AÇO`). Agora o painel saneia isso antes de agrupar.

Observação: `CORRENTE SOLD ZINC 6MM` continua OUTROS, porque "SOLD" isolado em corrente zincada não é consumível de solda; não usar esse caso para forçar fallback por classificacao_mb51.
