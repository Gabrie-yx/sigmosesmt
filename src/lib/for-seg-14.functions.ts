import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  acidenteId: z.string().uuid(),
  descricao: z.string().min(10),
  parteCorpo: z.string().nullable().optional(),
  naturezaLesao: z.string().nullable().optional(),
  agenteCausador: z.string().nullable().optional(),
  local: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
});

export type SugestaoForSeg14 = {
  enquadramento: Record<string, string[]>; // 9 quadros: fonte, tipo_acidente, atos, fator_pessoal, condicoes, fator_trabalho, natureza, localizacao, procedimentos
  porques: Array<{ pergunta: string; resposta: string }>;
  causa_basica: string;
  causa_imediata: string;
};

export const sugerirForSeg14IA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { error: "LOVABLE_API_KEY não configurada", sugestao: null as SugestaoForSeg14 | null };

    const userMsg = `Acidente para análise (FOR-SEG 14):
- Descrição: ${data.descricao}
- Parte do corpo atingida: ${data.parteCorpo ?? "—"}
- Natureza da lesão: ${data.naturezaLesao ?? "—"}
- Agente causador: ${data.agenteCausador ?? "—"}
- Local: ${data.local ?? "—"}
- Cargo da vítima: ${data.cargo ?? "—"}`;

    const schema = {
      type: "object",
      properties: {
        enquadramento: {
          type: "object",
          properties: {
            fonte_lesao: { type: "array", items: { type: "string" } },
            tipo_acidente: { type: "array", items: { type: "string" } },
            atos_inseguros: { type: "array", items: { type: "string" } },
            fator_pessoal: { type: "array", items: { type: "string" } },
            condicoes_inseguras: { type: "array", items: { type: "string" } },
            fator_trabalho: { type: "array", items: { type: "string" } },
            natureza_lesao: { type: "array", items: { type: "string" } },
            localizacao_lesao: { type: "array", items: { type: "string" } },
            procedimentos_medicos: { type: "array", items: { type: "string" } },
          },
          required: [
            "fonte_lesao","tipo_acidente","atos_inseguros","fator_pessoal",
            "condicoes_inseguras","fator_trabalho","natureza_lesao","localizacao_lesao","procedimentos_medicos"
          ],
          additionalProperties: false,
        },
        porques: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              pergunta: { type: "string" },
              resposta: { type: "string" },
            },
            required: ["pergunta","resposta"],
            additionalProperties: false,
          },
        },
        causa_imediata: { type: "string" },
        causa_basica: { type: "string" },
      },
      required: ["enquadramento","porques","causa_imediata","causa_basica"],
      additionalProperties: false,
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um TST/Engenheiro de Segurança especialista em investigação de acidentes pela NBR 14280 e NR-01. Dada a descrição de um acidente, preencha o FOR-SEG 14: (1) Enquadramento técnico nos 9 quadros (use frases curtas em PT-BR, máx 4 itens por quadro), (2) Análise dos 5 Porquês até a causa raiz, (3) Causa imediata e causa básica. Seja objetivo e técnico.",
          },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "preencher_for_seg_14",
            description: "Preenche análise técnica do FOR-SEG 14",
            parameters: schema,
          },
        }],
        tool_choice: { type: "function", function: { name: "preencher_for_seg_14" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return { error: "Limite de IA atingido. Aguarde 1 minuto.", sugestao: null };
      if (aiResp.status === 402) return { error: "Créditos de IA esgotados.", sugestao: null };
      const txt = await aiResp.text().catch(() => "");
      return { error: `Erro IA (${aiResp.status}): ${txt.slice(0, 160)}`, sugestao: null };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiJson: any = await aiResp.json();
    const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    try {
      const parsed = args ? JSON.parse(args) : null;
      return { error: null as string | null, sugestao: parsed as SugestaoForSeg14 };
    } catch {
      return { error: "Resposta da IA inválida", sugestao: null };
    }
  });