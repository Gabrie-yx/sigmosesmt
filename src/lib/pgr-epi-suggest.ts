// Heurística local: sugere EPIs do estoque para um risco do PGR
// a partir de categoria + palavras-chave do perigo/agravo.
// Não usa IA — é determinístico e roda 100% no cliente.

export type EstoqueEpiLite = {
  id: string;
  nome_material: string;
  codigo_material: string | null;
  ca: string | null;
  quantidade_atual: number | null;
};

export type RiscoLite = {
  categoria: string;
  perigo: string;
  agravo: string | null;
};

export type EpiSugestao = {
  epi: EstoqueEpiLite;
  motivo: string;
  obrigatorio: boolean;
  score: number;
};

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Regras: categoria + gatilhos no perigo/agravo -> palavras-chave no nome do EPI */
type Regra = {
  categoria?: string[];           // ex: ["FISICO"]
  gatilhos: string[];             // termos no perigo/agravo que ativam a regra
  epiKeywords: string[];          // termos no nome_material do EPI
  motivo: string;
  obrigatorio?: boolean;          // default true
};

const REGRAS: Regra[] = [
  // FÍSICOS
  { categoria: ["FISICO"], gatilhos: ["ruido", "decibel", "db"], epiKeywords: ["protetor auricular", "abafador", "plug", "concha"], motivo: "Atenuação de ruído (NR-15 An. 1)", obrigatorio: true },
  { categoria: ["FISICO"], gatilhos: ["calor", "ibutg", "termico"], epiKeywords: ["uniforme termico", "manga longa", "boné arabe", "protetor solar"], motivo: "Exposição a calor (NR-15 An. 3)" },
  { categoria: ["FISICO"], gatilhos: ["frio", "camara fria"], epiKeywords: ["jaqueta termica", "luva termica"], motivo: "Exposição a frio (NR-15 An. 9)" },
  { categoria: ["FISICO"], gatilhos: ["vibracao"], epiKeywords: ["luva antivibração", "luva anti vibracao"], motivo: "Vibração mão-braço (NR-15 An. 8)" },
  { categoria: ["FISICO"], gatilhos: ["radiacao nao ionizante", "uv", "solda", "soldagem"], epiKeywords: ["mascara de solda", "óculos solda", "avental raspa", "perneira raspa", "luva raspa"], motivo: "Radiação não ionizante / solda" },
  { categoria: ["FISICO"], gatilhos: ["radiacao ionizante", "raio x"], epiKeywords: ["avental plumbifero", "dosimetro"], motivo: "Radiação ionizante" },
  { categoria: ["FISICO"], gatilhos: ["umidade"], epiKeywords: ["bota pvc", "capa chuva", "luva pvc"], motivo: "Umidade (NR-15 An. 10)" },

  // QUÍMICOS
  { categoria: ["QUIMICO"], gatilhos: ["poeira", "particulado", "silica", "fumo"], epiKeywords: ["respirador", "pff2", "pff1", "pff3", "mascara descart"], motivo: "Aerodispersóides (NR-15 An. 11/12)", obrigatorio: true },
  { categoria: ["QUIMICO"], gatilhos: ["vapor organico", "solvente", "tinta", "thinner"], epiKeywords: ["respirador", "filtro vo", "cartucho", "mascara semifacial"], motivo: "Vapores orgânicos" },
  { categoria: ["QUIMICO"], gatilhos: ["acido", "alcali", "soda", "produto quimico"], epiKeywords: ["luva nitrilica", "luva pvc", "luva neoprene", "avental quimico", "óculos ampla"], motivo: "Contato com químico" },
  { categoria: ["QUIMICO"], gatilhos: ["graxa", "oleo"], epiKeywords: ["luva nitrilica", "luva latex"], motivo: "Óleos/graxas" },

  // BIOLÓGICOS
  { categoria: ["BIOLOGICO"], gatilhos: ["biologico", "virus", "bacteria", "sangue", "fluido"], epiKeywords: ["luva latex", "luva nitrilica", "mascara cirurgica", "avental", "óculos ampla"], motivo: "Agente biológico (NR-32)", obrigatorio: true },

  // ERGONÔMICOS
  { categoria: ["ERGONOMICO"], gatilhos: ["levantamento", "peso", "carga"], epiKeywords: ["cinta lombar", "luva multitato"], motivo: "Movimentação manual de cargas", obrigatorio: false },
  { categoria: ["ERGONOMICO"], gatilhos: ["postura", "repetitivo"], epiKeywords: ["palmilha", "apoio"], motivo: "Postura/repetição", obrigatorio: false },

  // ACIDENTES (mecânicos / queda / elétrico / fogo)
  { categoria: ["ACIDENTE"], gatilhos: ["queda", "altura", "trabalho em altura"], epiKeywords: ["cinto paraquedista", "talabarte", "trava queda", "capacete jugular"], motivo: "Trabalho em altura (NR-35)", obrigatorio: true },
  { categoria: ["ACIDENTE"], gatilhos: ["eletric", "choque", "arco eletrico"], epiKeywords: ["luva isolante", "capacete classe b", "vestimenta arco", "calçado eletrico"], motivo: "Risco elétrico (NR-10)", obrigatorio: true },
  { categoria: ["ACIDENTE"], gatilhos: ["corte", "perfuracao", "objeto cortante", "lamina"], epiKeywords: ["luva anticorte", "luva malha aco", "luva vaqueta"], motivo: "Risco de corte/perfuração" },
  { categoria: ["ACIDENTE"], gatilhos: ["projecao", "particula", "estilhaco"], epiKeywords: ["óculos seguranca", "protetor facial", "viseira"], motivo: "Projeção de partículas" },
  { categoria: ["ACIDENTE"], gatilhos: ["impacto", "queda objeto", "cabeca"], epiKeywords: ["capacete"], motivo: "Impacto na cabeça (NR-6)", obrigatorio: true },
  { categoria: ["ACIDENTE"], gatilhos: ["esmagamento", "pe", "queda objeto pe"], epiKeywords: ["bota seguranca", "calçado biqueira", "botina"], motivo: "Esmagamento de pés", obrigatorio: true },
  { categoria: ["ACIDENTE"], gatilhos: ["inflama", "explos", "fogo"], epiKeywords: ["vestimenta retardante", "luva couro", "respirador fuga"], motivo: "Inflamáveis/explosivos (NR-16/20)" },
  { categoria: ["ACIDENTE"], gatilhos: ["espaco confinado"], epiKeywords: ["mascara autonoma", "cinto resgate", "monitor gases"], motivo: "Espaço confinado (NR-33)", obrigatorio: true },
  { categoria: ["ACIDENTE"], gatilhos: ["transito", "atropelamento", "veicular"], epiKeywords: ["colete refletivo", "uniforme alta visibilidade"], motivo: "Visibilidade em trânsito" },
];

