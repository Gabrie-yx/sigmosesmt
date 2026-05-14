## Objetivo

1. Refletir a Matriz de Treinamento na ficha de cada funcionário.
2. Remodelar a página **Treinamentos & NR** com visual premium e organização intuitiva.
3. Catálogo de tipos cobrindo **todas as NRs + categorias** (Curso, Palestra, Workshop, Oficina, Integração, Reciclagem, Outro) com opção de inclusão livre.
4. Vincular cursos à **função (role)** do funcionário, não só ao setor.

---

## 1. Banco — migration única

**Estender `training_matrix_courses`:**
- `categoria text` default `'NR'` (`NR | CURSO | PALESTRA | WORKSHOP | OFICINA | INTEGRACAO | RECICLAGEM | OUTRO`)
- `descricao text` (opcional)
- `carga_horaria_h numeric` (opcional)

**Nova tabela `training_matrix_role_courses`:**
- `role_id uuid`, `course_id uuid` (PK composta) — define cursos obrigatórios por função (em adição a setor).

**Seed do catálogo:**
- Inserir NR-01 a NR-38 (apenas as faltantes), categoria `NR`, periodicidade `NA` por padrão (admin ajusta as obrigatórias).
- Manter cursos já existentes.

RLS: mesmas policies do padrão (`is_editor` / select público a autenticados).

---

## 2. Ficha do funcionário (`app.employees.$id.tsx`)

Adicionar nova aba **"Matriz de Treinamento"** ao lado das abas existentes:
- Lista de cursos obrigatórios para o funcionário, derivados da união de `sector_courses` (pelo `setor`) + `role_courses` (pela `role_id`).
- Para cada curso: status colorido (REALIZADO / A VENCER / VENCIDO / PENDENTE / EM ANDAMENTO / N/A) usando a mesma `computeStatus` da matriz.
- Data de realização + data de vencimento calculada.
- Botão **Editar** que abre o mesmo modal de edição (data, override, observação) usado na matriz, gravando em `training_matrix_entries`.
- Resumo no topo: % de aderência, contagem por status.

`computeStatus` será extraída de `app.matriz-treinamento.tsx` para `src/lib/matriz-status.ts` e reutilizada nas duas telas.

---

## 3. Remodelar página `app.trainings.tsx` (Treinamentos & NR)

Layout premium:
- **Header** com título grande, métricas resumo (total de eventos no ano, próximos a vencer, taxa de presença média).
- **Filtros** topo: categoria (NR/Curso/Palestra/...), período, busca.
- **Lista** em cards com agrupamento por mês, badges de categoria coloridas, ícone por categoria, indicador de validade.
- **Botão "Novo Treinamento"** abre dialog (em vez do form ocupar metade da tela).
- Dialog usa o **catálogo unificado** (`training_matrix_courses`) como dropdown de tipo, com opção "+ Cadastrar novo tipo" inline (que insere no catálogo).
- Categoria selecionável para tipos novos: Curso, Palestra, Workshop, Oficina, Integração, Reciclagem, Outro.

---

## 4. Cruzamento curso × função

Na página da Matriz de Treinamento:
- No diálogo "Cursos / NRs" (catálogo): adicionar campo categoria + carga horária.
- No diálogo "Setores": renomear para **"Vincular Cursos"** com 2 abas: **Por Setor** e **Por Função**.
- Na tabela da matriz: cursos obrigatórios = união de setor + função do funcionário.

Na ficha do funcionário: idem — união setor + função.

---

## Arquivos afetados

- Nova migration (estende catálogo + cria `training_matrix_role_courses` + seed NRs).
- `src/lib/matriz-status.ts` (novo) — helper extraído.
- `src/routes/app.matriz-treinamento.tsx` — usar helper, união setor+função, dialog catálogo com categoria, dialog vínculos com aba função.
- `src/routes/app.employees.$id.tsx` — nova aba "Matriz de Treinamento".
- `src/routes/app.trainings.tsx` — redesign completo (dialog form, cards, filtros, métricas, catálogo unificado).

---

## Fora do escopo (confirmar se quiser)

- Importar histórico de `trainings`/`training_attendees` para `training_matrix_entries` automaticamente — hoje são tabelas separadas (eventos x matriz). Posso unificar depois se desejar.
