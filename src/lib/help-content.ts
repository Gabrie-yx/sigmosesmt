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
    | "Estoque"
    | "Usuários"
    | "Conceitos"
    | "Geral";
  /** Palavras-chave para busca (minúsculo). Ex.: ["2fa","autenticador","otp"] */
  keywords?: string[];
  /** Uma frase explicando O QUE É (para não-técnico). */
  oQueE: string;
  /** Passos práticos "como usar / como configurar". */
  comoUsar?: string[];
  /** Dicas / pegadinhas / boas práticas. Opcional. */
  dicas?: string[];
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

  // ===================== SESMT — TELAS =====================
  {
    id: "hoje",
    title: "Painel Hoje",
    categoria: "Geral",
    keywords: ["hoje", "painel", "inicio", "dashboard", "home"],
    oQueE:
      "Sua tela inicial diária. Mostra o que precisa da sua atenção agora: DDS pendente, integrações da semana, termos de consentimento em aberto, ASOs vencendo, ações atrasadas. Se estiver limpa, tá tudo em dia.",
    dicas: [
      "Cada card leva direto para a tela onde você resolve o item.",
      "Não é um relatório histórico — é uma caixa de entrada de pendências.",
    ],
    rota: "/app/hoje",
  },
  {
    id: "painel-sesmt",
    title: "Dashboard SESMT",
    categoria: "SESMT",
    keywords: ["painel", "sesmt", "indicadores", "kpi", "estatistica"],
    oQueE:
      "Painel gerencial do SESMT com indicadores de segurança: taxa de frequência, gravidade, dias sem acidente, cobertura de treinamento, ASOs vencidos, DDS realizados, etc. Base para reunião de análise crítica.",
    base: "ISO 45001 cl. 9.1 · NR-01 1.5.4.4.6",
    rota: "/app/painel",
  },
  {
    id: "procedimentos",
    title: "Procedimentos / POPs",
    categoria: "SESMT",
    keywords: ["procedimento", "pop", "pgs", "instrução", "trabalho"],
    oQueE:
      "Biblioteca dos Procedimentos Operacionais Padrão (POPs) e Procedimentos de Gestão. Cada um tem número, revisão, responsável e lista de quem deu ciência. Base para treinamento e para defesa em auditoria.",
    comoUsar: [
      "Crie POP com código único, versão e data de vigência.",
      "Revise sempre que houver mudança relevante — a versão antiga fica no histórico.",
      "Colete ciência dos envolvidos após publicar nova versão.",
    ],
    base: "ISO 9001 cl. 7.5 · NR-01",
    rota: "/app/sesmt/procedimentos",
  },
  {
    id: "matriz-treinamento",
    title: "Matriz de Treinamento",
    categoria: "SESMT",
    keywords: ["matriz", "treinamento", "nr", "curso", "capacitação"],
    oQueE:
      "Tabela que cruza cargos × treinamentos obrigatórios (por NR ou por setor). Mostra em cores quem tá em dia, quem tá vencendo e quem tá vencido. Base para o plano anual de capacitação.",
    base: "NR-01 1.7 · ISO 45001 cl. 7.2",
    rota: "/app/matriz-treinamento",
  },
  {
    id: "sesmt-docs",
    title: "Documentos SESMT",
    categoria: "SESMT",
    keywords: ["documento", "laudo", "arquivo", "sesmt"],
    oQueE:
      "Repositório central dos documentos do SESMT: PGR, PCMSO, LTCAT, laudos, políticas, atas de CIPA. Cada documento tem responsável, próxima revisão e histórico de versões.",
    rota: "/app/sesmt/docs",
  },
  {
    id: "guia-documentos",
    title: "Guia: onde encontrar cada laudo?",
    categoria: "SESMT",
    keywords: ["guia", "laudo", "onde", "ajuda", "documento"],
    oQueE:
      "Guia rápido apontando em qual módulo do SIGMO fica cada laudo/documento (PGR, PCMSO, LTCAT, extintores, equipamentos, terceiros). Use quando o fiscal pedir alguma coisa e você não souber onde procurar.",
    rota: "/app/sesmt/guia-documentos",
  },
  {
    id: "controle-documentos",
    title: "Controle de Documentos",
    categoria: "SESMT",
    keywords: ["controle", "documento", "vencimento", "recorrente", "anexo"],
    oQueE:
      "Cadastro de documentos com data de vencimento e recorrência (ex.: alvará anual, laudo bianual). Avisa antes de vencer e mantém histórico de todas as versões anexadas.",
    base: "ISO 9001 cl. 7.5.3",
    rota: "/app/controle-documentos",
  },
  {
    id: "extintores",
    title: "Controle de Extintores",
    categoria: "SESMT",
    keywords: ["extintor", "inspeção", "recarga", "hidrostatico", "fogo"],
    oQueE:
      "Cadastro dos extintores da planta com localização, tipo (PQS/CO2/água), datas de recarga, teste hidrostático e inspeções mensais. Alerta quando qualquer prazo tá se aproximando.",
    comoUsar: [
      "Cadastre cada extintor com número de série e QR/foto.",
      "Faça inspeção mensal via foto (obriga a estar no local).",
      "Recarga é anual, teste hidrostático a cada 5 anos.",
    ],
    base: "NBR 12693 · NR-23",
    rota: "/app/extintores",
  },
  {
    id: "requisicoes-sesmt",
    title: "Requisições de Compra (SESMT)",
    categoria: "SESMT",
    keywords: ["requisicao", "compra", "sesmt", "epi", "material"],
    oQueE:
      "Onde o SESMT solicita compras: EPIs, extintores, sinalização, medicamentos etc. A requisição vira uma RC no módulo de Compras após aprovação.",
    rota: "/app/sesmt/requisicoes",
  },
  {
    id: "oss",
    title: "OSS — Ordens de Serviço (NR-01)",
    categoria: "SESMT",
    keywords: ["oss", "os", "ordem servico", "nr01", "atribuição"],
    oQueE:
      "Ordem de Serviço da NR-01: comunica formalmente ao empregado os riscos da função, as medidas de controle e as obrigações. Deve ser assinada na admissão e a cada mudança de função ou de risco.",
    base: "NR-01 1.4.1 b) · CLT art. 157",
    rota: "/app/oss",
  },
  {
    id: "trainings",
    title: "Treinamentos & NRs",
    categoria: "SESMT",
    keywords: ["treinamento", "nr", "capacitação", "curso", "certificado"],
    oQueE:
      "Registro dos treinamentos ministrados: NR-33, NR-35, brigada, integração etc. Guarda tema, carga horária, instrutor, lista de presença assinada e certificados. Alimenta a Matriz de Treinamento.",
    base: "NR-01 1.7 · ISO 45001 cl. 7.2",
    rota: "/app/trainings",
  },
  {
    id: "integracoes",
    title: "Integrações NR-01",
    categoria: "SESMT",
    keywords: ["integração", "admissional", "nr01", "novo funcionario"],
    oQueE:
      "Treinamento de integração para novos funcionários e visitantes: riscos da empresa, EPIs, rotas de fuga, procedimentos. Obrigatório antes de o trabalhador iniciar as atividades.",
    base: "NR-01 1.7.3",
    rota: "/app/sesmt/integracoes",
  },
  {
    id: "checklist-equipamentos",
    title: "Checklist de Equipamentos Móveis",
    categoria: "SESMT",
    keywords: ["checklist", "empilhadeira", "guindaste", "veiculo", "equipamento"],
    oQueE:
      "Checagem diária/turno de equipamentos móveis (empilhadeira, guindaste, plataforma, veículos). Registra quem operou, condições, avarias detectadas e bloqueia uso quando reprovado.",
    base: "NR-11 · NR-12 · NR-18",
    rota: "/app/sesmt/equipamentos-moveis",
  },
  {
    id: "terceiros",
    title: "Painel de Terceiros",
    categoria: "SESMT",
    keywords: ["terceiro", "contratada", "prestador", "painel"],
    oQueE:
      "Visão consolidada das contratadas: quantas pessoas ativas, documentos vencidos, ASOs em atraso, treinamentos pendentes. Vinculado ao Dossiê de Contratada.",
    base: "NR-04 · Súmula 331 TST",
    rota: "/app/sesmt/terceiros",
  },
  {
    id: "reincidencia-epi",
    title: "Reincidência de EPI",
    categoria: "SESMT",
    keywords: ["reincidencia", "epi", "perda", "reposição"],
    oQueE:
      "Relatório de trabalhadores que pediram o mesmo EPI várias vezes num curto período. Ajuda a identificar má utilização, roubo ou EPI inadequado para a função.",
    rota: "/app/relatorios/reincidencia-epi",
  },
  {
    id: "ncs",
    title: "Não Conformidades (NC)",
    categoria: "SESMT",
    keywords: ["nc", "não conformidade", "desvio", "auditoria"],
    oQueE:
      "Registro de desvios encontrados em auditorias, inspeções ou por relato: o que aconteceu, causa raiz, ação corretiva, responsável e prazo. Vira pauta de análise crítica.",
    base: "ISO 9001 cl. 10.2 · ISO 45001 cl. 10.2",
    rota: "/app/ncs",
  },
  {
    id: "incidentes",
    title: "Incidentes / Investigação",
    categoria: "SESMT",
    keywords: ["incidente", "acidente", "quase acidente", "investigação", "cat"],
    oQueE:
      "Registro e investigação de incidentes (com ou sem lesão) e quase-acidentes. Guarda a árvore de causas, evidências, testemunhas, ação corretiva e (quando aplicável) a CAT emitida.",
    base: "NR-01 · Lei 8.213/91 (CAT)",
    rota: "/app/incidentes",
  },
  {
    id: "plano-acoes",
    title: "Plano de Ações (5W2H)",
    categoria: "SESMT",
    keywords: ["plano", "ação", "5w2h", "atraso", "responsavel"],
    oQueE:
      "Lista central de todas as ações (de NC, incidente, auditoria, PGR) no formato 5W2H: o quê, por quê, quem, quando, onde, como e quanto. Colore por status/atraso.",
    base: "ISO 9001 · ISO 45001",
    rota: "/app/acoes",
  },
  {
    id: "employees",
    title: "Funcionários",
    categoria: "Funcionários",
    keywords: ["funcionario", "colaborador", "ficha", "cadastro"],
    oQueE:
      "Cadastro central dos funcionários próprios: dados pessoais, cargo, setor, admissão, foto, CTPS, documentos, histórico de função. Base para ASO, PPP, treinamentos e ordens de serviço.",
    rota: "/app/employees",
  },
  {
    id: "ficha-funcionario",
    title: "Ficha do Funcionário",
    categoria: "Funcionários",
    keywords: ["ficha", "detalhe", "funcionario", "aba"],
    oQueE:
      "Página com todas as abas de um funcionário: dados, documentos, ASOs, atestados, treinamentos, EPIs entregues, ocorrências. Toda abertura é registrada na trilha de leitura (LGPD).",
    base: "LGPD art. 37",
  },
  {
    id: "desligados",
    title: "Funcionários Desligados",
    categoria: "Funcionários",
    keywords: ["desligado", "demissão", "rescisão", "afastado"],
    oQueE:
      "Lista dos funcionários já desligados, com data e motivo. Mantém acesso ao histórico (PPP, ASOs, treinamentos) pelo prazo legal.",
    rota: "/app/employees/desligados",
  },
  {
    id: "saidas-expediente",
    title: "Saídas de Expediente",
    categoria: "Funcionários",
    keywords: ["saida", "expediente", "banco de horas", "consulta"],
    oQueE:
      "Registro de saídas antecipadas ou entradas tardias (consulta médica, particular, escola). Serve como comprovante para desconto ou compensação em folha.",
    base: "CLT art. 473",
    rota: "/app/employees/saidas",
  },
  {
    id: "listagem-funcionarios",
    title: "Listagem de Funcionários (PDF)",
    categoria: "Funcionários",
    keywords: ["listagem", "pdf", "lista", "impressão"],
    oQueE:
      "Gera PDF filtrado dos funcionários por empresa, setor ou frente de serviço. Uso comum: apresentar ao cliente ou órgão fiscalizador uma foto do efetivo alocado.",
    rota: "/app/employees/listagem",
  },
  {
    id: "cascos",
    title: "Cascos / Embarcações",
    categoria: "SESMT",
    keywords: ["casco", "embarcação", "navio", "obra"],
    oQueE:
      "Cadastro das embarcações/cascos em manutenção no estaleiro. Cada casco tem cliente, previsão, docagem e ordens de serviço vinculadas. Base para APRs e PTs.",
    rota: "/app/cascos",
  },
  {
    id: "empresas",
    title: "Empresas / Contratadas",
    categoria: "SESMT",
    keywords: ["empresa", "contratada", "cnpj", "fornecedor"],
    oQueE:
      "Lista de empresas contratadas com CNPJ, contato, contrato ativo e status de documentos. Cada uma tem seu Dossiê com toda a papelada exigida pela NR-04.",
    rota: "/app/companies",
  },
  {
    id: "cargos",
    title: "Cargos & Matriz de Riscos",
    categoria: "SESMT",
    keywords: ["cargo", "função", "cbo", "risco", "matriz"],
    oQueE:
      "Cadastro de cargos com CBO, descrição, atividades e riscos ocupacionais associados. Alimenta ASO, PPP, PGR e Matriz de Treinamento — trocar risco aqui reflete em todo o resto.",
    dicas: [
      "Mudou risco de cargo? Reveja ASO, PPP e treinamentos dos funcionários daquele cargo.",
    ],
    base: "NR-01 · NR-07",
    rota: "/app/roles",
  },
  {
    id: "matriz-riscos",
    title: "Matriz de Riscos (PGR/LTCAT)",
    categoria: "SESMT",
    keywords: ["matriz", "risco", "pgr", "ltcat", "avaliação"],
    oQueE:
      "Tabela consolidada dos riscos por GHE (Grupo Homogêneo de Exposição) com probabilidade × severidade e classificação final. É a fonte para o PGR, PCMSO e LTCAT.",
    base: "NR-01 · NR-07 · NR-09",
    rota: "/app/matriz-riscos",
  },
  {
    id: "acidentes",
    title: "Acidentes do Trabalho",
    categoria: "SESMT",
    keywords: ["acidente", "trabalho", "cat", "estatistica"],
    oQueE:
      "Registro completo de acidentes: data, hora, local, parte do corpo afetada, agente causador, dias perdidos, CAT emitida e relatório de investigação. Alimenta o indicador de dias sem acidente.",
    base: "Lei 8.213/91 · NBR 14280",
    rota: "/app/acidentes",
  },
  {
    id: "convocacoes-aso",
    title: "Convocações de ASO",
    categoria: "SESMT",
    keywords: ["convocação", "aso", "exame", "agenda", "periodico"],
    oQueE:
      "Fila de funcionários que precisam fazer exame (admissional, periódico, mudança de função, retorno, demissional). Gera guia de encaminhamento para o prestador e fecha automaticamente quando o ASO chega.",
    base: "NR-07 (PCMSO)",
    rota: "/app/sesmt/convocacoes-aso",
  },

  // ===================== ESTOQUE =====================
  {
    id: "estoque-epi",
    title: "Estoque de EPIs",
    categoria: "Estoque",
    keywords: ["estoque", "epi", "entrada", "saida", "ca"],
    oQueE:
      "Controle dos EPIs em almoxarifado: entradas (compra), saídas (entrega ao funcionário), CA, validade, estoque mínimo. Vinculado à Ficha de EPI de cada colaborador.",
    dicas: [
      "Entrega de EPI SEMPRE assinada — sem assinatura é como se não tivesse entregue.",
      "CA vencido = EPI sem valor legal, retire de circulação.",
    ],
    base: "NR-06",
    rota: "/app/estoque/epi",
  },
  {
    id: "fichas-epi-mensais",
    title: "Fichas mensais de EPI",
    categoria: "Estoque",
    keywords: ["ficha", "mensal", "epi", "entrega", "consolidado"],
    oQueE:
      "Consolidado mensal por funcionário de todos os EPIs entregues. Base para auditoria, para o PPP e para provar entrega em ação trabalhista.",
    rota: "/app/estoque/epi/fichas-mensais",
  },
  {
    id: "estoque-sesmt",
    title: "Estoque SESMT (medicamentos)",
    categoria: "Estoque",
    keywords: ["medicamento", "farmacinha", "primeiros socorros", "sesmt"],
    oQueE:
      "Estoque específico do SESMT (medicamentos de primeiros socorros, materiais de curativo, etc.) com controle de validade e retirada.",
    rota: "/app/estoque/sesmt",
  },

  // ===================== PRODUÇÃO =====================
  {
    id: "producao-dashboard",
    title: "Dashboard de Produção",
    categoria: "Produção",
    keywords: ["dashboard", "produção", "painel", "lista tecnica"],
    oQueE:
      "Painel gerencial da produção: ordens abertas, andamento por embarcação, consumo × previsto, gargalos. Cruza lista técnica com movimentos MB51 do SAP.",
    rota: "/app/producao/painel-lista-tecnica",
  },
  {
    id: "criar-ordem",
    title: "Criar Ordem de Produção",
    categoria: "Produção",
    keywords: ["criar", "ordem", "op", "produção"],
    oQueE:
      "Tela para abrir nova ordem de produção: embarcação/casco, tipo de produto, quantidade, prazo. Usa a Lista Técnica ativa para pré-preencher materiais.",
    rota: "/app/producao/criar-ordem",
  },
  {
    id: "ordens-producao",
    title: "Ordens de Produção",
    categoria: "Produção",
    keywords: ["ordem", "produção", "op", "andamento"],
    oQueE:
      "Lista de todas as OPs com status, responsável, itens consumidos vs. previstos. Base para apuração de custo e para expedição.",
    rota: "/app/producao/ordens",
  },
  {
    id: "base-mp",
    title: "Base de Matéria-Prima",
    categoria: "Produção",
    keywords: ["base", "materia prima", "mp", "classificação"],
    oQueE:
      "Cadastro-mestre dos materiais consumidos na produção: código SAP, descrição, unidade, grupo mercadoria, classificação de MP. Fonte para Lista Técnica e para relatórios de MB51.",
    rota: "/app/producao/base-materia-prima",
  },
  {
    id: "tipos-produto",
    title: "Tipos de Produto",
    categoria: "Produção",
    keywords: ["tipo", "produto", "categoria", "produção"],
    oQueE:
      "Classificação dos produtos fabricados (por tipo, família, complexidade). Usado para agrupar OPs e comparar consumo entre produtos parecidos.",
    rota: "/app/producao/tipos-produto",
  },
  {
    id: "lista-tecnica",
    title: "Lista Técnica",
    categoria: "Produção",
    keywords: ["lista tecnica", "bom", "estrutura", "produto"],
    oQueE:
      "\"Receita\" do produto: quais materiais, em que quantidade, para produzir 1 unidade. Cada versão fica no histórico; alterações revalidam automaticamente as OPs abertas.",
    rota: "/app/producao/lista-tecnica",
  },
  {
    id: "expedicao",
    title: "Expedição",
    categoria: "Produção",
    keywords: ["expedição", "entrega", "envio", "cliente"],
    oQueE:
      "Controle de saída de produto acabado: para qual cliente, quando, quantidade. Fecha a OP e libera para faturamento.",
    rota: "/app/producao/expedicao",
  },
  {
    id: "fatores-consumo",
    title: "Fatores de Consumo",
    categoria: "Produção",
    keywords: ["fator", "consumo", "perda", "produtividade"],
    oQueE:
      "Índices que ajustam o previsto ao real: perda de material, retrabalho, aproveitamento. Cada alteração fica no histórico para auditoria.",
    rota: "/app/producao/fatores-consumo",
  },

  // ===================== USUÁRIOS / SISTEMA =====================
  {
    id: "usuarios",
    title: "Usuários",
    categoria: "Usuários",
    keywords: ["usuario", "convite", "acesso", "modulo"],
    oQueE:
      "Cadastro dos usuários com login no SIGMO: papéis (roles), módulos habilitados, menus liberados e status de MFA. Só admin acessa.",
    dicas: [
      "Novo usuário entra via convite — o link expira em 7 dias.",
      "Sem módulo habilitado, mesmo com papel, o menu não aparece.",
    ],
    rota: "/app/users",
  },
  {
    id: "auditoria",
    title: "Auditoria do Sistema",
    categoria: "Usuários",
    keywords: ["auditoria", "log", "quem", "quando", "audit"],
    oQueE:
      "Registro de tudo que aconteceu no SIGMO: criações, alterações, exclusões e leituras de dados sensíveis. Filtro por usuário, tabela, ação e período. Fonte para responder \"quem fez o quê e quando\".",
    base: "LGPD art. 37 · ISO 27001 A.12.4.1",
    rota: "/app/audit",
  },
  {
    id: "minha-conta",
    title: "Minha conta / Segurança",
    categoria: "Usuários",
    keywords: ["conta", "senha", "mfa", "sessão", "perfil"],
    oQueE:
      "Suas configurações pessoais: trocar senha, ativar/desativar MFA, ver dispositivos com sessão ativa e revogar acessos indevidos.",
    rota: "/app/conta/seguranca",
  },
  {
    id: "assinador",
    title: "Assinador de PDFs",
    categoria: "Geral",
    keywords: ["assinatura", "assinar", "pdf", "documento"],
    oQueE:
      "Ferramenta para assinar PDFs internamente ao SIGMO (com assinatura salva do usuário). Registra data, hora e IP da assinatura para validade probatória.",
    rota: "/app/assinador",
  },
  {
    id: "extintores-foto",
    title: "Inspeção de Extintor por Foto",
    categoria: "SESMT",
    keywords: ["extintor", "foto", "inspeção", "mensal"],
    oQueE:
      "Inspeção mensal dos extintores capturando foto no local. A foto vira evidência (com data/GPS quando disponível) para auditoria.",
    rota: "/app/extintores-inspecao-foto",
  },

  // ===================== CONCEITOS (não são telas) =====================
  {
    id: "nr-01",
    title: "NR-01 (Disposições Gerais e GRO)",
    categoria: "Conceitos",
    keywords: ["nr01", "nr-01", "gro", "gerenciamento", "risco"],
    oQueE:
      "Norma-mãe. Define o Gerenciamento de Riscos Ocupacionais (GRO), o PGR, responsabilidades do empregador e do empregado, direito de recusa e a ordem de serviço. Toda outra NR se apoia nela.",
    base: "Portaria MTP 6.730/2020",
  },
  {
    id: "nr-06",
    title: "NR-06 (EPI)",
    categoria: "Conceitos",
    keywords: ["nr06", "nr-06", "epi", "ca"],
    oQueE:
      "Regras do EPI: seleção, fornecimento gratuito, treinamento, uso, guarda e substituição. Todo EPI precisa ter Certificado de Aprovação (CA) válido.",
  },
  {
    id: "nr-33",
    title: "NR-33 (Espaço Confinado)",
    categoria: "Conceitos",
    keywords: ["nr33", "nr-33", "confinado", "atmosfera", "vigia"],
    oQueE:
      "Trabalho em espaço confinado. Exige PT específica, medição atmosférica (O₂, LEL, H₂S, CO), vigia treinado, plano de resgate e capacitação de 40h (trabalhador/vigia) e 16h (supervisor).",
  },
  {
    id: "nr-34",
    title: "NR-34 (Indústria Naval)",
    categoria: "Conceitos",
    keywords: ["nr34", "nr-34", "naval", "estaleiro", "solda"],
    oQueE:
      "NR específica da indústria naval (construção e reparo). Trata de PT, trabalho a quente, escoramento, montagem, jateamento, pintura e resgate em ambiente naval.",
  },
  {
    id: "nr-35",
    title: "NR-35 (Trabalho em Altura)",
    categoria: "Conceitos",
    keywords: ["nr35", "nr-35", "altura", "cinto", "ancoragem"],
    oQueE:
      "Trabalho acima de 2 m de diferença de nível com risco de queda. Exige APR/PT, análise de aptidão (ASO específico), capacitação de 8h + reciclagem bienal, sistema de ancoragem e resgate previsto.",
  },
  {
    id: "ghe",
    title: "GHE (Grupo Homogêneo de Exposição)",
    categoria: "Conceitos",
    keywords: ["ghe", "homogeneo", "exposição", "pgr"],
    oQueE:
      "Grupo de trabalhadores expostos aos mesmos riscos, com mesma frequência e intensidade. É a unidade de análise do PGR: avalia-se o GHE, não a pessoa. Ex.: \"soldadores da caldeiraria\".",
    base: "NR-01 (GRO)",
  },
  {
    id: "pcmso",
    title: "PCMSO (Programa de Controle Médico)",
    categoria: "Conceitos",
    keywords: ["pcmso", "medico", "aso", "exame"],
    oQueE:
      "Programa que define quais exames médicos cada função precisa fazer, com que periodicidade, e as ações em caso de alteração. É a base para as convocações de ASO.",
    base: "NR-07",
  },
  {
    id: "ltcat",
    title: "LTCAT (Laudo Técnico das Condições Ambientais)",
    categoria: "Conceitos",
    keywords: ["ltcat", "laudo", "aposentadoria", "especial"],
    oQueE:
      "Laudo que descreve os agentes nocivos presentes no ambiente e sua intensidade. Base do INSS para reconhecer aposentadoria especial. Alimenta o PPP.",
    base: "Lei 8.213/91 art. 58 §1º",
  },
  {
    id: "cat",
    title: "CAT (Comunicação de Acidente de Trabalho)",
    categoria: "Conceitos",
    keywords: ["cat", "acidente", "inss", "comunicação"],
    oQueE:
      "Formulário obrigatório para comunicar ao INSS acidente de trabalho, doença ocupacional ou acidente de trajeto. Prazo: até o 1º dia útil seguinte ao ocorrido (ou imediatamente em caso de morte).",
    base: "Lei 8.213/91 art. 22",
  },
  {
    id: "5w2h",
    title: "5W2H",
    categoria: "Conceitos",
    keywords: ["5w2h", "plano", "ação", "metodo"],
    oQueE:
      "Método para estruturar plano de ação respondendo 7 perguntas: What (o quê), Why (por quê), Who (quem), When (quando), Where (onde), How (como) e How much (quanto custa).",
  },
  {
    id: "cipa",
    title: "CIPA (Comissão Interna de Prevenção)",
    categoria: "Conceitos",
    keywords: ["cipa", "comissão", "prevenção", "eleição"],
    oQueE:
      "Comissão paritária (empregador + empregados) que atua na prevenção de acidentes. Reunião mensal, mandato de 1 ano, treinamento obrigatório de 20h. A partir de 2022 inclui prevenção ao assédio (CIPA+A).",
    base: "NR-05",
  },
  {
    id: "lgpd",
    title: "LGPD no SIGMO",
    categoria: "Conceitos",
    keywords: ["lgpd", "privacidade", "dado pessoal", "consentimento"],
    oQueE:
      "Como o SIGMO trata dados pessoais: acesso baseado em papel, trilha de leitura em telas sensíveis, termo de consentimento assinado pelo funcionário e retenção pelo prazo legal.",
    base: "Lei 13.709/2018",
  },
  {
    id: "termo-consentimento",
    title: "Termo de Consentimento (LGPD)",
    categoria: "Conceitos",
    keywords: ["termo", "consentimento", "lgpd", "assinatura"],
    oQueE:
      "Documento em que o funcionário autoriza o tratamento dos seus dados pessoais (incluindo dados sensíveis como saúde). Coletado na admissão e renovado a cada mudança relevante.",
    base: "LGPD art. 8º e 11",
  },

  // ===================== FERRAMENTAS TRANSVERSAIS =====================
  {
    id: "command-palette",
    title: "Paleta de Comandos (Ctrl+K)",
    categoria: "Geral",
    keywords: ["ctrl k", "cmd k", "atalho", "busca", "paleta"],
    oQueE:
      "Aperte Ctrl+K (ou Cmd+K no Mac) em qualquer tela para abrir uma busca rápida que pula direto para qualquer menu, funcionário ou empresa. É o atalho mais rápido do sistema.",
  },
  {
    id: "backup",
    title: "Exportar / Importar Backup",
    categoria: "Geral",
    keywords: ["backup", "exportar", "importar", "restaurar"],
    oQueE:
      "Botões no header (desktop) para baixar um JSON com o estado local ou restaurar de um arquivo. Uso principal: mover configurações entre ambientes ou como cópia de segurança pontual.",
    dicas: [
      "Importar SOBRESCREVE dados atuais — sempre exportar antes por garantia.",
    ],
  },
  {
    id: "pendencias",
    title: "Minhas Pendências",
    categoria: "Geral",
    keywords: ["pendencia", "notificação", "aviso", "sino"],
    oQueE:
      "Sininho no topo com os itens que precisam da sua ação: assinatura pendente, ASO vencendo, ação atrasada. Cliques levam direto para resolver.",
  },
  {
    id: "central-ajuda",
    title: "Central de Ajuda",
    categoria: "Geral",
    keywords: ["ajuda", "help", "central", "duvida", "manual"],
    oQueE:
      "Você está aqui! 😄 Reúne explicações de cada tela e conceito do SIGMO. Também aparece como balãozinho \"?\" espalhado pelo sistema — o mesmo texto, no contexto certo.",
    rota: "/app/ajuda",
  },
];

export const HELP_MAP: Record<string, HelpTopic> = Object.fromEntries(
  HELP_TOPICS.map((t) => [t.id, t]),
);

export function getHelp(id: string): HelpTopic | undefined {
  return HELP_MAP[id];
}