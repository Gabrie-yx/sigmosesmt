## Visão geral

Hoje `/app/ptes` é uma "PTE genérica" solta — pouco campo, sem PDF, sem vínculo obrigatório com APR, sem subtipos. Vamos lapidar em **3 fases incrementais**, cada uma entregando valor sozinha. Esta proposta cobre a **Fase 1 (Fundação)**. Depois que rodar, encaixamos Fase 2 (PET NR-33) e Fase 3 (demais PTs + assinatura digital).

---

## Fase 1 — Fundação (esta entrega)

Objetivo: deixar o módulo pronto para receber os subtipos, com APR amarrada, validade, horários, tipo da PT e PDF imprimível.

### 1.1 Renomear módulo: "PTE" → "Permissões de Trabalho"

- Rota `/app/ptes` continua (não quebra link), mas o título da página, breadcrumb e item de menu viram **"Permissões de Trabalho"**.
- Subtítulo: "PT, PTE, PET e permissões especiais".

### 1.2 Novo campo: **Tipo de Permissão**

Select obrigatório com as categorias que conversamos na aula:

```text
- PTE   — Permissão de Trabalho Especial (genérica, sem NR dedicada)
- PET   — Espaço Confinado (NR-33)        [Fase 2: form completo]
- PTQ   — Trabalho a Quente (NR-34)
- PTA   — Trabalho em Altura (NR-35)
- PTI   — Içamento de Carga (NR-11/34)
- PTEL  — Elétrica / LOTO (NR-10)
- PTP   — Pintura / Jateamento (NR-34+NR-15)
- PTS   — Trabalho Simultâneo / SimOps
```

Na Fase 1 todos compartilham o **mesmo formulário base**. Na Fase 2/3 cada tipo ganha sua aba/checklist específica.

### 1.3 APR como pré-requisito (regra de ouro do auditor)

- Novo campo **"APR Vinculada"** no topo do formulário, **obrigatório** (não dá pra emitir sem).
- Ao escolher a APR, sistema **puxa automaticamente**: local, casco, empresa e sugere o tipo de PT baseado nos riscos da APR (já existe `detectarExigenciaPTE`, vamos reaproveitar).
- Botão "Gerar PT vinculada" continua funcionando vindo da tela da APR (já existe).
- Exceção: admin pode marcar "Emergência — sem APR" com justificativa obrigatória (auditável).

### 1.4 Validade e janela de execução

Hoje só tem `data`. Adicionar:

- `hora_inicio` (time)
- `hora_fim` (time)
- `validade` (radio: Turno / 24h / Personalizada)
- Status visual automático: **Válida / Expirada / Encerrada**

### 1.5 PT irmãs (relacionar permissões)

Campo opcional **"PTs relacionadas"** — multi-select de outras PTs ativas. Resolve o caso "soldar dentro de tanque" (PET + PTQ + Altura na mesma tarefa) que discutimos.

### 1.6 PDF/Preview/Impressão

Botão **"Visualizar PDF"** em cada PT do histórico:

- Abre modal com layout A4 pronto para impressão (mesmo padrão do APR).
- Campos: número, tipo, APR vinculada, local, casco, empresa, executante, validade, riscos, controles (puxados da APR), assinaturas (placeholder por enquanto).
- Botões: **Imprimir** (window.print scoped) e **Download PDF** (jsPDF, já temos no projeto).
- Assinatura digital fica para Fase 3.

### 1.7 Banco — migration mínima

Adicionar em `ptes`:
- `tipo_pt` (text, default 'PTE')
- `hora_inicio` (time)
- `hora_fim` (time)
- `validade_tipo` (text: 'TURNO' | '24H' | 'CUSTOM')
- `validade_ate` (timestamptz, calculado)
- `pts_relacionadas` (uuid[])
- `emergencia_sem_apr` (boolean, default false)
- `emergencia_justificativa` (text)

APR já vinculada via `apr_id` existente. Sem novas tabelas nesta fase.

---

## Fase 2 — PET NR-33 completo (próxima rodada, não nesta)

- Tabelas novas: `pet_trabalhadores_autorizados`, `pet_testes_atmosfera`, `pet_checklist_respostas` (35 itens do FOR-SEG 05), `pet_assinaturas`.
- Validação automática de limites (O₂ 19.5–23%, LIE <10%, etc.) com bloqueio de liberação.
- Vigia e Supervisor de Entrada obrigatórios.

## Fase 3 — Demais PTs + assinatura digital

- Forms específicos: PTQ (rescaldo 30min), PTA (ancoragem/cinto), PTEL (LOTO).
- Assinatura digital (canvas, igual APR) para Emitente / Executante / Vigia / Supervisor.
- Dashboard de PTs ativas por casco/frente.

---

## Detalhes técnicos (Fase 1)

- **Arquivo principal:** `src/routes/app.ptes.tsx` — reescrever formulário, adicionar select de tipo + APR obrigatória + horários.
- **Novo componente:** `src/components/pte/PtePdfPreview.tsx` — modal de preview/impressão.
- **Migration:** colunas novas em `ptes`, todas opcionais para não quebrar registros existentes.
- **Lib:** reaproveitar `apr-pte-rules.ts` para sugestão automática de tipo.
- **Menu lateral:** label "PTE" → "Permissões".

---

## O que NÃO entra nesta fase

- Checklist de 35 itens do PET (Fase 2).
- Testes atmosféricos com validação numérica (Fase 2).
- Assinatura digital com canvas (Fase 3).
- Forms separados por tipo (Fase 3).
- Continuous monitoring NR-33 (Fase 3).

---

## Pergunta antes de começar

Topa essa Fase 1 do jeito que tá ou quer ajustar algo (ex: já incluir alguns campos do PET nesta rodada, ou começar pelo PDF e deixar tipo/APR pra depois)?
