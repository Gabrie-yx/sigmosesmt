// Campos dinâmicos das Unidades Operacionais (Casco / Obra / Loja / Frota…).
// Você define os campos numa tela; o formulário se monta sozinho a partir daqui.

export type CampoTipo =
  | "texto"
  | "texto_longo"
  | "numero"
  | "moeda"
  | "data"
  | "hora"
  | "lista"
  | "sim_nao"
  | "telefone"
  | "whatsapp"
  | "email"
  | "cpf"
  | "cnpj"
  | "cep"
  | "anexo"
  | "pessoa";

export type CampoDef = {
  id: string;
  company_id: string | null;
  aba: string;
  aba_ordem: number;
  chave: string;
  label: string;
  tipo: CampoTipo;
  obrigatorio: boolean;
  ordem: number;
  opcoes: string[];
  ajuda: string | null;
  mostrar_lista: boolean;
  ativo: boolean;
};

export const TIPOS_CAMPO: { key: CampoTipo; label: string; descricao: string }[] = [
  { key: "texto", label: "Texto", descricao: "Uma linha de texto livre" },
  { key: "texto_longo", label: "Texto longo", descricao: "Várias linhas" },
  { key: "numero", label: "Número", descricao: "Somente números" },
  { key: "moeda", label: "Moeda (R$)", descricao: "Valor em reais" },
  { key: "data", label: "Data", descricao: "Calendário (dd/mm/aaaa)" },
  { key: "hora", label: "Hora", descricao: "Horário (hh:mm)" },
  { key: "lista", label: "Lista de opções", descricao: "Opções que você cadastra" },
  { key: "sim_nao", label: "Sim / Não", descricao: "Chave liga-desliga" },
  { key: "telefone", label: "Telefone", descricao: "(00) 00000-0000" },
  { key: "whatsapp", label: "WhatsApp", descricao: "(00) 00000-0000, vira link" },
  { key: "email", label: "E-mail", descricao: "Com validação e link" },
  { key: "cpf", label: "CPF", descricao: "000.000.000-00 com validação" },
  { key: "cnpj", label: "CNPJ", descricao: "00.000.000/0000-00 com validação" },
  { key: "cep", label: "CEP", descricao: "00000-000" },
  { key: "anexo", label: "Anexo", descricao: "Arquivo enviado ao SIGMO" },
  { key: "pessoa", label: "Pessoa cadastrada", descricao: "Escolher um funcionário" },
];

export const ABA_IDENTIFICACAO = "Identificação";

// ---------- máscaras ----------
const so = (v: string) => v.replace(/\D+/g, "");

export function mascarar(tipo: CampoTipo, valor: string): string {
  const v = valor ?? "";
  switch (tipo) {
    case "telefone":
    case "whatsapp": {
      const d = so(v).slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : "";
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    case "cpf": {
      const d = so(v).slice(0, 11);
      return d
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
    }
    case "cnpj": {
      const d = so(v).slice(0, 14);
      return d
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    case "cep": {
      const d = so(v).slice(0, 8);
      return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    }
    case "moeda": {
      const d = so(v).slice(0, 15);
      if (!d) return "";
      const n = Number(d) / 100;
      return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case "numero":
      return v.replace(/[^\d.,-]/g, "");
    default:
      return v;
  }
}

// ---------- validações ----------
export function cpfValido(valor: string): boolean {
  const c = so(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
  let d1 = ((s * 10) % 11) % 10;
  if (d1 !== Number(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
  const d2 = ((s * 10) % 11) % 10;
  return d2 === Number(c[10]);
}

export function cnpjValido(valor: string): boolean {
  const c = so(valor);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    let peso = base.length - 7;
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(c.slice(0, 12)) === Number(c[12]) && calc(c.slice(0, 13)) === Number(c[13]);
}

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim());
}

/** Retorna mensagem de erro ou null. */
export function validarCampo(def: CampoDef, valor: unknown): string | null {
  const vazio =
    valor === null ||
    valor === undefined ||
    (typeof valor === "string" && valor.trim() === "") ||
    (Array.isArray(valor) && valor.length === 0);

  if (def.obrigatorio && vazio && def.tipo !== "sim_nao") {
    return `${def.label} é obrigatório`;
  }
  if (vazio) return null;

  const s = String(valor);
  if (def.tipo === "cpf" && !cpfValido(s)) return `${def.label}: CPF inválido`;
  if (def.tipo === "cnpj" && !cnpjValido(s)) return `${def.label}: CNPJ inválido`;
  if (def.tipo === "email" && !emailValido(s)) return `${def.label}: e-mail inválido`;
  if (def.tipo === "cep" && so(s).length !== 8) return `${def.label}: CEP incompleto`;
  if ((def.tipo === "telefone" || def.tipo === "whatsapp") && so(s).length < 10) {
    return `${def.label}: telefone incompleto`;
  }
  return null;
}

// ---------- exibição ----------
export function formatarValor(def: CampoDef, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (def.tipo) {
    case "sim_nao":
      return valor === true || valor === "true" ? "Sim" : "Não";
    case "moeda":
      return `R$ ${String(valor)}`;
    case "data": {
      const [a, m, d] = String(valor).split("-");
      return d ? `${d}/${m}/${a}` : String(valor);
    }
    case "anexo":
      return "Anexo";
    default:
      return String(valor);
  }
}

export function linkWhatsapp(valor: string) {
  const d = so(valor);
  return `https://wa.me/55${d}`;
}

/** Gera uma chave estável a partir do rótulo digitado. */
export function chaveDe(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Agrupa os campos por aba, respeitando a ordem definida. */
export function agruparPorAba(campos: CampoDef[]): { aba: string; campos: CampoDef[] }[] {
  const mapa = new Map<string, CampoDef[]>();
  const ordemAba = new Map<string, number>();
  for (const c of campos.filter((x) => x.ativo)) {
    if (!mapa.has(c.aba)) mapa.set(c.aba, []);
    mapa.get(c.aba)!.push(c);
    const atual = ordemAba.get(c.aba);
    if (atual === undefined || c.aba_ordem < atual) ordemAba.set(c.aba, c.aba_ordem);
  }
  return [...mapa.entries()]
    .sort((a, b) => (ordemAba.get(a[0])! - ordemAba.get(b[0])!) || a[0].localeCompare(b[0]))
    .map(([aba, cs]) => ({ aba, campos: cs.sort((a, b) => a.ordem - b.ordem) }));
}
