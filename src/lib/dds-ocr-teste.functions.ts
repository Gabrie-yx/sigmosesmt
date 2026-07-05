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

    const systemPrompt = `Você é um auditor de OCR de uma ficha manuscrita de DDS (FOR-SEG-06). Faça uma análise PROFUNDA, célula por célula. Rigor máximo. Não invente.

═══ LAYOUT ═══
Ignore por completo: cabeçalho (empresa, CNPJ, data, hora, assuntos) e rodapé (Encarregado / SESMT / Gerente).

A grade tem ${rows} linhas numeradas de 1 a ${rows}. Colunas, da esquerda para a direita:
  [Nº] | [NOME DO FUNCIONÁRIO] | [FUNÇÃO] | SEG | TER | QUA | QUI | SEX | SAB

Cada célula de DIA (SEG..SAB) contém DOIS elementos lado a lado dentro da mesma coluna:
  (a) uma faixa larga à ESQUERDA, onde o funcionário escreve a assinatura/nome; e
  (b) um QUADRADINHO impresso pequeno à DIREITA (borda preta fina, interior branco).

═══ REGRA 1 — "assinou" (participação do funcionário) ═══
true SOMENTE se existir traço MANUSCRITO A CANETA em QUALQUER célula de dia daquela linha (na faixa à esquerda do quadradinho) OU um rabisco/nome escrito na área do nome. Uma única assinatura na linha já basta.
false se a linha inteira está impressa/vazia, sem nenhum traço a mão.
Texto impresso (nome/função já vindos do formulário) NUNCA conta como assinatura.

═══ REGRA 2 — "diasMarcados" (quadradinhos) ═══
Para cada um dos 6 quadradinhos da linha, olhe SÓ o INTERIOR do quadrado (a caixa impressa pequena à direita da faixa de assinatura).
MARCADO (true) quando o interior tem: "X" desenhado, "✓", ou o quadrado pintado/hachurado/preenchido.
NÃO MARCADO quando: interior branco/limpo; assinatura passa pela faixa da esquerda mas NÃO invade o interior do quadradinho; sombra, ruído, ponto isolado, borda impressa mais grossa.
Se hesitar → NÃO MARCADO.

Importante: a assinatura na faixa esquerda e a marca no quadradinho são TOTALMENTE INDEPENDENTES.
- Pode haver assinatura sem nenhum quadrado marcado (funcionário assinou mas esqueceu de marcar).
- Pode haver quadrados marcados SEM NENHUMA assinatura na linha inteira (funcionário só marcou os quadradinhos, não assinou). Isso é VÁLIDO — reporte diasMarcados normalmente e assinou=false. NÃO zere diasMarcados.
- Só zere diasMarcados quando a linha inteira está impressa/em branco (sem assinatura E sem marca em nenhum quadradinho).

═══ REGRA 3 — "nome" ═══
Transcreva o nome IMPRESSO da coluna "NOME DO FUNCIONÁRIO" (não a assinatura manuscrita). Se a linha está totalmente vazia (sem nome impresso e sem assinatura), nome=null.

═══ PROCEDIMENTO (siga na ordem, uma linha por vez) ═══
Para linha i = 1..${rows}:
  1. Leia o nome impresso na coluna NOME. Guarde.
  2. Percorra as 6 células de dia. Em cada uma, verifique SEPARADAMENTE:
       - há traço a caneta na faixa esquerda (assinatura do dia)? → contribui para assinou=true
       - o quadradinho da direita está marcado por dentro? → entra em diasMarcados
  3. assinou = existe traço a caneta em QUALQUER faixa de assinatura OU rabisco no campo nome.
  4. diasMarcados = lista dos dias cujo quadradinho está marcado — INDEPENDENTE de assinou.
  5. Emita o objeto da linha.

═══ SAÍDA (JSON puro, sem markdown, sem comentários) ═══
{"linhas":[{"linha":1,"assinou":true,"nome":"Fulano","diasMarcados":["SEG","TER"]}, ...]}

Exatamente ${rows} objetos em "linhas", na ordem de cima para baixo. diasMarcados só aceita "SEG","TER","QUA","QUI","SEX","SAB".`;

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
        // gpt-5 e afins só aceitam temperature default (1). Só mandamos 0.1 pros modelos que suportam.
        ...(modelId.startsWith("openai/") ? {} : { temperature: 0.1 }),
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 524 || resp.status === 504) {
        return {
          error: `Timeout do gateway (${resp.status}) — o modelo ${modelId} demorou demais lendo esse arquivo. Tenta com gemini-2.5-pro, ou converta o PDF pra imagem antes.`,
          linhas: [],
          totalParticipantes: 0,
        };
      }
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
      // "assinou" vem do modelo. Dias marcados NÃO implicam assinatura — é comum
      // um funcionário marcar quadradinhos sem assinar (e vice-versa). Mantemos
      // as duas dimensões independentes; o consumidor decide como contar.
      const assinou = !!item?.assinou;
      porLinha.set(n, {
        linha: n,
        assinou,
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
    // Participante = quem interagiu com a linha (assinou OU marcou algum dia).
    // Linha totalmente vazia não conta.
    const totalParticipantes = linhas.filter(
      (l) => l.assinou || l.diasMarcados.length > 0,
    ).length;

    return { linhas, totalParticipantes, modelUsed: modelId };
  });