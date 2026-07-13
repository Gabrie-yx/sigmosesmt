import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  PSICO_ITEMS,
  LIKERT_LABELS,
  DIMENSAO_LABEL,
  FAIXA_ETARIA,
  FAIXA_TEMPO_CASA,
  type PsicoItem,
} from "@/lib/psico-instrument";
import { validatePsicoToken, type PsicoValidateResult } from "@/lib/psico-public.functions";

export const Route = createFileRoute("/psico/$token")({
  head: () => ({
    meta: [
      { title: "SIGMO — Avaliação Psicossocial (NR-01)" },
      { name: "description", content: "Questionário anônimo de fatores psicossociais no trabalho — NR-01 / ISO 45003." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  // Valida o token no servidor (SSR): a página abre já com o resultado,
  // sem esperar por um fetch client-side. Tira ~1 round-trip do caminho crítico.
  loader: async ({ params }): Promise<PsicoValidateResult> => {
    try {
      return await validatePsicoToken({ data: { token: params.token } });
    } catch {
      return { ok: false, motivo: "DB" };
    }
  },
  // Cache curto: se o usuário voltar/atualizar em segundos, não bate o banco de novo.
  staleTime: 30_000,
  component: PsicoPublicPage,
});

type ValidateResp = PsicoValidateResult;

// ── persistência das respostas em sessionStorage ────────────────────────────
// PROBLEMA: navegador mobile recarrega abas em segundo plano, e as respostas
// (que ficavam só em useState) sumiam. Agora a gente salva por token — se a
// aba recarregar no meio, o formulário volta exatamente onde estava.
type PersistedAnswers = {
  step: "consent" | "form";
  aceitou: boolean;
  faixaEtaria: string;
  faixaTempo: string;
  respostas: Record<string, number>;
};
const STORAGE_VERSION = "v1";
function storageKey(token: string) {
  return `sigmo.psico.${STORAGE_VERSION}.${token}`;
}
function loadPersisted(token: string): PersistedAnswers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(token));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAnswers;
  } catch {
    return null;
  }
}
function savePersisted(token: string, data: PersistedAnswers) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(token), JSON.stringify(data));
  } catch {
    /* quota / private mode — segue sem persistir */
  }
}
function clearPersisted(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(token));
  } catch {
    /* noop */
  }
}

