# Módulo CAL — Gestão de Requisitos Legais

Novo módulo do SIGMO pra receber os CALs do Ius Natura (upload de planilha ou colagem manual), classificar aplicabilidade em dois níveis (SESMT + Gestor da área) e desdobrar em ações nos módulos existentes: Plano de Ações, Controle de Documentos, Procedimentos, DDS, PGR, Matriz de Treinamento, PCMSO e Contratadas.

## Tela-mãe: Dashboard de KPIs

Entrada do módulo em `/app/cal` mostrando:
- **KPIs no topo**: Total no período · % Aplicáveis · % Atendidos · % Em atraso · Risco médio · CALs sem análise
- **Gráfico**: linha do tempo de CALs recebidos vs. atendidos (últimos 12 meses)
- **Distribuição**: pizza por NR / por área impactada
- **Alertas**: cards vermelhos com PAs vencendo em 7 dias, aprovações pendentes de gestor, evidências faltantes
- **Botões de ação**: Importar planilha · Novo CAL manual · Ver todos (abre Kanban) · Ver tabela

Filtros globais: período, NR, área, criticidade, status, responsável.

## Fluxo em 5 estados

```text
RECEBIDO → EM ANÁLISE → [APLICÁVEL | NÃO APLICÁVEL] → EM TRATATIVA → ATENDIDO
                                                              ↘ MONITORAMENTO
```

- **RECEBIDO** — entrou por upload/manual, sem triagem
- **EM ANÁLISE** — SESMT lendo e classificando
- **APLICÁVEL / NÃO APLICÁVEL** — decisão SESMT + aprovação do Gestor da área impactada (dois olhos)
- **EM TRATATIVA** — PA(s) aberto(s), responsáveis atuando
- **ATENDIDO** — evidências validadas + assinatura Coord. SESMT
- **MONITORAMENTO** — requisito recorrente jogado no Controle de Documentos

## Entrada dos CALs

**Upload da planilha do CAL** (.xlsx exportado do sistemacal.com.br):
- Parser detecta colunas: nº do CAL, norma/lei, ementa, data de publicação, órgão, área, criticidade
- Preview antes de importar — usuário confirma o mapeamento
- Deduplicação por nº do CAL

**Colagem manual** — dialog com formulário curto pra CALs avulsos ou que chegaram fora da planilha.

## Card do Requisito (tratativa)

Aberto ao clicar num CAL. Contém:
1. **Cabeçalho**: nº CAL, norma, ementa, data publicação, órgão, link pro texto oficial
2. **Aplicabilidade** (SESMT): Sim / Parcial / Não + justificativa técnica + assinatura
3. **Aprovação** (Gestor da área): botão Aprovar / Rejeitar + comentário + assinatura
4. **Impacto** — multi-seleção dos módulos afetados: Plano de Ações, Controle de Docs, Procedimentos, DDS, PGR, Matriz Treinamento, PCMSO, Contratadas, EPI
5. **Ações desdobradas** — pra cada módulo marcado, o sistema cria automaticamente:
   - **Plano de Ações**: 1 PA por requisito com prazo, responsável, checklist
   - **Controle de Documentos**: entrada com data de validade se for documento recorrente
   - **Procedimentos**: flag "revisar POP/PT X" em `procedimento_revisoes`
   - **DDS**: sugestão de tema em `dds_temas`
   - **PGR**: pendência de revisão do inventário/GHE afetado
   - **Matriz Treinamento**: cursos marcados como "revisar carga/conteúdo"
   - **PCMSO**: pendência no `exam_catalog` se muda exame
   - **Contratadas**: replica exigência em `contratada_documentos`
6. **Evidências** — upload de arquivos (PDF do texto legal, laudos, ARTs, licenças, fotos de adequação, listas de presença)
7. **Histórico / auditoria** — trilha de tudo em `audit_logs`
8. **Fechamento** — assinatura Coord. SESMT + status ATENDIDO ou MONITORAMENTO

## Evidências

**Geradas pelo sistema (PDF assinado):**
- Parecer de aplicabilidade
- Termo de análise crítica (aplicabilidade + aprovação gestor)
- Relatório de conformidade (exportável por período)

**Upload manual pelo usuário:**
- PDF do requisito legal
- Laudos técnicos (LTCAT, insalubridade, elétrico, ergonômico)
- ARTs, licenças, alvarás, certificados
- Fotos de adequação
- POP/PT atualizado
- Lista de presença de DDS/treinamento
- Ofício ou e-mail do órgão fiscalizador

## Integrações com módulos existentes

