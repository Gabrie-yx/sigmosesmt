/**
 * Calendário do Processo Eleitoral da CIPA — gerado a partir da data da POSSE da nova gestão.
 * Modelo DMN protocolado no Sindicato (prazos legais NR-05 5.5.x):
 * data exata = cálculo do prazo; data corrigida = se cair em fim de semana/feriado,
 * antecipa para o dia útil anterior (sempre ANTES, para nunca perder o prazo legal).
 */
import { addDays } from "./cipa-eleicao";

export type EtapaKey =
  | "edital_convocacao" | "comissao_eleitoral" | "copia_sindicato" | "inicio_inscricoes"
  | "edital_inscricao" | "fim_inscricoes" | "lista_candidatos" | "eleicao" | "apuracao"
  | "resultado_sindicato" | "treinamento" | "posse";

export type Etapa = { key: EtapaKey; etapa: string; prazo: string; exata: string; corrigida: string; ajustada?: boolean };

const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25", "10-24", "09-05"]; // nacionais + Manaus (24/10) + AM (05/09)

function pascoa(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isFeriado(iso: string) {
  if (FERIADOS_FIXOS.includes(iso.slice(5, 10))) return true;
  const p = pascoa(Number(iso.slice(0, 4)));
  return [addDays(p, -48), addDays(p, -47), addDays(p, -2), addDays(p, 60)].includes(iso.slice(0, 10));
}
export function isDiaUtilBr(iso: string) {
  const w = new Date(iso.slice(0, 10) + "T00:00:00").getDay();
  return w !== 0 && w !== 6 && !isFeriado(iso);
}
export function uteisAntes(iso: string) {
  let d = iso.slice(0, 10);
  while (!isDiaUtilBr(d)) d = addDays(d, -1);
  return d;
}
export function diaSemana(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long" });
}

export function calcularCalendario(posse: string, overrides: Partial<Record<EtapaKey, string>> = {}): Etapa[] {
  const out: Etapa[] = [];
  const put = (key: EtapaKey, etapa: string, prazo: string, exata: string) => {
    const corrigida = overrides[key] || uteisAntes(exata);
    out.push({ key, etapa, prazo, exata, corrigida, ajustada: !!overrides[key] });
    return corrigida;
  };
  const conv = put("edital_convocacao", "Edital de convocação para eleição", "60 dias antes da posse", addDays(posse, -60));
  put("comissao_eleitoral", "Formação da comissão eleitoral", "55 dias antes do término do mandato", addDays(posse, -55));
  put("copia_sindicato", "Enviar cópia do edital de convocação ao sindicato", "5 dias após a convocação", addDays(conv, 5));
  const eleicaoExata = addDays(posse, -31);
  const ini = put("inicio_inscricoes", "Início das inscrições dos candidatos", "20 dias antes da eleição", addDays(uteisAntes(eleicaoExata), -20));
  put("edital_inscricao", "Publicação do edital de inscrição de candidatos", "45 dias antes do término do mandato", addDays(posse, -45));
  const fim = put("fim_inscricoes", "Término das inscrições", "mínimo 15 dias de inscrição", addDays(ini, 14));
  put("lista_candidatos", "Publicação da relação de candidatos", "1 dia após o término das inscrições", addDays(fim, 1));
  const el = put("eleicao", "Eleição", "30 dias antes do término do mandato", eleicaoExata);
  put("apuracao", "Apuração dos votos", "no dia da eleição", el);
  put("resultado_sindicato", "Comunicar resultado e data da posse ao sindicato", "até 5 dias após a eleição", addDays(el, 5));
  put("treinamento", "Treinamento dos membros eleitos e indicados", "antes da posse", addDays(posse, -5));
  out.push({ key: "posse", etapa: "Posse da nova gestão", prazo: "1º dia após o término do mandato", exata: posse, corrigida: overrides.posse || posse, ajustada: !!overrides.posse });
  return out;
}

export function etapa(cal: Etapa[], k: EtapaKey) {
  return cal.find((e) => e.key === k)?.corrigida ?? "";
}
