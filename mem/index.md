# Project Memory

## Core
Comando "listar pendencias" → ler mem://pendencias e mostrar itens `[ ]`.
Quando o usuário falar em "outras empresas", "multi-empresa", "white-label", "SaaS", "CNAE", "qualquer segmento", "vender o SIGMO" → consultar mem://pgr-generico.
Arquivar TUDO que o usuário disser na memória (pendência/decisão/contexto) para tratamento posterior — ver mem://preferences/arquivar-tudo.
Padrão **Modal-First**: ações novas abrem como modal/sheet/drawer sobre a tela contextual. Rota nova só com justificativa (ver mem://preferences/modal-first).
MB51: Base MP vence, mas OUTROS é residual saneado por descrição; classificacao_mb51 nunca reforça material cadastrado — ver mem://features/mb51-classificacao-base-mp.
RBAC: módulo/papel/menu precisa bater em UI, validação server-side, enum/funções do Supabase e guards; nunca divergir.
Tema escuro: telas/overlays/modais SEMPRE em tokens semânticos. PROIBIDO texto escuro/bg-white/bg-red-50 sobre fundo escuro. Ver mem://constraints/nada-de-cores-hardcoded.
Scrollbar SEMPRE glassmorph fina com flares (global em src/styles.css). PROIBIDO scrollbar padrão do SO/cinza, grossa ou hardcoded. Ver mem://constraints/scrollbar-glassmorph.
Horas extras pertencem ao módulo de origem; não usar SESMT como caixa geral nem mexer no painel SESMT para esse fluxo.
Aline Farias saiu; TST atual é Francisco Bandeira Almeida. Todo import (CAL/PGR/matriz) deve substituir "aline farias" por ele antes de gravar. Ver mem://constraints/aline-farias-fora.

## Memories
- [SIGMO Licenciamento - e-mail enviado](mem://features/sigmo-licenciamento-email-enviado) — E-mail formal enviado 21/07/2026 pra Anderson/Henrique/Leianderson provocando formalização; aguardando retorno.
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
- [RC Auto-scoring + 5 estrelas](mem://features/rc-auto-scoring-estrelas.md) — Fila pra depois: varredura de 2-3 cotações, "MELHOR OFERTA" automática e rating 1-5 do fornecedor; iniciar quando chegar a planilha SAP de fornecedores.
- [Auditoria RBAC / usuários](mem://features/rbac-auditoria-usuarios.md) — Levantamento 03/07: 4 de 5 usuários são admin; sem segregação por empresa; proposta de roles finas + MFA obrigatório em debate. Não codar sem OK.
- [RBAC com fonte única](mem://preferences/rbac-fonte-unica.md) — Nunca exibir módulo/papel na tela se backend/banco/guards não aceitarem; revisar tudo junto ao criar módulo.
- [Nada de cores hardcoded no tema escuro](mem://constraints/nada-de-cores-hardcoded.md) — Regra dura contra bg-white/text-slate/text-black/bg-red-50 em telas, modais, popovers, drawers e dropdowns.
- [Scrollbar glassmorph global](mem://constraints/scrollbar-glassmorph.md) — Regra global de scrollbar fina estilo vidro com flares aplicada em `*::-webkit-scrollbar*`. Proibido scrollbar padrão.
- [Onda 1 - Blindagem](mem://features/onda1-blindagem-seguranca.md) — Bloco 1 do parecer CONCLUÍDO ✅: endpoints IA fechados, bucket avatars privado + URLs assinadas, RPCs públicos auditados (REVOKE anon + is_supervisor_geral).
- [Parecer Auditoria SIGMO 2026-07-14](mem://features/parecer-auditoria-2026-07-14.md) — Fonte oficial: 117 achados em 6 ondas. Consultar sempre que falar em "onda X do parecer", C-XX ou G-XX.
- [Onda 2 - Gatilhos automáticos](mem://features/onda2-gatilhos-automaticos.md) — Bloco 2 do parecer PARCIAL 🟡: fizemos C-02 (demissão cascata APR/PTE), C-04 parcial (mudança cargo → histórico+audit, FALTA convocar exame MUDANCA_FUNCAO), cronjob ASO extra. PENDENTES: C-01, C-03, C-05 a C-10 + G-01 a G-15.
- [Deploy SIGMO servidor DMN (pausado)](mem://deploy-sigmo-servidor-dmn) — PAUSADO. Plano 5 fases em .lovable/plan.md p/ subir SIGMO + Supabase self-hosted no Ubuntu 24.04 via VPN DMN. Retomar quando usuário chamar.
- [Transferência funcionário entre empresas](mem://features/transferencia-funcionario-empresa) — Wizard admin/moderador; APRs/PTEs abertas → reatribuir ou arquivar; motivo obrigatório; grava employee_company_history.
- [NAO_MEI → CLT](mem://features/rename-clt-tipo-cadastro) — tipo_cadastro aceita só MEI/CLT/AVULSO. Default AVULSO. Trigger seta MEI quando empresa é DMN (companies.type='CLT').
- [Aline Farias fora](mem://constraints/aline-farias-fora.md) — Sanitizar em TODO parser/import: "Aline Farias" → "Francisco Bandeira Almeida". Já aplicado em cal-parser + import de PAs.
- [SIGMO resiliência sem IA](mem://features/sigmo-resiliencia-sem-ia) — Estratégia 2 camadas (templates determinísticos + IA opcional) para importar PGR/PCMSO/LTCAT/LIP sem quebrar se a IA cair. Pausado; retomar junto com Rev.06.
- [Onda 3 · PET blindada C-11/12/13](mem://features/onda3-blindagem-pet) — Modo strict opt-in, plano_resgate estruturado, soft delete medições. Pendente teste + UI do toggle strict.
- [PAUSADO · Bloqueios OS x PET](mem://features/pausado-oss-pet-bloqueios) — Chamar de "bloqueios OS x PET" ou "os 44 da PET". 42 de 44 travados por ASO/NR faltando, não pela OS. Pendências: migração ASO legado, cargos elétrica sem NRs, tooltip do dropdown.
- [Usuário só vê frontend](mem://preferences/user-so-ve-frontend.md) — Não perguntar ao usuário sobre banco/storage/coordenadas/estado técnico; descobrir sozinho com as tools antes de perguntar.
- [Módulo Psicossocial NR-01](mem://features/modulo-psicossocial-nr01) — Fase 1 entregue 12/07/2026: catálogo 8 dimensões, campanhas com tokens anônimos, questionário mobile /psico/:token, dashboard agregado com supressão n<5 (LGPD). Rota /app/psicossocial. Base HSE-IT BR + ISO 45003 (COPSOQ fica pra fase 2).

- [TST não controla ponto](mem://features/tst-nao-controla-ponto.md) — Base legal (CLT 74, Port. MTP 671/2021, NR-04, CBO 3516-05): controle de entrada/saída é do empregador/RH/DP/Portaria, NÃO do TST. Desvio de função quando exigido.
- [Plano de Ações — lapidação pendente](mem://features/plano-acoes-lapidacao-pendente.md) — NC-inspeção↔5W2H entregue (trigger+backfill+cards compactos/clicáveis). Falta chip "Origem: Inspeção" com link, validar em prod, revisar cores da tela da inspeção, decidir edição bidirecional.
- [Multi-tenant SIGMO (futuro)](mem://features/multi-tenant-futuro.md) — Grupo Atem cogita usar SIGMO em outras empresas do grupo; opção A (multi-tenant real) escolhida, mas só implementar quando 1º cliente do grupo fechar acesso oficial.
