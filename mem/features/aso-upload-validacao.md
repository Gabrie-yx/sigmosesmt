---
name: ASO upload validação
description: Decisão sobre validar conteúdo do PDF do ASO (hoje só confia em filename/MIME). Plano em 5 níveis; manter como está por enquanto, voltar quando priorizar conformidade.
type: feature
---
Hoje o upload do ASO NÃO valida conteúdo: confia no botão "Anexar ASO" + extensão/MIME. Buraco real de conformidade NR-7/ISO 45001 (qualquer PDF renomeado fecha a convocação).

Plano em camadas (do barato ao robusto):
1. Validação básica: assinatura %PDF, tamanho mín >30KB, texto extraível.
2. OCR + keywords: "ASO", "Atestado de Saúde Ocupacional", "Apto", CPF, CRM.
3. Extração estruturada via Lovable AI Gateway: JSON {médico, CRM, data, tipo, apto, riscos} e CRUZAR com convocação (CPF/tipo/data).
4. Dupla checagem humana: PENDENTE_VALIDACAO antes de fechar convocação.
5. Integração SOC/eSocial S-2220.

Decisão atual (jun/2026): MANTER COMO ESTÁ. Retomar quando priorizar Nível 1 + Nível 3.