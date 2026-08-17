---
name: Projeto "ESO killer" — SaaS de SST multiempresa
description: Ideia do usuário de criar do zero um concorrente do ESO (PGR/PCMSO/LTCAT/LIP multiempresa) com modelo de créditos pré-pagos. Em avaliação, nada codado.
type: feature
---
**Origem:** consultor que faz GRO do estaleiro (grupo Atem) usa ESO por R$ 1.000/mês. Usuário quer replicar melhor, aproveitando vivência de chão de fábrica (estaleiro/construção civil).

**Ideia extra:** área de créditos pré-pagos (ex.: 150 créditos = X horas de acesso) para o cliente montar o próprio PGR/PCMSO/LIP/LTCAT.

**Decisão atual:** só discussão. Não iniciar projeto novo do zero — avaliar extrair o motor documental do SIGMO para produto multi-tenant (ver mem://features/multi-tenant-futuro).

**Riscos levantados (não resolvidos):**
1. Multi-tenant real (tenant_id em ~170 tabelas + RLS) é pré-requisito, não detalhe.
2. Responsabilidade técnica: PGR/PCMSO/LTCAT precisam de ART/assinatura de profissional habilitado (eng. seg / médico do trabalho). SaaS "self-service" sem profissional = risco legal.
3. eSocial (S-2210/2220/2240) é o fosso competitivo do ESO — sem isso não substitui.
4. LGPD dado sensível de saúde: prontuário e ASO exigem RLS separada do RBAC do TST.
5. Modelo de crédito por hora atrita com uso real (documento vive o ano todo) — assinatura por vidas/CNPJ é o padrão de mercado.
6. Suporte/onboarding é o custo escondido: clínica não migra sem importador de base.
