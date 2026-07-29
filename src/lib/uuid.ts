import { uuid } from "@/lib/uuid";
/**
 * UUID v4 seguro em qualquer contexto.
 *
 * `uuid()` só existe em "secure contexts" (HTTPS ou localhost).
 * O SIGMO roda em servidor interno via HTTP, onde o Chrome deixa essa função
 * indefinida — o que quebrava telas inteiras (ex.: adicionar funcionário na
 * lista de hora extra). Aqui usamos randomUUID quando disponível,
 * getRandomValues como segunda opção e Math.random como último recurso.
 */
export function uuid(): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