function PsicoPublicPage() {
  // paleta SIGMO — vinho/rosa (não usar tokens do tema porque o app é dark)
  //   vinho escuro  #4c0519   headings
  //   vinho         #7f1d3a   detalhes / borda
  //   rosa          #e11d48   ação / progresso / seleção
  //   creme         #fdf2f8   fundo suave
  //   cinza         #374151   texto corpo
  const { token } = Route.useParams();
  const loaderData = Route.useLoaderData();

  // Se o loader já classificou como erro, mostramos direto.
  const initialErro = !loaderData.ok ? loaderData.motivo : null;
  const initialMeta = loaderData.ok ? loaderData : null;

  const [state, setState] = useState<"ready" | "sending" | "done" | "erro">(
    initialErro ? "erro" : "ready",
  );
  const [erroMotivo, setErroMotivo] = useState<string | null>(initialErro);
  const meta = initialMeta;

  // ── estado do formulário (hidratado do sessionStorage se existir) ─────────
  const [step, setStep] = useState<"consent" | "form">("consent");
  const [aceitou, setAceitou] = useState(false);
  const [faixaEtaria, setFaixaEtaria] = useState<string>("");
  const [faixaTempo, setFaixaTempo] = useState<string>("");
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [hidratou, setHidratou] = useState(false);
  const consentId = `psico-consent-${token.slice(0, 8)}`;

  // Hidrata do sessionStorage 1x, no cliente (nunca no SSR).
  useEffect(() => {
    const saved = loadPersisted(token);
    if (saved) {
      setStep(saved.step);
      setAceitou(saved.aceitou);
      setFaixaEtaria(saved.faixaEtaria);
      setFaixaTempo(saved.faixaTempo);
      setRespostas(saved.respostas ?? {});
    }
    setHidratou(true);
  }, [token]);

  // Salva a cada mudança (após hidratação).
  useEffect(() => {
    if (!hidratou) return;
    savePersisted(token, { step, aceitou, faixaEtaria, faixaTempo, respostas });
  }, [hidratou, token, step, aceitou, faixaEtaria, faixaTempo, respostas]);

  const totalItens = PSICO_ITEMS.length;
  const respondidos = Object.keys(respostas).length;
  const podeEnviar = respondidos === totalItens;

  function iniciarQuestionario() {
    if (!aceitou) return;
    setStep("form");
  }

  async function enviar() {
    setState("sending");
    const body = {
      token,
      consentimento: true as const,
      versao_termo: "v1.2026-07",
      faixa_etaria: faixaEtaria || null,
      faixa_tempo_casa: faixaTempo || null,
      respostas: PSICO_ITEMS.map((it) => ({
        item_codigo: it.codigo,
        dimensao: it.dimensao,
        valor: respostas[it.codigo],
      })),
    };
    const r = await fetch("/api/public/psico/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.ok) {
      clearPersisted(token); // resposta enviada → limpa o cache local
      setState("done");
    } else {
      setErroMotivo(j.error);
      setState("erro");
    }
  }

  if (state === "erro")
    return (
      <FullScreen>
        <Panel className="max-w-sm text-center">
          <XCircle className="h-12 w-12 text-rose-600 mx-auto" />
          <h1 className="text-lg font-bold text-[#4c0519] mt-3">Link inválido</h1>
          <p className="text-sm text-slate-600 mt-2">
            {erroMotivo === "TOKEN_JA_USADO"
              ? "Este link já foi usado. Cada link pode ser respondido uma única vez — isso garante o anonimato."
              : erroMotivo === "TOKEN_EXPIRADO"
                ? "Este link expirou. Peça um novo ao TST/RH."
                : erroMotivo === "CAMPANHA_INATIVA"
                  ? "A campanha não está mais ativa."
                  : "Não conseguimos validar seu link. Peça um novo ao TST/RH."}
          </p>
        </Panel>
      </FullScreen>
    );

  if (state === "done")
    return (
      <FullScreen>
        <Panel className="max-w-sm text-center">
          <CheckCircle2 className="h-14 w-14 text-rose-600 mx-auto" />
          <h1 className="text-lg font-bold text-[#4c0519] mt-3">Obrigado!</h1>
          <p className="text-sm text-slate-600 mt-2">
            Sua resposta foi enviada de forma <b>100% anônima</b>. Ela vai ajudar a melhorar o ambiente de trabalho.
          </p>
          <p className="text-xs text-slate-400 mt-3">Você pode fechar esta janela.</p>
        </Panel>
      </FullScreen>
    );

  // Consentimento
  if (step === "consent")
    return (
      <FullScreen>
        <Panel className="max-w-md">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#7f1d3a] to-[#4c0519] flex items-center justify-center shadow-sm">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#4c0519] leading-tight">Avaliação Psicossocial</h1>
              <p className="text-[10px] text-[#7f1d3a] font-semibold tracking-wide">SIGMO · NR-01</p>
            </div>
          </div>
          {meta?.ghe.label && <p className="text-xs text-slate-500 mt-3">{meta.ghe.label}</p>}
          <div className="text-sm text-slate-700 space-y-2 mt-4">
            <p>
              <b className="text-[#4c0519]">Sua resposta é 100% anônima.</b> O sistema não sabe quem você é — não pedimos nome, CPF, e-mail ou
              matrícula. O link que você abriu é descartável e é apagado depois do envio.
            </p>
            <p>
              Os resultados são <b>agregados por setor</b> (Grupo Homogêneo de Exposição — GHE), e só são liberados quando
              o grupo tem no mínimo 5 respondentes. Assim, ninguém consegue identificar respostas individuais.
            </p>
            <p>
              Base legal (LGPD): cumprimento de obrigação regulatória (NR-01, Portaria MTP 1.419/2024) e seu consentimento.
              Dados individuais nunca serão vistos por RH ou liderança.
            </p>
            <p className="text-xs text-[#7f1d3a] font-semibold pt-1">
              São {totalItens} perguntas rápidas · leva ~8 a 12 minutos. Se fechar a aba, suas respostas ficam salvas nesse celular até você enviar.
            </p>
          </div>
          <label
            htmlFor={consentId}
            className="w-full flex items-start gap-3 rounded-lg bg-[#fdf2f8] border border-rose-200 p-3 mt-4 text-left hover:bg-[#fce7ef] transition cursor-pointer select-none"
          >
            <input
              id={consentId}
              type="checkbox"
              checked={aceitou}
              onChange={(event) => setAceitou(event.currentTarget.checked)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition ${
                aceitou ? "bg-rose-600 border-rose-600" : "bg-white border-rose-400"
              }`}
            >
              {aceitou && <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={3} />}
            </span>
            <span className="text-sm text-slate-800 leading-relaxed">
              Li, entendi e concordo em participar de forma anônima e voluntária.
            </span>
          </label>
          <button
            type="button"
            disabled={!aceitou}
            onClick={iniciarQuestionario}
            className="mt-4 w-full h-11 rounded-lg font-semibold text-white bg-gradient-to-r from-[#7f1d3a] to-[#e11d48] shadow-sm hover:opacity-95 transition disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Concordo e começar
          </button>
        </Panel>
      </FullScreen>
    );

  // Formulário
  const grupos = groupBy(PSICO_ITEMS, (i) => i.dimensao);

  return (
    <div className="min-h-screen bg-[#fdf2f8] pb-24" style={{ colorScheme: "light" }}>
      <header className="sticky top-0 z-10 bg-white border-b-2 border-[#7f1d3a] px-4 py-3 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-[#7f1d3a] to-[#4c0519] flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#4c0519] leading-tight">Avaliação Psicossocial</h1>
              {meta?.ghe.label && <p className="text-[10px] text-[#7f1d3a]">{meta.ghe.label}</p>}
            </div>
          </div>
          <div className="text-xs font-bold text-rose-600 tabular-nums">
            {respondidos}/{totalItens}
          </div>
        </div>
        <div className="max-w-md mx-auto h-1.5 bg-rose-100 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7f1d3a] to-[#e11d48] transition-all"
            style={{ width: `${(respondidos / totalItens) * 100}%` }}
          />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <Panel>
          <p className="text-xs text-slate-700 leading-relaxed">
            Para cada afirmação, escolha o que mais se aproxima da sua realidade no trabalho <b>nos últimos 3 meses</b>.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <Label className="text-[10px] text-[#7f1d3a] font-semibold">Faixa etária (opcional)</Label>
              <Select value={faixaEtaria || "__none__"} onValueChange={(v) => setFaixaEtaria(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs bg-white border-rose-200 text-slate-800"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {FAIXA_ETARIA.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-[#7f1d3a] font-semibold">Tempo de casa (opcional)</Label>
              <Select value={faixaTempo || "__none__"} onValueChange={(v) => setFaixaTempo(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs bg-white border-rose-200 text-slate-800"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {FAIXA_TEMPO_CASA.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Panel>

        {Object.entries(grupos).map(([dim, itens]) => (
          <Panel key={dim}>
            <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
              <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <h2 className="text-[11px] font-bold text-[#4c0519] uppercase tracking-wider">
                {DIMENSAO_LABEL[dim as PsicoItem["dimensao"]]}
              </h2>
            </div>
            <div className="space-y-5 mt-3">
            {itens.map((it) => (
              <div key={it.codigo} className="space-y-2">
                <p className="text-sm text-slate-800 leading-snug font-medium">{it.texto}</p>
                <div className="grid grid-cols-5 gap-1">
                  {LIKERT_LABELS.map((op) => {
                    const active = respostas[it.codigo] === op.v;
                    return (
                      <button
                        key={op.v}
                        type="button"
                        onClick={() => setRespostas({ ...respostas, [it.codigo]: op.v })}
                        className={`h-14 rounded-lg border text-[10px] font-semibold leading-tight transition-all flex flex-col items-center justify-center px-1 ${
                          active
                            ? "bg-gradient-to-b from-[#e11d48] to-[#7f1d3a] border-[#4c0519] text-white shadow-md"
                            : "bg-white border-rose-200 text-slate-600 hover:border-rose-400 hover:bg-rose-50"
                        }`}
                      >
                        <span className="text-base font-black">{op.v}</span>
                        <span className={active ? "opacity-90" : "opacity-70"}>{op.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            </div>
          </Panel>
        ))}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#7f1d3a] p-3 shadow-[0_-4px_12px_rgba(127,29,58,0.08)]">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            disabled={!podeEnviar || state === "sending"}
            onClick={enviar}
            className="w-full h-12 rounded-lg font-semibold text-white bg-gradient-to-r from-[#7f1d3a] to-[#e11d48] shadow-md hover:opacity-95 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {state === "sending" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : podeEnviar ? (
              "Enviar resposta anônima"
            ) : (
              `Faltam ${totalItens - respondidos} de ${totalItens}`
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#fdf2f8] via-white to-[#fce7ef]"
      style={{ colorScheme: "light" }}
    >
      {children}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-xl shadow-[0_4px_20px_rgba(127,29,58,0.08)] border border-rose-100 p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function groupBy<T, K extends string>(arr: T[], fn: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = fn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}