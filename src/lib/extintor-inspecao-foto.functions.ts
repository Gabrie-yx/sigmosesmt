import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "extintores-inspecoes";

const InputSchema = z.object({
  foto_etiqueta_path: z.string().min(1),
  foto_manometro_path: z.string().min(1),
  foto_inmetro_path: z.string().min(1).optional().nullable(),
  foto_extra_path: z.string().min(1).optional().nullable(),
  // Para cross-check de divergência
  extintor_esperado: z
    .object({
      numero: z.string().optional().nullable(),
      numero_cilindro: z.string().optional().nullable(),
      tipo_agente: z.string().optional().nullable(),
      capacidade: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
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

// LAUDO COMPLETO — 12 itens FOR-SFG 08 + dados técnicos + cross-check
const LAUDO_SCHEMA = {
  type: "object",
  properties: {
    // ============ DADOS TÉCNICOS (extraídos das fotos) ============
    fabricante: { type: "string", description: "Marca/fabricante (ex: Norte Extintores, Resil)" },
    tipo: { type: "string", enum: ["ABC", "BC", "A", "AP", "CO2", "PQS", "PQS_K", "OUTRO"] },
    classes_fogo: {
      type: "array",
      items: { type: "string", enum: ["A", "B", "C", "K"] },
      description: "Classes de fogo indicadas na etiqueta (ex: A,B,C)",
    },
    capacidade_kg: { type: "number", description: "Capacidade em kg (ou litros para AP). Null se ilegível." },
    numero_cilindro: { type: "string", description: "Nº do cilindro gravado no metal ou impresso na etiqueta (ex: 008876). Null se ilegível." },
    codigo_inmetro: { type: "string", description: "Código alfanumérico do selo verde INMETRO (ex: ZZV86OE54). Null se não visível." },
    lote_inmetro: { type: "string", description: "Lote do selo INMETRO (ex: C: 121895). Null se não visível." },
    qr_inmetro_url: { type: "string", description: "URL do QR Code do INMETRO se conseguir ler. Null caso contrário." },
    data_fabricacao: { type: "string", description: "MM/AAAA. Null se ilegível." },
    proxima_manutencao_n2: { type: "string", description: "Data próxima manutenção 2º nível (AAAA-MM-DD ou MM/AAAA). Null se ilegível." },
    proxima_manutencao_n3: { type: "string", description: "Data próxima manutenção 3º nível (AAAA-MM-DD ou AAAA). Null se ilegível." },

    // ============ 12 ITENS FOR-SFG 08 ============
    item01_sinalizacao: { type: "string", enum: ["C", "NC", "NA"], description: "01. Sinalização de piso/parede visível e conforme" },
    item02_acesso: { type: "string", enum: ["C", "NC", "NA"], description: "02. Acesso desobstruído (livre por todos os lados)" },
    item03_suporte: { type: "string", enum: ["C", "NC", "NA"], description: "03. Suporte/fixação em boas condições" },
    item04_lacre: { type: "string", enum: ["C", "NC", "NA"], description: "04. Lacre íntegro" },
    item05_pino: { type: "string", enum: ["C", "NC", "NA"], description: "05. Pino de segurança presente e em posição" },
    item06_manometro: { type: "string", enum: ["C", "NC", "NA"], description: "06. Manômetro na faixa VERDE (C). Vermelho/amarelo = NC. CO2 não tem manômetro = NA." },
    item07_mangueira: { type: "string", enum: ["C", "NC", "NA"], description: "07. Mangueira sem rachadura, ressecamento ou entupimento" },
    item08_difusor: { type: "string", enum: ["C", "NC", "NA"], description: "08. Difusor/bico sem entupimento ou avaria" },
    item09_cilindro: { type: "string", enum: ["C", "NC", "NA"], description: "09. Corpo do cilindro sem corrosão, amassados ou danos" },
    item10_etiqueta: { type: "string", enum: ["C", "NC", "NA"], description: "10. Etiqueta de identificação legível" },
    item11_validade: { type: "string", enum: ["C", "NC", "NA"], description: "11. Validade da carga em dia (próx. manutenção N2 ainda não venceu)" },
    item12_selo_inmetro: { type: "string", enum: ["C", "NC", "NA"], description: "12. Selo INMETRO presente e legível" },

    // ============ ANÁLISE ============
    pressao_manometro: { type: "string", enum: ["OK_VERDE", "BAIXA_VERMELHO", "ALTA_AMARELO", "ILEGIVEL", "NAO_APLICA"] },
    qualidade_foto: { type: "string", enum: ["BOA", "REGULAR", "RUIM"] },
    confianca: { type: "number", description: "Confiança geral 0-1 da análise" },
    nao_conformidades: {
      type: "array",
      items: { type: "string" },
      description: "Lista textual de NCs (uma por linha, descrição clara)",
    },
    observacoes: { type: "string", description: "Observações gerais do inspetor IA" },

    // ============ CROSS-CHECK ============
    divergencia_detectada: {
      type: "boolean",
      description: "True se o nº de cilindro / tipo / capacidade extraídos não baterem com o extintor selecionado pelo usuário",
    },
    divergencia_descricao: {
      type: "string",
      description: "Descrição da divergência (ex: 'Cilindro lido 008876, esperado 008873')",
    },
  },
  required: [
    "tipo",
    "item01_sinalizacao", "item02_acesso", "item03_suporte", "item04_lacre",
    "item05_pino", "item06_manometro", "item07_mangueira", "item08_difusor",
    "item09_cilindro", "item10_etiqueta", "item11_validade", "item12_selo_inmetro",
    "pressao_manometro", "qualidade_foto", "confianca",
    "nao_conformidades", "divergencia_detectada",
  ],
  additionalProperties: false,
};

export const analisarFotosExtintor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada no servidor.");

    const [etiquetaUrl, manometroUrl, inmetroUrl, extraUrl] = await Promise.all([
      pathToDataUrl(supabase, data.foto_etiqueta_path),
      pathToDataUrl(supabase, data.foto_manometro_path),
      data.foto_inmetro_path ? pathToDataUrl(supabase, data.foto_inmetro_path) : Promise.resolve<string | null>(null),
      data.foto_extra_path ? pathToDataUrl(supabase, data.foto_extra_path) : Promise.resolve<string | null>(null),
    ]);

    const esperado = data.extintor_esperado;
    const ctxEsperado = esperado
      ? `\n\n### EXTINTOR ESPERADO (selecionado pelo usuário):\n` +
        `- Nº patrimônio/cadastro: ${esperado.numero ?? "—"}\n` +
        `- Nº cilindro: ${esperado.numero_cilindro ?? "—"}\n` +
        `- Tipo: ${esperado.tipo_agente ?? "—"}\n` +
        `- Capacidade: ${esperado.capacidade ?? "—"}\n` +
        `Se os dados extraídos NÃO baterem (especialmente nº de cilindro e tipo), marque divergencia_detectada=true e descreva.`
      : `\n\nNenhum extintor pré-selecionado — apenas extraia os dados; divergencia_detectada=false.`;

    const userContent: any[] = [
      {
        type: "text",
        text:
          "Você é um TST inspecionando um extintor (NBR 12693/12962, NR-23, formulário FOR-SFG 08).\n\n" +
          "FOTOS:\n" +
          "1) Corpo + etiqueta principal (fabricante, tipo, classes, capacidade)\n" +
          "2) Manômetro + lacre + pino + mangueira\n" +
          (inmetroUrl ? "3) Selo INMETRO verde + etiqueta amarela de manutenção (códigos, datas de N2/N3, QR)\n" : "") +
          (extraUrl ? "4) Foto extra (localização/sinalização/evidência de NC)\n" : "") +
          "\nPreencha TODOS os 12 itens FOR-SFG 08 com C (conforme), NC (não conforme) ou NA (não aplica).\n" +
          "Se algo está ilegível, marque NA com confiança menor — NUNCA chute.\n" +
          "Para CO2, item06 (manômetro) = NA.\n" +
          "Liste TODAS as NCs encontradas em 'nao_conformidades' (descrição clara, uma por linha)." +
          ctxEsperado +
          "\n\nResponda APENAS via tool 'preencher_laudo'.",
      },
      { type: "image_url", image_url: { url: etiquetaUrl } },
      { type: "image_url", image_url: { url: manometroUrl } },
    ];
    if (inmetroUrl) userContent.push({ type: "image_url", image_url: { url: inmetroUrl } });
    if (extraUrl) userContent.push({ type: "image_url", image_url: { url: extraUrl } });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um TST experiente, especialista em inspeção de extintores conforme NBR 12693/12962 e NR-23. Seja rigoroso, prefira reportar 'NA' ou 'ilegível' a chutar.",
          },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "preencher_laudo",
            description: "Preenche o laudo completo FOR-SFG 08 da inspeção do extintor",
            parameters: LAUDO_SCHEMA,
          },
        }],
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
    if (!call?.function?.arguments) throw new Error("IA não retornou laudo estruturado. Tente fotos com melhor qualidade.");
    let laudo: any;
    try { laudo = JSON.parse(call.function.arguments); }
    catch { throw new Error("Resposta da IA em formato inválido."); }

    return { laudo };
  });

const SalvarSchema = z.object({
  extintor_id: z.string().uuid().nullable().optional(),
  foto_etiqueta_path: z.string().min(1),
  foto_manometro_path: z.string().min(1),
  foto_inmetro_path: z.string().optional().nullable(),
  foto_extra_path: z.string().optional().nullable(),
  gps_lat: z.number().nullable().optional(),
  gps_lng: z.number().nullable().optional(),
  gps_accuracy: z.number().nullable().optional(),
  localizacao_descritiva: z.string().optional().nullable(),
  laudo_ia: z.any(),
  laudo_revisado: z.any(),
  dados_extraidos: z.any().optional().nullable(),
  confianca_ia: z.number().nullable().optional(),
  status_geral: z.enum(["conforme", "nao_conforme", "pendente_revisao"]),
  nao_conformidades: z.array(z.string()).default([]),
  precisa_revisao: z.boolean().default(false),
  justificativa_divergencia: z.string().optional().nullable(),
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
      .insert({ ...data, inspecionado_por: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
