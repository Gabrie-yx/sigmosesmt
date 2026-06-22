---
name: SIGMO aguardando Rev.06 PGR/PCMSO
description: Plano faseado para evoluir módulo PGR do SIGMO após chegada das revisões. Não mexer antes.
type: feature
---
# Contexto
Parecer Técnico v4 do PGR DMN 2026 identificou 13 NCs (3 críticas, 7 graves, 3 moderadas). Decisão do usuário: aguardar Rev.06 do PGR e Rev.06 do PCMSO antes de evoluir o módulo SIGMO, para evitar retrabalho.

# Plano faseado (quando documentos chegarem)
Ordem de execução combinada:

1. **Categoria Psicossocial no inventário** (`pgr_inventario_risks`) + flag "maior magnitude" — destrava 2 NCs.
2. **Plano de Ação vivo** — status + evidência + revisão mensal no `pgr_plano_acao`.
3. **AEP (Análise de Exposição Profissional) por GHE** — novo módulo/aba.
4. **Enquadramento GHE administrativo com atividade de campo** (NC-13 — caso TST) — flag + validação cruzada com cargos que têm atividades operacionais reais.
5. Demais ajustes acompanham a Rev.06.

# Gatilho para retomar
Usuário avisar que recebeu Rev.06 do PGR ou PCMSO. Aí abrir este memo + parecer v4 e executar fase 1.
