# SIGMO 100% no servidor DMN (nuvem só para atualizar código)

## Regra de ouro
O app **nunca** deve falar com `*.supabase.co` em produção.
A única coisa que vem da nuvem é o **código** (`git pull`).

## 1. Arquivo `/home/sigmo/app/.env` (servidor)
```
VITE_SUPABASE_URL=http://192.168.200.5:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY do /opt/supabase/supabase/docker/.env>
VITE_SUPABASE_PROJECT_ID=sigmo-dmn

SUPABASE_URL=http://192.168.200.5:8000
SUPABASE_PUBLISHABLE_KEY=<mesma ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY do /opt/supabase/supabase/docker/.env>
```
Sem essas variáveis o app cai no fallback da nuvem e mostra aviso no console.

## 2. Checagem automática
```
cd /home/sigmo/app
bash scripts/dmn-check.sh
```
Falha se qualquer endpoint ainda apontar para `supabase.co`, se faltar variável
ou se o Supabase local não responder.

## 3. Fluxo de atualização (única dependência da nuvem)
```
cd /home/sigmo/app
git pull                 # código novo vindo do Lovable
bash scripts/dmn-check.sh   # confirma que continua local
pkill -f vite; sleep 2
nohup npm run dev > /tmp/sigmo.log 2>&1 &
```

## 4. O que ainda falta para o corte definitivo
- [ ] Concluir carga de dados do dump `sigmo_full.dump` (migração pausada)
- [ ] Migrar buckets de Storage (`desligamento-pacotes`, assinaturas, anexos)
- [ ] Aplicar as migrations do repositório no banco local
- [ ] HTTPS via certificado da CA interna (depende do TI)

## 5. Migrations no banco local
As migrations do repositório (`supabase/migrations/`) precisam ser aplicadas
no banco local após cada `git pull` que traga arquivos novos:
```
for f in supabase/migrations/*.sql; do
  sudo docker exec -i supabase-db psql -U supabase_admin -d postgres < "$f"
done
```
