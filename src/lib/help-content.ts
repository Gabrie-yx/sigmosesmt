// Central de ajuda do SIGMO — dicionário único de microcopy contextual.
// Cada tópico vira um <HelpHint topic="..."> (popover) e também um card
// na Central de Ajuda (/app/ajuda). Manter linguagem simples, direta ao ponto,
// pensando em usuário não-técnico (RH, TST, portaria, encarregado).

export type HelpTopic = {
  /** Chave estável usada por <HelpHint topic="..."> */
  id: string;
  /** Título curto (título do popover e do card). */
  title: string;
  /** Categoria do índice — usada para filtrar/agrupar na Central de Ajuda. */
  categoria:
    | "Segurança"
    | "SESMT"
    | "Funcionários"
    | "Produção"
    | "Compras"
    | "Geral";
  /** Palavras-chave para busca (minúsculo). Ex.: ["2fa","autenticador","otp"] */
  keywords?: string[];
  /** Uma frase explicando O QUE É (para não-técnico). */
  oQueE: string;
  /** Passos práticos "como usar / como configurar". */
  comoUsar?: string[];
  /** Base normativa (NR, ISO, LGPD). Opcional. */
  base?: string;
  /** Rota interna relacionada — usada pelo botão "Ir para". */
  rota?: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "mfa",
    title: "O que é MFA (autenticação em 2 etapas)",
    categoria: "Segurança",
    keywords: ["mfa", "2fa", "autenticador", "otp", "código", "google authenticator", "authy"],
    oQueE:
      "MFA (Autenticação de Múltiplos Fatores) é uma segunda camada de segurança: além da senha, você confirma o login com um código de 6 dígitos gerado por um app no seu celular. Se alguém descobrir sua senha, ainda não entra sem o código.",
    comoUsar: [
      "Instale um app autenticador: Google Authenticator, Microsoft Authenticator ou Authy.",
      "Vá em Minha conta → Segurança e clique em “Configurar MFA”.",
      "Escaneie o QR Code com o app.",
      "Digite o código de 6 dígitos para confirmar. Pronto — no próximo login o SIGMO pedirá esse código.",
    ],
    base: "LGPD art. 46 (medidas de segurança) · ISO 27001 A.9.4.2",
    rota: "/app/conta/seguranca",
  },
  {
    id: "trilha-leitura",
    title: "Trilha de leitura (quem viu meus dados)",
    categoria: "Segurança",
    keywords: ["auditoria", "logs", "leitura", "lgpd", "quem viu"],
    oQueE:
      "Toda vez que alguém abre uma tela com dados pessoais sensíveis (ficha do funcionário, atestados, ASO, PPP, dossiê de contratada), o SIGMO registra silenciosamente quem acessou e quando. Não bloqueia nada — só deixa rastro para auditoria.",
    base: "LGPD art. 37 (registro de operações) · ISO 27001 A.12.4.1",
    rota: "/app/audit",
  },
  {
    id: "papeis-usuario",
    title: "Papéis de usuário (roles)",
    categoria: "Segurança",
    keywords: ["role", "papel", "permissão", "admin", "editor", "viewer"],
    oQueE:
      "Cada usuário tem um ou mais papéis que definem o que ele pode fazer. Admin vê tudo; moderador aprova; editor cria/edita nos módulos liberados; viewer só olha. Papéis extras (tst, compras) liberam áreas específicas.",
    comoUsar: [
      "Só admin pode mudar papéis (menu Usuários).",
      "Além do papel, cada usuário tem módulos habilitados (SESMT, Produção etc.).",
      "Sem módulo habilitado, mesmo com papel, o menu fica escondido.",
    ],
    rota: "/app/users",
  },
  {
    id: "aso",
    title: "ASO (Atestado de Saúde Ocupacional)",
    categoria: "SESMT",
    keywords: ["aso", "exame", "medico", "admissional", "periodico", "demissional"],
    oQueE:
      "Documento assinado pelo médico do trabalho declarando se o funcionário está APTO ou INAPTO para a função. Obrigatório na admissão, periodicamente (conforme PCMSO), mudança de função, retorno ao trabalho e demissão.",
    base: "NR-07 (PCMSO) · NR-01",
    rota: "/app/sesmt/convocacoes-aso",
  },
  {
    id: "atestado",
    title: "Atestado médico",
    categoria: "SESMT",
    keywords: ["atestado", "cid", "afastamento", "inss", "b31", "b91"],
    oQueE:
      "Documento emitido por médico ou dentista comprovando afastamento do trabalho por motivo de saúde. Registrar CID, dias de afastamento, se é acidente de trabalho (CAT) e o médico emissor. Base para pagamento pela empresa (até 15 dias) e envio ao INSS (a partir do 16º).",
    base: "CLT art. 473 · Lei 8.213/91 art. 60",
  },
  {
    id: "prestador-saude",
    title: "Prestador de saúde",
    categoria: "SESMT",
    keywords: ["prestador", "clinica", "laboratorio", "medico", "credenciado"],
    oQueE:
      "Clínica, laboratório ou médico credenciado usado pela empresa para realizar exames ocupacionais (ASO) e emitir guias de encaminhamento. Precisa ter CRM/CNES válido e dados de contato atualizados.",
    base: "NR-07 (PCMSO)",
    rota: "/app/sesmt/prestadores",
  },
  {
    id: "ppp",
    title: "PPP (Perfil Profissiográfico Previdenciário)",
    categoria: "SESMT",
    keywords: ["ppp", "inss", "aposentadoria", "insalubridade"],
    oQueE:
      "Histórico do trabalhador na empresa contendo função, riscos ocupacionais, EPI usado e resultados de exames. É entregue na rescisão e usado pelo INSS para análise de aposentadoria especial.",
    base: "IN INSS 128/2022 · Lei 8.213/91 art. 58",
  },
  {
    id: "dds",
    title: "DDS (Diálogo Diário de Segurança)",
    categoria: "SESMT",
    keywords: ["dds", "diario", "treinamento", "reuniao"],
    oQueE:
      "Reunião curta (5-15 min) no início do turno para reforçar segurança, discutir riscos do dia e ouvir os trabalhadores. Precisa ter tema, responsável, lista de presença e assinaturas.",
    base: "NR-01 · NR-18",
    rota: "/app/dds",
  },
  {
    id: "apr",
    title: "APR (Análise Preliminar de Risco)",
    categoria: "SESMT",
    keywords: ["apr", "risco", "tarefa", "atividade"],
    oQueE:
      "Documento que quebra uma tarefa em etapas, lista os riscos de cada etapa e define as medidas de controle antes de iniciar o trabalho. Feita e assinada pela equipe que vai executar.",
    base: "NR-01 · NR-18 · NR-35",
    rota: "/app/aprs",
  },
  {
    id: "pte",
    title: "PT (Permissão de Trabalho)",
    categoria: "SESMT",
    keywords: ["pte", "pt", "permissao", "espaco confinado", "altura", "quente"],
    oQueE:
      "Autorização formal para executar serviços de risco elevado (espaço confinado, trabalho em altura, serviço a quente). Só é válida com APR, checagem atmosférica quando aplicável, vigia designado e assinaturas obrigatórias.",
    base: "NR-33 (confinado) · NR-35 (altura) · NR-34",
    rota: "/app/ptes",
  },
  {
    id: "pgr",
    title: "PGR (Programa de Gerenciamento de Riscos)",
    categoria: "SESMT",
    keywords: ["pgr", "gro", "inventario", "risco"],
    oQueE:
      "Documento-mãe da segurança da empresa. Contém o inventário de riscos (por GHE) e o plano de ação para eliminar ou reduzir cada risco. Revisado a cada 2 anos ou quando houver mudança significativa.",
    base: "NR-01 (GRO) · PROCO-SGI-SST-01",
    rota: "/app/pgr",
  },
  {
    id: "hora-extra-sabado",
    title: "Hora extra sábado",
    categoria: "Funcionários",
    keywords: ["hora extra", "sabado", "banco de horas"],
    oQueE:
      "Registro dos funcionários que trabalharam em sábados (fora do expediente normal). Gera relatório para folha de pagamento e serve como evidência trabalhista.",
    base: "CLT art. 59",
    rota: "/app/employees/hora-extra-sabado",
  },
  {
    id: "dossie-contratada",
    title: "Dossiê de contratada",
    categoria: "SESMT",
    keywords: ["contratada", "terceirizada", "documentos", "dossie", "gestao"],
    oQueE:
      "Pasta digital com todos os documentos legais e trabalhistas de uma empresa contratada: CNPJ, contrato social, certidões, ASOs dos funcionários, comprovantes de treinamento, etc. Serve para auditoria e defesa em fiscalização.",
    base: "NR-04 · Súmula 331 TST",
    rota: "/app/companies",
  },
  {
    id: "rc",
    title: "RC (Requisição de Compra)",
    categoria: "Compras",
    keywords: ["rc", "requisicao", "compra", "cotacao"],
    oQueE:
      "Solicitação formal de compra de material ou serviço. Passa por aprovação, vai para cotação com fornecedores e vira pedido depois de aprovada.",
    rota: "/app/compras/requisicoes-recebidas",
  },
];

export const HELP_MAP: Record<string, HelpTopic> = Object.fromEntries(
  HELP_TOPICS.map((t) => [t.id, t]),
);

export function getHelp(id: string): HelpTopic | undefined {
  return HELP_MAP[id];
}