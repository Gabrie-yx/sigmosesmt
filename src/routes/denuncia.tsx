import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldAlert, CheckCircle2, Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/denuncia")({
  head: () => ({
    meta: [
      { title: "SIGMO — Canal de Denúncia Anônimo (Lei 14.457/2022)" },
      { name: "description", content: "Canal seguro e 100% anônimo para denúncias de assédio, discriminação ou violência no trabalho." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: DenunciaPage,
});

type Categoria = "ASSEDIO_MORAL" | "ASSEDIO_SEXUAL" | "DISCRIMINACAO" | "VIOLENCIA" | "OUTRO";

function DenunciaPage() {
  const [categoria, setCategoria] = useState<Categoria | "">("");
  const [local, setLocal] = useState("");
  const [data, setData] = useState("");
  const [relato, setRelato] = useState("");
  const [querRetorno, setQuerRetorno] = useState(false);
  const [contato, setContato] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria || relato.trim().length < 20) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/public/denuncia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria,
          local_ocorrencia: local || undefined,
          data_aproximada: data || null,
          relato,
          quer_retorno: querRetorno,
          contato_retorno: querRetorno ? contato : undefined,
        }),
      });
      const j = await r.json();
      if (!j.ok) setErro("Não foi possível registrar. Tente novamente.");
      else setProtocolo(j.protocolo);
    } catch {
      setErro("Erro de rede. Verifique sua conexão.");
    } finally {
      setEnviando(false);
    }
  }

  if (protocolo) {
    return (
      <FullScreen>
        <Panel className="max-w-md text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto" />
          <h1 className="text-lg font-bold text-[#4c0519] mt-3">Denúncia registrada</h1>
          <p className="text-sm text-slate-700 mt-2">
            Seu relato foi recebido de forma <b>100% anônima</b>. A comissão de apuração (Lei 14.457/2022) analisará o
            caso.
          </p>
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200">
            <p className="text-[10px] uppercase tracking-wide text-[#7f1d3a] font-bold">Seu protocolo</p>
            <p className="text-xl font-mono font-black text-[#4c0519] mt-1">{protocolo}</p>
            <p className="text-[10px] text-slate-500 mt-1">Guarde este código. É a única forma de acompanhar o caso.</p>
          </div>
          <p className="text-xs text-slate-500 mt-4">Pode fechar esta janela.</p>
        </Panel>
      </FullScreen>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf2f8] pb-12" style={{ colorScheme: "light" }}>
      <header className="bg-white border-b-2 border-[#7f1d3a] px-4 py-5 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-[#7f1d3a] to-[#4c0519] flex items-center justify-center shadow-sm">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#4c0519] leading-tight">Canal de Denúncia Anônimo</h1>
            <p className="text-xs text-[#7f1d3a] font-semibold">Lei 14.457/2022 · Programa Emprega + Mulher</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <Panel className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700 space-y-1">
            <p>
              <b className="text-[#4c0519]">Seu relato é 100% anônimo.</b> Não pedimos nome, CPF, e-mail ou matrícula. IP e
              dispositivo são armazenados apenas em hash irreversível — apenas como indício de tráfego.
            </p>
            <p className="text-xs text-slate-500">
              Retaliação contra denunciantes é crime (Lei 14.457/2022, Art. 23). A comissão de apuração é obrigada
              por lei a proteger sua identidade.
            </p>
          </div>
        </Panel>

        <form onSubmit={enviar} className="space-y-4">
          <Panel>
            <label className="text-xs font-bold text-[#4c0519]">Categoria da ocorrência *</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(
                [
                  ["ASSEDIO_MORAL", "Assédio moral"],
                  ["ASSEDIO_SEXUAL", "Assédio sexual"],
                  ["DISCRIMINACAO", "Discriminação"],
                  ["VIOLENCIA", "Violência"],
                  ["OUTRO", "Outro"],
                ] as [Categoria, string][]
              ).map(([v, l]) => {
                const active = categoria === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCategoria(v)}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-semibold transition ${
                      active
                        ? "bg-gradient-to-r from-[#7f1d3a] to-[#e11d48] text-white border-[#4c0519] shadow"
                        : "bg-white border-rose-200 text-slate-700 hover:border-rose-400"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel className="space-y-3">
            <div>
              <label className="text-xs font-bold text-[#4c0519]">Local aproximado (opcional)</label>
              <input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex: Oficina, refeitório, obra XYZ"
                className="mt-1 w-full h-10 rounded border border-rose-200 bg-white px-3 text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#4c0519]">Data aproximada (opcional)</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1 w-full h-10 rounded border border-rose-200 bg-white px-3 text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#4c0519]">Relato *</label>
              <textarea
                value={relato}
                onChange={(e) => setRelato(e.target.value)}
                rows={7}
                minLength={20}
                maxLength={5000}
                placeholder="Descreva o que aconteceu, quem estava envolvido e como isso te afetou. Quanto mais detalhes, melhor a apuração."
                className="mt-1 w-full rounded border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Mínimo 20 caracteres · {relato.length}/5000
              </p>
            </div>
          </Panel>

          <Panel>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={querRetorno}
                onChange={(e) => setQuerRetorno(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-rose-600"
              />
              <div>
                <p className="text-sm font-semibold text-[#4c0519]">Quero receber retorno sobre a apuração</p>
                <p className="text-xs text-slate-600">
                  Se marcar, deixe um contato descartável (e-mail temporário ou telefone). Continua anônimo — o contato
                  é usado só para retorno.
                </p>
              </div>
            </label>
            {querRetorno && (
              <input
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                placeholder="e-mail ou telefone para retorno"
                className="mt-3 w-full h-10 rounded border border-rose-200 bg-white px-3 text-sm text-slate-800"
              />
            )}
          </Panel>

          {erro && <p className="text-sm text-rose-700 bg-rose-100 p-3 rounded">{erro}</p>}

          <button
            type="submit"
            disabled={!categoria || relato.trim().length < 20 || enviando}
            className="w-full h-12 rounded-lg font-semibold text-white bg-gradient-to-r from-[#7f1d3a] to-[#e11d48] shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...
              </>
            ) : (
              "Enviar denúncia anônima"
            )}
          </button>
        </form>
      </main>
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
