import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  fileBase64: z.string().min(10),
  mime: z.string().min(3).max(100),
});

export type AsoOcrResult = {
  error: string | null;
  extraido: {
    nome?: string;
    cpf?: string;
    matricula?: string;
    cargo?: string;
    empresa?: string;
    medico_nome?: string;
    medico_crm?: string;
    clinica?: string;
    tipo_exame?: string;
    natureza?: string;
    data_realizacao?: string;
    data_vencimento?: string;
    aptidao?: string;
    riscos?: string[];
    observacoes?: string;
  };
};

export const extrairDadosAso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<AsoOcrResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { error: "LOVABLE_API_KEY não configurada", extraido: {} };

    if (data.fileBase64.length > 28 * 1024 * 1024) {
      return { error: "Arquivo muito grande (>20MB). Reduza a resolução.", extraido: {} };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você lê Atestados de Saúde Ocupacional (ASO) brasileiros. Extraia SOMENTE dados legíveis. Datas no formato ISO YYYY-MM-DD. Natureza deve ser um destes: ADMISSIONAL, PERIODICO, RETORNO_TRABALHO, MUDANCA_RISCO, DEMISSIONAL, SEMESTRAL. Aptidao deve ser SIM ou NAO. Não invente dados.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os campos do ASO." },
              { type: "image_url", image_url: { url: `data:${data.mime};base64,${data.fileBase64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_aso",
              description: "Registra os dados extraídos do ASO",
              parameters: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  cpf: { type: "string" },
                  matricula: { type: "string" },
                  cargo: { type: "string" },
                  empresa: { type: "string" },
                  medico_nome: { type: "string" },
                  medico_crm: { type: "string" },
                  clinica: { type: "string" },
                  tipo_exame: { type: "string", description: "Ex: Clínico, Audiometria, etc." },
                  natureza: { type: "string", enum: ["ADMISSIONAL", "PERIODICO", "RETORNO_TRABALHO", "MUDANCA_RISCO", "DEMISSIONAL", "SEMESTRAL"] },
                  data_realizacao: { type: "string", description: "ISO YYYY-MM-DD" },
                  data_vencimento: { type: "string", description: "ISO YYYY-MM-DD" },
                  aptidao: { type: "string", enum: ["SIM", "NAO"] },
                  riscos: { type: "array", items: { type: "string" } },
                  observacoes: { type: "string" },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_aso" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error("[aso-ocr] gateway error", resp.status, txt);
      if (resp.status === 429) return { error: "Limite de requisições atingido. Aguarde 1 min.", extraido: {} };
      if (resp.status === 402) return { error: "Créditos de IA esgotados.", extraido: {} };
      return { error: `Erro na IA (${resp.status}).`, extraido: {} };
    }

    const json: any = await resp.json();
    const tc = json?.choices?.[0]?.message?.tool_calls?.[0];
    try {
      const args = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : {};
      return { error: null, extraido: args };
    } catch (e) {
      console.error("[aso-ocr] parse fail", e);
      return { error: "Não foi possível interpretar a resposta da IA.", extraido: {} };
    }
  });