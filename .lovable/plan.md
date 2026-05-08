
## Visão geral

Vou recriar o app "EnviCorp – Gestão de Fardamentos e EPIs" como um SPA TanStack Start com banco real (Lovable Cloud / Supabase), autenticação por e-mail+senha e Google, e três níveis de acesso. Mantenho 100% das funcionalidades do original (que hoje vive em LocalStorage), trocando o armazenamento por tabelas com RLS.

## Funcionalidades (paridade com o original)

1. **Painel TST (Dashboard)**
   - Busca universal (nome, CPF, função, empresa)
   - Relatório de Vencimentos e Bloqueios (filtro por empresa)
   - Conformidade % por empresa (barras de progresso)

2. **Empresas** — CRUD (nome, tipo CLT/TERCEIRIZADO, CNPJ, encarregados, e-mail)

3. **Cargos / Riscos** — CRUD com requisitos (ASO, Integração, lista de NRs obrigatórias)

4. **Colaboradores** — lista com badges de status (APTO/ALERTA/BLOQUEADO/INATIVO/AFASTADO) calculados automaticamente. Ficha em 5 abas:
   - **Cadastro Base** (CPF, RG, CNH, matrícula, admissão, status, datas ASO/Integração)
   - **Saúde (ASOs)** — registro de exames clínicos com aptidão e vencimento
   - **Treinamentos (NRs)** — datas por NR, validade 1 ano
   - **Pasta Digital** — upload de docs (RG, CPF, ASO, CNH, comprovante) → Supabase Storage
   - **Controle de EPIs** — entregas, devoluções, tamanhos

5. **Emitir PTE** (Permissão de Trabalho/Entrada) — formulário + geração de PDF (html2pdf.js ou jsPDF)

6. **Backup** — Exportar/Importar JSON do banco do usuário (preserva o recurso original)

7. **Motor ISO 9001** — `calculateSafetyStatus()` portado: vencimentos de ASO, Integração, NRs por cargo, com estados Vencido / Vence em ≤30d / Inapto.

## Autenticação e papéis

- E-mail/senha + Google
- Tabela `profiles` (id, full_name, avatar_url) criada por trigger no signup
- Enum `app_role`: `admin`, `tst`, `viewer`
- Tabela `user_roles` separada + função `has_role()` SECURITY DEFINER
- Fluxo: primeiro usuário vira admin; admin atribui papéis na tela "Usuários"
- Página `/reset-password` incluída

Permissões:
- `admin`: tudo + gerenciar usuários/papéis
- `tst`: CRUD de empresas, cargos, colaboradores, emite PTE
- `viewer`: somente leitura (Dashboard e fichas)

## Modelo de dados (Lovable Cloud)

```text
profiles(id PK→auth.users, full_name, avatar_url, created_at)
user_roles(id, user_id→auth.users, role app_role, UNIQUE(user_id,role))
companies(id, name, type, cnpj, encarregado1, encarregado2, email)
roles(id, name, req_aso bool, req_integra bool, req_nrs text[])
employees(id, company_id→companies, role_id→roles, nome, cpf, rg, cnh, titulo,
          endereco, matricula, admissao date, status, data_aso date,
          data_integracao date, nrs jsonb)
employee_exams(id, employee_id, tipo_exame, data_realizacao, data_vencimento,
               aptidao, observacoes)
employee_docs(id, employee_id, tipo, file_path, uploaded_at)  -- Storage bucket "employee-docs"
epi_deliveries(id, employee_id, item, tamanho, qtd, data_entrega, data_devolucao, ca)
ptes(id, created_by, numero, data, empresa_id, dados jsonb, pdf_path)
```

Todas as tabelas com RLS:
- SELECT: usuários autenticados
- INSERT/UPDATE/DELETE: `has_role(uid,'admin') OR has_role(uid,'tst')`
- `user_roles`: somente admin pode escrever

## Arquitetura técnica

- **Rotas** (TanStack Router, file-based, todas dentro de `_authenticated`):
  - `/login`, `/reset-password` (públicas)
  - `/_authenticated/index` → Dashboard
  - `/_authenticated/empresas`
  - `/_authenticated/cargos`
  - `/_authenticated/colaboradores` (lista) e `/_authenticated/colaboradores/$id` (ficha com sub-abas via search params)
  - `/_authenticated/pte` (emissão)
  - `/_authenticated/usuarios` (admin)
- **Dados**: TanStack Query + cliente Supabase do browser (RLS faz o controle); mutations com `useMutation` + `invalidateQueries`
- **Validação**: Zod em todos os formulários
- **PDF**: `jspdf` + `jspdf-autotable` (compatível com Worker SSR; html2pdf.js só roda no client e fica em componente `client-only`)
- **Backup**: exportar/importar JSON via dump do `select *` em todas as tabelas (somente admin)
- **Lógica `calculateSafetyStatus`**: portada para `src/lib/safety.ts` e usada em listas/dashboard

## Design

- Tokens semânticos em `src/styles.css` (oklch): primary baseado no vermelho corporativo do original (#991b1b → oklch), secondary navy (#0f172a), accent âmbar (#f59e0b), além dos usuais
- Componentes shadcn (Button, Card, Table, Tabs, Dialog, Form, Badge, Progress, Sheet, Sonner)
- Ícones `lucide-react` substituindo Phosphor
- Tipografia: mantenho Inter como sans (já comum) e adiciono Outfit para títulos (Google Fonts)
- Layout: header escuro com nav + área de conteúdo cards arredondados, fiel ao espírito do original

## Ordem de implementação

1. Ativar Lovable Cloud, migrações (enum, tabelas, RLS, trigger de profile, função `has_role`, bucket Storage)
2. Auth: páginas login/signup/reset, layout `_authenticated`, contexto de auth
3. Tokens de design + Header + shell
4. CRUDs base: Empresas, Cargos, Usuários (admin)
5. Colaboradores: lista com badges + ficha (abas Cadastro, Saúde, NRs, Pasta Digital, EPIs)
6. Motor `calculateSafetyStatus` + Dashboard (busca, vencimentos, conformidade)
7. PTE com geração de PDF
8. Backup export/import JSON
9. Seed opcional (botão "carregar dados de exemplo" reproduzindo as listas DMN/JC/NB do original)

## Fora do escopo desta entrega

- Notificações por e-mail de vencimentos (pode entrar depois via cron + Edge functions)
- App mobile/PWA offline
- Importação direta do LocalStorage do app antigo (mas o "Importar JSON" cobre se você exportar de lá)
