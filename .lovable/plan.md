# Overlay universal para Templates Homologados

## Situação atual (raio-x que você não vê)

No painel de Templates de Documentos hoje existem **17 códigos cadastrados**, mas só **2 têm PDF de fato subido**:

| Código | Nome cadastrado | PDF subido? | Overlay hoje |
|---|---|---|---|
| FORCP-GP-16 | Avaliação de Reação | ✅ | ✅ (já feito) |
| FOR-SEG-02 | Ficha de Entrega de EPI *(arquivo subido chama "LISTA DE PRESENÇA.pdf" — divergência)* | ✅ | ❌ |
| FOR-SEG-01, 03…15, FORCP-GP-12 | 15 outros | ❌ (sem arquivo) | ❌ |

Ou seja: **não dá pra "aplicar overlay em todos" hoje**, porque 15 templates não têm PDF-mãe pra sobrepor. Overlay exige o PDF homologado como base.

## O que eu vou fazer agora

### 1. Motor genérico de overlay (uma vez só)

Extrair a lógica que já funciona no `reacao-treinamento-pdf.ts` pra um utilitário reutilizável `src/lib/pdf-overlay-engine.ts`:

- `renderOverlay(codigoTemplate, campos, checkboxes, opts)` → baixa o PDF ativo do template pelo código, desenha campos nas coordenadas mapeadas, devolve `Uint8Array`.
- Cache do PDF-base por sessão (já existe pra reação, generalizo).
- Registro central de mapeamentos em `src/lib/pdf-overlay-maps.ts` — um objeto por código:
  ```ts
  export const OVERLAY_MAPS = {
    "FORCP-GP-16": { fields: {...}, checkboxes: {...} },
    "FOR-SEG-02":  { fields: {...}, rows: {...} },  // quando o PDF certo for subido
  }
  ```
- Refatorar `reacao-treinamento-pdf.ts` pra consumir o motor (mantendo assinatura pública, zero regressão no dialog atual).

### 2. Migrar Lista de Presença (FOR-SEG-06) e Ficha EPI (FOR-SEG-02) *quando o PDF estiver subido corretamente*

Hoje o FOR-SEG-02 tem um arquivo com nome divergente do cadastro. Vou:
- Deixar o motor pronto e o slot registrado.
- Marcar no painel de templates um alerta visual "PDF ausente / divergente" nos códigos sem arquivo homologado, pra você saber exatamente o que subir.

### 3. Não vou tocar

- Módulos com PDF gerado do zero (APR, OSS, PPP, NC, Rescisão, Hora Extra, etc.) — nenhum deles tem template homologado subido. Se você subir o PDF-mãe deles no painel, eu mapeio as coordenadas depois.

## O que fica dependendo de você

Pra eu realmente aplicar overlay em mais documentos, preciso que você suba o PDF-mãe homologado de cada código no painel de Templates. Assim que o arquivo estiver lá, eu adiciono o mapeamento de coordenadas no `OVERLAY_MAPS` — sem precisar mexer no motor.

## Entrega desta rodada

1. `pdf-overlay-engine.ts` (motor genérico).
2. `pdf-overlay-maps.ts` (registro central, começando com FORCP-GP-16).
3. `reacao-treinamento-pdf.ts` refatorado pra usar o motor (comportamento idêntico).
4. Painel de Templates: badge "sem PDF" / "overlay ativo" por linha, pra você enxergar o status de cada um.

Assim que aprovar, eu executo.
