---
name: Matriz de Requisitos Legais (LIRA) — pendente
description: Módulo novo pra gerenciar requisitos legais aplicáveis (VCL/RL) com evidências, exigido por ISO 9001/45001/14001 e auditoria CAL. Não é Controle de Documentos.
type: feature
---

## Contexto (08/07/2026)
Usuário mandou cartaz de Chagas + print da planilha (coluna E "Descrição" com "VCL 2024 - Garantir atendimento…" e coluna J "Requisito Legal" com códigos tipo RL94129, RL100309). Perguntou se guarda em Controle de Documentos. **Resposta: NÃO.**

## Diferença crítica
- **Controle de Documentos** = documentos controlados (PGR, PCMSO, POP, laudo, cartaz-PDF-mestre) com revisão/vigência.
- **Matriz de Requisitos Legais (LIRA)** = lista de leis/normas aplicáveis + status (atende/não atende/NA) + **evidência** vinculada. Exigência direta: ISO 9001 (8.5.1, 7.5), ISO 45001 (6.1.3), ISO 14001 (6.1.3), CAL Naval.
- **Evidência** = foto do cartaz afixado, ata de treino, registro de higienização — vive DENTRO do requisito, não solto na pasta de docs.

## Estrutura proposta (quando retomar)
- `requisitos_legais` (código RL, descrição VCL, órgão emissor, aplicabilidade, criticidade, norma_aplicavel[], status, responsável, próxima revisão)
- `requisitos_evidencias` (requisito_id, tipo [cartaz/foto/procedimento/ata], arquivo_url, data, local, responsável)
- `requisitos_revisoes` (histórico VCL ano a ano)
- FK opcional pra `procedimentos` e `controle_documentos` (cartaz PDF mestre fica no CD, evidência de afixação fica aqui)

## Pendências abertas com o usuário
- [ ] Usuário tem planilha .xlsx completa dos requisitos — pedir quando for construir (parser + seed).
- [ ] Definir se escopo é só ISO 9001 + CAL ou SGI completo (9001+45001+14001+CAL) — recomendação: SGI completo com campo `norma_aplicavel` multi-select.
- [ ] Definir fase 1 (cadastro), fase 2 (evidências + upload foto), fase 3 (auditoria/relatório).

## Quando retomar
Usuário falar em: "requisito legal", "matriz legal", "LIRA", "VCL", "RL9XXXX", "evidência de conformidade", "auditoria CAL/ISO 9001 requisitos", "cartaz obrigatório", "avaliação de conformidade legal".
