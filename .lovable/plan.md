
## Plano — Plano de Ações 5W2H ISO 9001

### 1. Banco de dados (migration única)

**Tabela `plano_acoes` — novos campos:**
- `origem_acao` TEXT — enum textual: `AUDITORIA`, `INSPECAO_SST`, `QUASE_ACIDENTE`, `CIPA`, `PGR_APR`, `CHECKLIST`, `OUTRO`
- `tipo_registro` TEXT — `ACAO_CORRETIVA` | `MELHORIA` (default `ACAO_CORRETIVA`)
- `responsavel_execucao` TEXT (nome livre — quem executa)
- `responsavel_validacao_id` UUID → `profiles(id)` (gestor/aprovador)
- `data_verificacao_eficacia` TIMESTAMPTZ (calculada ao concluir)
- `status_eficacia` TEXT — `PENDENTE` | `EFICAZ` | `INEFICAZ` (NULL até a conclusão)
- `eficacia_observacao` TEXT
- `eficacia_validada_por` UUID, `eficacia_validada_em` TIMESTAMPTZ

**Tabela `nao_conformidades` — campo novo (causa raiz fica aqui, como combinamos):**
- `analise_causa` TEXT (5 Porquês — uma vez por NC)

**Triggers:**
- `plano_acoes_set_eficacia()` — ao mudar status para `CONCLUIDA`, calcula `data_verificacao_eficacia` baseado em `prioridade`: ALTA/CRITICA = 15d, MEDIA = 30d, BAIXA = 60d. Seta `status_eficacia = 'PENDENTE'`.
- Auto-preenche `origem_acao` quando criada com `nc_id` ou `incidente_id` (deriva de `nao_conformidades.origem`).

**Função RPC:**
- `validar_eficacia_acao(_id, _eficaz boolean, _obs text)` — só admin/moderador. Se ineficaz, opcionalmente cria nova ação vinculada.

### 2. Verificação de eficácia (cron + email)

- pg_cron diário às 8h → server route `/api/public/hooks/verificar-eficacia`
- A rota busca ações com `status='CONCLUIDA'`, `status_eficacia='PENDENTE'`, `data_verificacao_eficacia <= now()` e:
  - Marca flag visual no dashboard (já fica visível pela query)
  - Envia email ao `responsavel_validacao_id` via Lovable AI (Resend não está configurado — uso o que estiver disponível; se nenhum estiver, alerto e deixo só o dashboard funcionando)

### 3. Formulário (modal com 3 abas)

Usando `Tabs` do shadcn já presente no projeto:

- **Aba 1 — Identificação**: tipo_registro (radio), origem_acao (select, auto-preenche se vier de NC), vínculo opcional com NC existente (combobox), título (O Quê), descrição (Por Quê).
- **Aba 2 — Investigação**: textarea grande "Análise de Causa Raiz" com tooltip dos 5 Porquês. (Se houver `nc_id`, edita `nao_conformidades.analise_causa`; senão, fica no campo `descricao` da ação ou cria NC enxuta — vou usar a primeira opção: só edita quando há NC vinculada, e mostra aviso "vincule uma NC para registrar causa raiz".)
- **Aba 3 — Planejamento (5W2H)**: como, onde, quando (data), responsavel_execucao, responsavel_validacao (select de usuários), prioridade, custo.

Validações com Zod, navegação entre abas com botões "Próximo/Anterior".

### 4. Dashboard

- Novo card de KPI no topo: **"Pendente de Eficácia"** (roxo) — conta ações com `status_eficacia='PENDENTE'` e `data_verificacao_eficacia <= now()`.
- Na linha de cada ação `CONCLUIDA` com eficácia pendente: botão **"Validar Eficácia"** visível só pra admin/moderador → abre mini-modal (Sim/Não + observação).
- Badge de eficácia nas linhas: `Eficaz` (verde), `Ineficaz` (vermelho), `Aguardando` (roxo).
- Filtro novo: por tipo_registro e origem.

### 5. Permissões / RLS

Mantém o padrão atual de `plano_acoes` (já tem RLS). RPC `validar_eficacia_acao` usa `has_role` para gate de admin/moderador.

### Detalhes técnicos
- 1 migration única (não dá pra editar migrations antigas)
- 1 server function pra `validar_eficacia` (chama RPC)
- 1 server route pública pro cron de eficácia
- Email: vou checar se há Resend ou outro provider configurado; se não, te aviso e deixo só dashboard + notificação visual
- ~3 arquivos novos, edição de `src/routes/app.acoes.tsx`

### Fora de escopo (a confirmar depois)
- Anexos/evidências na validação de eficácia
- Workflow de aprovação multi-nível
- Exportação PDF do plano de ação

Posso seguir?
