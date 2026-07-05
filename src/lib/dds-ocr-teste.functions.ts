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

    const systemPrompt = `Você é um auditor forense de OCR de uma ficha manuscrita de DDS (FOR-SEG-06).
Trabalhe com RIGOR MÁXIMO, célula por célula, em DOIS PASSES. Nunca invente. Se ficar em dúvida, é NÃO.

═══ LAYOUT ═══
Ignore cabeçalho (empresa, CNPJ, data, hora, assuntos) e rodapé (Encarregado / SESMT / Gerente).
A grade tem ${rows} linhas numeradas 1..${rows}. Colunas:
  [Nº] | [NOME DO FUNCIONÁRIO] | [FUNÇÃO] | SEG | TER | QUA | QUI | SEX | SAB

Cada célula de DIA tem DOIS sub-elementos, lado a lado:
  (a) FAIXA de assinatura à ESQUERDA (área larga onde se escreve à caneta).
  (b) QUADRADINHO impresso pequeno à DIREITA (borda preta fina, ~5–8mm, interior branco).

═══ REGRA 1 — "assinou" (a pessoa passou a caneta na linha?) ═══
true se existir QUALQUER traço manuscrito a caneta em QUALQUER faixa de assinatura da linha, OU rabisco/nome escrito no campo NOME.
false se a linha inteira só tem texto impresso ou está totalmente em branco.
Texto impresso do formulário (nome/função pré-preenchidos) NUNCA conta como assinatura.

Sinais de assinatura verdadeira: linha ondulada contínua, loops, cortes cursivos, traço com pressão variável que atravessa parte da faixa.
Não é assinatura: uma pinguinha isolada, sombra da dobra do papel, marca d'água impressa, linha de base impressa.

═══ REGRA 2 — "diasMarcados" (quadradinhos preenchidos) ═══
Para cada um dos 6 quadradinhos da linha, olhe SÓ o INTERIOR do quadrado (dentro da borda preta).
MARCADO: interior tem "X" desenhado, "✓", "/", risco diagonal, ou o quadrado inteiro pintado/hachurado. O traço tem que estar DENTRO da borda impressa.
NÃO MARCADO: interior limpo/branco; a assinatura vazou da faixa esquerda mas parou ANTES da borda do quadradinho; ponto isolado; sombra; borda impressa levemente mais grossa; ruído de scan.
Se hesitar entre marcado/não marcado → NÃO MARCADO. Zero tolerância a falso positivo.

═══ REGRA 3 — INDEPENDÊNCIA total ═══
Assinatura e quadradinho são DUAS observações separadas. Trate cada uma isoladamente. As 4 combinações são TODAS válidas:
  A) assinou=true  + diasMarcados=[...] → assinou e marcou (caso normal).
  B) assinou=true  + diasMarcados=[]    → assinou mas esqueceu de marcar os quadradinhos.
  C) assinou=false + diasMarcados=[...] → NÃO assinou mas marcou quadradinhos. VÁLIDO. Reporte os dias marcados normalmente com assinou=false. NÃO zere.
  D) assinou=false + diasMarcados=[]    → linha em branco.

═══ REGRA 4 — "nome" ═══
Transcreva o nome IMPRESSO da coluna NOME DO FUNCIONÁRIO. Não transcreva a assinatura manuscrita.
Se não há nome impresso E a linha está vazia → nome=null.
Se há nome impresso mas o funcionário não assinou nem marcou → mesmo assim retorne o nome (útil pra auditoria).

═══ PROCEDIMENTO (2 PASSES obrigatórios) ═══
PASSE 1 — Varredura linha a linha, i=1..${rows}:
  a) Leia o nome impresso da coluna NOME. Guarde.
  b) Para cada dia (SEG..SAB), olhe SEPARADAMENTE:
     - a faixa de assinatura tem traço a caneta? (evidência de assinou)
     - o quadradinho está preenchido POR DENTRO da borda? (evidência de diasMarcados)
  c) Compile: assinou = OR das faixas + rabisco no campo nome; diasMarcados = lista dos quadrados marcados.

PASSE 2 — Auto-verificação (revise ANTES de emitir):
  - Para cada linha com assinou=true, você consegue apontar em qual coluna(s) enxergou o traço? Se NÃO, corrija pra false.
  - Para cada linha com um dia marcado, o preenchimento está DENTRO da borda? Se ficou em cima da borda ou fora → remova esse dia.
  - Se marcou TODOS os 6 dias numa linha, revise: pode ser padrão impresso repetido; confirme que há preenchimento visível em CADA um dos 6.
  - Se assinou=false e diasMarcados=[], confirme que a linha está mesmo totalmente vazia (nem nome impresso, nem traço).
  - Não zere diasMarcados só porque assinou=false. Só zere se realmente não há marca visível.

═══ EXEMPLOS DE CALIBRAÇÃO ═══
Ex1: linha 1 tem "João Silva" impresso, rabisco cursivo na faixa de SEG e TER, quadradinho de SEG com X grosso, quadradinho de TER com X, demais quadradinhos limpos.
  → {"linha":1,"assinou":true,"nome":"João Silva","diasMarcados":["SEG","TER"]}

Ex2: linha 2 tem "Maria Souza" impresso, assinatura cursiva grande em SEG, mas os 6 quadradinhos estão TODOS limpos.
  → {"linha":2,"assinou":true,"nome":"Maria Souza","diasMarcados":[]}

Ex3: linha 3 tem "Pedro Alves" impresso, NENHUMA assinatura em nenhuma faixa, mas os 6 quadradinhos têm X.
  → {"linha":3,"assinou":false,"nome":"Pedro Alves","diasMarcados":["SEG","TER","QUA","QUI","SEX","SAB"]}

Ex4: linha 4 tem "Ana Costa" impresso, nada mais.
  → {"linha":4,"assinou":false,"nome":"Ana Costa","diasMarcados":[]}

Ex5: linha 5 totalmente em branco (sem nome impresso, sem nada).
  → {"linha":5,"assinou":false,"nome":null,"diasMarcados":[]}

═══ SAÍDA ═══
JSON puro, sem markdown, sem comentário, sem texto antes/depois:
{"linhas":[{"linha":1,"assinou":true,"nome":"Fulano","diasMarcados":["SEG","TER"]}, ...]}
Exatamente ${rows} objetos em "linhas", ordenados 1..${rows}. diasMarcados só aceita "SEG","TER","QUA","QUI","SEX","SAB".`;

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