---
name: Usuário só vê o frontend
description: Não perguntar ao usuário sobre dados de banco, storage, coordenadas ou qualquer coisa que só o agente enxerga
type: preference
---
O usuário só enxerga "telas bonitinhas" (front-end). Não tem visão de banco, storage, tabelas, coordenadas, arquivos internos, edge functions, etc.

**Como aplicar:** antes de perguntar algo, verificar se a resposta pode ser descoberta lendo o próprio código/banco/storage com as ferramentas do agente. Só perguntar sobre decisões de produto, escopo, prioridade e preferência visual — nunca sobre estado técnico do sistema.

**Não fazer:** "onde estão as coordenadas hoje?", "esse dado já existe em qual tabela?", "o PDF tem quantas páginas?" — descobrir sozinho.