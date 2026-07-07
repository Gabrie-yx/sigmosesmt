---
name: Deploy SIGMO servidor DMN (pausado)
description: Plano completo de deploy do SIGMO + Supabase self-hosted no servidor Ubuntu 24.04 da DMN via SSH/VPN. Pausado até o usuário chamar.
type: feature
---
Status: PAUSADO — retomar só quando o usuário pedir.

Plano detalhado vive em `.lovable/plan.md` (5 fases: pré-req TI, Supabase self-hosted, migração dados, subir SIGMO com PM2, teste via VPN).

Contexto:
- Servidor Ubuntu 24.04, 8 vCPU/32GB/1TB NVMe + 1TB backup, acesso via VPN DMN (Starlink não enxerga).
- TI entregou servidor virgem; falta instalar Docker/Bun/usuário sigmo/firewall.
- Última entrega: passo a passo detalhado de instalação do Docker no Ubuntu 24.04.

Pendências antes de retomar Fase 1:
1. TI rodar checklist Fase 0 (Docker, Compose, Git, Node20, Bun, user sigmo, UFW 22/3000/8000).
2. Usuário informar IP interno + user SSH.
3. Decidir email auth: SMTP DMN / Lovable Email / desabilitar (recomendado começar desabilitado).
4. Decidir IA: manter Lovable AI Gateway (recomendado) ou chave própria OpenAI/Gemini.

Comunicação: PT-BR informal, explicar cada termo técnico em linguagem simples — usuário não é dev.