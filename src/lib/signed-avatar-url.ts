// Bloco 1 (Onda 1) — helper de URL assinada pro bucket `avatars`.
//
// Objetivo: parar de depender da URL pública das fotos de colaborador.
// Hoje qualquer pessoa com o link acessa a foto direto do S3. O plano é
// tornar o bucket privado e servir sempre via URL assinada (TTL 1h).
//
// Este helper é drop-in: recebe o que já está gravado em `employees.foto_url`
// (URL pública histórica) OU um path novo (`employees/<id>/xxx.jpg`) e devolve
// uma URL assinada. Se não conseguir assinar (ex.: URL externa, offline), cai
// de volta pro valor original — nada quebra visualmente.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
const TTL_SECONDS = 60 * 60; // 1h

// Cache em memória (URL assinada → expira em X). Evita gerar 500 signed URLs
// pra mesma foto quando a lista de colaboradores re-renderiza.
type CacheEntry = { url: string; exp: number };
const cache = new Map<string, CacheEntry>();

export function extractAvatarPath(input: string | null | undefined): string | null {
  if (!input) return null;
  // Já é um path relativo (sem esquema)?
  if (!input.includes("://")) return input.replace(/^\/+/, "");
  try {
    const url = new URL(input);
    const marker = `/${BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx < 0) return null;
    // Suporta tanto /object/public/avatars/... quanto /object/sign/avatars/...
    return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export async function signAvatarUrl(
  input: string | null | undefined,
): Promise<string | null> {
  if (!input) return null;
  const path = extractAvatarPath(input);
  if (!path) return input; // URL externa (imgur, etc) — devolve como está

  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.exp > now + 60_000) return hit.url;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS);
  if (error || !data?.signedUrl) return input; // fallback graceful

  cache.set(path, { url: data.signedUrl, exp: now + TTL_SECONDS * 1000 });
  return data.signedUrl;
}

export function useSignedAvatarUrl(src: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!src) return null;
    const path = extractAvatarPath(src);
    if (!path) return src;
    const hit = cache.get(path);
    return hit && hit.exp > Date.now() + 60_000 ? hit.url : null;
  });

  useEffect(() => {
    let alive = true;
    if (!src) { setUrl(null); return; }
    signAvatarUrl(src).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src]);

  return url;
}