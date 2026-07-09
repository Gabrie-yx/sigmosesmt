---
name: SIGMO resiliência sem IA — importadores determinísticos
description: Estratégia para não depender de IA em conformidade legal (PGR/PCMSO/LTCAT/LIP). Arquitetura 2 camadas + templates oficiais + propagação automática.
type: feature
---
# Contexto / Preocupação do usuário
O SIGMO vem absorvendo IA em vários pontos. Preocupação: se o cenário de IA
mudar (custo, indisponibilidade, mudança de política, quebra de gateway), o
sistema NÃO pode quebrar — principalmente nos módulos de conformidade legal
(PGR, PCMSO, LTCAT, LIP — Laudo de Insalubridade e Periculosidade).

Decisão: importar PGR, PCMSO, LTCAT e LIP e populá-los/atualizá-los por
completo no sistema, mantendo regularidade — SEM depender de IA no caminho
crítico.

# Arquitetura combinada (2 camadas)
**Camada 1 — Determinística (obrigatória, sempre funciona sem IA):**
- Templates oficiais SIGMO em Excel/CSV com abas padronizadas e validação de célula:
  `template-pgr.xlsx`, `template-pcmso.xlsx`, `template-ltcat.xlsx`, `template-lip.xlsx`.
- Importador único em `/app/sesmt/importar`: parser XLSX → preview diff → commit.
- Wizard manual guiado como fallback eterno.

**Camada 2 — IA (opcional, só aceleradora):**
- "Extrair da PDF com IA" apenas PREENCHE a planilha padrão para revisão humana.
- Nunca escreve direto no banco. Se a IA cair, camadas 1 seguem 100%.
- Marcado visualmente como "assistente".

# Regra de ouro por tela de importação
3 modos oferecidos ao usuário:
1. Upload de planilha padrão (determinístico)
2. Wizard manual guiado (eterno)
3. IA extrai rascunho (opcional)

# Propagação automática após import
- PGR → `pgr_ghe`, `pgr_inventario_riscos`, `cargo_riscos`
- PCMSO → `roles.exames_obrigatorios`, `risco_exames`, `exam_natureza_base`
- LTCAT → `cargo_riscos_medicoes`, feeds do PPP
- LIP → nova tabela `laudo_insal_pericul` + flag em `roles`

# O que EVITAR
- Fluxo "cola PDF → IA popula banco" sem revisão humana.
- Dependência de embeddings/vector DB para conformidade legal.
- Salvar só PDF e consultar via IA — precisamos dos dados estruturados pra
  emitir ASO, PPP, bloquear portaria etc.

# Status
Pausado / aguardando retomada. Retomar junto com Rev.06 do PGR/PCMSO
(ver `mem://features/sigmo-pgr-pcmso-rev06-pendente`).

# Próximo passo quando voltar
Construir os 4 templates Excel (validação de célula, aba de instruções,
exemplos preenchidos com Rev.05 do DMN) e a tela `/app/sesmt/importar`.