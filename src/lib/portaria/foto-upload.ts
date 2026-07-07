// Captura, comprime e envia foto para o bucket privado `portaria-fotos`.
// A câmera traseira é priorizada via <input capture="environment"> no HTML.
// A imagem é reduzida para ~1280px no lado maior e re-encodada em JPEG 0.75
// antes do upload — mantém legibilidade da placa/rosto e economiza tráfego
// no celular do porteiro (típico: 3MB → 150-250KB).

import { supabase } from "@/integrations/supabase/client";

export type FotoTipo = "rosto" | "documento" | "placa" | "bagageiro" | "acompanhante1" | "acompanhante2";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.75;
const BUCKET = "portaria-fotos";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function compressImageFile(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((res) => {
    const fr = new FileReader();
    fr.onloadend = () => res(fr.result as string);
    fr.readAsDataURL(file);
  });
  const img = await loadImage(dataUrl);
  const ratio = Math.min(MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight), 1);
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não disponível");
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao comprimir imagem"))), "image/jpeg", JPEG_QUALITY);
  });
}

export async function uploadFotoPortaria(
  file: File,
  tipo: FotoTipo,
  visitaId: string,
): Promise<string> {
  const blob = await compressImageFile(file);
  const hoje = new Date().toISOString().slice(0, 10);
  const path = `${hoje}/${visitaId}/${tipo}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) throw error;
  return path;
}

/** Retorna URL assinada (válida por 1h) para exibir uma foto do bucket privado. */
export async function getFotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}