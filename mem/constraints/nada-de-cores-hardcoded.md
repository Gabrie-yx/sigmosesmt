---
name: Nunca hardcode cores claras/escuras contra o tema escuro
description: Todo app escuro SEMPRE em tokens semânticos. Proibido bg-white, text-slate-*, text-black, bg-red-50 em overlays/telas/modais. Usuário proibiu repetir.
type: constraint
---

## Proibido em telas, cards, overlays e modais sobre tema escuro
- `bg-white`, `bg-slate-*`, `bg-red-50`, `bg-rose-50`, `bg-amber-50`, `bg-emerald-50`
- `text-slate-*`, `text-gray-*`, `text-zinc-*`, `text-neutral-*`, `text-rose-*`, `text-black`
- `border-slate-*`, `border-red-200/300`, `border-rose-*`
- Botões/modal de exclusão com rosa/rose hardcoded ou contraste baixo

## Obrigatório
- Fundo: `bg-popover`, `bg-card`, `bg-background`, `bg-muted`
- Texto: `text-foreground`, `text-popover-foreground`, `text-muted-foreground`
- Borda: `border-border`, `border-input`
- Hover: `hover:bg-accent hover:text-accent-foreground`
- Badge vermelha dark: `bg-red-500/15 text-red-200 border-red-500/40`
- Botão vermelho sólido: `bg-red-700 hover:bg-red-800 text-white`

## Por que
SIGMO tem tema escuro (vermelho/vinho). Texto escuro em fundo escuro e cards claros remendados ficam ilegíveis. **Revisar contraste de autocomplete/lookup/drawer/modal/tela antes de finalizar.**