export function suggestEpisHeuristic(
  risco: RiscoLite,
  estoque: EstoqueEpiLite[],
): EpiSugestao[] {
  const texto = norm(`${risco.categoria} ${risco.perigo} ${risco.agravo ?? ""}`);
  const sugestoes = new Map<string, EpiSugestao>();

  for (const regra of REGRAS) {
    if (regra.categoria && !regra.categoria.map(norm).includes(norm(risco.categoria))) continue;
    const ativada = regra.gatilhos.some((g) => texto.includes(norm(g)));
    if (!ativada) continue;

    for (const epi of estoque) {
      const nomeNorm = norm(epi.nome_material);
      for (const kw of regra.epiKeywords) {
        if (nomeNorm.includes(norm(kw))) {
          const score = kw.length + (regra.obrigatorio === false ? 0 : 5);
          const atual = sugestoes.get(epi.id);
          if (!atual || atual.score < score) {
            sugestoes.set(epi.id, {
              epi,
              motivo: regra.motivo,
              obrigatorio: regra.obrigatorio !== false,
              score,
            });
          }
          break;
        }
      }
    }
  }

  return Array.from(sugestoes.values()).sort((a, b) => b.score - a.score);
}

/** Lista de palavras-chave esperadas que NÃO foram encontradas no estoque */
export function epiKeywordsFaltantes(
  risco: RiscoLite,
  estoque: EstoqueEpiLite[],
): string[] {
  const texto = norm(`${risco.categoria} ${risco.perigo} ${risco.agravo ?? ""}`);
  const faltam = new Set<string>();
  const nomes = estoque.map((e) => norm(e.nome_material));

  for (const regra of REGRAS) {
    if (regra.categoria && !regra.categoria.map(norm).includes(norm(risco.categoria))) continue;
    if (!regra.gatilhos.some((g) => texto.includes(norm(g)))) continue;

    const algumEncontrado = regra.epiKeywords.some((kw) =>
      nomes.some((n) => n.includes(norm(kw))),
    );
    if (!algumEncontrado) {
      faltam.add(regra.epiKeywords[0]);
    }
  }
  return Array.from(faltam);
}