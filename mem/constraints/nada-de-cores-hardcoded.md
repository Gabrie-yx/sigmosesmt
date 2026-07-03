---
name: Nunca hardcode cores claras em cima do tema escuro
description: Overlays (popover/drawer/dropdown/lookup) SEMPRE em tokens semânticos. Proibido bg-white, text-slate-*, bg-red-50 em overlays. Usuário reclamou 3+ vezes.
type: constraint
---

## Proibido em overlays sobre tema escuro
- `bg-white`, `bg-slate-*`, `bg-red-50`, `bg-amber-50`, `bg-emerald-50`
- `text-slate-800/700/600/500/400`, `text-black`
- `border-slate-*`, `border-red-200/300`

## Obrigatório
- Fundo: `bg-popover`, `bg-card`, `bg-background`, `bg-muted`
- Texto: `text-foreground`, `text-popover-foreground`, `text-muted-foreground`
- Borda: `border-border`, `border-input`
- Hover: `hover:bg-accent hover:text-accent-foreground`
- Badge vermelha dark: `bg-red-500/15 text-red-200 border-red-500/40`
- Botão vermelho sólido: `bg-red-700 hover:bg-red-800 text-white`

## Por que
SIGMO tem tema escuro (vermelho/vinho). Combinações claras ficam ilegíveis. **Revisar autocomplete/lookup/drawer novos antes de finalizar.**
