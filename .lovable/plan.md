
# Plano: Relatório de Admissões + Transferência entre Empresas + CLT

Três frentes, executadas em ordem. Cada uma depende da anterior.

---

## Frente 1 — Renomear `NAO_MEI` → `CLT` no banco

**Migration (SQL):**
1. `ALTER TYPE tipo_cadastro_enum ADD VALUE 'CLT'` (se for enum) — ou update direto se for text
2. `UPDATE employees SET tipo_cadastro='CLT' WHERE tipo_cadastro='NAO_MEI'` (39 registros)
3. Recriar enum sem `NAO_MEI` (drop/rename dance) — só depois de garantir que ninguém escreve mais `NAO_MEI`
4. Trigger `employees_default_tipo_cadastro` **BEFORE INSERT**: se `tipo_cadastro` vier NULL, aplica default:
   - empresa é DMN (companies.tipo='CLT' ou flag equivalente) → `MEI`
   - senão → `AVULSO`
   - Trigger só preenche default; **não bloqueia** override manual (usuário pode mudar depois)

**Código a varrer (search/replace `NAO_MEI` → `CLT`):**
- `src/lib/constants.ts` — `COMPANY_TYPES`, tipos de cadastro
- Formulário de funcionário (`src/components/employees/*`)
- Filtros na listagem (`src/routes/app.employees.index.tsx`, `listagem.tsx`)
- PDFs (`employee-ficha-pdf.ts`, `employees-listagem-pdf.ts`)
- `safety-engine.ts` e regras que dependem de `tipo_cadastro`
- Enum TS regenerado automaticamente após migration

---

## Frente 2 — Relatório de Admissões por Período

Nova rota `src/routes/app.employees.relatorio-admissoes.tsx`.

**Filtros no topo:**
- Data admissão de/até (obrigatório)
- Empresa (multi-select, opcional)
- Tipo cadastro (MEI/CLT/AVULSO, multi, opcional)
- Função/Cargo (opcional)

**Colunas da tabela:**
Nome · CPF · Função · Empresa · Tipo Cadastro (MEI/CLT/AVULSO) · Data Admissão

**Ações:**
- Botão **"Exportar PDF"** (usa `pdf-header.ts` padrão SIGMO)
- Botão **"Exportar CSV"**

**Acesso:** admin + moderador + RH (via `access-control.ts`).

Item de menu na sidebar em Funcionários → "Relatório de Admissões".

---

## Frente 3 — Transferência de Funcionário entre Empresas

### 3.1 Nova tabela `employee_company_history`

```
id, employee_id (FK), empresa_antiga_id, empresa_nova_id,
transferido_em (timestamptz), transferido_por (FK auth.users),
motivo (text NOT NULL), created_at
```
RLS: SELECT autenticados; INSERT via server function apenas.

### 3.2 Server function `transferEmployee` (`src/lib/employees-transfer.functions.ts`)

Middleware `requireSupabaseAuth` + checagem de role (admin OU moderador; senão 403).

**Input:**
```ts
{
  employeeId, novaEmpresaId, motivo (obrigatório),
  reassignments: [{ documentoId, tipo: 'APR'|'PTE', novoFuncionarioId | 'ARQUIVAR' }]
}
```

**Handler (transação):**
1. Valida caller = admin/moderador
2. Busca APRs/PTEs abertas do funcionário → confere que TODAS têm decisão em `reassignments`
3. Para cada `novoFuncionarioId`: `UPDATE apr_assinaturas / pte_assinaturas SET employee_id=novo`
4. Para cada `ARQUIVAR`: `UPDATE aprs/ptes SET status='CANCELADA_POR_TRANSFERENCIA', cancelada_em=now(), cancelada_motivo=motivo`
5. **ASO vigente:** não mexe (segue valendo — é do funcionário)
6. **GHE:** consulta `pgr_ghe` da empresa nova
   - Se compatível (mesmo cargo/risco) → mantém
   - Se não → grava alerta e limpa `ghe_id` do funcionário (aparecerá em pendências de realocação)
7. `UPDATE employees SET company_id=novaEmpresaId`
8. `INSERT employee_company_history (...)`
9. Log em `audit_logs`

### 3.3 UI — Dialog "Transferir Funcionário"

Botão na ficha do funcionário (`app.employees.$id.tsx`), visível só para admin/moderador.

**Wizard 3 passos:**
1. **Destino + Motivo:** select empresa nova · textarea motivo (obrigatório)
2. **Pendências abertas:** lista APRs/PTEs; para cada uma:
   - dropdown "Reatribuir para funcionário da empresa antiga" (só ativos, mesma função quando possível)
   - OU botão "Arquivar (cancelar por transferência)"
   - Se não houver nenhum funcionário elegível E usuário não escolher arquivar → botão "Confirmar" desabilitado com mensagem
3. **Revisão:** resumo (alerta GHE se incompatível) → confirmar

Após sucesso: toast + invalidate queries + redirect pra ficha na empresa nova.

### 3.4 Histórico visível

Nova aba/card na ficha do funcionário: "Histórico de Empresas" listando `employee_company_history` em ordem cronológica.

---

## Implicações no que já existe (impacto)

| Área | Impacto |
|---|---|
| APRs/PTEs assinadas antes | reatribuídas ou arquivadas — nunca ficam órfãs |
| ASOs, atestados, vacinas | não mexem (são do funcionário) |
| GHE | mantém se compatível; alerta+limpa se não |
| `employee_role_history` | não afetado (só rastreia cargo) |
| Onda 2 triggers | mudança de empresa NÃO dispara convocação de exame (só mudança de cargo já dispara) |
| Portaria/DDS/Integrações históricas | permanecem vinculadas à empresa antiga (histórico correto) |
| Relatórios existentes | passam a ler `CLT` em vez de `NAO_MEI` (search/replace) |

---

## Ordem de execução

1. Migration Frente 1 (rename + trigger default)
2. Varredura de código `NAO_MEI` → `CLT`
3. Migration Frente 3.1 (tabela histórico + status cancelamento em aprs/ptes)
4. Server function `transferEmployee` + UI wizard
5. Rota do Relatório de Admissões + PDF/CSV
6. Item de menu

Confirma e eu vou executando na ordem, migration por migration.
