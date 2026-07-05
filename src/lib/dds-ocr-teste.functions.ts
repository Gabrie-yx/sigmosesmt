import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  fileBase64: z.string().min(100),
  mime: z.string().min(3).max(64),
  expectedMarkers: z.array(z.string()).min(1).max(200),
  rows: z.number().int().min(1).max(30).optional(),
  model: z.string().optional(),
});

type MarkerResult = {
  id: string;
  filled: boolean;
  confidence: number;
  notes?: string;
};

export const analisarMarcadoresOCR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY não configurada", markers: [] as MarkerResult[] };
    }

    const rows = data.rows ?? 12;
    const modelId = data.model || "google/gemini-2.5-pro";

    const systemPrompt = `Você é um analisador visual de fichas semanais de DDS (Diálogo Diário de Segurança), modelo FOR-SEG-06.

LAYOUT DO DOCUMENTO (fixo):
- Cabeçalho no topo (com logo, título e metadados). IGNORE o cabeçalho.
- Uma TABELA principal com ${rows} linhas de funcionários (L01 a L${String(rows).padStart(2, "0")}).
- Para cada linha há 6 colunas de dias úteis, nesta ordem exata da esquerda para a direita: SEG, TER, QUA, QUI, SEX, SAB.
- Em cada célula (linha × dia) existe UM pequeno quadrado com borda preta fina no canto DIREITO da célula, alinhado à assinatura do funcionário. A célula inteira também pode conter uma assinatura manuscrita à esquerda desse quadrado.
- Ao final do documento existem 3 quadrados isolados de assinatura de responsáveis: SIG-ENC (Encarregado), SIG-SES (SESMT), SIG-GER (Gerência).

COMO DECIDIR "filled":
- filled=true SOMENTE quando o QUADRADO em si contém marca visível (X, traço, rabisco, pintura, tinta, carimbo, ou está totalmente escurecido).
- filled=true também quando uma ASSINATURA claramente invade e cobre o interior do quadrado.
- filled=false quando o quadrado está limpo/branco por dentro, MESMO QUE exista uma assinatura na mesma linha ao lado dele (assinatura fora do quadrado NÃO conta como preenchido).
- filled=false quando a célula inteira está em branco.

PROCEDIMENTO OBRIGATÓRIO:
1. Localize as 4 âncoras (quadrados pretos) nos cantos da tabela para orientar o grid.
2. Percorra a tabela linha por linha, de cima para baixo. Para cada linha, percorra as 6 colunas na ordem SEG→SAB.
3. Emita EXATAMENTE um registro por ID solicitado, na mesma ordem em que os IDs foram enviados.
4. Depois das linhas, avalie SIG-ENC, SIG-SES, SIG-GER (nessa ordem).

REGRAS DE SAÍDA:
- Responda APENAS JSON válido no formato: {"markers":[{"id":"L01-SEG","filled":true,"confidence":0.92,"notes":""}, ...]}.
- confidence entre 0.0 e 1.0 (use ≥0.8 quando a marca é nítida; ≤0.4 quando há dúvida).
- notes curto e opcional ("marca leve", "assinatura invade", "célula cortada", "não localizado"). Não invente conteúdo.
- Se não conseguir localizar um marcador específico, retorne filled=false, confidence=0, notes="não localizado".
- NUNCA invente IDs fora da lista solicitada. NUNCA repita IDs.`;

    const userText = `Analise a ficha DDS FOR-SEG-06 anexada e devolva o status de cada marcador abaixo, NA MESMA ORDEM, seguindo o procedimento do sistema.

Total esperado: ${data.expectedMarkers.length} marcadores (${rows} linhas × 6 dias + 3 assinaturas de responsáveis).

IDs (em ordem de leitura — linha por linha, SEG→SAB, depois SIG-ENC, SIG-SES, SIG-GER):
${data.expectedMarkers.join(", ")}`;

    const contentBlocks: any[] = [{ type: "text", text: userText }];
    if (data.mime.startsWith("image/")) {
      contentBlocks.push({
        type: "image_url",
        image_url: { url: `data:${data.mime};base64,${data.fileBase64}` },
      });
    } else if (data.mime === "application/pdf") {
      contentBlocks.push({
        type: "file",
        file: {
          filename: "documento.pdf",
          file_data: `data:application/pdf;base64,${data.fileBase64}`,
        },
      });
    } else {
      return { error: `Tipo não suportado: ${data.mime}`, markers: [] as MarkerResult[] };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentBlocks },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { error: `Gateway ${resp.status}: ${t.slice(0, 400)}`, markers: [] as MarkerResult[] };
    }
    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    let parsed: { markers?: MarkerResult[] } = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return { error: "Resposta do modelo não é JSON válido", markers: [] as MarkerResult[], raw };
    }

    const markers = Array.isArray(parsed.markers) ? parsed.markers : [];
    // garante 1 resultado por ID esperado
    const map = new Map<string, MarkerResult>();
    for (const m of markers) {
      if (m && typeof m.id === "string") map.set(m.id.toUpperCase(), {
        id: m.id.toUpperCase(),
        filled: !!m.filled,
        confidence: Math.max(0, Math.min(1, Number(m.confidence ?? 0))),
        notes: m.notes,
      });
    }
    const finalMarkers = data.expectedMarkers.map((id) => {
      const key = id.toUpperCase();
      return map.get(key) ?? { id: key, filled: false, confidence: 0, notes: "não retornado" };
    });
    return { markers: finalMarkers, modelUsed: modelId };
  });