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