## Objetivo

Reorganizar todo o `/app/painel` na pegada visual da imagem que você enviou (dashboard de controle de acidentes/incidentes, estilo BI corporativo). Toda a **lógica e dados existentes são preservados** — mudam só a estrutura visual, a grade e a estética dos gráficos.

## Linguagem visual nova (inspirada na imagem)

- **Header largo azul-marinho** com título em caixa alta branco, faixa fina abaixo, filtros à direita (empresa / período) em pílulas brancas.
- **Coluna de filtros lateral** (esquerda, estreita) com blocos pequenos: Empresa, Período, Tipo (APTO/ALERTA/BLOQ), Modalidade, Setor — clicáveis pra cruzar dados.
- **Grade central densa** (3–4 colunas), cada bloco com borda fina cinza, título compacto em maiúsculas e gráfico ocupando o card inteiro — sem espaço desperdiçado.
- **KPI gigante vermelho** no topo-esquerda (estilo o "19" da imagem): número grande, label curto embaixo, fundo vermelho sangue (mantém o `#7f1212` da marca).
- **Mini-charts coloridos**: barras verticais, donut, área pequena, ranking horizontal — todos com mesmas dimensões pra dar ritmo visual.
- **Coluna direita** com ranking de pessoas/empresas (estilo o "GESTOR" da imagem) e medidores verticais (Tempo na Função / Tempo na Empresa → vira "Conformidade por Empresa" / "DDS por Setor").

## Mapeamento dos blocos (o que vai onde)

```text
┌──────────────────────────────────────────────────────────────┐
│  HEADER AZUL · PAINEL EXECUTIVO SESMT · filtros à direita    │
├────────┬─────────────────────────────────────────┬───────────┤
│ FILTROS│ KPI 19  │ TOP 5 EMPRESAS │ ENTREGAS/MÊS │ CONFORM.  │
│ Empresa│ (BLOQ)  │ (barras vert.) │ (área)       │ DONUT 87% │
│ Período├─────────┴────────────────┴──────────────┤           │
│ Status │ ENTREGAS POR MOTIVO (mini barras)       │ RANKING   │
│ Setor  ├────────────────┬────────────────────────┤ EMPRESAS  │
│ Modal. │ DDS POR TURNO  │ DDS EVOLUÇÃO (linha)   │ (lista)   │
│        ├────────────────┴────────────────────────┤           │
│        │ AÇÕES RECOMENDADAS · PRÓXIMOS 7 DIAS    │ MEDIDORES │
│        │ (lista compacta com badges)             │ VERT.     │
└────────┴─────────────────────────────────────────┴───────────┘
```

## Mudanças por seção

1. **Header** — vira faixa azul-marinho `#0c2340 → #1a4a6e`, título "DASHBOARD CONTROLE SESMT" em branco caixa-alta, badge DMN dentro, filtros movem pra direita.
2. **Filtros** — coluna lateral estreita (~180px) com blocos clicáveis estilo "TIPO C…", "MODA…", "SETOR" da imagem (toggle de filtro por status / empresa).
3. **KPI Bloqueados** — vira o "19": card vermelho-sangue grande, número em 64px branco, "BLOQUEADOS" embaixo.
4. **Conformidade Geral** — vira um **donut grande** (igual o "Status Investigação" da imagem), com % no centro.
5. **Conformidade por Empresa** — vira **barras verticais coloridas** (verde/amarelo/vermelho) tipo o "TOP 5" da imagem.
6. **Fluxo de EPI** — mantém ComposedChart mas em card menor com fundo branco e bordas marcadas, estilo "Quantidade de Acidentes por Mês".
7. **DDS · Evolução** — vira card lado-a-lado com "DDS por Setor" (barras horizontais).
8. **Top pendências por empresa** — vira **ranking vertical estilo "GESTOR"** na coluna direita, com nomes em lista e número à direita.
9. **Ações Recomendadas + Próximos 7 dias** — viram dois blocos densos lado-a-lado embaixo, estilo "Principais Setores com Acidente".
10. **Medidores** (Documentos / Extintores / Estoque) — viram **barras verticais finas** estilo "Tempo na Função" / "Tempo na Empresa" na direita.

## Paleta

- Azul header: `#0c2340` → `#1a4a6e` (gradient)
- Vermelho KPI crítico: `#7f1212` (já é o da marca, mantém)
- Verde OK: `#10b981`
- Amarelo alerta: `#f59e0b`
- Cinza grade/bordas: `#cbd5e1` / `#e2e8f0`
- Fundo página: `#f1f5f9` (mais frio que o atual)

## Detalhes técnicos

- Arquivo único editado: `src/routes/app.painel.tsx` (873 linhas → reescreve o JSX a partir da linha ~316, mantendo todo o data fetching e os `useMemo` acima dela intactos).
- `KpiCard` ganha variante `mega` (o card vermelho gigante) e `donut` (gauge circular).
- Adiciono um `MiniBarsVertical` e um `RankingList` (componentes locais no mesmo arquivo, pra não inflar `/components`).
- Recharts continua sendo a lib (já importada). Sem novas dependências.
- Layout responsivo: a partir de `lg:` ativa a grade 3-colunas com filtros laterais; em mobile vira stack vertical normal.

## Fora de escopo

- Não mexo nas tabelas/listas de busca de colaboradores no rodapé (se houver).
- Não mexo nos dados — toda métrica continua vindo do mesmo `useQuery`.
- Não troco a paleta global do sistema, só a do painel.

Aprova que mando bala?
