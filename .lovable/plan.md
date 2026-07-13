
# Módulo `/app/sesmt/inspecoes` — Plano de Ataque

Substituto interno do "laudo SafeAI", com rastreabilidade real, base legal correta e IA como acelerador opcional (nunca no caminho crítico).

## Decisões já travadas

- **Quem abre:** SESMT + Líder + Encarregado (líder abre rascunho → SESMT valida/publica)
- **Fotos:** upload de celular **+** import de CFTV/câmera fixa (URL)
- **IA:** híbrido — núcleo determinístico + botão opcional "sugerir NCs" (só rascunho)
- **Matriz:** 5x5 com rubrica documentada e impressa no PDF
- **Grau de risco DMN:** 3 (para cálculo NR-28)

## Fases

### Fase 1 — Núcleo determinístico (MVP)
1. Tabelas no banco (`inspecoes`, `inspecao_fotos`, `inspecao_ncs`, `inspecao_ncs_planos`, `nr28_valores`, `matriz_risco_rubrica`)
2. Tela de abertura de inspeção (`/app/sesmt/inspecoes/nova`) — local, data, escopo, participantes
3. Upload de fotos (celular) com hash SHA-256, timestamp, GPS quando disponível
4. Import de foto CFTV via URL + metadados manuais (câmera, timestamp)
5. Cadastro de NC via **catálogo pré-mapeado** de NRs/itens (dropdown NR → item → texto oficial) — reusa `catalogo_nrs` existente
6. Matriz 5x5 com rubrica clicável (P1-P5 e S1-S5 com definições)
7. Cálculo automático de multa NR-28 (grau 3 × nº empregados × gradação I1-I4 × valor Portaria vigente)
8. Plano de ação por NC (responsável, prazo, PDCA, evidência de encerramento)
9. Fluxo de aprovação: líder abre rascunho → SESMT revisa → publica (RLS + estado)

### Fase 2 — PDF profissional + integrações
10. PDF do relatório com header DMN, ART (campo assinatura), rubrica da matriz no rodapé, hash das fotos, texto legal, PDCA
11. NC publicada vira registro em `nao_conformidades` (tabela existente) e alimenta indicadores
12. Notificação ao responsável do plano de ação

### Fase 3 — IA opcional (acelerador)
13. Botão "Sugerir NCs com IA" nas fotos → preenche rascunho de NCs no formulário (usuário confirma cada uma antes de salvar)
14. Nunca grava direto no relatório final — segue filosofia `sigmo-resiliencia-sem-ia`

## Tabelas novas (resumo)

```text
inspecoes
  id, empresa_id, local, data_inspecao, escopo, tipo_local,
  aberta_por (uuid), status (rascunho|em_revisao|publicada|arquivada),
  revisada_por, publicada_em, created_at

inspecao_fotos
  id, inspecao_id, fonte (celular|cftv), storage_path, hash_sha256,
  timestamp_captura, gps_lat, gps_lng, camera_ref, tirada_por

inspecao_ncs
  id, inspecao_id, foto_id (nullable), nr_codigo, nr_item,
  descricao, probabilidade (1-5), severidade (1-5), risco_calculado,
  gradacao_nr28 (I1..I4), multa_estimada, criada_por, criada_em

inspecao_ncs_planos
  id, nc_id, acao, responsavel_id, prazo, status_pdca,
  evidencia_path, encerrada_em

nr28_valores  (seed com portaria vigente)
  gradacao, grau_risco, valor_base, portaria_ref, vigencia_inicio

matriz_risco_rubrica  (seed, referência única)
  eixo (P|S), nivel (1-5), definicao, exemplo
```

## Guardrails

- **Sem IA no caminho crítico** — Fase 3 é acelerador, nunca dependência
- **RLS**: líder/encarregado só vê inspeções da própria frente; SESMT vê tudo
- **Grants**: `SELECT/INSERT/UPDATE` para `authenticated`, sem `anon`
- **PDF**: usa `drawPdfHeader` (`EMPRESA_INFO`) — consistência com resto do SIGMO
- **NC publicada** alimenta a tabela `nao_conformidades` existente — não cria silo

## O que NÃO vai ter (por design)

- Sem check constraint com `now()` (usa triggers)
- Sem foto sem hash/timestamp
- Sem multa NR-28 chutada (só via tabela `nr28_valores` versionada)
- Sem "laudo" — o documento se chama **Relatório de Inspeção de Segurança** (inspeção ≠ laudo, laudo exige ART)

## Ordem de execução sugerida

Começo pela **Fase 1 itens 1-6** (banco + tela de abertura + upload celular + catálogo NR + matriz 5x5). É o esqueleto que já entrega valor. CFTV, NR-28 e PDF vêm em seguida.

**Confirma que começo por aí?** Ou prefere que eu inclua CFTV já no primeiro round?
