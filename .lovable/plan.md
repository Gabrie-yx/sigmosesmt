## Objetivo
Entregar os 3 blocos (A → C → B) com visual elegante glassmorphism (mesmo padrão do painel OSS/Breadcrumb), sem cara de SOC.

## Ordem de execução

### Fase 1 — Catálogo de Prestadores (base de tudo)
Sem isso, guia e convocação não têm endereço/clínica. Atacar primeiro.

- Migration: tabela `prestadores_saude` (razão social, fantasia, CNPJ, endereço completo, contatos, especialidades[], tipos_guia_esocial[], ativo)
- Rota `/app/sesmt/prestadores` com listagem glass + KPIs (total, ativos, por especialidade)
- Dialog cadastro/edição com máscaras CNPJ/CEP (auto-preenche endereço via ViaCEP)
- Seed dos prestadores já conhecidos (Medical Clin, Multimagem etc.) se você me passar; senão deixo vazio pra você cadastrar

### Fase 2 — Ficha Viva do Funcionário (Bloco A)
Completar a ficha com gaps mapeados do SOC, **sem scroll infinito**.

- Migration: adicionar campos faltantes em `employees` (RG, nome_mae, nome_pai, naturalidade, estado_civil, escolaridade, PIS, CTPS, título eleitor, reservista, endereço completo, telefone, e-mail, dependentes JSON, log_alteracoes JSON)
- Refatorar `employees/$id` com **tabs glass** (já temos `animated-tabs-bar`):
  - 📇 Dados Pessoais
  - 💼 Vínculo (cargo/setor/admissão/salário)
  - 📍 Endereço & Contato
  - 👨‍👩‍👧 Dependentes
  - 🩺 Saúde (ASOs, convocações, atestados)
  - 🦺 EPI (entregas, devoluções, perdas)
  - 📚 Treinamentos
  - 🚪 Saídas/Hora Extra
  - 📜 Histórico (timeline + log de alterações)
- Modal-first: edição inline com drawer glass, não nova rota

### Fase 3 — Guia de Encaminhamento + Smart Agenda (Bloco C + B)
- Migration: tabela `guias_encaminhamento` (numero auto, prestador_id, employee_id, tipo_eSocial, exames[], data_emissao, atendido, anexos)
- Estender `convocacoes_exames` com `guia_id`, `data_agendada`, `clinica_id`, `status` (pendente/agendado/realizado/faltou/reagendado)
- Rota `/app/sesmt/agenda-exames` com:
  - Visão **Kanban glass** (Pendente → Agendado → Realizado → Faltou) — substitui scroll do SOC
  - Visão **Calendário** alternativa
  - Drag-and-drop pra mudar status
  - Reagendamento em lote
  - Lista de faltosos com 1 clique pra reconvocar
- Geração PDF da Guia com header DMN + riscos do cargo (cruza PGR/PCMSO) + exames sugeridos automaticamente
- Geração PDF "Itinerário do Funcionário" (mapa dos exames do dia)

## Visual (não negociável)
- Glass cards: `bg-white/5 backdrop-blur-xl border border-white/10` + flare gradient sutil
- KPIs com chrome border (mesmo dos OSS)
- Tabs animadas (`animated-tabs-bar`)
- Modal-first para edição
- Texto `text-white/95` (alto contraste, lição aprendida do print)
- Sem ícones XP, sem códigos crípticos tipo "Cód. 675"

## Detalhes técnicos
- Todas as tabelas novas: GRANT + RLS por role (admin/sesmt_admin escrita; sesmt_leitor read)
- Triggers: fechar guia quando atendido=true, gerar nº sequencial da guia, propagar status pra convocacao
- ViaCEP via fetch direto (sem server function)
- PDFs via `pdf-print.ts` central (já padronizado)
- Realtime na agenda (Supabase channel) pra refletir mudanças entre usuários

## Entregáveis ao final
- 3 rotas novas (prestadores, agenda-exames) + 1 refatorada (employees/$id)
- 4 PDFs novos (guia, itinerário, ASO standalone, lista faltosos)
- Memória atualizada em `mem://features/`

## Estimativa
Fase 1: ~3 arquivos novos + 1 migration
Fase 2: ~6 arquivos (split em tabs) + 1 migration
Fase 3: ~5 arquivos + 2 migrations + 2 PDFs

Posso atacar tudo numa sequência. Confirma que vou de Fase 1 → 2 → 3?
