## Painel de Cursos Ministrados

Nova aba **"Cursos Ministrados"** dentro de `/app/trainings` (ao lado da grade atual). Foco: card mestre por curso/NR, dentro dele as turmas históricas, e em cada turma os anexos homologados.

### 1. Tipos de atividade + modalidade

Categorias do card mestre (já existe `CATEGORIA` em `matriz-status.ts` — adiciono "PALESTRA" se faltar e garanto o label):

- NR · Curso · **Palestra** · Workshop · Oficina · Integração · Reciclagem

Modalidade (campo novo do form de turma):
- **Presencial** · **Online** · **Híbrida**

Tipo (existente, mantenho):
- Interno · Externo · In Company

### 2. Estrutura visual

```text
ABA "Cursos Ministrados"
┌─────────────────────────────────────────────────┐
│ [+ Novo Card]   busca: ___   filtro: categoria  │
├─────────────────────────────────────────────────┤
│  ┌── Card NR-06 ───┐  ┌── Card NR-17 ───┐  ...  │
│  │ 🛡 NR-06        │  │ 🪑 NR-17        │       │
│  │ 12 turmas       │  │ 3 turmas        │       │
│  │ última: 25/08   │  │ última: 10/09   │       │
│  │ [Ver turmas]    │  │ [Ver turmas]    │       │
│  └─────────────────┘  └─────────────────┘       │
└─────────────────────────────────────────────────┘

Click em "Ver turmas" → dialog com:
  - botão "+ Nova turma"
  - lista de turmas (data, instrutor, carga, modalidade, status anexos)
  - cada linha expande pra mostrar: lista de presença, fotos, eficácia, reação
```

### 3. Schema (migration)

Reaproveito `trainings` + `training_attendees` (já existem e já sincronizam com a matriz via trigger). Adiciono apenas:

- `trainings.modalidade` text (PRESENCIAL/ONLINE/HIBRIDA)
- `training_anexos` (id, training_id, tipo enum: LISTA_PRESENCA | FOTO | EFICACIA | REACAO, file_path, descricao, uploaded_by, uploaded_at) — até 5 FOTOs por turma
- `training_eficacia` (1:1 com training, JSON com os 10 itens pontuados + plano de ação)
- `training_reacao` (1:N por participante, JSON com fatores 1-4 + textos)
- bucket `training-docs` já existe → uso ele

O card mestre = `matriz_courses` (já existe, com categoria). Turma = `trainings` apontando pra `course_id`. Nada se sobrescreve: cada turma é uma linha nova.

### 4. PDFs homologados (idênticos aos enviados)

Três geradores em `src/lib/`:

- `lista-presenca-pdf.ts` — **já existe**, reaproveito
- `eficacia-treinamento-pdf.ts` — **novo**, FORCP-GP-12, com os 10 itens, pontuação 1-5, totalizador, plano de ação, assinaturas Superior/RH
- `reacao-treinamento-pdf.ts` — **novo**, FORCP-GP-16, com fatores 1-4 (Conteúdo/Instrutor/Recursos), 3 perguntas abertas, escala final

Fluxo: usuário preenche o form no app → gera PDF pré-preenchido → imprime, colhe assinatura, escaneia, faz upload do PDF assinado em `training_anexos`.

### 5. Fluxo de cadastro de turma

Dialog "Nova turma" (parte do que já existe + 2 campos novos):

- Curso/NR (select do card mestre)
- Título/Assunto
- Data início · Data fim · Carga horária
- Instrutor (texto + assinatura opcional)
- Tipo: Interno / Externo / In Company
- **Modalidade: Presencial / Online / Híbrida** ← novo
- Instituição · Local
- Participantes (multi-select de funcionários)

Após salvar → card da turma aparece dentro do card mestre, com 4 botões:
1. **Lista de Presença** → gera PDF, permite upload do assinado
2. **Fotos (até 5)** → upload múltiplo
3. **Avaliação de Eficácia** → form + gera PDF + upload assinado
4. **Avaliação de Reação** → form + gera PDF + upload assinado

### 6. Ordem de entrega (pra prova de fogo dia 26)

**Mínimo viável dia 26 (NR-06 + NR-17):**
1. Migration (modalidade + training_anexos)
2. Aba "Cursos Ministrados" com cards mestre + dialog de turmas
3. Form de nova turma com modalidade
4. Lista de presença (já pronta) + upload do assinado
5. Upload genérico de fotos/anexos

**Pós-26 (incremental):**
6. PDF + form da Eficácia
7. PDF + form da Reação
8. Dashboard de aderência por curso

### Detalhes técnicos

- Aba implementada como `<Tabs>` no topo de `app.trainings.tsx`: "Grade Atual" (conteúdo atual) | "Cursos Ministrados" (novo componente `CursosMinistradosPanel`)
- Sem nova rota — tudo dentro de `/app/trainings`
- Cards usam `matriz_courses.categoria` pra agrupar e colorir (já existe `CATEGORIA_COLOR`)
- Uploads vão pro bucket `training-docs` já existente, paths `training_anexos/{training_id}/{tipo}/{uuid}.pdf`
- Geradores PDF seguem o mesmo padrão do `lista-presenca-pdf.ts` (jsPDF + preview dialog)
