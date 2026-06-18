import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpenCheck, FileText, ShieldCheck, Stethoscope, Flame, HardHat,
  Activity, AlertTriangle, Building2, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/app/sesmt/guia-documentos")({
  component: GuiaDocumentosPage,
});

type Doc = {
  sigla: string;
  nome: string;
  base: string;
  quemEmite: string;
  ondeEncontrar: string;
  validade: string;
  paraQueServe: string;
  obrigatorio: "SIM" | "CONDICIONAL";
  custoMedio: string;
  icon: React.ComponentType<{ className?: string }>;
  cor: keyof typeof CORES;
};

const CORES = {
  rose: "bg-rose-950/60 text-rose-200 border border-rose-400/30",
  amber: "bg-amber-950/50 text-amber-200 border border-amber-400/30",
  emerald: "bg-emerald-950/50 text-emerald-200 border border-emerald-400/30",
  orange: "bg-orange-950/50 text-orange-200 border border-orange-400/30",
  red: "bg-red-950/60 text-red-200 border border-red-400/30",
  violet: "bg-violet-950/50 text-violet-200 border border-violet-400/30",
  blue: "bg-rose-950/60 text-rose-200 border border-rose-400/30",
  slate: "bg-rose-950/60 text-rose-200 border border-rose-400/30",
} as const;

const DOCS: Doc[] = [
  {
    sigla: "LTCAT",
    nome: "Laudo Técnico das Condições Ambientais do Trabalho",
    base: "Lei 8.213/91 · IN INSS 128/2022",
    quemEmite: "Engenheiro de Seg. do Trabalho (CREA) ou Médico do Trabalho (CRM)",
    ondeEncontrar: "SESMT da empresa · RH · DP · arquivo do eSocial (S-2240)",
    validade: "Sem prazo legal fixo — revisar a cada mudança de função/ambiente (recomendado 1 a 2 anos)",
    paraQueServe: "Base da aposentadoria especial (15/20/25 anos) e do PPP. Sem LTCAT, o INSS nega aposentadoria especial.",
    obrigatorio: "SIM",
    custoMedio: "R$ 3k a R$ 15k (consultoria SST)",
    icon: ShieldCheck,
    cor: "rose",
  },
  {
    sigla: "PGR",
    nome: "Programa de Gerenciamento de Riscos (substituiu o PPRA)",
    base: "NR-01 (item 1.5)",
    quemEmite: "Eng. Seg. Trabalho + Téc. Seg. Trabalho (SESMT) ou consultoria",
    ondeEncontrar: "SESMT · RH · pasta do PGR (Inventário de Riscos + Plano de Ação)",
    validade: "2 anos (1 ano para empresas com risco 3 ou 4)",
    paraQueServe: "Mapa oficial de riscos por cargo. Base da insalubridade, EPI, treinamentos NR e fiscalização do MTE.",
    obrigatorio: "SIM",
    custoMedio: "R$ 2k a R$ 10k",
    icon: AlertTriangle,
    cor: "amber",
  },
  {
    sigla: "PCMSO",
    nome: "Programa de Controle Médico de Saúde Ocupacional",
    base: "NR-07",
    quemEmite: "Médico do Trabalho coordenador (CRM + especialização)",
    ondeEncontrar: "Clínica de medicina ocupacional · RH · pasta ASOs",
    validade: "1 ano (revisão anual obrigatória)",
    paraQueServe: "Define exames admissionais, periódicos, demissionais. Base do ASO. Vinculado ao PGR.",
    obrigatorio: "SIM",
    custoMedio: "R$ 1,5k a R$ 8k/ano",
    icon: Stethoscope,
    cor: "emerald",
  },
  {
    sigla: "Laudo de Insalubridade",
    nome: "Laudo Pericial de Insalubridade (NR-15)",
    base: "CLT art. 189-192 · NR-15",
    quemEmite: "Eng. Seg. Trabalho ou Médico do Trabalho com perícia (CREA/CRM)",
    ondeEncontrar: "SESMT · RH · Jurídico · arquivo de perícias trabalhistas",
    validade: "Sem prazo — revisar quando mudar ambiente, processo ou EPI",
    paraQueServe: "Define adicional de 10% / 20% / 40% sobre o salário mínimo. Defesa em ações trabalhistas.",
    obrigatorio: "CONDICIONAL",
    custoMedio: "R$ 1,5k a R$ 6k por laudo",
    icon: Activity,
    cor: "orange",
  },
  {
    sigla: "Laudo de Periculosidade",
    nome: "Laudo Pericial de Periculosidade (NR-16)",
    base: "CLT art. 193 · NR-16",
    quemEmite: "Eng. Seg. Trabalho (CREA) — exclusivo",
    ondeEncontrar: "SESMT · RH · Jurídico",
    validade: "Sem prazo — revisar a cada mudança relevante",
    paraQueServe: "Define adicional de 30% sobre o salário base (eletricidade SEP, inflamáveis, explosivos, radiação, segurança patrimonial).",
    obrigatorio: "CONDICIONAL",
    custoMedio: "R$ 1,5k a R$ 6k por laudo",
    icon: HardHat,
    cor: "red",
  },
  {
    sigla: "AET",
    nome: "Análise Ergonômica do Trabalho",
    base: "NR-17",
    quemEmite: "Ergonomista (Eng. Seg., Fisioterapeuta, T.O. com certificação)",
    ondeEncontrar: "SESMT · RH · pasta de ergonomia",
    validade: "2 anos (ou após mudança de posto/processo)",
    paraQueServe: "Análise de posturas, esforço, repetitividade. Defesa em LER/DORT e ações de doença ocupacional.",
    obrigatorio: "CONDICIONAL",
    custoMedio: "R$ 2k a R$ 8k por setor",
    icon: FileText,
    cor: "violet",
  },
  {
    sigla: "PPP",
    nome: "Perfil Profissiográfico Previdenciário",
    base: "Lei 8.213/91 · IN INSS 128/2022",
    quemEmite: "RH/DP com base em LTCAT e PCMSO",
    ondeEncontrar: "RH · DP · eSocial (S-2240) · entregue ao colaborador na rescisão",
    validade: "Atualizado a cada mudança de função/risco",
    paraQueServe: "Documento individual que comprova exposição a riscos para aposentadoria especial.",
    obrigatorio: "SIM",
    custoMedio: "Interno (RH)",
    icon: FileText,
    cor: "blue",
  },
  {
    sigla: "Selo dos Extintores",
    nome: "Certificado de Recarga e Teste Hidrostático",
    base: "NBR 12962 · NBR 15808",
    quemEmite: "Empresa de manutenção certificada INMETRO",
    ondeEncontrar: "Pasta de extintores · SESMT · selo no próprio cilindro",
    validade: "Recarga: 1 ano · Hidrostático: 5 anos",
    paraQueServe: "Comprova que o extintor está ativo e seguro. Exigido pelo Corpo de Bombeiros.",
    obrigatorio: "SIM",
    custoMedio: "R$ 40 a R$ 200 por unidade/ano",
    icon: Flame,
    cor: "red",
  },
  {
    sigla: "AVCB / CLCB",
    nome: "Auto de Vistoria do Corpo de Bombeiros",
    base: "Lei estadual (varia por UF)",
    quemEmite: "Corpo de Bombeiros Militar do estado",
    ondeEncontrar: "Administração predial · pasta de licenças",
    validade: "1 a 5 anos (depende do estado)",
    paraQueServe: "Licença para funcionamento. Sem AVCB a empresa pode ser interditada.",
    obrigatorio: "SIM",
    custoMedio: "R$ 500 a R$ 5k (taxa + projeto)",
    icon: Building2,
    cor: "slate",
  },
];

function GuiaDocumentosPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 pt-5 pb-3 border-b border-rose-400/20 bg-gradient-to-r from-rose-950/70 via-[#1a0810]/80 to-black/70 shadow-[0_0_24px_-12px_rgba(220,38,70,0.6)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-rose-600 to-rose-900 text-rose-50 shadow-[0_0_18px_-4px_rgba(220,38,70,0.7)] border border-rose-400/40">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-rose-50 tracking-tight">
              Guia: Onde encontrar meus documentos de SST?
            </h1>
            <p className="text-xs text-rose-200/70 mt-0.5">
              Quem emite, onde fica arquivado, qual a validade e para que serve cada laudo obrigatório.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="rounded-lg border border-amber-400/30 bg-amber-950/30 p-4 text-sm text-amber-100 flex gap-3 backdrop-blur-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-300" />
          <div>
            <p className="font-semibold mb-1 text-amber-200">Antes de marcar um risco como "Avaliado":</p>
            <p className="text-amber-100/90">
              Sempre confira os valores reais (intensidade, limite de tolerância, grau de insalubridade) no
              <b> laudo oficial assinado por profissional habilitado</b>. Não use estimativas de IA ou da literatura
              para decisões legais — elas servem só de ponto de partida.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOCS.map((d) => {
            const Icon = d.icon;
            return (
              <Card key={d.sigla} className="glass-card border-rose-400/20 hover:shadow-[0_0_28px_-10px_rgba(220,38,70,0.7)] transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${CORES[d.cor]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base font-bold text-rose-50">{d.sigla}</CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        d.obrigatorio === "SIM"
                          ? "border-rose-400/40 bg-rose-950/60 text-rose-200 text-[10px]"
                          : "border-amber-400/40 bg-amber-950/50 text-amber-200 text-[10px]"
                      }
                    >
                      {d.obrigatorio === "SIM" ? "Obrigatório" : "Quando aplicável"}
                    </Badge>
                  </div>
                  <p className="text-xs text-rose-200/70 mt-1 leading-snug">{d.nome}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <Linha label="Base legal" value={d.base} />
                  <Linha label="Quem emite" value={d.quemEmite} />
                  <Linha label="Onde encontrar" value={d.ondeEncontrar} highlight />
                  <Linha label="Validade" value={d.validade} />
                  <Linha label="Para que serve" value={d.paraQueServe} />
                  <Linha label="Custo médio" value={d.custoMedio} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="glass-card border-emerald-400/25 bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-emerald-200 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Não tenho nenhum desses documentos. E agora?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-emerald-100/90 space-y-2">
            <p>
              <b>1.</b> Procure uma <b>consultoria de SST</b> registrada (Engenheiro de Seg. do Trabalho com CREA ativo).
              Peça orçamento de pacote: <b>PGR + LTCAT + PCMSO</b> juntos saem mais barato.
            </p>
            <p>
              <b>2.</b> Empresas a partir de 100 colaboradores (ou em CNAEs de risco 3/4) <b>são obrigadas a manter SESMT próprio</b>
              (NR-04). Verifique se o seu caso exige.
            </p>
            <p>
              <b>3.</b> Enquanto não tem o laudo: mantenha os riscos no SIGMO como <b>🟡 Em revisão</b>. Não marque como
              "Avaliado" sem documento oficial — isso pode gerar passivo trabalhista.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Linha({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex gap-2 ${highlight ? "bg-rose-950/50 border border-rose-400/20 -mx-2 px-2 py-1 rounded" : ""}`}>
      <span className="font-semibold text-rose-200/60 shrink-0 w-24">{label}:</span>
      <span className={highlight ? "text-rose-100 font-medium" : "text-rose-100/85"}>{value}</span>
    </div>
  );
}