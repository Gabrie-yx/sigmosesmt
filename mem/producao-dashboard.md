---
name: Dashboard Dinâmico de Produção
description: Estado do módulo Produção (dashboard MB51 × Base MP × Lista Técnica), tabelas, rotas e o que falta subir.
type: feature
---

# Dashboard Dinâmico de Produção

## Tabelas no Supabase
- `producao_base_materia_prima` — códigos SAP + tipo (FERRO/GÁS/SOLDA/TINTA/OUTROS). **POPULADA** (~931).
- `producao_mb51_ordens` — 1 linha por Ordem SAP importada da MB51.
- `producao_mb51_movimentos` — N linhas (movimentos da MB51) por ordem; FK em ordem_id.
- `producao_lista_tecnica` + `producao_lista_tecnica_itens` — listas técnicas B51 por casco.
- `cascos` — cascos (numero, nome).

## Parsers
- `src/lib/base-mp-parser.ts` → `parseBaseMpXlsx` (Base MP).
- `src/lib/mb51-parser.ts` → `parseMb51Xlsx` + `resolveTipo` + `normalizeCascoName`.

## Rotas
- `/app/producao/base-materia-prima` → upload da **Base MP**.
- `/app/producao/ordens` → upload da **MB51** (popula mb51_ordens/movimentos).
- `/app/producao/lista-tecnica` → upload de Lista Técnica B51 por casco.
- `/app/producao/painel-lista-tecnica` → **DASHBOARD DINÂMICO**: lê mb51_ordens + base_materia_prima + lista técnica, agrupa por categoria e casco.

## Para ver o dashboard funcionando
Base MP já está carregada. Falta subir a **planilha MB51** na rota `/app/producao/ordens`.

## Histórico de mudanças
- 2026-05-19: Memória criada. Base MP populada (931 itens). MB51 ainda vazia.
