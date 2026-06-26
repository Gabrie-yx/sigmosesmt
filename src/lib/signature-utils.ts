/**
 * Utilitários para tratar assinaturas digitais antes de estampar em PDFs.
 *
 * Regra de ouro: PRESERVAR A COR ORIGINAL DO TRAÇO.
 * As pessoas assinam com caneta AZUL e queremos que o PDF mostre o azul
 * exatamente como foi escaneado/fotografado. Aqui apenas removemos o
 * fundo claro do papel (para a estampa não ficar com um retângulo branco
 * tampando a célula da rubrica) — sem mexer no RGB do traço.
 */

export type CleanOptions = {
  /** Acima desse valor de luminância min(r,g,b) o pixel vira 100% transparente. */
  hard?: number;
  /** Entre soft e hard o pixel vira semi-transparente (anti-aliasing das bordas). */
  soft?: number;
};

/** Aplica a limpeza de fundo claro em uma data URL existente. */
export async function cleanSignatureDataUrl(
  dataUrl: string,
  opts: CleanOptions = {},
): Promise<string> {
  if (typeof window === "undefined") return dataUrl;
  const hard = opts.hard ?? 235;
  const soft = opts.soft ?? 200;
  try {
    const img = await loadImage(dataUrl);
    const MAX = 1200;
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const minC = Math.min(d[i], d[i + 1], d[i + 2]);
      if (minC >= hard) {
        d[i + 3] = 0;
      } else if (minC >= soft) {
        const t = (minC - soft) / (hard - soft);
        d[i + 3] = Math.round(d[i + 3] * (1 - t));
      }
      // RGB nunca é alterado — cor da caneta preservada.
    }
    ctx.putImageData(data, 0, 0);
    return c.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

/**
 * Reduz drasticamente o peso de uma assinatura ANTES de estampar no PDF.
 * - Limita largura/altura máximas (default 600×200) — a assinatura nunca é
 *   impressa em tamanho maior que ~6cm, então 600px já é mais que suficiente
 *   para impressão a 300 DPI.
 * - Mantém transparência (PNG) e cor original do traço.
 * - Resultado típico: 60-100KB → 4-12KB. jsPDF.addImage fica MUITO mais rápido
 *   (não precisa parsear PNG gigante) e o PDF gerado é menor.
 */
export async function compressSignatureForPdf(
  dataUrl: string | null | undefined,
  maxW = 600,
  maxH = 200,
): Promise<string | null> {
  if (!dataUrl) return null;
  if (typeof window === "undefined") return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const w = Math.max(1, Math.round(img.naturalWidth * ratio));
    const h = Math.max(1, Math.round(img.naturalHeight * ratio));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

/** Versão em lote — processa muitas assinaturas em paralelo com cache simples. */
const _sigCache = new Map<string, string>();
export async function compressSignaturesBatch(
  urls: (string | null | undefined)[],
  maxW = 600,
  maxH = 200,
): Promise<(string | null)[]> {
  return Promise.all(
    urls.map(async (u) => {
      if (!u) return null;
      const cacheKey = u.length < 200 ? u : u.slice(0, 64) + ":" + u.length;
      const hit = _sigCache.get(cacheKey);
      if (hit) return hit;
      const out = (await compressSignatureForPdf(u, maxW, maxH)) ?? null;
      if (out) _sigCache.set(cacheKey, out);
      return out;
    }),
  );
}

/** Baixa uma URL pública de assinatura e devolve uma PNG com fundo transparente. */
export async function fetchSignatureAsCleanDataUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
    return await cleanSignatureDataUrl(dataUrl);
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}