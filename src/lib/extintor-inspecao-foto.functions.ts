import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "extintores-inspecoes";

const InputSchema = z.object({
  foto_etiqueta_path: z.string().min(1),
  foto_manometro_path: z.string().min(1),
  foto_lacre_path: z.string().min(1).optional().nullable(),
});

function mimeFromPath(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function pathToDataUrl(supabase: any, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Falha ao baixar ${path}: ${error?.message ?? "desconhecido"}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:${mimeFromPath(path)};base64,${buf.toString("base64")}`;
}

const LAUDO_SCHEMA = {
  type: "object",
  properties: {
    marca: { type: "string", description: "Fabricante/marca lida na etiqueta" },
    tipo: { type: "string", enum: ["ABC", "BC", "A", "AP", "CO2", "PQS", "PQS_K", "OUTRO"] },
    capacidade_kg: { type: "number", description: "Capacidade em kg (ou litros para AP). Null se ilegível." },
    fabricante: { type: "string" },
    data_fabricacao: { type: "string", description: "Formato MM/AAAA ou AAAA. Null se ilegível." },
    validade: { type: "string", description: "Data de validade da carga MM/AAAA. Null se ilegível." },
    num_patrimonio: { type: "string", description: "Número de patrimônio se visível na etiqueta. Null se não." },
    pressao_manometro: { type: "string", enum: ["OK_VERDE", "BAIXA_VERMELHO", "ALTA_AMARELO", "ILEGIVEL"] },
    lacre_integro: { type: "boolean" },
    mangueira_ok: { type: "boolean", description: "Mangueira sem rachadura, sem entupimento aparente" },
    sinalizacao_ok: { type: "boolean", description: "Sinalização de piso/parede visível" },
    obstrucao: { type: "boolean", description: "True se há obstrução de acesso ao extintor" },
    qualidade_foto: { type: "string", enum: ["BOA", "REGULAR", "RUIM"] },
    confianca: { type: "number", description: "Confiança geral 0-1 da análise" },
    nao_conformidades: {
      type: "array",
      items: { type: "string" },
      description: "Lista textual de não conformidades detectadas (ex: 'Manômetro na faixa vermelha', 'Lacre rompido', 'Acesso obstruído')",
    },
    observacoes: { type: "string" },
  },
  required: [
    "tipo",
    "pressao_manometro",
    "lacre_integro",
    "qualidade_foto",
    "confianca",
    "nao_conformidades",
  ],
  additionalProperties: false,
};

export const analisarFotosExtintor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY não configurada no servidor.");
    }

    const [etiquetaUrl, manometroUrl, lacreUrl] = await Promise.all([
      pathToDataUrl(supabase, data.foto_etiqueta_path),
      pathToDataUrl(supabase, data.foto_manometro_path),
      data.foto_lacre_path ? pathToDataUrl(supabase, data.foto_lacre_path) : Promise.resolve<string | null>(null),
    ]);

    const userContent: any[] = [
      {
        type: "text",
        text:
          "Você é um TST inspecionando um extintor de incêndio (NBR 12693 / NR-23). " +
          "Analise as fotos e preencha o laudo. " +
          "Foto 1 = etiqueta/corpo (extraia marca, tipo de agente, capacidade, fabricação, validade, patrimônio). " +
          "Foto 2 = manômetro (verde=OK, vermelho=baixa, amarelo=alta). " +
          (lacreUrl ? "Foto 3 = lacre/contexto (lacre íntegro, mangueira, sinalização, obstrução). " : "") +
          "Liste TODAS as não conformidades observadas. Se algo estiver ilegível ou em dúvida, marque confiança menor e deixe o campo como null/vazio. " +
          "Responda APENAS via a tool 'preencher_laudo'.",
      },
      { type: "image_url", image_url: { url: etiquetaUrl } },
      { type: "image_url", image_url: { url: manometroUrl } },
    ];
    if (lacreUrl) userContent.push({ type: "image_url", image_url: { url: lacreUrl } });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um técnico de segurança do trabalho experiente, especialista em inspeção de extintores conforme NBR 12693 e NR-23. Seja rigoroso, prefira reportar 'ilegível' a chutar.",
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "preencher_laudo",
              description: "Preenche o laudo estruturado da inspeção do extintor",
              parameters: LAUDO_SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "preencher_laudo" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) throw new Error("Limite de requisições à IA atingido. Tente novamente em alguns instantes.");
      if (aiResp.status === 402) throw new Error("Créditos de IA esgotados. Recarregue em Configurações → Planos & créditos.");
      throw new Error(`Falha na IA (${aiResp.status}): ${txt.slice(0, 200)}`);
    }

    const json = await aiResp.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      throw new Error("IA não retornou laudo estruturado. Tente fotos com melhor qualidade.");
    }
    let laudo: any;
    try {
      laudo = JSON.parse(call.function.arguments);
    } catch {
      throw new Error("Resposta da IA em formato inválido.");
    }

    return { laudo };
  });

const SalvarSchema = z.object({
  extintor_id: z.string().uuid().nullable().optional(),
  foto_etiqueta_path: z.string().min(1),
  foto_manometro_path: z.string().min(1),
  foto_lacre_path: z.string().optional().nullable(),
  gps_lat: z.number().nullable().optional(),
  gps_lng: z.number().nullable().optional(),
  gps_accuracy: z.number().nullable().optional(),
  localizacao_descritiva: z.string().optional().nullable(),
  laudo_ia: z.any(),
  laudo_revisado: z.any(),
  confianca_ia: z.number().nullable().optional(),
  status_geral: z.enum(["conforme", "nao_conforme", "pendente_revisao"]),
  nao_conformidades: z.array(z.string()).default([]),
  assinatura_path: z.string().optional().nullable(),
  assinado_por_nome: z.string().optional().nullable(),
  assinado_por_cargo: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export const salvarInspecaoFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SalvarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: row, error } = await supabase
      .from("extintor_inspecoes_fotos")
      .insert({
        ...data,
        inspecionado_por: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });