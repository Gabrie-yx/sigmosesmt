
# Recriação do sistema EnviCorp / Fardamento

Recria o app vanilla original (Vite + localStorage) sobre o stack atual (TanStack Start + React + Supabase + shadcn), mantendo todas as funcionalidades e dados, mas com visual adaptado ao design system.

## 1. Banco de dados (migration única)

Estender o schema atual para cobrir todos os campos do sistema antigo.

**`employees`** — adicionar colunas:
- `rg_orgao`, `cnpj`, `endereco`, `bairro`, `cidade`, `uf`, `cep`
- `whatsapp`, `whatsapp_emergencia`, `nome_contato`, `email`
- `tipo_cadastro` (`MEI` | `NAO_MEI`, default `NAO_MEI`)
- `foto_url` (referência ao bucket `avatars`)
- renomear/alias: usar `data_admissao` (manter `admissao` legado)
- `data_integracao` (já existe via `nrs`? — adicionar coluna explícita)

**`employee_exams`** — adicionar:
- `natureza` (Admissional, Periódico, etc.)
- `periodicidade_meses` (int)
- `anexo_path` (PDF no bucket `employee-docs`)

**`ptes`** — adicionar colunas:
- `local`, `risco`, `status` (`ATIVA` | `ENCERRADA`, default `ATIVA`)
- `employee_id`, `employee_name` (snapshot)
- `data_emissao` (já existe `data`)

**`epi_deliveries`** — já está completo.

**`employee_docs`** — já está completo (tipo + file_path).

**Storage buckets** — todos já existem (`avatars` público, `employee-docs` privado). Adicionar policies para upload/download via usuários autenticados editores.

## 2. Camada de dados (React Query)

`src/lib/db/` — hooks tipados para cada entidade:
- `useCompanies`, `useSaveCompany`, `useDeleteCompany`
- `useRoles`, `useSaveRole`, `useDeleteRole`
- `useEmployees`, `useEmployee(id)`, `useSaveEmployee`, `useDeleteEmployee`
- `useExams(empId)`, `useSaveExam`, `useDeleteExam`
- `useDocs(empId)`, `useUploadDoc`, `useDeleteDoc`
- `useEpis(empId)`, `useSaveEpi`, `useDeleteEpi`
- `usePtes`, `useSavePte`, `useRevokePte`, `useDeletePte`

## 3. Motor de Inteligência (ISO 9001)

`src/lib/safety-engine.ts` — porta direta de `calculateSafetyStatus`:

- Entrada: employee + role + exames
- Saída: `{ label: 'APTO' | 'ALERTA' | 'BLOQUEADO' | 'INATIVO' | 'AFASTADO', msgs[], acessoPermitido }`
- Regras:
  - INATIVO/AFASTADO bloqueia
  - Exames mais recentes por tipo: aptidão NÃO → BLOQUEADO; vencido → BLOQUEADO; ≤30 dias → ALERTA
  - ASO/Integração: 1 ano de validade
  - NRs exigidas pela função: faltando → BLOQUEADO; vencendo → ALERTA
  - Checagem cruzada: se há ASO Clínico válido no histórico de exames, ignora o campo legado `data_aso`

## 4. Layout e navegação

Substituir o atual `app.tsx` por header escuro + nav horizontal (mais próximo do original) com tokens do design system:
- Header: `bg-sidebar`/`bg-secondary` (definir token), badge do usuário, role, logout
- Itens: Painel TST · Empresas · Cargos/Riscos · Colaboradores · **Emitir PTE** (destaque)
- Botões backup: Exportar / Importar JSON
- Mobile: hambúrguer + sheet
- Permissões aplicadas: viewer só lê, tst/admin editam, admin exclui

## 5. Telas

### 5.1 `/app` — Painel TST
- Omnisearch (nome, CPF, função, empresa) com resultados em tempo real
- Card "Relatório de Vencimentos e Bloqueios" filtrável por empresa
- Card "Conformidade por Empresa" (% APTO, barras coloridas)
- Cards de KPI: total colaboradores, aptos, alertas, bloqueados

### 5.2 `/app/companies` — Empresas
- Lista (esquerda) + detalhe/edição (direita)
- Form: nome, tipo (CLT/Terceirizado/Contratante), CNPJ, encarregado1/2, e-mail
- Lista de colaboradores da empresa selecionada com status calculado
- Botão "Novo colaborador" levando ao cadastro com `companyId` pré-selecionado

