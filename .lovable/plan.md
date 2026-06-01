# Módulo OSS (Ordem de Serviço de Segurança) — NR-01 item 1.4.1 "c"

## Visão geral
Cria o módulo de Ordens de Serviço de Segurança por **cargo**, gerada de forma **híbrida** (auto-monta a partir da Matriz de Riscos + EPIs + NRs, mas SESMT pode editar antes de emitir), com assinatura **física via upload de PDF assinado**, e reciclagem automática quando:
- Funcionário muda de cargo
- Risco/EPI do cargo é alterado
- Vence o ciclo anual

## 1. Banco de dados (migration única)

### `oss_templates` — modelos editáveis por cargo
- `cargo` (text, único) — chave do cargo (ex.: "SOLDADOR", "CALDEREIRO")
- `titulo`, `setor`, `descricao_atividades` (text)
- `riscos_texto`, `medidas_preventivas`, `epis_obrigatorios`, `proibicoes`, `penalidades`, `procedimentos_emergencia` (text) — todos pré-preenchidos a partir da Matriz de Riscos + ficha de EPI, mas editáveis
- `validade_meses` (int, default 12)
- `revisao` (int, default 1) — incrementa a cada alteração relevante
- `hash_conteudo` (text) — SHA do conteúdo, usado pra detectar mudança de risco/EPI e disparar re-assinatura
- `ativo` (bool)

### `oss_emissoes` — OSS emitidas por funcionário
- `employee_id` (uuid → employees)
- `template_id` (uuid → oss_templates), `template_revisao` (int) — congela versão emitida
- `cargo_snapshot` (text)
- `pdf_gerado_path` (storage path, bucket `oss-pdfs`) — PDF "limpo" pra imprimir
- `pdf_assinado_path` (storage path) — PDF escaneado de volta
- `status` (enum: `PENDENTE_ASSINATURA`, `ASSINADO`, `VENCIDO`, `SUBSTITUIDO`)
- `emitido_em`, `assinado_em`, `expira_em` (timestamptz)
- `motivo_emissao` (enum: `ADMISSAO`, `MUDANCA_CARGO`, `REVISAO_RISCO`, `RECICLAGEM_ANUAL`)
- `emitido_por`, `validado_por` (uuid → auth.users)

### RLS
- SELECT: usuários autenticados do mesmo workspace
- INSERT/UPDATE: somente perfis SESMT/Admin (via `has_role`)

### Triggers
- Ao alterar `cargo` do funcionário → marca OSS ativa como `SUBSTITUIDO` e cria pendência
- Ao alterar Matriz de Riscos de um cargo → recalcula `hash_conteudo` do template, marca OSS ativas como `SUBSTITUIDO`
- Job diário (server fn agendada manualmente por enquanto) → marca `VENCIDO` quando `expira_em < now()`

## 2. Storage
Bucket privado `oss-pdfs` (RLS por user/role).

## 3. Rotas e UI

```
src/routes/
  app.oss.tsx                    # layout
  app.oss.index.tsx              # lista de OSS emitidas (filtros: status, cargo, funcionário)
  app.oss.templates.tsx          # gestão de modelos por cargo
  app.oss.$id.tsx                # detalhe de uma OSS emitida
```

### Página `app.oss.templates.tsx`
- Lista todos os cargos com OSS configurada
- Botão "Gerar a partir da Matriz" → puxa riscos do `cargo-riscos-panel` + EPIs da ficha + NRs aplicáveis e pré-popula os campos
- Editor com todos os campos texto (Textarea grande), preview lateral
- "Salvar revisão" incrementa `revisao` e recalcula `hash_conteudo`

### Página `app.oss.index.tsx`
- Tabela: Funcionário | Cargo | Status (badge colorido) | Emitido em | Vence em | Ações
- Filtros: status, cargo, busca por nome
- Botão "Emitir OSS" → seleciona funcionário → escolhe template do cargo → gera PDF
- Linha com status `PENDENTE_ASSINATURA`: botão **"Baixar PDF para assinar"** + **"Anexar PDF assinado"** (input file)
- Linha `SUBSTITUIDO` ou `VENCIDO`: badge vermelho + botão "Reemitir"

### Detalhe `app.oss.$id.tsx`
- Mostra conteúdo congelado da OSS
- Download do PDF gerado e (se houver) do PDF assinado
- Histórico de mudanças de status

## 4. Geração de PDF (`src/lib/oss-pdf.ts`)
- Reaproveita o padrão de `epi-ficha-pdf.ts` (jsPDF + autoTable)
- Cabeçalho com logo da empresa, número da OSS, revisão, validade
- Seções: Atividades / Riscos / Medidas Preventivas / EPIs Obrigatórios / Proibições / Penalidades / Emergência
- Rodapé com 2 campos de assinatura: **Trabalhador** + **SESMT/Encarregado**
- Reusa `PDFPreviewDialog` (sem `signable`, pois assinatura é física)

## 5. Integração com Pendências
- Adicionar fonte `OSS_PENDENTE` no `use-pendencias` → aparece no `minhas-pendencias` do SESMT
- Critério: existir `oss_emissoes` com status `PENDENTE_ASSINATURA`, `SUBSTITUIDO` ou `VENCIDO`

## 6. Integração com APR/PT (Fase 2 — não incluído agora)
Futuramente: ao criar APR/PT, validar que o funcionário tem OSS `ASSINADA` e dentro da validade pro cargo dele. Por ora, apenas registro independente — combinamos isso depois.

## 7. Menu e permissões
- Adicionar item "Ordens de Serviço (OSS)" no `app-sidebar.tsx` na seção SESMT, com ícone `FileSignature`
- Gate via `module-guard` exigindo módulo `seguranca` (ou criar `oss` específico se preferir)

## 8. Cargos iniciais sugeridos (pré-popular templates)
Soldador, Caldereiro, Pintor Naval, Eletricista Naval, Mecânico, Operador de Guindaste, Trabalhador em Espaço Confinado, Trabalhador em Altura, Mergulhador, Jateador, Encanador Naval, Ajudante de Estaleiro.
(Cria os templates "em branco" — o usuário gera o conteúdo via botão "Gerar a partir da Matriz" quando quiser.)

---

## Ordem de execução
1. Migration (tabelas + RLS + triggers + bucket storage)
2. `oss-pdf.ts` (gerador)
3. Rotas e telas (templates → index → detalhe)
4. Sidebar + Pendências
5. Teste fim a fim (criar template → emitir → baixar → upload assinado → ver pendência sumir)

## Pergunta final antes de começar
- Confirma o bucket `oss-pdfs` privado, ok?
- Os 12 cargos iniciais acima cobrem o estaleiro de vocês, ou quer ajustar a lista antes?