export type ProximosPassos = {
  proximaInspecaoMensal: Date | null;
  proximaRecarga: Date | null;
  proximoTesteHidrostatico: Date | null;
};

function parseISO(d?: string | null): Date | null {
  if (!d) return null;
  const iso = String(d).split("T")[0];
  const [y, m, day] = iso.split("-").map((x) => Number(x));
  if (!y || !m || !day) return null;
  const dt = new Date(y, m - 1, day);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Calcula próximos passos regulatórios (NBR 12962). */
export function calcularProximosPassos(
  extintor: any,
  ultimaInspecaoData?: string | null,
): ProximosPassos {
  // Inspeção mensal: última inspeção + 1 mês (ou mês corrente se não houver)
  let proximaInspecaoMensal: Date | null = null;
  const ult = parseISO(ultimaInspecaoData);
  if (ult) {
    proximaInspecaoMensal = addMonths(ult, 1);
  } else {
    const hoje = new Date();
    proximaInspecaoMensal = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }

  // Recarga (manutenção 2º grau): última recarga + 12 meses, ou campo proxima_recarga
  let proximaRecarga: Date | null = null;
  const ultRec = parseISO(extintor?.data_ultima_recarga);
  if (ultRec) {
    proximaRecarga = addMonths(ultRec, 12);
  } else {
    proximaRecarga = parseISO(extintor?.proxima_recarga);
  }

  // Teste hidrostático (3º grau): ano_teste_hidrostatico + 5 anos (mantém mês da última recarga, ou março como padrão técnico)
  let proximoTesteHidrostatico: Date | null = null;
  const ano = Number(extintor?.ano_teste_hidrostatico);
  if (ano && ano > 1900) {
    const mes = ultRec ? ultRec.getMonth() : 2; // março fallback
    proximoTesteHidrostatico = new Date(ano + 5, mes, 1);
  }

  return { proximaInspecaoMensal, proximaRecarga, proximoTesteHidrostatico };
}

export function formatMesAnoBR(d: Date | null): string {
  if (!d) return "—";
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

export function isVencido(d: Date | null): boolean {
  if (!d) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d.getTime() < hoje.getTime();
}