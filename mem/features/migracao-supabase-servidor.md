---
name: Migração Supabase FRANK → servidor DMN
description: Status da migração do banco SIGMO do Supabase Cloud para o Supabase self-hosted no servidor DMN. Pausada, retomada, fases e bloqueios.
type: feature
---

**STATUS: PAUSADA em 28/07/2026.**

### Contexto
- Banco Cloud: projeto `mokuitocaihpgtlglrtg` (Supabase FRANK).
- Servidor local: `dmnsgm0001`, Supabase self-hosted via Docker Compose.
- Rede Docker: `supabase_default` migrada para `192.168.200.0/24` (gateway `192.168.200.1`).
- Container `supabase-kong`: `192.168.200.5:8000` (porta 8000 exposta para o host).

### O que já foi feito
- Schema `public` criado no banco local (via migrations do repositório).
- Tabela `employees` carregada com 181 registros via dump parcial.
- Migração da Fase 0 do versionamento de OS aplicada (`pgr_versoes`, colunas de rastreabilidade em `oss_templates` e `oss_emissoes`).
- Código atualizado para priorizar variáveis de ambiente `.env` e cair no fallback Cloud apenas no preview Lovable.
- `vite.config.ts` e `docs/SERVIDOR-DMN.md` atualizados para a nova rede `192.168.200.0/24`.

### O que falta para o corte definitivo
- [ ] Concluir carga do dump completo (`sigmo_full.dump`) sem a tabela `audit_logs` (derruba conexão por SSL).
- [ ] Migrar buckets de Storage (`desligamento-pacotes`, assinaturas, anexos, ASO, etc.).
- [ ] Aplicar migrations pendentes do repositório no banco local após cada `git pull`.
- [ ] HTTPS via certificado CA interna (depende do TI da DMN).
- [ ] Verificar se todas as tabelas essenciais estão populadas e sem erros de referência.

### Bloqueios recentes
- Dump completo cai por SSL no pooler quando passa pela tabela `audit_logs` (muitos dados JSON).
- Solução em discussão: `--exclude-table=public.audit_logs` no `pg_dump` e migrar `audit_logs` separadamente em partes.

### Comandos de referência

Puxar dados do Cloud (sem `audit_logs`):
```bash
export PGPASSWORD='SENHA_AQUI'
pg_dump -h aws-0-sa-east-1.pooler.supabase.com -p 5432 -U postgres.mokuitocaihpgtlglrtg -d postgres --data-only --no-owner --no-privileges --disable-triggers --exclude-table=public.audit_logs -Fc -f /tmp/sigmo_full_no_audit.dump
```

Carregar no banco local:
```bash
# truncar schema public (CUIDADO)
sudo docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SET session_replication_role = replica;" -c "DO \$\$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END \$\$;"

# restaurar
sudo docker exec -i supabase-db pg_restore -U supabase_admin -d postgres --disable-triggers --data-only /tmp/sigmo_full_no_audit.dump
```

### Atenção
Enquanto a migração não for concluída, o app no servidor precisa apontar para a URL correta. Se apontar para a nuvem, o SIGMO do estaleiro e o da nuvem ficam sincronizados, o que pode causar confusão. A configuração correta está em `docs/SERVIDOR-DMN.md`.
