import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  pdfPath: z.string().min(1).max(1024),
});

export type OcrDia = {
  data: string; // dd/mm
  dia_semana?: string;
  hor?: string;
  marcacoes: string[]; // ["07:28","12:00","13:00","17:32"]
  observacao?: string; // "Trabalhando", "Horas Extras 50%", "DSR", "FOLGA", "FERIADO", etc
  trab?: string; // "09:00"
  faltas?: string;
  atraso?: string;
  hett?: string;
  h50?: string;
  h55?: string;
  h60?: string;
  h80?: string;
  h100?: string;
  h110?: string;
  noturno?: string;
};

export type OcrFolha = {
  pagina: number;
  matricula?: string;
  nome?: string;
  cargo?: string;
  localizacao?: string;
  ctps?: string;
  categoria?: string;
  periodo_inicio?: string; // dd/mm/yyyy
  periodo_fim?: string;    // dd/mm/yyyy
  dias: OcrDia[];
  totais?: {
    trabalho?: string; faltas?: string; atrasos?: string; hett?: string;
    extras_50?: string; extras_55?: string; extras_60?: string; extras_80?: string;
    extras_100?: string; extras_110?: string; ad_noturno?: string;
  };
};

export const ocrFolhaDePonto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ folhas: OcrFolha[]; error?: string }> => {
    const { supabase } = context as any;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { folhas: [], error: "LOVABLE_API_KEY não configurada" };

    const dl = await supabase.storage.from("ponto-pdfs").download(data.pdfPath);
    if (dl.error || !dl.data) return { folhas: [], error: `Falha ao baixar PDF: ${dl.error?.message ?? "?"}` };
    const blob = dl.data as Blob;
    if (blob.size > 20 * 1024 * 1024) return { folhas: [], error: "PDF > 20MB — reduza a resolução" };

    const buf = Buffer.from(await blob.arrayBuffer());
    const b64 = buf.toString("base64");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você extrai dados de folhas/cartões de ponto CLT em português. Cada página tem 1 funcionário. " +
              "Extraia cabeçalho (matrícula, nome, cargo, localização, CTPS, categoria, período dd/mm/aaaa a dd/mm/aaaa) " +
              "e TODAS as linhas de dia (Data dd/mm, dia da semana SEG/TER/etc, código Hor, marcações HH:MM, observação como 'Trabalhando'/'Horas Extras 50%'/'DSR'/'FOLGA'/'FERIADO'/'FALTA'/'ATESTADO', e as colunas de totais Trab, Faltas, Atraso, HETT, H.50%, H.55%, H.60%, H.80%, H.100%, H.110%, Noturno). " +
              "Extraia também os totais do rodapé. Retorne EXATAMENTE o que está impresso — não invente valores. Se coluna estiver vazia, omita o campo.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todas as folhas de ponto deste PDF (uma por página)." },
              { type: "file", file: { filename: "folha.pdf", file_data: `data:application/pdf;base64,${b64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_folhas",
              description: "Registra as folhas de ponto extraídas do PDF.",
              parameters: {
                type: "object",
                properties: {
                  folhas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        pagina: { type: "integer" },
                        matricula: { type: "string" },
                        nome: { type: "string" },
                        cargo: { type: "string" },
                        localizacao: { type: "string" },
                        ctps: { type: "string" },
                        categoria: { type: "string" },
                        periodo_inicio: { type: "string", description: "dd/mm/aaaa" },
                        periodo_fim: { type: "string", description: "dd/mm/aaaa" },
                        dias: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              data: { type: "string", description: "dd/mm" },
                              dia_semana: { type: "string" },
                              hor: { type: "string" },
                              marcacoes: { type: "array", items: { type: "string" } },
                              observacao: { type: "string" },
                              trab: { type: "string" },
                              faltas: { type: "string" },
                              atraso: { type: "string" },
                              hett: { type: "string" },
                              h50: { type: "string" },
                              h55: { type: "string" },
                              h60: { type: "string" },
                              h80: { type: "string" },
                              h100: { type: "string" },
                              h110: { type: "string" },
                              noturno: { type: "string" },
                            },
                            required: ["data", "marcacoes"],
                          },
                        },
                        totais: {
                          type: "object",
                          properties: {
                            trabalho: { type: "string" }, faltas: { type: "string" }, atrasos: { type: "string" }, hett: { type: "string" },
                            extras_50: { type: "string" }, extras_55: { type: "string" }, extras_60: { type: "string" }, extras_80: { type: "string" },
                            extras_100: { type: "string" }, extras_110: { type: "string" }, ad_noturno: { type: "string" },
                          },
                        },
                      },
                      required: ["pagina", "dias"],
                    },
                  },
                },
                required: ["folhas"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_folhas" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("[ponto-ocr] gateway", resp.status, t);
      if (resp.status === 429) return { folhas: [], error: "Limite de IA atingido — aguarde 1 minuto." };
      if (resp.status === 402) return { folhas: [], error: "Créditos de IA esgotados." };
      return { folhas: [], error: `Erro IA (${resp.status})` };
    }

    const j: any = await resp.json();
    const call = j?.choices?.[0]?.message?.tool_calls?.[0];
    try {
      const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
      const folhas = Array.isArray(args?.folhas) ? (args.folhas as OcrFolha[]) : [];
      return { folhas };
    } catch (e: any) {
      console.error("[ponto-ocr] parse tool args", e);
      return { folhas: [], error: "Falha ao interpretar resposta da IA" };
    }
  });