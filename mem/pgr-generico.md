---
name: PGR genérico multi-empresa/multi-segmento
description: Decisões e requisitos para o SIGMO gerar PGR para qualquer empresa e segmento (CNAE). Lembrar quando o usuário falar em "PGR genérico", "outras empresas", "white-label", "multi-tenant", "CNAE", "qualquer segmento".
type: feature
---

## Decisões confirmadas pelo usuário (PGR Fase 1)
1. Tabela `pgr_ghe` (numero, setor, ambiente_descricao, qtd_colaboradores, jornada) + `cargos.ghe_id` opcional. SIM
2. Reaproveitar 100% das colunas do inventário do PGR DMN (Perigo, Agravo, Fonte, Controles, Exposição, Intensidade, LT, Tipo avaliação, P, S, R, Classificação, Monitoramento). SIM
3. PDF: layout MODERNO, elegante, profissional, apresentável (NÃO 1:1 do DMN). Inspiração: design SIGMO atual, headers gradiente, tipografia limpa, tabelas zebra, capa com logo/CNPJ/RT/revisão.
4. PT exige APR: flag configurável `pt_exige_apr_valida` em `company_settings`. Default = NÃO bloqueia. Quando ligado, bloqueia emissão de PT sem APR válida vinculada à tarefa.

## Status Fase 1 (em construção)
- [x] Migration: `pgr_ghe`, `pgr_inventario_riscos` (com `risco` calculado P*S), `pgr_plano_acao` (5W2H), flag `company_settings.pt_exige_apr_valida`, `roles.ghe_id`.
- [x] Helper `src/lib/aiha.ts` — classificação 5×5 (Trivial/Baixo/Moderado/Alto/Muito Alto + priorização).
- [x] Rota `/app/pgr` com 3 abas: GHEs (CRUD + vincular cargos), Inventário (CRUD + matriz visual 5×5 + KPIs), Plano 5W2H (CRUD + sugestões para riscos Alto/Muito Alto).
- [ ] Seed automático do PGR DMN (importar 10 GHEs + inventário do PDF).
- [ ] PDF moderno do PGR (capa, GHEs, inventário, matriz, plano 5W2H, plano de monitoramento).
- [ ] Flag PT exige APR: aplicar no fluxo de emissão de PT (`src/routes/app.ptes.tsx`).

## Pergunta aberta do usuário (responder com calma, NÃO codar ainda)
"O que o SIGMO precisa para gerar qualquer PGR, para qualquer empresa e qualquer segmento?"

### 6 camadas necessárias
1. **Multi-tenant real (company_id em tudo SST)** — hoje há `companies` mas nem toda tabela escopa. PGR, GHE, inventário, plano de ação, PAE — TUDO por empresa. RLS por company_id + role.
2. **Catálogo nacional CNAE + Grau de Risco NR-04** — tabela `cnae` (código, descrição, grau 1-4). ~1.300 CNAEs do IBGE/MTE. Caracterização puxa CNAE → grau automático → periodicidade ASO, dimensionamento SESMT.
3. **Biblioteca-mãe de perigos por segmento** — tabela `catalogo_perigos` (categoria físico/químico/biológico/ergonômico/acidente, perigo, agravo, fonte típica, controles, LT NR-15/NR-09, tipo avaliação). Pacotes: Naval, Construção, Alimentos, Saúde, Escritório, Transporte, Mineração, Agro.
4. **Matriz AIHA 5×5** — já decidida, universal para todos segmentos.
5. **Branding por empresa** — logo, CNPJ, endereço, RT (CREA), cores em `company_branding`. PDF lê e monta capa/cabeçalho/rodapé.
6. **Wizard de PGR** — (1) CNPJ → ReceitaWS preenche tudo + CNAE→grau; (2) escolher pacote(s) de segmento → pré-popula GHE; (3) ajustar GHEs; (4) revisar inventário e classificar P×S; (5) plano 5W2H auto dos Altos/Muito Altos; (6) gerar PDF moderno.

## Perguntas em aberto pro usuário (na hora certa)
- a) SIGMO vai ser **white-label SaaS** (vários clientes no mesmo app, cada um seu workspace) ou **instância por empresa**?
- b) Pacotes de segmento: você cura e entrega prontos ou cada cliente monta o seu?
- c) Integrar ReceitaWS/CNPJ.ws para autopreencher empresa por CNPJ?
- d) LTCAT e PCMSO também viram universais (mesma lógica)?
- e) Cobrança por cliente (Stripe/Paddle) se for SaaS?

## Quando relembrar
Usuário falar em: "outras empresas", "vender o SIGMO", "PGR para cliente X", "multi-empresa", "white-label", "SaaS", "CNAE", "qualquer segmento" → puxar este memo, mostrar as 6 camadas e as perguntas abertas.
