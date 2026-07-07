## Contexto que já temos

- **Servidor:** Ubuntu Server 24.04 LTS, 8 vCPUs, 32 GB RAM, 1 TB SSD NVMe + 1 TB backup, 1 Gbps interna (a config que definimos com o TI).
- **Acesso:** VPN/rede interna DMN (Starlink não enxerga — precisa estar na rede da empresa).
- **Escopo:** SIGMO (app TanStack Start) + Supabase self-hosted (banco, auth, storage, studio) TUDO no mesmo servidor.
- **Sem domínio público** por enquanto — vamos usar IP interno + porta. Se depois quiser `sigmo.dmn.local`, é só o TI apontar no DNS interno.

## Divisão de responsabilidades (importante!)

**TI faz** (você só valida que foi feito):
1. Confirmar que Docker + Docker Compose estão instalados no servidor (ou instalar).
2. Configurar firewall interno pra liberar as portas 80, 443, 3000, 8000, 22 só pra rede DMN/VPN.
3. Configurar backup automático da pasta do Supabase pro disco de 1TB de backup.

**Você (com meu apoio linha por linha)**:
1. Clonar o Supabase self-hosted e subir os containers.
2. Migrar o banco atual (Supabase Cloud → self-hosted).
3. Clonar o SIGMO do GitHub e buildar.
4. Subir o SIGMO com PM2 (roda 24/7, reinicia sozinho).
5. Testar tudo pela VPN.

---

## Fase 0 — Pré-requisitos (peça pro TI antes de começar)

Envie esse checklist pro TI:

```text
Preciso confirmar no servidor SIGMO:
1. Docker Engine instalado e ativo (docker --version)
2. Docker Compose v2 instalado (docker compose version)
3. Git instalado (git --version)
4. Node.js 20 LTS + Bun instalados
5. Firewall UFW liberando apenas rede interna nas portas:
   - 22 (SSH — só admin)
   - 3000 (SIGMO web)
   - 8000 (Supabase Studio — painel admin)
   - 5432 (Postgres — só se precisar acessar direto)
6. Usuário 'sigmo' criado com permissão de rodar Docker (grupo docker)
7. Pasta /opt/sigmo criada com dono sigmo:sigmo
8. Backup diário da pasta /opt/sigmo/supabase/volumes pro disco de 1TB
```

Só siga adiante quando TI responder "tudo pronto".

---

## Fase 1 — Subir Supabase self-hosted (banco + auth + storage)

Passos que você roda via SSH, na ordem exata. **Vou te acompanhar em cada um** — cola o output aqui se der erro.

```text
Passo 1.1 — Entrar no servidor
  ssh sigmo@<IP-do-servidor>

Passo 1.2 — Ir pra pasta base
  cd /opt/sigmo

Passo 1.3 — Clonar o Supabase oficial
  git clone --depth 1 https://github.com/supabase/supabase
  cd supabase/docker
  cp .env.example .env

Passo 1.4 — Gerar chaves seguras (te mando os comandos exatos)
  openssl rand -hex 32  # POSTGRES_PASSWORD
  openssl rand -hex 32  # JWT_SECRET
  openssl rand -hex 32  # DASHBOARD_PASSWORD
  # Anon key e service key: geramos com script que te passo

Passo 1.5 — Editar .env com os valores gerados
  nano .env
  # Vou te mandar exatamente o que trocar

Passo 1.6 — Subir os containers
  docker compose pull
  docker compose up -d

Passo 1.7 — Verificar que subiu
  docker compose ps  # todos "healthy"
  curl http://localhost:8000  # Studio respondendo

Passo 1.8 — Acessar Studio pela VPN
  http://<IP-do-servidor>:8000
  Login: supabase / <DASHBOARD_PASSWORD>
```

---

## Fase 2 — Migrar dados do Supabase Cloud pro self-hosted

O banco atual tá na Supabase Cloud (`mokuitocaihpgtlglrtg`). Vamos exportar tudo e importar no novo.

