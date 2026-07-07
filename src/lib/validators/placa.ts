// Validador de placa brasileira — modelo antigo (AAA-0000) e Mercosul (AAA0A00).
// Retorna sempre uppercase, sem hífen, para gravar no banco.

const RX_ANTIGA = /^[A-Z]{3}[0-9]{4}$/;
const RX_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const RX_NORMALIZADA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function normalizePlaca(v: string): string {
  return (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

export function isValidPlaca(v: string): boolean {
  const p = normalizePlaca(v);
  if (p.length !== 7) return false;
  return RX_ANTIGA.test(p) || RX_MERCOSUL.test(p) || RX_NORMALIZADA.test(p);
}

export function maskPlaca(v: string): string {
  const p = normalizePlaca(v);
  if (p.length <= 3) return p;
  return `${p.slice(0, 3)}-${p.slice(3)}`;
}