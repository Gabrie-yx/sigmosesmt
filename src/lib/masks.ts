// Máscaras de formatação para campos brasileiros

export function maskCPF(v: string) {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCNPJ(v: string) {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskPhone(v: string) {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function maskCEP(v: string) {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function maskRG(v: string) {
  // RG aceita números e X (dígito verificador)
  return (v ?? "").replace(/[^\dXx]/g, "").toUpperCase().slice(0, 12);
}

export function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}