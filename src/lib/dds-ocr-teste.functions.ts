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

    const systemPrompt = `Você analisa uma ficha semanal de DDS (Diálogo Diário de Segurança), modelo FOR-SEG-06.

LAYOUT:
- Ignore o cabeçalho.
- A tabela tem ${rows} linhas de funcionários (linha 1 até linha ${rows}), de cima para baixo.
- Cada linha contém: nome/assinatura manuscrita do funcionário à esquerda e, à direita, 6 quadradinhos correspondentes aos dias da semana na ordem SEG, TER, QUA, QUI, SEX, SAB.
- Um funcionário "assinou" a ficha quando existe qualquer nome escrito ou assinatura manuscrita na parte esquerda da linha (não importa se legível ou não).
- Um dia está "marcado" quando o quadradinho daquele dia tem qualquer marca visível dentro (X, traço, pintura, tinta, rabisco, escurecimento). Quadrado branco por dentro = NÃO marcado.

SUA TAREFA (só isso, nada mais):
Para cada uma das ${rows} linhas, devolva:
  - "linha": número da linha (1..${rows})
  - "assinou": true se há assinatura/nome escrito na linha, false se a linha está totalmente em branco
  - "nome": o nome legível (string) ou null se não houver ou for ilegível
  - "diasMarcados": array com os dias marcados, ex: ["SEG","TER"]. Array vazio se nenhum quadrado dessa linha estiver marcado.

SAÍDA (JSON exato, sem comentários, sem markdown):
{"linhas":[{"linha":1,"assinou":true,"nome":"João Silva","diasMarcados":["SEG","TER"]}, ...]}

Regras:
- Devolva exatamente ${rows} objetos em "linhas", na ordem de cima para baixo.
- Se a linha está vazia: {"linha":N,"assinou":false,"nome":null,"diasMarcados":[]}.
- Não invente nomes. Se não conseguir ler, use null.
- Só use os valores "SEG","TER","QUA","QUI","SEX","SAB" em diasMarcados.`;

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