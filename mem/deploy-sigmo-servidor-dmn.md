---
name: Deploy SIGMO servidor DMN (RODANDO)
description: SIGMO deployado e rodando no servidor DMN via Bun+PM2 desde 11/07/2026. Supabase self-hosted local na rede 192.168.200.0/24 (Kong 192.168.200.11:8000). Migração de dados em andamento.
type: feature
---
Status: **RODANDO EM PRODUÇÃO INTERNA** desde sábado 11/07/2026.

### Setup atual
- Host: `dmnsgm0001` (Ubuntu 24.04.4 LTS), SSH `fbalmeida@sigmo.dmnestaleiro.com.br` via VPN DMN.
- Specs: 8 vCPU Xeon Gold 5318Y, 15Gi RAM, 946Gi livres, Docker 29.6.1 + Compose v5.3.1.
- Stack: Node 22 (upgrade do 20 por WebSocket do Realtime), Bun 1.3.14, PM2 24/7.
- User de app: `sigmo` (uid 1002, grupo docker), UFW liberado nas portas 22/3000/8000.
- App em `/home/sigmo/app` (ZIP extraído), 756 pacotes instalados via `bun install`.
- Endpoint interno: **http://172.18.0.50:8080/app** (acessado via VPN DMN).
- Rodando com `pm2 start` (`bun run dev --host 0.0.0.0`).
- **Atualização rede Docker (28/07/2026):** a rede `supabase_default` foi movida para `192.168.200.0/24` e o container `supabase-kong` responde em `192.168.200.11:8000`. Se o `.env` ainda apontar para IPs antigos, o app não consegue falar com o banco local.

### Supabase
- **Migração para self-hosted em andamento.** A rede Docker foi fixada em `192.168.200.0/24` e o Supabase local está respondendo em `192.168.200.11:8000`.
- O `.env` do servidor deve apontar para o Supabase local (`192.168.200.11:8000`), não para o Cloud. Ver documento-mãe `mem://features/migracao-supabase-servidor.md`.
- Cloud ainda existe como backup/código-fonte, mas os dados operacionais devem ir todo para o servidor local.

### Pendências reais (não bloqueiam operação)
- LOVABLE_API_KEY e SERVICE_ROLE_KEY conferir se estão no `.env` do servidor (IA/OCR/admin).
- Trocar `bun run dev` por build de produção (`bun run build` + serve) quando quiser performance.
- Configurar HTTPS/domínio interno se quiserem tirar do IP puro.
- **BLOQUEIO JURÍDICO ainda em aberto** — ver `mem://features/sigmo-propriedade-licenciamento.md` (contrato de licenciamento com DMN não assinado; SIGMO segue sendo do Fabiano por lei).

Comunicação: PT-BR informal, explicar termo técnico simples — user não é dev.
