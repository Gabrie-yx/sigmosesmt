---
name: Scrollbar sempre glassmorph
description: Regra global — nunca usar scrollbar padrão; usar glassmorph fino com flares em todo o sistema
type: constraint
---
PROIBIDO usar scrollbar padrão do SO/browser em qualquer área rolável (vertical ou horizontal).

OBRIGATÓRIO: scrollbar fina (8px), estilo vidro/glassmorph, discreta, com flares (gradiente radial de luz nas bordas do thumb) e brilho no hover.

A regra está aplicada globalmente em `src/styles.css` via seletor `*::-webkit-scrollbar*` + `scrollbar-width: thin` + `scrollbar-color`. Não sobrescrever com `#cbd5e1`, `bg-gray-*` ou scrollbars grossas em componentes individuais.

**Why:** usuário reclamou repetidamente de scrollbars feias/grossas/cinza padrão. Identidade visual do SIGMO é glass escuro.

**How to apply:** ao criar áreas com overflow, não adicionar CSS de scrollbar customizado — o global já cobre. Se precisar variante, herdar do padrão glass e apenas ajustar largura/opacidade.