```text
Passo 2.1 — Dump do banco atual (rodo eu daqui, te mando o arquivo .sql)
  pg_dump ...

Passo 2.2 — Copiar o .sql pro servidor
  scp backup.sql sigmo@<IP>:/opt/sigmo/

Passo 2.3 — Restaurar no Supabase self-hosted
  docker exec -i supabase-db psql -U postgres < backup.sql

Passo 2.4 — Migrar Storage (fotos assinatura, PDFs, etc.)
  # Script que te passo baixa tudo do Storage Cloud e sobe no self-hosted

Passo 2.5 — Validar no Studio novo
  # Ver se todas as tabelas, RLS, functions, triggers vieram
```

---

## Fase 3 — Subir o SIGMO (app)

```text
Passo 3.1 — Clonar o repo do GitHub
  cd /opt/sigmo
  git clone <URL-do-repo-lovable> app
  cd app

Passo 3.2 — Criar .env apontando pro Supabase local
  VITE_SUPABASE_URL=http://<IP-servidor>:8000
  VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key-gerada-na-fase-1>
  SUPABASE_URL=http://supabase-kong:8000  # interno docker
  SUPABASE_SERVICE_ROLE_KEY=<service-key-gerada-na-fase-1>
  # ... resto das variáveis

Passo 3.3 — Instalar dependências
  bun install

Passo 3.4 — Buildar pra produção
  bun run build

Passo 3.5 — Instalar PM2 (mantém o app rodando 24/7)
  sudo npm install -g pm2

Passo 3.6 — Subir o SIGMO
  pm2 start .output/server/index.mjs --name sigmo -i 4
  pm2 save
  pm2 startup  # inicia junto com o servidor
```

---

## Fase 4 — Acesso e teste

```text
Passo 4.1 — Testar acesso do teu PC (dentro da VPN DMN)
  http://<IP-servidor>:3000       → SIGMO
  http://<IP-servidor>:8000       → Supabase Studio

Passo 4.2 — Testar login com um usuário conhecido
Passo 4.3 — Testar uma rotina real (criar ASO, DDS, etc.)
Passo 4.4 — Confirmar que pg_cron continua rodando os gatilhos automáticos
```

---

## Fase 5 — Depois (não bloqueia o go-live)

- **Domínio interno bonito**: pedir pro TI apontar `sigmo.dmn.local` → IP do servidor.
- **HTTPS interno**: gerar certificado autoassinado ou usar Certificado da própria DMN.
- **Backup automatizado**: cron diário do `pg_dump` pro disco de 1TB (te passo o script).
- **Monitoramento**: PM2 já tem `pm2 monit`; posso ajudar a plugar num Uptime Kuma se quiser.

---

## Riscos que preciso te avisar antes

1. **Supabase self-hosted é MUITO mais trabalhoso** que o gerenciado — se um serviço cair de madrugada, alguém tem que reiniciar. Sem SLA da Supabase.
2. **Extensões `pg_cron`, `pg_net`, `vault`**: o SIGMO usa. Já vêm no Supabase self-hosted mas precisam ser habilitadas manualmente após restore. Vou te passar os comandos.
3. **Emails de auth** (recuperar senha, confirmar email): Supabase self-hosted vem com SMTP DUMMY. Ou (a) integramos SMTP da DMN, (b) mantemos Lovable Email, (c) deixamos sem confirmação por email. Precisa decidir.
4. **Google OAuth do Lovable broker**: NÃO funciona no self-hosted. Login via Google, se usarem, precisa ser reconfigurado com credenciais próprias no Google Cloud Console (te acompanho).
5. **Lovable AI Gateway** (chats do SIGMO, extração OCR, etc.): as chaves são gerenciadas pela Lovable. No self-hosted, ou (a) você paga uma OpenAI/Google Gemini direto e troca as chamadas, (b) mantém o gateway apontando pra nuvem enquanto o resto fica local. Precisa decidir.

---

## O que eu preciso que você me confirme antes de rodar a Fase 1

1. **TI já instalou Docker + Bun + criou usuário `sigmo`?** (item 0)
2. **IP interno do servidor** e teu usuário SSH (só o IP, sem senha).
3. **Decisão de email**: SMTP da DMN, Lovable Email, ou sem confirmação de email por enquanto?
4. **Decisão de IA**: mantém Lovable AI Gateway (rede sai pra internet) ou vamos trocar por chave própria?

Com isso na mão, a gente vai fase por fase, comando por comando, sem pressa. Fecha?
