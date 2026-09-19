---
name: Identidade visual separada entre nuvem e servidor DMN
description: Novo logo SIGMO e texto SESMT somente na nuvem; servidor interno deve preservar identidade DMN após deploy.
type: constraint
---
O novo logotipo SIGMO enviado pelo usuário e o texto “SISTEMA DE GESTÃO SESMT” devem aparecer somente na versão em nuvem.

Na instalação interna conectada ao servidor DMN, preservar o logotipo DMN no cabeçalho e na home, além do texto “Construção Naval · Amazônia”, inclusive após atualizações e deploys.

Qualquer futura alteração visual de identidade deve respeitar essa separação e nunca substituir automaticamente a marca do servidor interno.

Paleta de cores: a nuvem usa o tema `theme-cloud` (verde-lima oklch(0.79 0.20 131) + azul oklch(0.66 0.145 228), extraídos do logotipo EnviCorp); o servidor mantém `theme-dmn` (vinho). A classe é escolhida em `src/routes/__root.tsx` via `IS_BACKEND_LOCAL`. Novas cores de destaque devem usar variáveis (`--primary`, `--brand`, `--flare-*`, `--brand-glow`) definidas nos dois temas, nunca cores fixas. Remoções de módulos/menus na nuvem (Produção, Compras, Administrativo, Almoxarifado, Portaria, Cozinha, Cascos) também NÃO podem afetar o servidor DMN.