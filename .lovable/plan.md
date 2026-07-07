
# Módulo Portaria SIGMO — Fase 1 (MVP)

Foco: colocar a portaria operacional no celular sem quebrar nada do que já roda (Saída no Expediente do SESMT, dossiê de contratadas, RBAC). Fornecedor recorrente e relatórios avançados ficam pra Fase 2, mas o schema já nasce preparado.

## O que entra na Fase 1

1. **Cadastro de visitante avulso** com foto + veículo + até 2 acompanhantes
2. **Validação de saída de funcionário** consumindo o `employee_saidas_expediente` que já existe
3. **Dashboard mobile** do porteiro com card do dia + alertas de pendentes
4. **Painel de controle SESMT** (você) com filtros por período/CPF/status e trilha de auditoria
5. **Cadastro de fornecedor recorrente** (só o CRUD + seleção rápida na entrada; workflow de pré-aprovação fica pra Fase 2)

O que NÃO entra agora: offline-first, retenção LGPD automática de fotos (30d), auto-expiração de token, bloqueio de nova autorização com pendência, exportação PDF/CSV. Tudo isso volta no faseamento.

## Arquitetura de dados

Duas camadas: **estado atual** (rápido, editável dentro das regras) e **auditoria imutável** (append-only via trigger, ninguém escreve direto).

### Tabelas novas

- **`portaria_pessoas`** — cadastro pessoa física recorrente
  - `cpf` (único, validado), `nome`, `rg`, `foto_documento_url`, `observacoes`, `bloqueado` (bool + motivo)
  - Segunda visita: porteiro digita CPF → sistema pré-preenche

- **`portaria_fornecedores_recorrentes`** — motorista/prestador fixo
  - FK opcional pra `companies` ou `empresas_terceiras` (aproveita o dossiê que já existe)
  - `pessoa_id` (FK portaria_pessoas), `funcao` (ex: "Motorista entrega"), `ativo`

- **`portaria_veiculos`** — cache de placa+modelo pra reentrada rápida
  - `placa` (única, validada Mercosul/antiga), `modelo`, `cor`, `tipo` (carro/moto/caminhão/van)

- **`portaria_visitas`** — o EVENTO de entrada (tabela central)
  - `tipo` enum: `VISITANTE`, `FORNECEDOR`, `PRESTADOR`
  - `pessoa_id` FK, `veiculo_id` FK opcional, `empresa_visitada_id` (companies), `motivo_visita`, `funcionario_recebedor_id` (employees, opcional)
  - `foto_rosto_url`, `foto_placa_url`, `foto_bagageiro_url`
  - `entrada_at`, `saida_at` (null enquanto dentro), `entrada_por_user_id`, `saida_por_user_id`
  - `status` enum: `DENTRO`, `SAIDA_VALIDADA`, `CANCELADA`
  - Índices: `(status, entrada_at DESC)`, `(pessoa_id)`, `(veiculo_id, saida_at)`

- **`portaria_visita_acompanhantes`** — 0..2 por visita
  - `visita_id`, `pessoa_id`, `foto_rosto_url`

- **`portaria_saidas_funcionarios`** — o "check-out físico" do funcionário
  - `saida_expediente_id` FK pra `employee_saidas_expediente` (já existe)
  - `employee_id`, `validada_at`, `validada_por_user_id`, `observacao_portaria`
  - Uma linha por saída autorizada validada. Se não validou, não existe linha → aparece como pendente.

- **`portaria_auditoria`** — trilha imutável
  - `entidade` (visita/saida_funcionario/pessoa/veiculo), `entidade_id`, `acao` (INSERT/UPDATE), `snapshot_json`, `user_id`, `origem_modulo`, `criado_em`
  - Populada via trigger AFTER INSERT/UPDATE nas tabelas acima
  - RLS: SELECT só admin/SESMT; nenhuma policy de UPDATE/DELETE (nem service_role via UI)

### RLS e grants

- Role nova: `porteiro` (via `user_roles` que já existe, sem inventar campo em profile)
- `porteiro` pode: INSERT em visitas/pessoas/veiculos/saidas_funcionarios; UPDATE só em `portaria_visitas.saida_at` da própria empresa; SELECT nas visitas do dia
- `sesmt`/`admin`: SELECT total + UPDATE com registro na auditoria
- Ninguém tem DELETE via policy
- Grants explícitos pra `authenticated` e `service_role` em cada tabela (respeitando a regra do projeto)

### Storage

- Bucket privado `portaria-fotos` (fotos de rosto, documento, placa, bagageiro)
- URLs assinadas com expiração curta ao exibir
- Path: `portaria/{yyyy-mm-dd}/{visita_id}/{tipo}.jpg`

## Fluxos de UI

### A) Rota `/app/portaria` (mobile-first, porteiro)

Substitui o placeholder atual (`app.portaria.controle-entrada.tsx`).

**Header fixo:** hora atual, contador "N pessoas dentro", botão SOS/alerta

