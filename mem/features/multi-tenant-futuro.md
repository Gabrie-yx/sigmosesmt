---
name: Multi-tenant SIGMO (futuro)
description: Plano/decisão de transformar SIGMO em multi-tenant quando outras empresas do Grupo Atem quiserem usar. Não fazer agora — só quando houver demanda concreta fechada.
type: feature
---
**Contexto:** SIGMO está sendo hospedado no servidor da refinaria REAN (Grupo Atem). Outras empresas do grupo (Atem tem várias — pesquisar na internet) já estão cogitando usar. Chico não esperava esse crescimento.

**Decisão atual:** NÃO implementar multi-tenant agora. Aguardar demanda concreta (primeira empresa do grupo pedindo acesso oficial).

**Quando for hora, opção escolhida = A (Multi-tenant real):**
- Cada empresa = tenant isolado, dados invisíveis entre si.
- Modelo: SaaS interno do Grupo Atem.

**Escopo técnico (pra lembrar quando retomar):**
1. Adicionar `tenant_id` em ~170 tabelas do schema public + reescrever TODAS as RLS pra filtrar por tenant. Vazamento = LGPD/processo.
2. Catálogos (CBO, NRs, riscos, EPIs, exames) = compartilhados globalmente + overrides por tenant.
3. Storage: reorganizar buckets em pastas `tenant_id/...` + RLS de storage.
4. Login/seleção de tenant: decidir entre subdomínio (`dmn.sigmo...`, `envicorp.sigmo...`), seletor pós-login, ou 1 tenant por usuário.
5. Tela de super-admin (só Chico) pra criar/suspender/monitorar tenants.
6. Migração dos dados atuais: marcar tudo com `tenant_id = 'dmn'`.
7. Custo estimado: 3-4 semanas de trabalho focado + atenção contínua em toda feature nova.

**Enquanto isso:** se precisar demonstrar SIGMO limpo pra alguém do grupo, usar Opção C (botão reset/sandbox) — não parte pra multi-tenant "por precaução".

**Gatilho pra retomar:** primeira empresa do grupo (Envicorp, refinaria, outra) fechar acesso oficial ou Chico decidir licenciar formalmente.