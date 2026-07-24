// Concatena PDFs de anexos padrão no final de um PDF-mãe (gerado por jsPDF).
// Fluxo: base ArrayBuffer -> pdf-lib PDFDocument -> copyPages(...) de cada anexo.
import { PDFDocument } from "pdf-lib";
import { signedUrlAnexo } from "@/lib/pdf-anexos.functions";

async function fetchAnexoBytes(arquivo_path: string): Promise<ArrayBuffer> {
  const { url } = await signedUrlAnexo({ data: { arquivo_path, expira_seg: 300 } });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar anexo (${res.status})`);
  return await res.arrayBuffer();
}

/**
 * Recebe o PDF base + a lista de anexos escolhidos (id + arquivo_path) e
 * devolve os bytes finais com todos os anexos concatenados após o documento-mãe.
 */
export async function mergeAnexos(
  baseBytes: ArrayBuffer,
  anexos: Array<{ id: string; arquivo_path: string; titulo?: string }>,
): Promise<Uint8Array> {
  if (!anexos.length) return new Uint8Array(baseBytes);
  const basePdf = await PDFDocument.load(baseBytes, { ignoreEncryption: true });
  for (const a of anexos) {
    try {
      const ab = await fetchAnexoBytes(a.arquivo_path);
      const src = await PDFDocument.load(ab, { ignoreEncryption: true });
      const pages = await basePdf.copyPages(src, src.getPageIndices());
      pages.forEach((p) => basePdf.addPage(p));
    } catch (err) {
      console.error(`[mergeAnexos] falha no anexo "${a.titulo ?? a.id}"`, err);
    }
  }
  return await basePdf.save();
}