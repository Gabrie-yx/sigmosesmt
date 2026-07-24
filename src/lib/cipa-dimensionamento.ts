/**
 * Dimensionamento CIPA — NR-05 (Portaria MTP 4.219/2022), Quadro I resumido.
 *
 * Cruza Grau de Risco (1-4) × nº de empregados do estabelecimento e sugere:
 *  - `modo`: DESIGNADO (5.6.4) ou COMISSAO paritária.
 *  - Composição mínima (efetivos/suplentes) por bancada.
 *  - Carga horária mínima de capacitação (item 5.7 — 20 h para GR3/GR4, 8 h demais).
 *
 * Isolado do route file para permitir reuso (PDF, dashboards) e evitar
 * warning de code-splitting do TanStack Router.
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

export function dimensionarCipa(gr: number | null, n: number | null): CipaSugestao | null {
  if (!gr || !n || n <= 0) return null;
  // Piso de eleição paritária por grau de risco (Quadro I NR-05).
  // Valores conforme parâmetro adotado no SIGMO — o Quadro I completo depende
  // do CNAE do estabelecimento; ajuste manual quando o grupo (C-XX) exigir.
  //   GR1/GR2: comissão a partir de 51 empregados.
  //   GR3    : comissão a partir de 20 empregados.
  //   GR4    : comissão a partir de 30 empregados (20-29 = designado).
  const piso = gr === 4 ? 30 : gr === 3 ? 20 : 51;
  const carga = gr >= 3 ? 20 : 8;
  if (n < piso) {
    return {
      modo: "DESIGNADO",
      efetivosEmpregador: 0,
      suplentesEmpregador: 0,
      efetivosEmpregados: 0,
      suplentesEmpregados: 0,
      cargaTreinamento: carga,
      nota:
        n < 20
          ? `Estabelecimento com menos de 20 empregados: designado obrigatório (NR-05 item 5.6.3).`
          : `Grau de Risco ${gr} com ${n} empregados: abaixo do Quadro I → designa 1 empregado (NR-05 item 5.6.4). Sem estabilidade do art. 10, II, "a" ADCT, salvo previsão em ACT/CCT.`,
    };
  }
  // Faixas simplificadas do Quadro I (composição mínima por bancada):
  const faixa =
    n <= 50 ? { ef: 1, su: 1 } :
    n <= 100 ? { ef: 3, su: 3 } :
    n <= 500 ? { ef: 4, su: 4 } :
    n <= 1000 ? { ef: 6, su: 6 } :
    { ef: 9, su: 7 };
  return {
    modo: "COMISSAO",
    efetivosEmpregador: faixa.ef,
    suplentesEmpregador: faixa.su,
    efetivosEmpregados: faixa.ef,
    suplentesEmpregados: faixa.su,
    cargaTreinamento: carga,
    nota: `Comissão paritária: ${faixa.ef} efetivos + ${faixa.su} suplentes por bancada. Mandato 1 ano, permitida 1 reeleição. Estabilidade dos eleitos: art. 10, II, "a" ADCT.`,
  };
}