/**
 * Regras do processo eleitoral da CIPA — NR-05 itens 5.5.x + Requisitos de CAL (DMN).
 * Funções puras para prazos, participação (5.5.4) e classificação dos candidatos.
 */

export type Candidato = {
  employee_id: string;
  nome: string;
  inscricao_em: string; // data da inscrição (início da estabilidade)
  comprovante: boolean; // comprovante de inscrição entregue (5.5.3 c)
  votos: number | null;
  admissao?: string | null; // desempate por tempo de serviço (5.5.7)
};

export type EleicaoDados = {
  extraordinaria?: boolean; // vacância sem suplentes nos 1ºs 6 meses → prazos pela metade
  comissao_eleitoral?: string; // nomes (presidente + vice ou designada pela organização)
  sindicato_comunicado_em?: string;
  sindicato_comprovante?: string; // e-mail com confirmação / protocolo
  edital_publicado_em?: string;
  edital_local?: string;
  inscricao_inicio?: string;
  inscricao_fim?: string;
  inscritos_publicados_em?: string;
  votacao_data?: string;
  votacao_meio?: "URNA" | "ELETRONICO" | "";
  sigilo_garantido?: boolean; // 5.5.3 h/j — segurança, sigilo e precisão
  turnos_contemplados?: boolean; // dia normal de trabalho, respeitando turnos
  eleitores_aptos?: number | null;
  votantes_dia1?: number | null;
  votantes_dia2?: number | null;
  votantes_dia3?: number | null;
  apuracao_data?: string;
  apuracao_acompanhantes?: string; // representantes da organização e dos empregados
  ata_eleicao_url?: string;
  posse_data?: string;
  candidatos?: Candidato[];
};

const DAY = 86400000;
export function addDays(iso: string, n: number) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string) {
  return Math.round((new Date(b.slice(0, 10) + "T00:00:00").getTime() - new Date(a.slice(0, 10) + "T00:00:00").getTime()) / DAY);
}

/** Prazos-limite a partir do fim do mandato em curso. Extraordinária: metade. */
export function prazosEleicao(fimMandato: string, extraordinaria = false) {
  const f = extraordinaria ? 0.5 : 1;
  return {
    editalAte: addDays(fimMandato, -Math.ceil(60 * f)), // 5.5.1 convocação ≥ 60 dias
    inscricaoMinDias: Math.ceil(15 * f), // 5.5.3 b ≥ 15 dias corridos
    votacaoAte: addDays(fimMandato, -Math.ceil(30 * f)), // 5.5.3 f ≥ 30 dias
    posse: addDays(fimMandato, 1), // posse no 1º dia útil após o término
  };
}

export type Check = { ok: boolean | null; item: string; texto: string };

export function checarEleicao(fimMandato: string, e: EleicaoDados): Check[] {
  const p = prazosEleicao(fimMandato, !!e.extraordinaria);
  const c: Check[] = [];
  const le = (a?: string, b?: string) => (a && b ? a <= b : null);
  c.push({ item: "5.5.2", ok: e.comissao_eleitoral ? true : null, texto: "Comissão eleitoral constituída pelo Presidente e Vice (ou pela organização, se não houver CIPA)" });
  c.push({ item: "5.5.1.1", ok: e.sindicato_comunicado_em ? (e.edital_publicado_em ? e.sindicato_comunicado_em <= e.edital_publicado_em : true) && !!e.sindicato_comprovante : null, texto: "Sindicato da categoria preponderante comunicado com antecedência, com confirmação de entrega" });
  c.push({ item: "5.5.1", ok: le(e.edital_publicado_em, p.editalAte), texto: `Edital publicado em local de fácil acesso até ${fmt(p.editalAte)} (≥ ${e.extraordinaria ? 30 : 60} dias do fim do mandato)` });
  const dur = e.inscricao_inicio && e.inscricao_fim ? diffDays(e.inscricao_inicio, e.inscricao_fim) + 1 : null;
  c.push({ item: "5.5.3 b", ok: dur === null ? null : dur >= p.inscricaoMinDias, texto: `Inscrições abertas por ≥ ${p.inscricaoMinDias} dias corridos${dur !== null ? ` (atual: ${dur})` : ""}` });
  const cand = e.candidatos ?? [];
  c.push({ item: "5.5.3 c", ok: cand.length ? cand.every((x) => x.comprovante) : null, texto: "Comprovante de inscrição fornecido a todos os inscritos" });
  c.push({ item: "5.5.3 e", ok: e.inscritos_publicados_em ? (e.inscricao_fim ? e.inscritos_publicados_em >= e.inscricao_fim && (!e.votacao_data || e.inscritos_publicados_em < e.votacao_data) : true) : null, texto: "Relação de inscritos publicada após o fim das inscrições e antes da votação" });
  c.push({ item: "5.5.3 f", ok: le(e.votacao_data, p.votacaoAte), texto: `Eleição realizada até ${fmt(p.votacaoAte)} (≥ ${e.extraordinaria ? 15 : 30} dias do fim do mandato)` });
  c.push({ item: "5.5.3 g", ok: e.votacao_data ? (isDiaUtil(e.votacao_data) && !!e.turnos_contemplados) : null, texto: "Eleição em dia normal de trabalho, contemplando todos os turnos" });
  c.push({ item: "5.5.3 h/j", ok: e.votacao_meio ? !!e.sigilo_garantido : null, texto: "Voto secreto em processo que garante segurança, sigilo e precisão do registro" });
  const part = avaliarParticipacao(e);
  c.push({ item: "5.5.4", ok: part.valida, texto: part.texto });
  c.push({ item: "5.5.3 i", ok: e.apuracao_data ? (isDiaUtil(e.apuracao_data) && !!e.apuracao_acompanhantes?.trim()) : null, texto: "Apuração em horário normal com representantes da organização e dos empregados" });
  c.push({ item: "5.5.6", ok: e.ata_eleicao_url ? true : null, texto: "Ata de eleição lavrada e arquivada (5 anos)" });
  return c;
}

