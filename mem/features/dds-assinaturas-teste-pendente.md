---
name: DDS Semanal assinaturas - teste E2E pendente
description: Toggle de assinatura digital implementado no DDS Semanal; falta validar E2E (auth externa bloqueia Playwright).
type: feature
---
Status: implementado, nao testado E2E.

- dds-formulario-semanal-dialog.tsx: seletor + EmployeeSignatureToggle para Encarregado e SESMT, puxando employees.assinatura_url.
- Demais docs ja usam assinatura do DB: Termo Perda EPI, Saida Expediente (toggle), Hora Extra Sabado (por linha), Ficha EPI, Convocacao ASO, Guia Encaminhamento, OSS.

Retomar:
1. Validacao manual: abrir DDS Semanal, escolher Encarregado, ligar toggle, conferir preview PNG, gerar PDF, checar estampa.
2. Ou auditar src/lib/dds-formulario-semanal-pdf.ts confirmando que signatureUrl chega e e desenhado.

Playwright bloqueado: LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged.
