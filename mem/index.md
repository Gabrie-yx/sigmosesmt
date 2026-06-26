# Project Memory

## Core
Comando "listar pendencias" → ler mem://pendencias e mostrar itens `[ ]`.
Quando o usuário falar em "outras empresas", "multi-empresa", "white-label", "SaaS", "CNAE", "qualquer segmento", "vender o SIGMO" → consultar mem://pgr-generico.
Arquivar TUDO que o usuário disser na memória (pendência/decisão/contexto) para tratamento posterior — ver mem://preferences/arquivar-tudo.
Padrão **Modal-First**: ações novas abrem como modal/sheet/drawer sobre a tela contextual. Rota nova só com justificativa (ver mem://preferences/modal-first).
MB51: Base MP vence, mas OUTROS é residual saneado por descrição; classificacao_mb51 nunca reforça material cadastrado — ver mem://features/mb51-classificacao-base-mp.

## Memories
- [Pendências](mem://pendencias) — Tarefas pendentes acordadas com o usuário (geradores PDF Eficácia/Reação, etc.)
- [Dashboard Produção](mem://producao-dashboard) — Estado do módulo Produção: tabelas MB51/Base MP/Lista Técnica, rotas de upload e dashboard dinâmico. Quando o usuário falar de "dashboard produção", "MB51", "Base MP" ou "painel lista técnica", consultar este arquivo e atualizar o histórico ao final.
- [Distribuição de Orçamentos entre Balsas](mem://producao-distribuicao-orcamentos) — Lógica acordada (não implementada ainda) para subir N orçamentos a um pool e distribuir matéria-prima 50/50 entre balsas/cascos existentes. Quando o usuário falar em "distribuir orçamento", "pool de orçamentos" ou "subir orçamento de produção", consultar este arquivo.
- [PGR Genérico](mem://pgr-generico) — Decisões do PGR Fase 1 (GHE, AIHA 5×5, PDF moderno, PT-APR flag) + roadmap das 6 camadas para gerar PGR de qualquer empresa/segmento (multi-tenant, CNAE, biblioteca de perigos, branding, wizard). Perguntas abertas registradas.
- [Organograma DMN Rev. 06](mem://features/organograma-dmn-rev06) — Quadro de pessoal DMN 14/04/2026 (~21 CLT + 2 ATEM/CSC) e 6 não conformidades cruzadas com PGR Rev. 05 (base da matriz GHE real vs PGR).
- [Arquivar tudo](mem://preferences/arquivar-tudo) — Toda fala do usuário vira memória (pendência/decisão/contexto) para tratar depois.
- [SIGMO aguardando Rev.06 PGR/PCMSO](mem://features/sigmo-pgr-pcmso-rev06-pendente.md) — Plano faseado (psicossocial, plano vivo, AEP, GHE adm com campo) só executar após chegada das revisões.
- [Anti-MDI — roubos do Senior](mem://design/anti-mdi-roubos-senior.md) — Manifesto: 6 pecados do Senior (MDI, abas empilhadas, FRSELEMP) + 8 roubos com classe (drawer, switcher de obra, ação em massa, preview, Cmd+K, chip de status).
- [Padrão Modal-First](mem://preferences/modal-first.md) — Antes de criar rota nova, tentar modal/sheet/drawer sobre a tela contextual. Rota só para wizard longo, URL compartilhável, PDF dedicado ou módulo top-level.
- [ASO upload validação](mem://features/aso-upload-validacao.md) — Hoje não valida conteúdo do PDF; plano em 5 níveis registrado; manter como está até priorizar Nível 1+3 (validação básica + extração IA cruzando com convocação).
- [Indicadores Executivos + Notificações (pausado)](mem://features/indicadores-notificacoes-pausado.md) — Turbinada SOC aprovada mas em espera: dashboard executivo SST (TF/TG/TFCA) + notificações inteligentes. Retomar após documentação técnica do Parecer TI Rev00.
- [DDS Semanal assinaturas (teste pendente)](mem://features/dds-assinaturas-teste-pendente.md) — Toggle de assinatura digital implementado; falta validar E2E. Auth externa bloqueia Playwright; depende da Arteniza validar manual.
- [MB51 classificação — Base MP vence](mem://features/mb51-classificacao-base-mp.md) — Regra inviolável do resolveTipo: Base MP é fonte da verdade absoluta; classificacao_mb51 só como último recurso para material sem cadastro. Caso real CORRENTE SOLD ZINC vazando p/ GÁS.
- [Israel - Almoxarifado](mem://team/israel-almoxarifado.md) — Responsável pelo almox no pátio; valida fatores de consumo (SOLDA/GÁS/TINTA) em /app/producao/fatores-consumo.
