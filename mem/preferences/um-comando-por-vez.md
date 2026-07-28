---
name: Um comando por vez
description: No terminal/servidor, passar SEMPRE um único comando por mensagem e esperar a saída antes do próximo
type: preference
---
Ao orientar o usuário em terminal/servidor (SSH, docker, psql, dump, deploy):

- Enviar **UM comando por mensagem**. Nunca blocos com passos 1,2,3,4.
- Esperar a saída do usuário antes de mandar o próximo.
- Dizer sempre **de onde tirar** cada senha/chave (caminho exato do arquivo ou tela exata do painel), nunca assumir que ele sabe.
- Explicar em uma linha o que o comando faz, sem jargão.

**Why:** o usuário não é operador de infra; blocos longos geram erro, retrabalho e frustração. Ele já pediu isso explicitamente.