| Módulo | O que o CAL dispara | Tabela alvo |
|---|---|---|
| Plano de Ações | Cria PA vinculado com prazo e responsável | `plano_acoes` |
| Controle de Documentos | Cria entrada recorrente se doc tem validade | `controle_documentos`, `controle_doc_recorrentes` |
| Procedimentos | Marca POP pra revisão + ciência da equipe | `procedimentos`, `procedimento_revisoes`, `procedimento_cientes` |
| DDS | Sugere tema de DDS baseado no requisito | `dds_temas` |
| PGR | Pendência de revisão do GHE/inventário | `pgr_inventario_riscos`, `pgr_plano_acao` |
| Matriz Treinamento | Marca cursos afetados pra revisão | `training_matrix_courses` |
| PCMSO | Ajuste no catálogo de exames | `exam_catalog`, `convocacoes_exames` |
| Contratadas | Replica exigência documental | `contratada_documentos` |
| Auditoria | Trilha completa | `audit_logs` |

## Notificações

- Badge no header pra Coord. SESMT: "N novos CALs sem análise"
- Badge pro Gestor da área: "N CALs aguardando sua aprovação"
- Card no `/app/hoje`: "CALs vencendo em 7 dias"
- E-mail (via SIGMO existente) quando um CAL é atribuído a você

## RBAC

- **Coord. SESMT / Téc. Segurança**: cria, importa, analisa, fecha
- **Gestor da área impactada**: aprova/rejeita aplicabilidade
- **Admin**: full
- **Solicitante comum**: só visualiza CALs da própria área

## Detalhes técnicos

### Novas tabelas (public schema, com GRANTs)

```text
cal_requisitos               ← 1 linha por CAL/requisito
cal_aplicabilidade           ← análise SESMT + aprovação gestor (2 assinaturas)
cal_impactos_modulos         ← N:N com módulos afetados
cal_evidencias               ← anexos + refs pra documentos_assinados
cal_historico                ← trilha estado→estado
cal_lote_importacao          ← metadados de cada upload de planilha
```

Cada tabela: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role`, RLS ON, políticas por `has_role()`.

FKs pra `plano_acoes.id`, `controle_documentos.id`, `procedimentos.id`, `dds_temas.id` etc. — quando um CAL desdobra ação num módulo, guarda o link nos dois lados.

### Storage

Bucket privado `cal-evidencias/` para anexos do usuário. Signed URLs de 1h.

### Server functions (`src/lib/cal.functions.ts`)

- `importarPlanilhaCal` — recebe arquivo, faz parse, deduplica, cria requisitos em batch
- `criarRequisitoManual`
- `analisarAplicabilidade` — SESMT decide
- `aprovarAplicabilidade` — Gestor aprova/rejeita
- `desdobrarImpacto` — cria PAs/entradas em Controle Docs/etc. de forma transacional
- `fecharRequisito`
- `getDashboardKpis`
- `listarRequisitos` (filtros)

Todas com `.middleware([requireSupabaseAuth])`. `supabaseAdmin` só em operações administrativas específicas via `await import()` dentro do handler.

### Parser de planilha

Novo arquivo `src/lib/cal-parser.ts` usando `xlsx`. Detecta headers do CAL via heurística (similar a `sheet-detect.ts`). Retorna array tipado `CalRequisitoImportado[]`.

### Rotas (TanStack, sob `_authenticated`)

- `/app/cal` — Dashboard KPIs (tela-mãe)
- `/app/cal/lista` — Tabela com filtros + botão de importação
- `/app/cal/kanban` — Kanban dos 5 estados
- `/app/cal/$id` — Detalhe/tratativa do requisito

### Componentes

- `CalDashboard`, `CalImportDialog`, `CalRequisitoCard`, `CalAplicabilidadeForm`, `CalAprovacaoGestorForm`, `CalImpactoSelector`, `CalEvidenciasUploader`, `CalHistoricoTimeline`

### PDF

`src/lib/cal-parecer-pdf.ts` — parecer de aplicabilidade assinado, reaproveitando o `pdf-header.ts` e `signature-utils.ts` já existentes.

### Realtime

Subscription em `cal_requisitos` pra atualizar badges e dashboard em tempo real (padrão do projeto: `useEffect` + `removeChannel` no cleanup).

## Entrega faseada

- **Fase 1** — Schema + Import planilha + Card do requisito + Aplicabilidade dois olhos + integração com **Plano de Ações** e **Controle de Documentos** (o essencial pra você já ganhar tempo)
- **Fase 2** — Integração com Procedimentos + DDS + Contratadas
- **Fase 3** — Integração com PGR + Matriz Treinamento + PCMSO + PDFs de parecer + relatório de conformidade

## Fora de escopo (por enquanto)

- API oficial com Ius Natura (só se eles fornecerem contrato)
- IA sugerindo aplicabilidade automática (fica pra depois, quando tivermos histórico)
- Integração com Jurídico externo
