---
name: RC Auto-scoring de cotações + 5 estrelas por fornecedor
description: Fila pra depois. Quando RC tiver 2-3 cotações, sistema faz varredura por item/qtd/valor unitário/valor total/valor da nota, destaca a "melhor oferta" e classifica o fornecedor de 1-5 estrelas com base em histórico (preço vs média, prazo, entrega). Dispensa de cotação já foi implementada; auto-scoring vira o próximo módulo do fluxo de Compras.
type: feature
---

## Escopo pendente
- Varredura automática de cotações anexadas (compare item por item, qtd, valor unitário, valor total, valor da nota).
- Sinalizar "MELHOR OFERTA" (custo total menor + prazo compatível).
- Rating 1-5 estrelas do fornecedor calculado a partir do histórico:
  - preço médio vs mercado (RCs anteriores),
  - vitórias/derrotas,
  - prazo de entrega cumprido (quando tivermos módulo de recebimento),
  - reincidência de fornecedor exclusivo em dispensas.
- Base de fornecedores virá do SAP (planilha que o usuário vai exportar e importar no SIGMO).
- Integrar com módulo Compras já existente (`app.compras.requisicoes-recebidas.tsx`) mostrando badge "MELHOR OFERTA" no `CotacaoCard` e estrelas no cabeçalho de cada cotação.

## Ativar quando
O usuário mandar a planilha de fornecedores exportada do SAP OU pedir explicitamente para iniciar essa fase.