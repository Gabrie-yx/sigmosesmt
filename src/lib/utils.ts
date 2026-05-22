import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Title Case PT-BR: nomes próprios em "Aldeniy Nunes Camurca",
// preposições em minúsculo ("de", "da", "do", ...). Hifenizados também.
export function toTitleCasePT(s: string | null | undefined): string {
  if (!s) return "";
  const minusc = new Set([
    "de", "da", "do", "das", "dos", "e",
    "di", "du", "del", "la", "le", "von", "van",
  ]);
  return s
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (i > 0 && minusc.has(w)) return w;
      return w
        .split("-")
        .map((p) => (p.length === 0 ? p : p[0].toUpperCase() + p.slice(1)))
        .join("-");
    })
    .join(" ");
}