### 5.3 `/app/roles` — Cargos / Matriz de Riscos
- Lista de cargos + editor lateral
- Toggles: Exige ASO, Exige Integração
- Grid de NRs (NR-05, 06, 10, 11, 12, 17, 20, 33, 34, 35) marcáveis
- CRUD completo

### 5.4 `/app/employees/$id` — Colaborador (RG digital)
Tabs:
- **PROFILE** — identificação, endereço, contato/emergência, vínculo, foto (upload p/ `avatars`), datas ASO/Integração, validações, badge de status
- **NRS** — grid das NRs com data; destaque vermelho nas exigidas pela função; salvar em `employees.nrs` (jsonb) ou tabela dedicada
- **DOCS** — upload de RG, CPF, comprovante de residência, MEI (condicional); badges Anexado/Pendente/Opcional; bucket `employee-docs`
- **EPI** — formulário (descrição, CA, data, qtd) + histórico + impressão de ficha (HTML→PDF via `react-to-print` ou `html2pdf`)
- **SAÚDE** — formulário de exame (tipo, natureza, realização, periodicidade, vencimento auto, aptidão, anexo PDF) + histórico ordenado com badges VÁLIDO/A VENCER/VENCIDO/INAPTO; botão visualizar PDF anexado

Lista mestre `/app/employees` com filtro por empresa e busca.

### 5.5 `/app/ptes` — Emissão de PTE
- Form: local, classificação (Trabalho a Quente, Espaço Confinado NR-33, Altura NR-35, Eletricidade NR-10), seletor de executante (apenas APTOS habilitados, BLOQUEADOS aparecem desabilitados com 🚫)
- Histórico lateral com cards (status ATIVA/ENCERRADA, editar, revogar, excluir)
- Geração de PDF da PTE

## 6. Seed inicial

Migration de seed com:
- 3 empresas: ESTALEIRO DMN (CLT), JC GALVÃO, NB CONSTRUÇÃO (Terceirizadas)
- 18 cargos com matriz de NRs do original
- ~80 colaboradores (listas DMN, JC, NB) com datas de ASO/Integração geradas

Idempotente: só insere se as tabelas estiverem vazias.

## 7. Backup JSON (import/export)

Componente no header:
- **Exportar**: baixa JSON com `{ companies, roles, employees, exams, docs (metadata), epis, ptes }`
- **Importar**: aceita o JSON do sistema antigo (`dmn_erp_v25_fulldata`) e do novo; mapeia IDs antigos → uuid e faz upsert via Supabase. Confirmação dupla antes de sobrescrever.

## 8. Permissões (já no schema)

Usar `useAuth` existente para esconder/mostrar ações:
- `viewer` — só leitura
- `tst` — criar/editar tudo
- `admin` — + excluir + página `/app/users`

## 9. Tokens / visual

Adicionar em `src/styles.css`:
- `--brand` (azul `#0369a1`), `--brand-dark` (`#075985`)
- `--header` escuro (`#0f172a`)
- Status: `--status-apto`, `--status-alerta`, `--status-bloqueado`
- Manter Inter via Google Fonts; usar shadcn Card/Table/Tabs/Dialog/Select para todo o conteúdo

## Detalhes técnicos

- Uploads: `supabase.storage.from('employee-docs').upload(...)` com path `${empId}/${tipo}-${timestamp}.ext`
- PDFs gerados client-side com `html2pdf.js` (já é leve e funciona no browser)
- Datas: utilitário `formatDateBR`, `daysUntil`, `addMonths`
- Toda mutação usa `react-query` invalidando keys; `sonner` para toast
- Rotas TanStack file-based: `app.companies.tsx`, `app.roles.tsx`, `app.employees.tsx`, `app.employees.$id.tsx`, `app.ptes.tsx`

## Ordem de implementação

1. Migration (schema + storage policies)
2. Engine de status + hooks de dados
3. Layout/header com permissões
4. Painel TST
5. Empresas + Cargos
6. Colaboradores (todas as 5 abas)
7. PTE
8. Backup JSON + Seed dos dados originais

## Fora de escopo (este plano)

- App mobile nativo
- Notificações por e-mail de vencimento (pode entrar depois com edge function + cron)
- Assinatura digital de PTE
