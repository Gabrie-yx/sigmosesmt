---
name: SIGMO multissegmento (nuvem) — decisões 19/09/2026
description: Plano de transformar o SIGMO da nuvem em sistema SESMT multissegmento; servidor DMN congelado. Decisões tomadas e pendências.
type: feature
---

## Regra de ouro
Servidor DMN = **congelado**. Todos os módulos atuais, cascos e paleta atual permanecem lá.
Toda mudança desta reforma vale **somente na nuvem**, controlada por perfil de ambiente
(mesma mecânica do `IS_BACKEND_LOCAL` usado na identidade visual; `.env.local` do servidor
aponta para 192.168.200.11:8000 e o deploy nunca sobrescreve esse arquivo).

## Decidido
- Nuvem remove os módulos: Produção, Compras, Administrativo, Almoxarifado, Portaria, Cozinha.
- Cascos/Embarcações: **removido permanentemente** da nuvem (com a lógica dependente).
- Ramo de atividade: definido **por empresa cadastrada** (vários ramos no mesmo SIGMO).
- Dados da nuvem: excluir a empresa DMN e qualquer referência (nomes, funcionários, APRs).
  Criar uma empresa fictícia nova, **não naval**, com CNPJ/CNAE completos e 30 funcionários com cargos.
- Ordem de trabalho: **visual primeiro** (paleta/identidade), depois menus, depois lógica multissegmento.

## Arquitetura multissegmento (3 camadas)
1. **Ramo da empresa** → define catálogo inicial: riscos, NRs aplicáveis, EPIs, exames, treinamentos.
2. **Vocabulário configurável** → "Casco" vira cadastro neutro de Local/Área renomeável por empresa
   (Loja, Pista, Obra, Planta, Frota).
3. **Núcleo fixo** (não muda por ramo): funcionários, cargos, PGR, APR, PT, DDS, ASO, EPI,
   treinamentos, incidentes, plano de ação, indicadores.

## Pendências
- Usuário vai enviar logotipo com a paleta de cores de referência (não chegou ainda).
- Definir o substituto de Cascos em APR/PT/inspeções (sugestão do agente: cadastro neutro de Locais/Áreas).
