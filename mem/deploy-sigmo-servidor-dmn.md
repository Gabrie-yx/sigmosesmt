---
name: Deploy SIGMO servidor DMN (pausado)
description: Plano completo de deploy do SIGMO + Supabase self-hosted no servidor Ubuntu 24.04 da DMN via SSH/VPN. Pausado até o usuário chamar.
type: feature
---
Status: PAUSADO — retomar quando usuário pedir. Apelido curto: **"Supa no servidor"**.

### Onde paramos (2026-07-11)
- SSH funcionando: `ssh fbalmeida@sigmo.dmnestaleiro.com.br` (via VPN DMN).
- Host: dmnsgm0001, Ubuntu 24.04.4 LTS.
- Specs OK: 8 vCPU Xeon Gold 5318Y, 15Gi RAM, 946Gi livres em /, Docker 29.6.1 + Compose v5.3.1.
- Sem PostgreSQL nativo. Portas 3000/5432/8000/8443/4000/5000/9999/54321/54322 todas livres.
- User `fbalmeida` já no grupo `docker` (precisa logout/login pra valer — `docker ps` sem sudo confirmado após relogin).

### Próximo passo quando retomar
1. `cd ~ && git clone --depth 1 https://github.com/supabase/supabase && cd supabase/docker && cp .env.example .env`
2. Gerar 7 senhas com openssl (POSTGRES_PASSWORD, JWT_SECRET, DASHBOARD_PASSWORD, SECRET_KEY_BASE, VAULT_ENC_KEY, LOGFLARE_API_KEY, LOGFLARE_LOGGER_BACKEND_API_KEY) — salvar em local seguro.
3. Gerar ANON_KEY + SERVICE_ROLE_KEY (JWTs derivados do JWT_SECRET) via https://supabase.com/docs/guides/self-hosting/docker
4. Editar .env com as 9 chaves.
5. `docker compose up -d` → Studio em http://<IP-interno>:8000
6. Migrar schema + dados do Supabase Cloud (mokuitocaihpgtlglrtg) → self-hosted.
7. Apontar SIGMO pro novo endpoint.

### Pendências abertas
- Decidir email auth: SMTP DMN / Lovable Email / desabilitar (rec: começar desabilitado).
- Decidir IA: manter Lovable AI Gateway (rec) ou chave própria.
- Backup do Supabase Cloud antes de migrar dados.

Comunicação: PT-BR informal, explicar termo técnico em linguagem simples — user não é dev.