**Cards empilhados (verticais, thumb-friendly):**
1. **[+ Nova Entrada]** botão grande verde no topo
2. **[Validar Saída de Funcionário]** botão amarelo (abre lista de tokens ativos)
3. **Card do dia atual** — expande mostrando visitas ordenadas por entrada_at DESC
   - Cada linha: foto rosto + nome + empresa + hora entrada + badge status
   - Pendente (sem saída) → borda vermelha + pulse
   - Tap na linha → drawer com detalhes + botão "Registrar Saída"
4. **Card da semana** (colapsado por padrão, 7 sub-cards de dia)
5. **Card do mês** (colapsado, agregado)

**Wizard "Nova Entrada"** (mobile stepper, 4 passos):
1. CPF → busca em `portaria_pessoas`; se achou, pula pro passo 3; se não, passo 2
2. Dados pessoa (nome, RG, CNPJ opcional) + foto documento
3. Foto rosto + motivo + empresa visitada (select das `companies`)
4. Veículo (opcional) → placa (busca em `portaria_veiculos`) + foto placa + foto bagageiro + acompanhantes (0-2)

Captura de foto: `<input capture="environment">` (câmera traseira nativa, sem depender de lib pesada). Compressão client-side pra ~200KB antes do upload.

**Drawer "Validar Saída Funcionário":**
- Campo busca CPF/nome
- Lista tokens ativos (`employee_saidas_expediente` sem linha correspondente em `portaria_saidas_funcionarios`)
- Cada card: foto grande do funcionário + tipo (pessoal/empresa) + com/sem retorno + motivo + hora autorização
- Botão gigante verde "CONFIRMAR SAÍDA FÍSICA" → grava validação + registra auditoria

### B) Rota `/app/portaria/controle` (desktop, SESMT/admin — você)

- **KPIs topo:** dentro agora, entradas hoje, saídas pendentes de validação, tempo médio permanência
- **Aba Visitantes:** tabela com filtros (período, CPF, empresa, status) + drill-down na trilha
- **Aba Saídas Funcionários:** cruza `employee_saidas_expediente` × `portaria_saidas_funcionarios` — destaca as pendentes
- **Aba Auditoria:** timeline imutável, filtrável por entidade/user
- **Aba Cadastros:** CRUD de fornecedores recorrentes, veículos, pessoas bloqueadas

Exportação CSV/PDF fica pra Fase 2 (mas o schema já suporta).

### C) Integração com `employee_saidas_expediente` (já existe)

Zero mudança destrutiva. O que rola:
- Ao salvar saída no SESMT, o registro fica visível pra portaria automaticamente (query já filtra por `retorno_at IS NULL` + ausência de validação)
- Novo campo derivado em view: `status_portaria` = `AGUARDANDO_VALIDACAO` | `VALIDADA` | `SEM_VALIDACAO`
- Alerta no seu painel SESMT: contador de "saídas autorizadas há +2h sem validação física"

## Validações e segurança

- CPF: regex + dígito verificador (helper novo em `src/lib/validators/cpf.ts`, reutilizável)
- Placa: regex Mercosul (`AAA0A00`) e antiga (`AAA0000`), normalizada uppercase
- Foto obrigatória: rosto pra visitante, placa pra veículo
- Trigger pl/pgsql que impede UPDATE em `portaria_visitas` depois de `saida_at` preenchido (exceto admin com flag explícita)
- Trigger de auditoria em cada INSERT/UPDATE das tabelas de estado
- Nunca DELETE via UI — só `status = CANCELADA` com motivo obrigatório

## Ordem de implementação

1. Migração 1: enums + tabelas de cadastro (`portaria_pessoas`, `portaria_veiculos`, `portaria_fornecedores_recorrentes`) + RLS + grants
2. Migração 2: tabelas de evento (`portaria_visitas`, `portaria_visita_acompanhantes`, `portaria_saidas_funcionarios`) + RLS + grants
3. Migração 3: `portaria_auditoria` + triggers em todas as tabelas acima
4. Migração 4: role `porteiro` no enum `app_role` + bucket storage
5. Helpers: `src/lib/validators/cpf.ts`, `src/lib/validators/placa.ts`, `src/lib/portaria/foto-capture.ts`
6. UI mobile porteiro: wizard entrada + dashboard cards + drawer saída funcionário
7. UI desktop SESMT: painel de controle com abas
8. Verificação: fluxo ponta-a-ponta com Playwright (entrada visitante, saída funcionário, alerta pendente)

## O que preciso confirmar antes de codar

- **Você quer o botão "Validar Saída Funcionário" no mesmo `/app/portaria` do porteiro, ou numa rota separada `/app/portaria/saidas`?** (defaultei pra mesma rota, drawer)
- **Empresa visitada é obrigatória na entrada?** (defaultei pra sim — sem isso o relatório por empresa fica furado)
- **Foto do documento (RG/CNH) é obrigatória no primeiro cadastro da pessoa, ou opcional?** (defaultei pra opcional — porteiro pode pular se a pessoa não quiser mostrar)
