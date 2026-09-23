/**
 * Dimensionamento CIPA — NR-05 (Portaria SEPRT 422/2021, vigente desde 03/01/2022), Quadro I.
 *
 * O Quadro I da NR-05 é definido por GRAU DE RISCO (NR-04) × nº de empregados do
 * estabelecimento e fornece o nº de EFETIVOS/SUPLENTES da representação dos
 * EMPREGADOS. A representação do EMPREGADOR é paritária (mesmo número — item 5.4.1).
 * Abaixo da primeira faixa com composição, aplica-se o designado (item 5.4.13).
 *
 * Carga horária da capacitação (item 5.7.4.1):
 *   GR1 = 8h · GR2 = 12h · GR3 = 16h · GR4 = 20h.
 */
export type CipaSugestao = {
  modo: "DESIGNADO" | "COMISSAO";
  efetivosEmpregador: number;
  suplentesEmpregador: number;
  efetivosEmpregados: number;
  suplentesEmpregados: number;
  cargaTreinamento: number;
  nota: string;
};

// Faixas do Quadro I (limite superior inclusivo).
export const FAIXAS = [19, 29, 50, 80, 100, 120, 140, 300, 500, 1000, 2500, 5000, 10000];
type C = [number, number] | null;
// [efetivos, suplentes] da representação dos empregados, por GR, por faixa.
export const QUADRO: Record<number, C[]> = {
  1: [null, null, null, null, [1, 1], [1, 1], [1, 1], [1, 1], [2, 2], [4, 3], [5, 4], [6, 5], [8, 6]],
  2: [null, null, null, [1, 1], [1, 1], [2, 1], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [8, 6], [10, 8]],
  3: [null, [1, 1], [1, 1], [2, 1], [2, 1], [2, 1], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [8, 6], [10, 8]],
  4: [null, [1, 1], [2, 1], [3, 2], [3, 2], [4, 2], [4, 3], [4, 3], [5, 4], [6, 4], [8, 6], [10, 8], [12, 8]],
};
// Acréscimo a cada grupo de 2.500 acima de 10.000.
const ACRESCIMO: Record<number, [number, number]> = { 1: [1, 1], 2: [1, 1], 3: [2, 2], 4: [2, 2] };

export const CARGA_CAPACITACAO: Record<number, number> = { 1: 8, 2: 12, 3: 16, 4: 20 };

export function cargaCapacitacao(gr: number | null | undefined): number {
  return CARGA_CAPACITACAO[gr ?? 4] ?? 20;
}

export function dimensionarCipa(gr: number | null, n: number | null): CipaSugestao | null {
  if (!gr || gr < 1 || gr > 4 || !n || n <= 0) return null;
  const carga = cargaCapacitacao(gr);
  let comp: C;
  if (n > 10000) {
    const base = QUADRO[gr][12] as [number, number];
    const grupos = Math.ceil((n - 10000) / 2500);
    comp = [base[0] + grupos * ACRESCIMO[gr][0], base[1] + grupos * ACRESCIMO[gr][1]];
  } else {
    const idx = FAIXAS.findIndex((lim) => n <= lim);
    comp = QUADRO[gr][idx];
  }
  if (!comp) {
    return {
      modo: "DESIGNADO",
      efetivosEmpregador: 0, suplentesEmpregador: 0,
      efetivosEmpregados: 0, suplentesEmpregados: 0,
      cargaTreinamento: carga,
      nota: `GR ${gr} com ${n} empregados: fora do Quadro I → a organização nomeia 1 empregado (NR-05 item 5.4.13), capacitado com ${carga}h. O nomeado não tem a estabilidade do art. 10, II, "a" do ADCT, salvo ACT/CCT.`,
    };
  }
  const [ef, su] = comp;
  return {
    modo: "COMISSAO",
    efetivosEmpregador: ef, suplentesEmpregador: su,
    efetivosEmpregados: ef, suplentesEmpregados: su,
    cargaTreinamento: carga,
    nota: `Quadro I (GR ${gr}, ${n} empregados): ${ef} efetivo(s) + ${su} suplente(s) por representação (paritária). Mandato de 1 ano, permitida 1 reeleição. Estabilidade dos eleitos (titulares e suplentes) desde o registro da candidatura até 1 ano após o fim do mandato.`,
  };
}
