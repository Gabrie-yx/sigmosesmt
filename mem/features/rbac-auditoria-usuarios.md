---
name: Auditoria RBAC e reestruturação de usuários
description: Levantamento 03/07/2026 dos usuários ativos e proposta de reestruturação de papéis/módulos/segregação por empresa. Aguardando decisões do usuário antes de codar.
type: feature
---

## Situação em 03/07/2026

### Usuários com login ativo (5)
| Nome | Email | Roles | Módulos | Último acesso |
|---|---|---|---|---|
| Francisco Bandeira | fbandeira.br@gmail.com | admin | (bypass) | 27/06 |
| Israel Uchôa | uchoaisrael23@gmail.com | editor | estoque, producao | 24/06 |
| Anderson Soares | anderson.soares@grupoatem.com.br | **admin** | producao, manutencao | 23/06 |
| Frank Almeida | ilhamontrichard@gmail.com | admin | (bypass) | 09/06 |
| Gabriel Almeida | gabriel.a.almeida.br@gmail.com | admin | (bypass) | 08/05 |

### Convites pendentes: 12
### Profiles órfãos (sem auth.users): 13 — lixo a limpar

## Problemas críticos
1. **4 de 5 = admin** — admin ignora `hasModule`/`hasMenu`, RLS via `has_role('admin')`, e ainda destrava MFA se `requiresMfa` só olha admin/moderador.
2. **Anderson (Supervisor Geral) é admin** — deveria ser role própria `supervisor_geral` com escopo estrito (aprovar RC + ver produção/manutenção). Hoje ele enxerga folha, ASO, salário-base implícito etc.
3. **Sem role para TST, Medicina, RH, Portaria, Almoxarife** — tudo cai em `editor` genérico ou `admin`.
4. **Sem segregação por empresa** (DMN, Atem, contratadas) — qualquer editor vê funcionário de qualquer contratada.
5. **Sem trilha "quem acessou o quê"** além do `audit_logs` de escrita.
6. **Sem expiração de sessão / rotação de senha / política mínima**.
7. **Convites de 12 pessoas parados** — precisa decidir quem entra, com qual papel.

## Proposta em debate (não implementar sem OK)
- Reduzir admins reais para 2 (Francisco + Frank como break-glass).
- Criar roles: `supervisor_geral`, `tst`, `medicina`, `rh`, `almoxarife`, `portaria`, `compras`, `producao_pcp`, `manutencao`, `viewer`.
- Matriz `role → módulos → menus` fixa (herança) e permitir override fino só por admin.
- MFA obrigatório para: admin, supervisor_geral, rh, medicina, compras.
- Segregação por empresa: coluna `allowed_company_ids uuid[]` em profiles + policies filtrando `employees.company_id = any(...)`.
- Job diário de limpeza de profiles órfãos.
- Tela "Minha Sessão" mostrando último login, IP e dispositivos.
- Botão "Revogar acesso" com invalidação imediata da sessão.

## Aguardando decisão
- Frank e Gabriel continuam admin ou viram viewer?
- Anderson vira `supervisor_geral` puro (sem admin)?
- Segregar por empresa é prioridade agora ou fase 2?
- MFA obrigatório para quais roles exatas?