export function avaliarParticipacao(e: EleicaoDados): { valida: boolean | null; texto: string; acao?: string } {
  const aptos = e.eleitores_aptos ?? 0;
  if (!aptos || e.votantes_dia1 == null) return { valida: null, texto: "Participação mínima de 50% dos empregados (5.5.4) — informe eleitores e votantes" };
  const d1 = e.votantes_dia1 ?? 0;
  const pct = (v: number) => `${((v / aptos) * 100).toFixed(1)}%`;
  if (d1 / aptos >= 0.5) return { valida: true, texto: `Participação ${pct(d1)} ≥ 50% no 1º dia — apuração liberada (5.5.4)` };
  if (e.votantes_dia2 == null) return { valida: false, texto: `Participação ${pct(d1)} < 50%: NÃO apurar. Prorrogar a votação para o dia seguinte, somando os votos já registrados (5.5.4)`, acao: "PRORROGAR_1" };
  const d2 = e.votantes_dia2;
  if (d2 / aptos >= 1 / 3) return { valida: true, texto: `Acumulado ${pct(d2)} ≥ 1/3 no 2º dia — eleição válida (5.5.4)` };
  if (e.votantes_dia3 == null) return { valida: false, texto: `Acumulado ${pct(d2)} < 1/3: NÃO apurar. Prorrogar mais um dia; será válida com qualquer participação (5.5.4.1)`, acao: "PRORROGAR_2" };
  return { valida: true, texto: `3º dia (${pct(e.votantes_dia3)}) — válida com qualquer participação (5.5.4.1)` };
}

/** Classificação: mais votados = titulares; demais votados = suplentes em ordem decrescente.
 *  Empate → maior tempo de serviço no estabelecimento (5.5.7). */
export function classificar(cands: Candidato[], efetivos: number, suplentes: number) {
  const votados = cands.filter((c) => (c.votos ?? 0) > 0).slice().sort((a, b) => {
    const dv = (b.votos ?? 0) - (a.votos ?? 0);
    if (dv) return dv;
    return (a.admissao ?? "9999").localeCompare(b.admissao ?? "9999");
  });
  return {
    titulares: votados.slice(0, efetivos),
    suplentes: votados.slice(efetivos, efetivos + suplentes),
    empates: votados.some((c, i) => i > 0 && c.votos === votados[i - 1].votos),
  };
}

export function isDiaUtil(iso: string) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00").getDay();
  return d !== 0 && d !== 6;
}
export function fmt(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
/** Estabilidade do eleito: registro da candidatura até 1 ano após o fim do mandato (ADCT art. 10, II, a; CLT 165). */
export function fimEstabilidade(fimMandato: string) {
  const d = new Date(fimMandato + "T00:00:00");
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
