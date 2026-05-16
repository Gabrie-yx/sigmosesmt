import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Glossário central de siglas usadas no sistema.
 * Adicione novas siglas aqui — todos os componentes que usam <Sigla> ganham o tooltip automaticamente.
 */
export const SIGLAS: Record<string, { nome: string; descricao: string }> = {
  APR: {
    nome: "Análise Preliminar de Risco",
    descricao: "Checklist obrigatório feito antes de iniciar o serviço, identificando riscos e controles.",
  },
  PTE: {
    nome: "Permissão de Trabalho Especial",
    descricao: "Autorização formal para tarefas de alto risco (altura, espaço confinado, fogo, energia).",
  },
  DDS: {
    nome: "Diálogo Diário de Segurança",
    descricao: "Conversa rápida sobre segurança realizada com a equipe antes do início da jornada.",
  },
  POP: {
    nome: "Procedimento Operacional Padrão",
    descricao: "Instrução escrita do passo a passo correto para executar uma tarefa específica.",
  },
  SESMT: {
    nome: "Serviço Especializado em Segurança e Medicina do Trabalho",
    descricao: "Equipe responsável pela saúde e segurança dos trabalhadores na empresa.",
  },
  EPI: {
    nome: "Equipamento de Proteção Individual",
    descricao: "Item de uso pessoal para proteger o trabalhador (capacete, luva, óculos, etc.).",
  },
  EPC: {
    nome: "Equipamento de Proteção Coletiva",
    descricao: "Dispositivo que protege um grupo de trabalhadores ao mesmo tempo (guarda-corpo, ventilação, sinalização).",
  },
  CIPA: {
    nome: "Comissão Interna de Prevenção de Acidentes",
    descricao: "Comissão formada por trabalhadores e empresa para prevenir acidentes e doenças do trabalho.",
  },
  TST: {
    nome: "Técnico de Segurança do Trabalho",
    descricao: "Profissional responsável por orientar e fiscalizar a aplicação das normas de segurança.",
  },
  "NR-35": {
    nome: "Norma Regulamentadora 35 — Trabalho em Altura",
    descricao: "Regras obrigatórias para qualquer atividade executada acima de 2 metros.",
  },
  "NR-33": {
    nome: "Norma Regulamentadora 33 — Espaço Confinado",
    descricao: "Regras obrigatórias para trabalho em locais com ventilação restrita.",
  },
  "NR-10": {
    nome: "Norma Regulamentadora 10 — Eletricidade",
    descricao: "Regras obrigatórias para serviços em instalações elétricas.",
  },
  "NR-12": {
    nome: "Norma Regulamentadora 12 — Máquinas e Equipamentos",
    descricao: "Regras de segurança para operação e manutenção de máquinas.",
  },
  "NR-06": {
    nome: "Norma Regulamentadora 06 — EPI",
    descricao: "Regras sobre fornecimento, uso e fiscalização de Equipamentos de Proteção Individual.",
  },
};

type SiglaProps = {
  /** A sigla a explicar (case-insensitive). Se não existir no glossário, renderiza o texto puro. */
  children: string;
  /** Classes adicionais no trigger (span). */
  className?: string;
  /** Se true, mostra também o nome completo entre parênteses na primeira renderização. */
  showFullName?: boolean;
};

/**
 * Componente para envolver siglas técnicas com tooltip explicativo.
 * Uso: <Sigla>APR</Sigla>  ou  <Sigla showFullName>APR</Sigla>
 */
export function Sigla({ children, className, showFullName = false }: SiglaProps) {
  const key = children.trim().toUpperCase();
  const entry = SIGLAS[key] ?? SIGLAS[children.trim()];

  if (!entry) {
    return <span className={className}>{children}</span>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "underline decoration-dotted decoration-slate-400 underline-offset-2 cursor-help",
              className,
            )}
            aria-label={`${children} — ${entry.nome}`}
          >
            {children}
            {showFullName && <span className="text-slate-500"> ({entry.nome})</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-slate-900 text-white text-xs leading-relaxed">
          <div className="font-bold mb-0.5">{entry.nome}</div>
          <div className="opacity-90">{entry.descricao}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}