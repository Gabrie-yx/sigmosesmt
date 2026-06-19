# Inspeção de Extintor por Foto com IA

Fluxo guiado de 2-3 fotos → IA (Lovable AI / Gemini) extrai dados → TST/usuário revisa → salva inspeção + evidências.

## Fluxo do usuário

1. Na tela `/app/extintores`, botão novo **"Inspeção por foto"** (também acessível dentro do detalhe de um extintor existente, pré-vinculado).
2. Modal/página guiada em 3 passos:
   - **Foto 1 — Etiqueta/corpo** (obrigatória): captura marca, tipo (ABC/BC/CO₂/K), capacidade, fabricante, data de fabricação, validade, nº de patrimônio (se legível).
   - **Foto 2 — Manômetro** (obrigatória): lê pressão (verde/vermelho/amarelo) → status carga OK / descarregado / sobrecarga.
   - **Foto 3 — Lacre/contexto** (opcional): lacre íntegro, mangueira, sinalização, obstrução.
3. Captura GPS automática do celular (`navigator.geolocation`) + campo livre "Localização descritiva".
4. IA processa as fotos → devolve laudo estruturado (JSON).
5. Tela de revisão: TST/usuário confere cada campo (editável), marca conformidades/não conformidades, assina (assinatura desenhada — reaproveita componente já existente).
6. Salvar → cria registro em `extintor_inspecoes_fotos` + fotos no Storage + atualiza `extintores` (próxima inspeção, status) se vinculado.

## Banco (migração)

Bucket privado `extintores-inspecoes`.

Tabela `extintor_inspecoes_fotos`:
- `extintor_id` (FK opcional — pode ser inspeção avulsa antes de cadastrar)
- `inspecionado_por` (uuid do usuário), `inspecionado_em`
- `foto_etiqueta_path`, `foto_manometro_path`, `foto_lacre_path`
- `gps_lat`, `gps_lng`, `gps_accuracy`, `localizacao_descritiva`
- `laudo_ia` (jsonb — saída bruta da IA)
- `laudo_revisado` (jsonb — versão editada pelo TST)
- `confianca_ia` (numeric 0-1)
- `status_geral` (`conforme` / `nao_conforme` / `pendente_revisao`)
- `nao_conformidades` (text[])
- `assinatura_path` (svg/png da assinatura)
- `assinado_por_nome`, `assinado_por_cargo`
- `observacoes`

RLS: SELECT/INSERT para `authenticated` (qualquer perfil pode inspecionar, conforme combinado); UPDATE/DELETE só admin/TST.
GRANTs explícitos + trigger `updated_at`.

Policies do bucket: INSERT/SELECT para authenticated nas próprias inspeções; DELETE só admin.

## Backend (server function)

`src/lib/extintor-inspecao.functions.ts` com `analisarFotosExtintor`:
- Recebe URLs assinadas das 3 fotos (já no bucket).
- Chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com prompt multimodal + structured output (Zod schema).
- Schema de saída: `{ marca, tipo, capacidade_kg, fabricante, data_fabricacao, validade, num_patrimonio, pressao_manometro, lacre_integro, mangueira_ok, sinalizacao_ok, obstrucao, qualidade_foto, confianca, nao_conformidades[], observacoes }`.
- Retorna o JSON + score de confiança.

`salvarInspecao` com `requireSupabaseAuth`: persiste registro + atualiza extintor vinculado.

## Frontend

- `src/routes/_authenticated/app/extintores.inspecao-foto.tsx` (rota nova) — wizard de 3 passos.
- Componente `FotoCapture` reutilizável (input file com `capture="environment"` para celular + preview + retake).
- Componente `RevisaoLaudo` — formulário pré-preenchido pela IA, com badge de confiança por campo.
- Reaproveita componente de assinatura existente (`assinaturas_salvas`).
- Botão "Inspeção por foto" no header de `/app/extintores`.
- Aba "Histórico de inspeções com foto" no detalhe do extintor.

## Notas técnicas

- GPS: `navigator.geolocation.getCurrentPosition` com fallback gracioso (sem GPS → continua, só marca campo vazio).
- Compressão de imagem client-side antes do upload (máx 1600px lado maior, JPEG 0.85) — economiza storage e acelera IA.
- Upload direto ao Storage com signed upload URL.
- Modelo IA: `google/gemini-3-flash-preview` (multimodal, rápido, barato). Se confiança < 0.7 → força revisão obrigatória com aviso amarelo.
- Tratamento de erros do gateway (429 / 402) com mensagens claras na UI.
