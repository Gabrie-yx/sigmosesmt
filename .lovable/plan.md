
# Módulo Psicossocial NR-01 no SIGMO — Fase 1 (antecipar antes da Rev.06)

## Por que agora (varredura confirmou)

- **NR-01 (Portaria MTP 1.419/2024)** exige gestão de risco psicossocial no PGR desde 26/05/2025. Fiscalização **punitiva** começou em **26/05/2026** — o timing comercial é agora.
- **Guia MTE 2025** e **FUNDACENTRO (mai/2026)** não travam matriz nem número de fatores — dá liberdade de design, mas exige defensibilidade metodológica (ISO 45003 + instrumento validado + evidência de coleta anônima + plano de ação + monitoramento contínuo).
- Concorrentes já rodando: **PrismaNR, NR1.AI, COPSOQ-SaaS Magoweb, NR1 Riscos Psicossociais, AVALIA NR01**. Nenhum divulga preço público, nenhum entrega **benchmarking setorial por CNAE**, nenhum cruza com **acidentes/absenteísmo/CID mental** dentro do mesmo SGI. Aí mora nosso diferencial.
- **Cuidado jurídico:** COPSOQ III tem zona cinza de licenciamento comercial. Vamos usar **HSE Indicator Tool (uso livre, HSE-UK)** como espinha dorsal + itens próprios inspirados em ISO 45003, evitando dor de PI. COPSOQ fica como opção "traga sua licença".

## O que entra na Fase 1 (esta rodada)

### 1. Categoria PSICOSSOCIAL na engine de risco existente
- Adicionar `PSICOSSOCIAL` ao enum de categorias (`aiha.ts` já tem label, falta enum no banco/inventário).
- Matriz 5×5 reaproveita `classifyAiha` — mesma régua de todos os outros riscos, coerência total.

### 2. Catálogo-mãe de perigos psicossociais (seed universal, qualquer CNAE)
Baseado no Guia MTE + ISO 45003. **8 dimensões, ~35 perigos**, com agravo, fonte, controles sugeridos:
1. Demandas do trabalho (sobrecarga, ritmo, pressão de prazo)
2. Controle/autonomia (falta de decisão, microgerenciamento)
3. Apoio social (liderança, pares)
4. Reconhecimento e recompensa (ERI/Siegrist)
5. Clareza de papel e mudança organizacional
6. Relações interpessoais (conflito, assédio moral/sexual, discriminação)
7. Violência no trabalho (interna e externa)
8. Interface trabalho-vida (jornada, conectividade fora do expediente, insegurança)

Vai virar tabela `catalogo_perigos_psicossociais` — base pro dropdown do inventário, e alimenta a taxonomia dos módulos futuros (auto-classificação de respostas do questionário).

### 3. Instrumento de coleta anônimo (o "questionário")
- **O que é:** questionário autoaplicável, respondido pelo próprio colaborador com garantia técnica de anonimato (token descartável, sem vínculo user↔resposta, supressão de relatório se GHE < 5 respondentes).
- **Base:** HSE Indicator Tool (35 itens, uso livre) + 5 itens de assédio/violência + 3 itens sociodemográficos não-identificantes (faixa etária, sexo, tempo de casa em faixas).
- **Fluxo:** TST/RH cria campanha → escolhe GHEs → sistema gera link/QR com token único descartável → colaborador responde no celular → dashboard agrega por GHE e por dimensão, nunca por pessoa.
- **Devolutiva:** só agregada. Zero identificação individual no dashboard.

### 4. Cruzamento nativo (ninguém no mercado faz)
Widget "Sinal de alerta psicossocial por GHE" que cruza:
- score do questionário
- taxa de absenteísmo do GHE (ponto)
- afastamentos por CID F (mental) do PCMSO
- acidentes/quase-acidentes do GHE (últimos 12m)
- rotatividade

Se 3 dos 4 sinais estão altos → alerta laranja no PGR do GHE, com sugestão de plano de ação.

### 5. Plano de ação 5W2H específico psicossocial
Reaproveita `pgr_plano_acao` já existente. Sugestões automáticas por perigo (ex.: "Sobrecarga" → revisão de dimensionamento, gestão de jornada, pausa programada).

### 6. Blindagem LGPD (obrigatório, sem atalho)
- Base legal: cumprimento de obrigação regulatória (NR-01) + consentimento no primeiro acesso.
- Dado individual **nunca** vai pra RH/gestor — só médico do trabalho, sob sigilo PCMSO. Dashboard executivo é 100% agregado.
- Supressão automática se n<5 no recorte.
- Log de acesso auditável na `audit`.
- Termo de consentimento versionado, guardado com hash da resposta (sem identificar).

## Entregáveis desta rodada (o que codo agora)

1. **Migration Supabase**
   - enum `pgr_categoria_risco` += `PSICOSSOCIAL`
   - `catalogo_perigos_psicossociais` (seed com as 8 dimensões e ~35 perigos)
   - `psico_campanhas` (empresa, ghes[], instrumento, data_inicio, data_fim, status, min_respondentes=5)
   - `psico_tokens` (campanha_id, hash_token, ghe_id, usado_em) — descartável, sem user_id
   - `psico_respostas` (id, campanha_id, ghe_id, dimensao, item_codigo, valor 1-5, respondido_em) — sem FK pra usuário, nunca.
   - `psico_consentimentos` (hash_token, versao_termo, aceito_em) — separado das respostas.
   - RLS estrita + GRANTs corretos, tudo escopado por `company_id`.

2. **Rota `/app/psicossocial`** com 4 abas:
   - **Catálogo** (biblioteca de perigos, editável por admin)
   - **Campanhas** (criar/enviar/monitorar coleta, ver taxa de participação)
   - **Diagnóstico** (dashboard agregado por GHE × dimensão, matriz 5×5 visual, sinais de alerta cruzados)
   - **Plano de ação** (5W2H, já integrado ao PGR)

3. **Rota pública `/psico/:token`** (SSR, sem auth) — colaborador responde no celular, sem login. Token single-use, invalidado após envio.

4. **Server functions**
   - `criarCampanhaPsico`, `gerarTokens` (admin, protegida)
   - `submitRespostaPsico` (pública, valida token + rate-limit + grava sem user_id)
   - `dashboardAgregado` (protegida, retorna só agregado com supressão n<5)

5. **Integração PGR**
   - Aba PSICOSSOCIAL no `/app/pgr` puxando direto do diagnóstico.
   - Score entra no inventário automático como P×S por GHE.

6. **Central de Ajuda** — 1 tópico novo explicando NR-01 psicossocial + como usar o módulo, alimenta o SIGMO Chat.

## O que NÃO entra agora (fica pra fase 2)

- IA para análise de respostas abertas (texto livre) — só campos fechados nesta rodada.
- Benchmarking por CNAE — precisa de massa de dados primeiro; roadmap.
- COPSOQ III como instrumento adicional — depende de análise jurídica de licença.
- Integração automática com CID F do PCMSO — depende da Rev.06 do PCMSO chegar.

## Ordem de execução

1. Migration + seed catálogo (1 passo)
2. Server functions + RLS + testes de anonimato
3. Rota `/app/psicossocial` (4 abas)
4. Rota pública `/psico/:token` mobile-first
5. Integração com `/app/pgr` (aba nova)
6. Update Central de Ajuda + memória do projeto

Confirma que sigo por esse desenho? Se quiser, ajusto: (a) trocar HSE-IT por outro instrumento base, (b) mudar o mínimo de n=5 pra supressão, (c) incluir/excluir alguma dimensão.
