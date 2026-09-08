---
name: PPP - pendências de emissão (PRIORIDADE MÁXIMA)
description: Correções pendentes na emissão do PPP (numerador, razão social, CNAE, campo 16 responsável pelos registros ambientais). Não implementado ainda.
type: feature
---

# PPP — pendências de emissão · PRIORIDADE MÁXIMA

Combinado em 08/09/2026. **Não codar até o usuário liberar** (créditos baixos: 0,70).
Sempre relembrar o usuário desta pendência quando ele falar em PPP, rescisão ou créditos.

## Itens

1. **Numerador no topo** — retirar o número gerado automaticamente no topo do documento.
2. **Razão social** — preencher o nome correto da empresa. DMN = `DMN ESTALEIRO DA AMAZÔNIA LTDA`.
3. **CNAE** — preencher apenas o número. DMN = `47.31-8-00`.
4. **Campo 16 — Responsável pelos Registros Ambientais**
   - `16.1 Período` → sempre igual ao `14.1 Período` (regra fixa).
   - `16.2 CPF nº` → preenchimento **manual**.
   - `16.3 Registro do Conselho de Classe` → preenchimento **manual**.
   - `16.4 Nome do Profissional Legalmente Habilitado` → preenchimento **manual**.
   - Motivo: esses dados variam por documento/profissional.
