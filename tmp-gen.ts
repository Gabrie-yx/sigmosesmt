import { buildOssPdf } from "./tmp-oss-pdf";
import { writeFileSync } from "fs";
const doc = buildOssPdf({
  revisao: 1, emitido_em: "2026-07-27",
  funcionario: { nome: "Jarlisson da Silva Ribeiro" },
  cargo: "Montador I", setor: "Produção",
  empresa: "NB CONSTRUÇÃO", empresa_cnpj: "23.036.690/0001-34",
  conteudo: {
    descricao_atividades: "Montagem de conjuntos e subconjuntos mecânicos/estruturais em embarcações e equipamentos navais; uso de ferramentas manuais e elétricas (chave de impacto, furadeira, esmerilhadeira); leitura de desenho; auxílio a soldadores e operadores.",
    riscos_texto: "",
    riscos_categorias: {
      fisico: "Ruído de produção (87,3 dB(A) medido em caldeiraria); vibração de ferramentas elétricas; variação térmica.",
      quimico: "Fumos de solda secundária (proximidade); poeiras metálicas; vapores de óleos e desengraxantes.",
      biologico: "Não significativo.",
      ergonomico: "Levantamento e movimentação de peças; postura forçada (agachado, sobre andaimes, posições variadas); movimentos repetitivos; trabalho em altura.",
      acidente: "Queda de mesmo e diferente nível; prensagem entre peças; projeção de partículas; queimadura por respingos de solda; corte por ferramentas; choque elétrico; queda de objetos sobre a cabeça.",
      psicossocial: "Pressão por prazo; cobrança por qualidade do encaixe; trabalho em equipe sob estresse.",
    },
    medidas_preventivas: "Uso de andaimes certificados (NR-18); inspeção diária de ferramentas; içamento de cargas somente com rigger habilitado; PT para trabalho em altura (NR-35); isolamento da área de movimentação de cargas.",
    epis_obrigatorios: "Capacete com jugular\nóculos de segurança - CA 10346\nprotetor auricular plug + concha - CA 5674\nluvas de vaqueta/multitato - CA 25965\ncalçado de segurança com biqueira - CA 36783\nvestimenta de manga longa (algodão) - CA 34627\ncinto/talabarte ao operar acima de 2m - CA 35531",
    proibicoes: "Trabalhar acima de 2m sem cinto/ancoragem; circular sob carga suspensa; usar ferramenta improvisada; remover proteções coletivas.",
    penalidades: "O descumprimento das normas de segurança contidas nesta Ordem de Serviço sujeita o trabalhador às penalidades previstas no art. 158 da CLT (advertência, suspensão e demissão por justa causa).",
    procedimentos_emergencia: "Em queda: NÃO movimentar vítima, acionar SAMU/SESMT, isolar área. Em queimadura: água fria 10min, ambulatório. Em prensagem: NÃO tracionar, desenergizar/aliviar carga.",
  },
});
console.log("PAGES", doc.getNumberOfPages());
writeFileSync("/mnt/documents/OS-Montador_I-Jarlisson_1pagina.pdf", Buffer.from(doc.output("arraybuffer")));
