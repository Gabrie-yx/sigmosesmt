import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  fileBase64: z.string().min(100),
  mime: z.string().min(3).max(64),
  expectedMarkers: z.array(z.string()).min(1).max(200),
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

    const systemPrompt = `Você é um sistema OCR especializado em detectar marcadores fiduciais em formulários de segurança do trabalho (DDS).
O formulário contém quadrados brancos com uma borda preta fina, cada um identificado por um ID em texto pequeno (ex: L01-SEG, L02-TER, SIG-ENC).
Para cada ID solicitado, determine:
- filled=true se o quadrado estiver visivelmente preenchido/pintado/marcado (X, traço, rabisco, tinta) OU se houver uma assinatura sobreposta que cubra a maior parte da célula.
- filled=false se o quadrado estiver vazio (branco).
- confidence: 0.0 a 1.0 baseado em nitidez.
- notes: opcional, curto (ex: "assinatura sobrepõe célula", "quadrado cortado", "não localizado").
Se um ID não for encontrado no documento, retorne filled=false, confidence=0 e notes="não localizado".
Retorne SOMENTE JSON válido no formato { "markers": [{ "id": "...", "filled": bool, "confidence": number, "notes": "..." }] }.`;

    const userText = `IDs esperados no documento:\n${data.expectedMarkers.join(", ")}\n\nAnalise a imagem/PDF e devolva o status de cada marcador.`;

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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentBlocks },
        ],
        response_format: { type: "json_object" },
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
    return { markers: finalMarkers };
  });