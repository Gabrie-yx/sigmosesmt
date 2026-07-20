Chico, esse pacote é grande (mexe em banco, backend, formulário público e dashboard). Antes de sair codando, deixa eu alinhar o escopo pra não sair coisa que você não pediu.

## Escopo (10 frentes, tudo menos "integrar ao Inventário PGR")

### Banco (1 migration só)
- `psico_planos_acao` — 5W2H automático a partir de dimensões classificadas Alto/Muito Alto por campanha.
- `psico_cronograma` — próxima reavaliação por GHE (anual por padrão, +alerta 30d).
- `psico_acoes_realizadas` — registro de ações pós-diagnóstico (data, responsável, evidência, dimensão atacada).
- `psico_denuncias` (Lei 14.457/2022) — canal anônimo: hash do relato, categoria (assédio moral / sexual / discriminação / outro), status (recebida → em apuração → concluída), sem user_id.
- `psico_assinatura_parecer` — trilha do responsável técnico (TST/Eng. Segurança) por campanha: hash do PDF, data, CREA/registro, assinatura eletrônica.
- Adicionar `campanha.perguntas_abertas_habilitado` (bool) + tabela `psico_relatos_abertos` (respostas livres, anônimas, opcionais, hash do token).
- Seed de benchmarks CNAE (baseline HSE-IT BR por seção CNAE — começo com 5 setores: C-Indústria, F-Construção, H-Transporte, Q-Saúde, O-Adm Pública; expandimos depois).
- Enriquecer `catalogo_perigos_psicossociais` com `nr01_item_ref` (ex: "1.5.3.2", "1.5.4.4.6") pra citar item exato no parecer.

### Backend (server functions)
- `gerarPlanoAcao5W2H(campanhaId)` — cria linhas em `psico_planos_acao` pras dimensões Alto/Muito Alto, com What/Why/Where/Who/When (90d)/How/HowMuch defaults editáveis.
- `criarCronograma(campanhaId)` — calcula próxima reavaliação e agenda notificação.
- `registrarAcaoRealizada(...)` — CRUD acoes.
- `receberDenuncia(...)` — endpoint público `/api/public/denuncia-assedio` sem token (Lei 14.457 exige anônimo).
- `assinarParecerPsicossocial(campanhaId)` — grava hash do PDF + assinatura do TST.
- `cruzarSaudeAbsenteismo(campanhaId)` — cruza campanha × `employee_atestados` (CID F*) × `hora_extra_*` × `acidentes_trabalho` no GHE, retorna "sinal cruzado".

### Frontend
- `/app/psicossocial` ganha 4 abas novas: **Plano de Ação**, **Cronograma**, **Ações Realizadas**, **Sinal Cruzado**.
- Aba **Diagnóstico** passa a estratificar por faixa etária / tempo de casa (charts) e mostrar comparação vs. benchmark CNAE.
- Aba **Instrumento** ganha toggle "habilitar perguntas abertas" na criação de campanha.
- Nova página pública `/denuncia/:empresa` — canal anônimo Lei 14.457.
- `psico-parecer-pdf.ts` passa a citar item NR-01 exato em cada achado + bloco de assinatura do responsável técnico + QR de verificação.
- Formulário público (`/psico/$token`) ganha seção opcional "quer relatar algo em texto livre? (100% anônimo)" ao final.

### Menu
- Adicionar item "Canal de Denúncia (Lei 14.457)" no menu-catalog público (link compartilhável).

## Fora do escopo (fica registrado)
- Integração `psico ↔ pgr_inventario_riscos` (aguardando PGR Rev.06 conforme sua orientação).
- Widget de sinal cruzado no `/app/painel` (fica só na aba do módulo por enquanto — se quiser depois eu subo pro painel geral).
- Notificação por e-mail (SIGMO ainda não tem SMTP configurado — o alerta vai por card na `/app/hoje`).

## Ordem de execução
1. Migration única (todas as tabelas + colunas + seed benchmark + item NR-01)
2. Server functions
3. Rotas públicas (denúncia)
4. UI (4 abas novas + toggle perguntas abertas + estratificação + benchmark)
5. PDF do parecer (item NR-01 + assinatura + QR)

Se topar, saio codando na sequência. Alguma frente eu tirei/adicionei sem alinhar?