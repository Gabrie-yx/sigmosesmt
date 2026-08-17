---
name: Projeto ESO clone — arquitetura entendida (prints 17/08/2026)
description: Entendimento correto do que o ESO faz (fábrica de documentos SST para consultoria multiempresa) e o núcleo arquitetural a replicar. SIGMO != ESO.
type: feature
---
**Correção importante:** SIGMO é SGI interno de UMA empresa. O ESO é outra coisa: plataforma para **consultorias/engenheiros** elaborarem documentos legais para MUITAS empresas clientes (ex.: ASA, 1113 vidas; Casa Santos).

**Saída do ESO:** PGR, PCMSO, LTCAT, LIP, PGRTR, PPRA/PCMAT (legado).

**O que os prints revelaram (arquitetura a copiar):**
1. Documento = entidade versionada com metadados: título, autor (RT), coordenador, modelo do documento, data doc, início validade, renovação sugerida, link público (sim/não), anexar cronograma, descrição, **faturamento** (fatura por documento emitido).
2. Corpo do documento em **editor rich-text** com "inserir modelo pronto" (biblioteca de blocos): tabela Controle das Revisões (Emissão/Revisão/Página/Data/Natureza) e Quadro de Colaboradores (Setor/Função/Quantidade).
3. Cadastro de pessoa genérico: tipo doc (CPF), nascimento, CPF, sexo, é empregador?, nome, RG+UF, NIS, **documento de classe + nº + UF** (CREA/CRM), tags, toggles CONTATO e ESOCIAL.
4. **Mapeamento** é o núcleo: "Responsáveis pelos dados ambientais" + lista de cargos com contadores "(7 riscos, 11 exames, 2 aptidões)". Ações: adicionar cargo, importar cargo, alterar data de início de validade, excluir em massa.
5. Criar cargo: nome, cor, ícone, **CBO**, data início validade eSocial, aptidões extras, **ambientes pelos quais o cargo transita** (multi) + **ambiente principal** (radio), informações do setor, atividades (impessoal no infinitivo) com "puxar do histórico", jornada/carga horária, toggles informações complementares e parecer técnico.
6. Menu topo: Mapeamento / Funcionários / Segurança / Programas-Laudos / Saúde / Relatórios.

**Núcleo do modelo de dados:** Cliente(tenant) → Ambientes → Cargos(CBO) → Riscos → Exames/Aptidões → EPI/EPC → Documentos gerados.

**Aproveitar do SIGMO:** catálogo de riscos (166), CBO, NRs, EPIs, exames, motor de PDF, RBAC, biblioteca de ações PGR.
**Precisa ser novo:** multi-tenant por cliente do consultor, editor rich-text de documento com modelos, versionamento/revisões, faturamento por documento, eSocial.

**Status:** aguardando mais prints (Saúde, Relatórios, Segurança, eSocial, lista de documentos). Nada codado.
