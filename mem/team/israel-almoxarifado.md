---
name: Israel - Almoxarifado
description: Israel é o responsável pelo almoxarifado no pátio do estaleiro; valida fatores de consumo (SOLDA/GÁS/TINTA) e tem acesso liberado a /app/producao/fatores-consumo.
type: reference
---
Israel trabalha direto no pátio do estaleiro recebendo material e acompanhando o consumo real por casco.

**Papel no SIGMO:**
- Acesso liberado a `/app/producao/fatores-consumo`.
- Valida/ajusta os fatores históricos calculados automaticamente (SOLDA ~20,42 kg/ton, GÁS ~16,60 kg/ton, TINTA ~0,17 gal/ton para BALSA GRANELEIRA).
- Usa observação/justificativa e trava (🔒) quando o valor já foi validado em campo.
- Histórico de alterações registra cada mudança dele para auditoria ISO 9001.

Sempre que falar de fatores de consumo ou validação de consumíveis no pátio, referenciar pelo nome.