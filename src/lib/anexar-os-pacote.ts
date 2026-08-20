import { supabase } from "@/integrations/supabase/client";

export type OsAnexo = { bucket: string; path: string; rotulo: string };

/**
 * Baixa os PDFs das OS informadas e os anexa (merge) ao final do PDF do pacote
 * de rescisão. Nenhuma OS nova é emitida — apenas evidência documental existente.
 * Retorna os bytes do PDF final e a lista de OS efetivamente anexadas.
 */
export async function anexarOsAoPacote(
  pacoteBytes: ArrayBuffer | Uint8Array,
  anexos: OsAnexo[],
): Promise<{ bytes: Uint8Array; anexadas: string[]; falhas: string[] }> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const base = await PDFDocument.load(pacoteBytes as any);
  const font = await base.embedFont(StandardFonts.HelveticaBold);
  const anexadas: string[] = [];
  const falhas: string[] = [];

  for (const a of anexos) {
    try {
      const { data, error } = await supabase.storage.from(a.bucket).download(a.path);
      if (error || !data) throw error ?? new Error("arquivo não encontrado");
      const buf = await data.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const pages = await base.copyPages(src, src.getPageIndices());
      pages.forEach((p, i) => {
        base.addPage(p);
        if (i === 0) {
          const { width, height } = p.getSize();
          p.drawText(`ANEXO — ${a.rotulo}`.slice(0, 90), {
            x: 24,
            y: height - 16,
            size: 7,
            font,
            color: rgb(0.45, 0.45, 0.45),
          });
          void width;
        }
      });
      anexadas.push(a.rotulo);
    } catch {
      falhas.push(a.rotulo);
    }
  }

  const bytes = await base.save();
  return { bytes, anexadas, falhas };
}
