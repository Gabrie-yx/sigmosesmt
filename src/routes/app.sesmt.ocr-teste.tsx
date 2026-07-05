import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analisarDDS, type LinhaResultado } from "@/lib/dds-ocr-teste.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  Upload,
  Loader2,
  ScanLine,
  CheckCircle2,
  Circle,
  AlertCircle,
  FlaskConical,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/ocr-teste")({
  component: OCRTestePage,
});

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"] as const;

function OCRTestePage() {
  const analisar = useServerFn(analisarDDS);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rows, setRows] = useState(12);
  const [model, setModel] = useState("google/gemini-2.5-pro");
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<LinhaResultado[]>([]);
  const [totalParticipantes, setTotalParticipantes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function onPick(f: File | null) {
    setLinhas([]);
    setTotalParticipantes(0);
    setError(null);
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f && f.type.startsWith("image/")) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  }

  async function fileToBase64(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
    }
    return btoa(bin);
  }

  async function rodar() {
    if (!file) return toast.error("Selecione um arquivo primeiro");
    if (file.size > 15 * 1024 * 1024) return toast.error("Arquivo grande demais (máx 15MB)");
    setLoading(true);
    setError(null);
    setLinhas([]);
    setTotalParticipantes(0);
    try {
      const b64 = await fileToBase64(file);
      const resp = await analisar({
        data: { fileBase64: b64, mime: file.type || "image/jpeg", rows, model },
      });
      if (resp.error) {
        setError(resp.error);
        toast.error(resp.error);
      } else {
        setLinhas(resp.linhas);
        setTotalParticipantes(resp.totalParticipantes);
        toast.success(`OCR concluído — ${resp.totalParticipantes} participantes`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Erro desconhecido");
      toast.error(e?.message ?? "Erro ao rodar OCR");
    } finally {
      setLoading(false);
    }
  }

  const totalMarcacoes = useMemo(
    () => linhas.reduce((s, l) => s + l.diasMarcados.length, 0),
    [linhas],
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <Link
          to="/app/painel"
          className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          <ChevronLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-fuchsia-700" />
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
            DDS — Teste de leitura (OCR)
          </h1>
          <Badge variant="outline" className="ml-2 text-[10px] font-bold uppercase">
            TEMP
          </Badge>
        </div>
        <p className="text-xs font-bold text-slate-600 mt-1">
          Suba o FOR-SEG-06 preenchido. O sistema devolve, por linha: se o funcionário assinou, o nome (se legível)
          e quais dias marcou.
        </p>
      </div>

      <div className="bg-white border rounded-lg p-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">Arquivo (PDF, PNG, JPG)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              className="mt-1"
            />
            {file && (
              <div className="text-[11px] text-slate-500 mt-1">
                {file.name} — {(file.size / 1024).toFixed(0)} KB — {file.type || "?"}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Nº de linhas</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(30, Number(e.target.value) || 12)))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Modelo</Label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full text-xs border rounded p-2 bg-white h-9"
              >
                <option value="google/gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="google/gemini-3-flash-preview">gemini-3-flash-preview</option>
                <option value="google/gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="openai/gpt-5">gpt-5</option>
              </select>
            </div>
          </div>

          <Button onClick={rodar} disabled={loading || !file} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanLine className="h-4 w-4 mr-2" />}
            {loading ? "Analisando..." : "Rodar OCR"}
          </Button>
        </div>

        <div className="border rounded bg-slate-50 flex items-center justify-center min-h-[240px] overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt="preview" className="max-h-[360px] w-auto object-contain" />
          ) : file?.type === "application/pdf" ? (
            <div className="text-center text-xs text-slate-500 p-4">
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
              PDF carregado — pré-visualização de imagem indisponível
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400 p-4">
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhum arquivo selecionado
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" /> <span className="font-mono">{error}</span>
        </div>
      )}

      {linhas.length > 0 && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-emerald-700" />
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-emerald-700/80">
                Total de participantes do DDS
              </div>
              <div className="text-3xl font-black text-emerald-900 leading-tight">
                {totalParticipantes}
                <span className="text-sm font-bold text-emerald-700 ml-2">
                  · {totalMarcacoes} presenças marcadas
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr className="text-left">
                  <th className="p-2 font-black uppercase text-[10px] tracking-wide w-12">#</th>
                  <th className="p-2 font-black uppercase text-[10px] tracking-wide">Funcionário / Assinatura</th>
                  {DIAS.map((d) => (
                    <th
                      key={d}
                      className="p-2 font-black uppercase text-[10px] tracking-wide text-center w-14"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} className={`border-t ${l.assinou ? "" : "bg-slate-50/60 text-slate-400"}`}>
                    <td className="p-2 font-mono text-xs">{String(l.linha).padStart(2, "0")}</td>
                    <td className="p-2">
                      {l.assinou ? (
                        <span className="font-semibold text-slate-800">
                          {l.nome ?? <em className="text-slate-500 font-normal">assinatura ilegível</em>}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">linha em branco</span>
                      )}
                    </td>
                    {DIAS.map((d) => {
                      const on = l.diasMarcados.includes(d);
                      return (
                        <td key={d} className="p-2 text-center">
                          {on ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}