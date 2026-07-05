import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  fileBase64: z.string().min(100),
  mime: z.string().min(3).max(64),
  rows: z.number().int().min(1).max(30).default(12),
  model: z.string().optional(),
});

export type LinhaResultado = {
  linha: number;
  assinou: boolean;
  nome: string | null;
  diasMarcados: string[]; // subset de ["SEG","TER","QUA","QUI","SEX","SAB"]
};

export type OCRResultado = {
  error?: string;
  linhas: LinhaResultado[];
  totalParticipantes: number;
  modelUsed?: string;
  raw?: string;
};

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"] as const;

export const analisarDDS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<OCRResultado> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY não configurada", linhas: [], totalParticipantes: 0 };
    }

    const rows = data.rows;
    const modelId = data.model || "google/gemini-2.5-pro";

    const systemPrompt = `Você audita uma ficha manuscrita de DDS (FOR-SEG-06). Rigor máximo, viés CONSERVADOR: NA DÚVIDA = NÃO MARCADO / NÃO ASSINOU.

LAYOUT (ignore totalmente o cabeçalho e o rodapé de assinaturas):
- Tabela com ${rows} linhas numeradas de 1 a ${rows}, de cima para baixo.
- Colunas: [#] [NOME] [FUNÇÃO] [SEG] [TER] [QUA] [QUI] [SEX] [SAB]
- Os 6 quadradinhos à direita são PEQUENOS e IMPRESSOS (linha preta fina). Interior BRANCO por padrão.

DEFINIÇÃO ESTRITA — "assinou":
- true SOMENTE quando existe TRAÇO MANUSCRITO A CANETA na área de nome/assinatura da linha (rabisco, assinatura, nome à mão). Texto impresso não conta. Linha totalmente em branco = false.

DEFINIÇÃO ESTRITA — "dia marcado":
- true SOMENTE quando o INTERIOR do quadradinho daquele dia contém uma marca clara e inequívoca: um "X" desenhado, um "✓", ou o quadrado pintado/hachurado por dentro.
- NÃO conta: quadrado com interior branco/limpo; rabisco que passa POR CIMA da borda mas não invade o interior; sombra do papel; ruído de digitalização; ponto pequeno; borda impressa mais grossa.
- Se você hesitar entre "marcado" e "não marcado" → é NÃO MARCADO.

PADRÃO REAL DA FICHA (use como sanity check):
- A grande maioria das linhas assinadas marca APENAS 1 dia (o dia da participação). Marcar 2+ dias na mesma linha é RARO.
- Se você achou 3, 4, 5 ou 6 dias marcados numa mesma linha, RECONFERE: quase certeza que a maioria é falso positivo. Reduza para apenas os que você tem certeza absoluta.
- Linha sem assinatura NUNCA tem dias marcados. Se "assinou"=false, "diasMarcados" DEVE ser [].

PROCEDIMENTO OBRIGATÓRIO:
1) Localize a tabela. Numere as linhas de 1 a ${rows}.
2) Para cada linha, olhe primeiro a área de nome/assinatura. Decida "assinou" (true/false).
3) Se assinou=false → pule os quadrados, devolva diasMarcados=[].
4) Se assinou=true → examine UM POR UM os 6 quadrados. Só liste os que têm marca CLARA no interior.
5) Nome: transcreva só se conseguir ler com confiança. Caso contrário, null.

SAÍDA JSON (sem markdown, sem comentários):
{"linhas":[{"linha":1,"assinou":true,"nome":"Fulano","diasMarcados":["SEG"]}, ...]}

Regras finais:
- Exatamente ${rows} objetos em "linhas", na ordem de cima para baixo.
- diasMarcados só aceita: "SEG","TER","QUA","QUI","SEX","SAB".
- Não invente. Prefira sempre subestimar a superestimar.`;

    const userText = `Analise a ficha DDS anexada e devolva o JSON com as ${rows} linhas.`;

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
      return { error: `Tipo não suportado: ${data.mime}`, linhas: [], totalParticipantes: 0 };
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
      return { error: `Gateway ${resp.status}: ${t.slice(0, 400)}`, linhas: [], totalParticipantes: 0 };
    }
    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    let parsed: { linhas?: any[] } = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return { error: "Resposta do modelo não é JSON válido", linhas: [], totalParticipantes: 0, raw };
    }

    const rawLinhas = Array.isArray(parsed.linhas) ? parsed.linhas : [];
    const porLinha = new Map<number, LinhaResultado>();
    for (const item of rawLinhas) {
      const n = Number(item?.linha);
      if (!Number.isInteger(n) || n < 1 || n > rows) continue;
      const dias = Array.isArray(item?.diasMarcados)
        ? item.diasMarcados
            .map((d: any) => String(d).toUpperCase().trim())
            .filter((d: string) => (DIAS as readonly string[]).includes(d))
        : [];
      const nomeVal = typeof item?.nome === "string" && item.nome.trim() ? item.nome.trim() : null;
      porLinha.set(n, {
        linha: n,
        assinou: !!item?.assinou || !!nomeVal || dias.length > 0,
        nome: nomeVal,
        diasMarcados: Array.from(new Set(dias)),
      });
    }

    const linhas: LinhaResultado[] = [];
    for (let i = 1; i <= rows; i++) {
      linhas.push(
        porLinha.get(i) ?? { linha: i, assinou: false, nome: null, diasMarcados: [] },
      );
    }
    const totalParticipantes = linhas.filter((l) => l.assinou).length;

    return { linhas, totalParticipantes, modelUsed: modelId };
  });