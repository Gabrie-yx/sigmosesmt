import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/psico/$token")({
  head: () => ({
    meta: [
      { title: "SIGMO — Avaliação Psicossocial (NR-01)" },
      { name: "description", content: "Questionário anônimo de fatores psicossociais no trabalho — NR-01 / ISO 45003." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PsicoPublicPage,
});

type ValidateResp =
  | { ok: true; campanha: { id: string; titulo: string; descricao: string | null; instrumento: string }; ghe: { id: string | null; label: string | null } }
  | { ok: false; motivo: string };

function PsicoPublicPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "sending" | "done" | "erro">("loading");
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);
  const [meta, setMeta] = useState<Extract<ValidateResp, { ok: true }> | null>(null);
  const [step, setStep] = useState<"consent" | "form">("consent");
  const [aceitou, setAceitou] = useState(false);
  const [faixaEtaria, setFaixaEtaria] = useState<string>("");
  const [faixaTempo, setFaixaTempo] = useState<string>("");
  const [respostas, setRespostas] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`/api/public/psico/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j: ValidateResp) => {
        if (j.ok) {
          setMeta(j);
          setState("ready");
        } else {
          setErroMotivo(j.motivo);
          setState("erro");
        }
      })
      .catch(() => setState("erro"));
  }, [token]);

  const totalItens = PSICO_ITEMS.length;
  const respondidos = Object.keys(respostas).length;
  const podeEnviar = respondidos === totalItens;

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
    if (j.ok) setState("done");
    else {
      setErroMotivo(j.error);
      setState("erro");
    }
  }

  if (state === "loading") return <FullScreen><Loader2 className="h-8 w-8 animate-spin text-rose-500" /></FullScreen>;

  if (state === "erro")
    return (
      <FullScreen>
        <Card className="p-6 max-w-sm text-center space-y-3">
          <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">Link inválido</h1>
          <p className="text-sm text-slate-600">
            {erroMotivo === "TOKEN_JA_USADO"
              ? "Este link já foi usado. Cada link pode ser respondido uma única vez — isso garante o anonimato."
              : erroMotivo === "TOKEN_EXPIRADO"
                ? "Este link expirou. Peça um novo ao TST/RH."
                : erroMotivo === "CAMPANHA_INATIVA"
                  ? "A campanha não está mais ativa."
                  : "Não conseguimos validar seu link. Peça um novo ao TST/RH."}
          </p>
        </Card>
      </FullScreen>
    );

  if (state === "done")
    return (
      <FullScreen>
        <Card className="p-6 max-w-sm text-center space-y-3">
          <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">Obrigado!</h1>
          <p className="text-sm text-slate-600">
            Sua resposta foi enviada de forma <b>100% anônima</b>. Ela vai ajudar a melhorar o ambiente de trabalho.
          </p>
          <p className="text-xs text-slate-400">Você pode fechar esta janela.</p>
        </Card>
      </FullScreen>
    );

  // Consentimento
  if (step === "consent")
    return (
      <FullScreen>
        <Card className="p-6 max-w-md space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            <h1 className="text-lg font-bold text-slate-900">Avaliação Psicossocial — NR-01</h1>
          </div>
          {meta?.ghe.label && <p className="text-xs text-slate-500">{meta.ghe.label}</p>}
          <div className="text-sm text-slate-700 space-y-2">
            <p>
              <b>Sua resposta é 100% anônima.</b> O sistema não sabe quem você é — não pedimos nome, CPF, e-mail ou
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
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
            <Checkbox id="c" checked={aceitou} onCheckedChange={(v) => setAceitou(!!v)} />
            <Label htmlFor="c" className="text-sm text-slate-800 leading-relaxed">
              Li, entendi e concordo em participar de forma anônima e voluntária.
            </Label>
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={!aceitou}
            onClick={() => setStep("form")}
          >
            Começar
          </Button>
        </Card>
      </FullScreen>
    );

  // Formulário
  const grupos = groupBy(PSICO_ITEMS, (i) => i.dimensao);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-900">Avaliação Psicossocial</h1>
            {meta?.ghe.label && <p className="text-[10px] text-slate-500">{meta.ghe.label}</p>}
          </div>
          <div className="text-xs font-bold text-emerald-600">
            {respondidos}/{totalItens}
          </div>
        </div>
        <div className="max-w-md mx-auto h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(respondidos / totalItens) * 100}%` }}
          />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <Card className="p-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Para cada afirmação, escolha o que mais se aproxima da sua realidade no trabalho <b>nos últimos 3 meses</b>.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-slate-500">Faixa etária (opcional)</Label>
              <Select value={faixaEtaria || "__none__"} onValueChange={(v) => setFaixaEtaria(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {FAIXA_ETARIA.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">Tempo de casa (opcional)</Label>
              <Select value={faixaTempo || "__none__"} onValueChange={(v) => setFaixaTempo(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {FAIXA_TEMPO_CASA.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {Object.entries(grupos).map(([dim, itens]) => (
          <Card key={dim} className="p-3 space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {DIMENSAO_LABEL[dim as PsicoItem["dimensao"]]}
            </h2>
            {itens.map((it) => (
              <div key={it.codigo} className="space-y-2">
                <p className="text-sm text-slate-800 leading-snug">{it.texto}</p>
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
                            ? "bg-emerald-500 border-emerald-600 text-white shadow"
                            : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300"
                        }`}
                      >
                        <span className="text-base font-black">{op.v}</span>
                        <span>{op.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </Card>
        ))}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3">
        <div className="max-w-md mx-auto">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300"
            disabled={!podeEnviar || state === "sending"}
            onClick={enviar}
          >
            {state === "sending" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : podeEnviar ? (
              "Enviar resposta anônima"
            ) : (
              `Faltam ${totalItens - respondidos} de ${totalItens}`
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">{children}</div>;
}

function groupBy<T, K extends string>(arr: T[], fn: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = fn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}