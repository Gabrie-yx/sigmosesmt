import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analisarMarcadoresOCR } from "@/lib/dds-ocr-teste.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Upload, Loader2, ScanLine, CheckCircle2, XCircle, AlertCircle, FlaskConical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/ocr-teste")({
  component: OCRTestePage,
});

type MarkerResult = { id: string; filled: boolean; confidence: number; notes?: string };

function buildDefaultMarkers(rows: number): string[] {
  const dias = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
  const ids: string[] = [];
  for (let r = 1; r <= rows; r++) {
    for (const d of dias) ids.push(`L${String(r).padStart(2, "0")}-${d}`);
  }
  ids.push("SIG-ENC", "SIG-SES", "SIG-GER");
  return ids;
}

function OCRTestePage() {
  const analisar = useServerFn(analisarMarcadoresOCR);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rows, setRows] = useState(12);
  const [customIds, setCustomIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MarkerResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState("google/gemini-2.5-pro");

  const expectedIds = useMemo(() => {
    const trimmed = customIds.trim();
    if (trimmed) {
      return trimmed
        .split(/[\s,;\n]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    }
    return buildDefaultMarkers(rows);
  }, [customIds, rows]);

  function onPick(f: File | null) {
    setResults([]);
    setError(null);
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f && f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
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
    setResults([]);
    try {
      const b64 = await fileToBase64(file);
      const resp = await analisar({
        data: {
          fileBase64: b64,
          mime: file.type || "image/jpeg",
          expectedMarkers: expectedIds,
          rows,
          model,
        },
      });
      if (resp.error) {
        setError(resp.error);
        toast.error(resp.error);
      } else {
        setResults(resp.markers ?? []);
        toast.success(`OCR concluído — ${resp.markers?.length ?? 0} marcadores analisados`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Erro desconhecido");
      toast.error(e?.message ?? "Erro ao rodar OCR");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = results.length;
    const filled = results.filter((r) => r.filled).length;
    const empty = total - filled;
    const avgConf = total ? results.reduce((s, r) => s + r.confidence, 0) / total : 0;
    const missing = results.filter((r) => (r.notes ?? "").toLowerCase().includes("não")).length;
    return { total, filled, empty, avgConf, missing };
  }, [results]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
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
            OCR de Marcadores — Módulo de Testes
          </h1>
          <Badge variant="outline" className="ml-2 text-[10px] font-bold uppercase">TEMP</Badge>
        </div>
        <p className="text-xs font-bold text-slate-600 mt-1">
          Suba um FOR-SEG-06 (impresso, preenchido/pintado e escaneado ou fotografado). O sistema pergunta ao modelo se cada quadrado
          está preenchido ou vazio, por ID (L01-SEG … SIG-GER).
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
              <Label className="text-xs uppercase font-bold text-slate-500">Nº de linhas do formulário</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(30, Number(e.target.value) || 12)))}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Badge variant="secondary" className="font-mono text-[11px]">
                {expectedIds.length} marcadores
              </Badge>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">Modelo</Label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full text-xs border rounded p-2 bg-white"
            >
              <option value="google/gemini-2.5-pro">gemini-2.5-pro (recomendado)</option>
              <option value="google/gemini-3-flash-preview">gemini-3-flash-preview</option>
              <option value="google/gemini-2.5-flash">gemini-2.5-flash (rápido)</option>
              <option value="openai/gpt-5">gpt-5</option>
            </select>
          </div>

          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">
              IDs customizados (opcional — sobrepõe o padrão)
            </Label>
            <textarea
              value={customIds}
              onChange={(e) => setCustomIds(e.target.value)}
              placeholder="L01-SEG, L01-TER, SIG-ENC ..."
              rows={3}
              className="mt-1 w-full text-xs font-mono border rounded p-2"
            />
          </div>

          <Button onClick={rodar} disabled={loading || !file} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanLine className="h-4 w-4 mr-2" />}
            {loading ? "Analisando..." : "Rodar OCR"}
          </Button>

          <div className="text-[11px] text-slate-500 leading-snug">
            Dica: escaneie a 150–200 dpi ou fotografe com boa luz e o formulário reto. As 4 âncoras nos cantos ajudam o modelo a
            reconhecer o documento mesmo torto.
          </div>
        </div>

        <div className="border rounded bg-slate-50 flex items-center justify-center min-h-[280px] overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt="preview" className="max-h-[420px] w-auto object-contain" />
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

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Preenchidos" value={stats.filled} tone="green" />
            <StatCard label="Vazios" value={stats.empty} tone="slate" />
            <StatCard label="Não localizados" value={stats.missing} tone="amber" />
            <StatCard label="Confiança média" value={`${(stats.avgConf * 100).toFixed(0)}%`} tone="blue" />
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr className="text-left">
                  <th className="p-2 font-black uppercase text-[10px] tracking-wide">ID</th>
                  <th className="p-2 font-black uppercase text-[10px] tracking-wide">Status</th>
                  <th className="p-2 font-black uppercase text-[10px] tracking-wide w-48">Confiança</th>
                  <th className="p-2 font-black uppercase text-[10px] tracking-wide">Observação</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.id + i} className="border-t">
                    <td className="p-2 font-mono">{r.id}</td>
                    <td className="p-2">
                      {r.filled ? (
                        <Badge className="bg-green-600 hover:bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Preenchido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">
                          <XCircle className="h-3 w-3 mr-1" /> Vazio
                        </Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Progress value={r.confidence * 100} className="h-1.5 flex-1" />
                        <span className="font-mono w-10 text-right">{(r.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-2 text-slate-500 text-[11px]">{r.notes ?? ""}</td>
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

function StatCard({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-50 text-slate-800",
    green: "bg-green-50 text-green-800",
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-blue-50 text-blue-800",
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone] ?? tones.slate}`}>
      <div className="text-[10px] uppercase font-black tracking-wider opacity-70">{label}</div>
      <div className="text-xl font-black">{value}</div>
    </div>
  );
}