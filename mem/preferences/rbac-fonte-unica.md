---
name: RBAC com fonte única
description: Requisito para nunca exibir módulos/papéis na tela se backend e banco não aceitarem o mesmo valor.
type: preference
---
Toda alteração de módulo, papel, menu ou convite de usuário deve manter uma fonte única de verdade para UI, validação server-side e regras do banco. Nunca deixar a tela oferecer uma opção que `users.functions`, enum/funções do Supabase ou guardas de rota não aceitem.

**Why:** O usuário já reportou recorrência de opção aparecendo na tela e falhando no convite por validação divergente.

**How to apply:** Ao introduzir módulo/papel novo, revisar juntos: catálogo/menu, access-control, server functions, enum/funções/policies do Supabase e guards/sidebar.