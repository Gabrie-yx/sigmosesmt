import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Camera, MapPin, Sparkles, CheckCircle2, AlertTriangle, RotateCcw,
  Loader2, PenLine, Search, Plus, XCircle, MinusCircle, Flame,
} from "lucide-react";
import { toast } from "sonner";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { analisarFotosExtintor, salvarInspecaoFoto } from "@/lib/extintor-inspecao-foto.functions";

export const Route = createFileRoute("/app/extintores-inspecao-foto")({
  component: InspecaoFotoPage,
  head: () => ({ meta: [{ title: "Inspeção de Extintor por Foto · SIGMO" }] }),
});

const BUCKET = "extintores-inspecoes";
const TIPOS = ["ABC", "BC", "A", "AP", "CO2", "PQS", "PQS_K", "OUTRO"] as const;

type Slot = "etiqueta" | "manometro" | "inmetro" | "extra";

type FotoState = {
  file: File | null;
  previewUrl: string | null;
  path: string | null;
  uploading: boolean;
};
const initialFoto = (): FotoState => ({ file: null, previewUrl: null, path: null, uploading: false });

const SLOT_INFO: Record<Slot, { titulo: string; instrucao: string; obrigatoria: boolean; emoji: string }> = {
  etiqueta: {
    emoji: "🏷️",
    titulo: "Foto 1 — Corpo + etiqueta principal",
    instrucao: "Centralize a ETIQUETA PRINCIPAL (com fabricante, tipo ABC/BC, classes de fogo e capacidade). Mostre o corpo inteiro.",
    obrigatoria: true,
  },
  manometro: {
    emoji: "📊",
    titulo: "Foto 2 — Manômetro + lacre + pino + mangueira",
    instrucao: "Aproxime o suficiente para a IA ver a AGULHA do manômetro, o LACRE plástico, o PINO de segurança e a MANGUEIRA.",
    obrigatoria: true,
  },
  inmetro: {
    emoji: "🟢",
    titulo: "Foto 3 — Selo INMETRO + etiqueta de manutenção",
    instrucao: "Mostre o SELO VERDE do INMETRO (códigos e QR Code) E a ETIQUETA AMARELA de manutenção (datas N2/N3). Pode ser uma foto só ou colar lado a lado.",
    obrigatoria: true,
  },
  extra: {
    emoji: "📍",
    titulo: "Foto 4 — Extra (localização / NC)",
    instrucao: "OPCIONAL. Use para foto ampla da sinalização de piso, acesso, ou evidência de qualquer não conformidade (corrosão, dano, obstrução).",
    obrigatoria: false,
  },
};

const ITENS_FOR_SFG_08 = [
  { key: "item01_sinalizacao", label: "01. Sinalização visível" },
  { key: "item02_acesso",      label: "02. Acesso desobstruído" },
  { key: "item03_suporte",     label: "03. Suporte/fixação OK" },
  { key: "item04_lacre",       label: "04. Lacre íntegro" },
  { key: "item05_pino",        label: "05. Pino de segurança" },
  { key: "item06_manometro",   label: "06. Manômetro na faixa verde" },
  { key: "item07_mangueira",   label: "07. Mangueira em bom estado" },
  { key: "item08_difusor",     label: "08. Difusor/bico sem entupimento" },
  { key: "item09_cilindro",    label: "09. Cilindro sem corrosão/dano" },
  { key: "item10_etiqueta",    label: "10. Etiqueta legível" },
  { key: "item11_validade",    label: "11. Validade da carga em dia" },
  { key: "item12_selo_inmetro",label: "12. Selo INMETRO presente" },
] as const;

async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const ratio = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * ratio);
  const h = Math.round(bmp.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  return await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
}

function FotoCapture({
  slot, foto, onSelect, onClear,
}: {
  slot: Slot;
  foto: FotoState;
  onSelect: (slot: Slot, file: File) => void;
  onClear: (slot: Slot) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const info = SLOT_INFO[slot];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2">
              <span className="text-lg">{info.emoji}</span>
              <span>{info.titulo}</span>
              {info.obrigatoria
                ? <Badge variant="destructive" className="text-[10px]">obrigatória</Badge>
                : <Badge variant="outline" className="text-[10px]">opcional</Badge>}
            </div>
            <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 leading-relaxed">
              <strong>📷 Como fazer:</strong> {info.instrucao}
            </div>
          </div>
        </div>
        {foto.previewUrl ? (
          <div className="relative">
            <img src={foto.previewUrl} alt={info.titulo} className="w-full max-h-72 object-contain rounded border bg-black/5" />
            {foto.uploading && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <Button type="button" size="sm" variant="outline" className="mt-2"
              onClick={() => { onClear(slot); inputRef.current?.click(); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Trocar foto
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full h-32 border-dashed"
            onClick={() => inputRef.current?.click()}>
            <Camera className="h-5 w-5 mr-2" /> Tirar/escolher foto
          </Button>
        )}
        <input
          ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelect(slot, f);
            e.target.value = "";
          }}
        />
      </CardContent>
    </Card>
  );
}

// ============ COMPONENTE PRINCIPAL ============
function InspecaoFotoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [etapa, setEtapa] = useState<0 | 1 | 2 | 3>(0);

  // Seleção do extintor
  const [extintorId, setExtintorId] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [modoManual, setModoManual] = useState(false);
  const [manualNumero, setManualNumero] = useState("");
  const [manualCilindro, setManualCilindro] = useState("");
  const [manualTipo, setManualTipo] = useState<string>("ABC");
  const [manualLocal, setManualLocal] = useState("");

  // Fotos
  const [etiqueta, setEtiqueta] = useState<FotoState>(initialFoto());
  const [manometro, setManometro] = useState<FotoState>(initialFoto());
  const [inmetro, setInmetro] = useState<FotoState>(initialFoto());
  const [extra, setExtra] = useState<FotoState>(initialFoto());

  // Localização
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsErro, setGpsErro] = useState<string | null>(null);
  const [localizacaoDescritiva, setLocalizacaoDescritiva] = useState("");

  // Laudo
  const [observacoes, setObservacoes] = useState("");
  const [laudoIA, setLaudoIA] = useState<any | null>(null);
  const [laudo, setLaudo] = useState<any>({});
  const [analisando, setAnalisando] = useState(false);
  const [justifDiv, setJustifDiv] = useState("");
  const [sigOpen, setSigOpen] = useState(false);
  const [assinatura, setAssinatura] = useState<{ path: string; nome: string; cargo: string } | null>(null);

  // GPS ao montar
  useEffect(() => {
    if (!("geolocation" in navigator)) { setGpsErro("Geolocalização não suportada"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => setGpsErro(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const extintores = useQuery({
    queryKey: ["extintores-todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extintores")
        .select("id,numero,numero_cilindro,tipo_agente,capacidade_extintora,carga_nominal,carga_unidade,area,localizacao")
        .order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const extintorSelecionado = useMemo(
    () => (extintores.data ?? []).find((e: any) => e.id === extintorId) ?? null,
    [extintores.data, extintorId],
  );

  const buscaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const todos = extintores.data ?? [];
    if (!q) return todos.slice(0, 8);
    return todos.filter((e: any) =>
      [e.numero, e.numero_cilindro, e.localizacao, e.area]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q))
    ).slice(0, 8);
  }, [extintores.data, busca]);

  const handleSelectFoto = async (slot: Slot, file: File) => {
    const setter = slot === "etiqueta" ? setEtiqueta : slot === "manometro" ? setManometro : slot === "inmetro" ? setInmetro : setExtra;
    const previewUrl = URL.createObjectURL(file);
    setter({ file, previewUrl, path: null, uploading: true });
    try {
      const blob = await compressImage(file);
      const path = `${user!.id}/${Date.now()}-${slot}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/jpeg", upsert: false,
      });
      if (error) throw error;
      setter({ file, previewUrl, path, uploading: false });
    } catch (e: any) {
      toast.error(`Falha no upload: ${e.message ?? e}`);
      setter(initialFoto());
    }
  };

  const handleClearFoto = (slot: Slot) => {
    const setter = slot === "etiqueta" ? setEtiqueta : slot === "manometro" ? setManometro : slot === "inmetro" ? setInmetro : setExtra;
    setter(initialFoto());
  };

  const analisarFn = useServerFn(analisarFotosExtintor);
  const salvarFn = useServerFn(salvarInspecaoFoto);

  // Cria extintor rápido se manual e ainda não criado
  const criarExtintorManual = async (): Promise<string | null> => {
    if (!modoManual) return extintorId || null;
    if (!manualNumero || !manualCilindro) {
      toast.error("Informe nº patrimônio e nº do cilindro.");
      return null;
    }
    try {
      const { data, error } = await supabase
        .from("extintores")
        .insert({
          numero: manualNumero,
          numero_cilindro: manualCilindro,
          tipo_agente: manualTipo as any,
          localizacao: manualLocal || undefined,
          status: "ATIVO",
          created_by: user!.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Extintor cadastrado rapidamente. 👍");
      return data.id as string;
    } catch (e: any) {
      toast.error(`Não foi possível cadastrar: ${e.message ?? e}`);
      return null;
    }
  };

  const handleAnalisar = async () => {
    if (!etiqueta.path || !manometro.path || !inmetro.path) {
      toast.error("Envie as 3 fotos obrigatórias (etiqueta, manômetro e INMETRO).");
      return;
    }
    if ([etiqueta, manometro, inmetro, extra].some((f) => f.uploading)) {
      toast.error("Aguarde os uploads terminarem.");
      return;
    }
    setAnalisando(true);
    try {
      const esperado = extintorSelecionado
        ? {
            numero: extintorSelecionado.numero,
            numero_cilindro: extintorSelecionado.numero_cilindro,
            tipo_agente: extintorSelecionado.tipo_agente,
            capacidade: extintorSelecionado.capacidade_extintora ||
              (extintorSelecionado.carga_nominal ? `${extintorSelecionado.carga_nominal} ${extintorSelecionado.carga_unidade ?? "kg"}` : null),
          }
        : null;
      const { laudo: l } = await analisarFn({
        data: {
          foto_etiqueta_path: etiqueta.path,
          foto_manometro_path: manometro.path,
          foto_inmetro_path: inmetro.path,
          foto_extra_path: extra.path ?? null,
          extintor_esperado: esperado,
        },
      });
      setLaudoIA(l);
      setLaudo({ ...l });
      setEtapa(3);
      if (l?.divergencia_detectada) {
        toast.error("⚠ Divergência detectada — escreva a justificativa antes de salvar.");
      } else if ((l?.confianca ?? 0) < 0.7) {
        toast.warning("Confiança baixa — revise os dados com atenção.");
      } else {
        toast.success("Laudo gerado! Revise antes de salvar.");
      }
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setAnalisando(false);
    }
  };

  const salvarMut = useMutation({
    mutationFn: async () => {
      const ncs: string[] = Array.isArray(laudo.nao_conformidades) ? laudo.nao_conformidades : [];
      const itensNC = ITENS_FOR_SFG_08.filter((it) => laudo[it.key] === "NC").length;
      const divergente = !!laudo.divergencia_detectada;
      if (divergente && justifDiv.trim().length < 10) {
        toast.error("Por favor, escreva uma justificativa (>= 10 caracteres) para a divergência.");
        throw new Error("justificativa obrigatória");
      }
      const status_geral: "conforme" | "nao_conforme" | "pendente_revisao" =
        ncs.length === 0 && itensNC === 0 && !divergente ? "conforme" :
        divergente ? "pendente_revisao" : "nao_conforme";

      // Dados técnicos para gravar e enriquecer o cadastro
      const toDate = (v: any): string | null => {
        if (!v || typeof v !== "string") return null;
        const s = v.trim();
        if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        let m = s.match(/^(\d{1,2})\/(\d{4})$/); // MM/AAAA
        if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/AAAA
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        if (/^\d{4}$/.test(s)) return `${s}-12-31`; // só ano
        return null;
      };
      const dadosTecnicos = {
        fabricante: laudo.fabricante ?? null,
        tipo: laudo.tipo ?? null,
        classes_fogo: laudo.classes_fogo ?? null,
        capacidade_kg: laudo.capacidade_kg ?? null,
        numero_cilindro: laudo.numero_cilindro ?? null,
        codigo_inmetro: laudo.codigo_inmetro ?? null,
        lote_inmetro: laudo.lote_inmetro ?? null,
        qr_inmetro_url: laudo.qr_inmetro_url ?? null,
        data_fabricacao: toDate(laudo.data_fabricacao),
        proxima_manutencao_n2: toDate(laudo.proxima_manutencao_n2),
        proxima_manutencao_n3: toDate(laudo.proxima_manutencao_n3),
        checklist: Object.fromEntries(ITENS_FOR_SFG_08.map((it) => [it.key, laudo[it.key]])),
      };

      return await salvarFn({
        data: {
          extintor_id: extintorId || null,
          foto_etiqueta_path: etiqueta.path!,
          foto_manometro_path: manometro.path!,
          foto_inmetro_path: inmetro.path ?? null,
          foto_extra_path: extra.path ?? null,
          gps_lat: gps?.lat ?? null,
          gps_lng: gps?.lng ?? null,
          gps_accuracy: gps?.accuracy ?? null,
          localizacao_descritiva: localizacaoDescritiva || null,
          laudo_ia: laudoIA,
          laudo_revisado: laudo,
          dados_extraidos: dadosTecnicos,
          confianca_ia: laudoIA?.confianca ?? null,
          status_geral,
          nao_conformidades: ncs,
          precisa_revisao: divergente,
          justificativa_divergencia: divergente ? justifDiv : null,
          assinatura_path: assinatura?.path ?? null,
          assinado_por_nome: assinatura?.nome ?? null,
          assinado_por_cargo: assinatura?.cargo ?? null,
          observacoes: observacoes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Inspeção salva!");
      qc.invalidateQueries({ queryKey: ["extintor-inspecoes-foto"] });
      qc.invalidateQueries({ queryKey: ["extintores"] });
      navigate({ to: "/app/extintores" });
    },
    onError: (e: any) => {
      if (e?.message === "justificativa obrigatória") return;
      toast.error(e.message ?? String(e));
    },
  });

  const handleAssinaturaUpload = async (dataUrl: string, nome: string, cargo: string) => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const path = `${user!.id}/assinaturas/${Date.now()}.png`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/png", upsert: false,
      });
      if (error) throw error;
      setAssinatura({ path, nome, cargo });
      toast.success("Assinatura registrada");
    } catch (e: any) {
      toast.error(`Erro na assinatura: ${e.message ?? e}`);
    }
  };

  const podeAvancarSelecao = !!extintorSelecionado || (modoManual && manualNumero && manualCilindro);

  return (
    <div className="container px-4 md:px-6 py-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/extintores"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <h1 className="text-xl font-semibold">Inspeção por Foto (FOR-SFG 08)</h1>
        </div>
        <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> IA</Badge>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className={`flex-1 h-1.5 rounded ${etapa >= n ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Etapa {etapa + 1} de 4 — {
          etapa === 0 ? "Identificar extintor" :
          etapa === 1 ? "Tirar as fotos" :
          etapa === 2 ? "Localização" : "Revisão & assinatura"
        }
      </p>

      {/* ========== ETAPA 0: Identificar extintor ========== */}
      {etapa === 0 && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Flame className="h-4 w-4 text-red-600" /> Qual extintor você vai inspecionar?
                </Label>
                <Button
                  size="sm" variant={modoManual ? "default" : "outline"}
                  onClick={() => { setModoManual((v) => !v); setExtintorId(""); }}
                >
                  {modoManual ? <><XCircle className="h-3.5 w-3.5 mr-1" />Cancelar</> : <><Plus className="h-3.5 w-3.5 mr-1" />Não cadastrado</>}
                </Button>
              </div>

              {!modoManual && (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nº patrimônio, nº cilindro, área ou local…"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-auto">
                    {extintores.isLoading && <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>}
                    {!extintores.isLoading && buscaFiltrada.length === 0 && (
                      <div className="text-sm text-muted-foreground py-4 text-center">
                        Nenhum extintor encontrado. Use "Não cadastrado" se a etiqueta estiver apagada.
                      </div>
                    )}
                    {buscaFiltrada.map((e: any) => {
                      const sel = e.id === extintorId;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setExtintorId(e.id)}
                          className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                            sel ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-mono font-bold text-red-700">{e.numero}</div>
                              <div className="text-xs text-muted-foreground">
                                {e.tipo_agente} · {e.localizacao ?? "sem local"}
                                {e.numero_cilindro && <> · cil. <span className="font-mono">{e.numero_cilindro}</span></>}
                              </div>
                            </div>
                            {sel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {modoManual && (
                <div className="space-y-3 rounded-md border border-dashed p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">
                    Cadastro rápido — para extintores antigos sem etiqueta ou ainda não inventariados.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nº patrimônio *</Label>
                      <Input value={manualNumero} onChange={(e) => setManualNumero(e.target.value)} placeholder="ex: 364-DMN" />
                    </div>
                    <div>
                      <Label className="text-xs">Nº cilindro *</Label>
                      <Input value={manualCilindro} onChange={(e) => setManualCilindro(e.target.value)} placeholder="ex: 008876" />
                    </div>
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={manualTipo} onValueChange={setManualTipo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Localização</Label>
                      <Input value={manualLocal} onChange={(e) => setManualLocal(e.target.value)} placeholder="ex: oficina, lado direito" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              disabled={!podeAvancarSelecao}
              onClick={async () => {
                if (modoManual) {
                  const id = await criarExtintorManual();
                  if (id) { setExtintorId(id); setModoManual(false); setEtapa(1); }
                } else {
                  setEtapa(1);
                }
              }}
            >
              Continuar →
            </Button>
          </div>
        </div>
      )}

      {/* ========== ETAPA 1: Fotos ========== */}
      {etapa === 1 && (
        <div className="space-y-3">
          {extintorSelecionado && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              Inspecionando: <strong className="text-red-700 font-mono">{extintorSelecionado.numero}</strong> · {extintorSelecionado.tipo_agente} · {extintorSelecionado.localizacao ?? "sem local"}
            </div>
          )}
          {(["etiqueta", "manometro", "inmetro", "extra"] as Slot[]).map((s) => (
            <FotoCapture
              key={s}
              slot={s}
              foto={s === "etiqueta" ? etiqueta : s === "manometro" ? manometro : s === "inmetro" ? inmetro : extra}
              onSelect={handleSelectFoto}
              onClear={handleClearFoto}
            />
          ))}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setEtapa(0)}>← Voltar</Button>
            <Button
              onClick={() => setEtapa(2)}
              disabled={!etiqueta.path || !manometro.path || !inmetro.path ||
                [etiqueta, manometro, inmetro, extra].some((f) => f.uploading)}
            >
              Continuar →
            </Button>
          </div>
        </div>
      )}

      {/* ========== ETAPA 2: Localização ========== */}
      {etapa === 2 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {gps ? (
                  <span className="text-emerald-700">
                    GPS capturado: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} (±{Math.round(gps.accuracy)}m)
                  </span>
                ) : gpsErro ? (
                  <span className="text-amber-700">Sem GPS: {gpsErro}</span>
                ) : (
                  <span className="text-muted-foreground">Obtendo GPS…</span>
                )}
              </div>
              <div>
                <Label>Localização descritiva</Label>
                <Input
                  placeholder="Ex: corredor da oficina, lado direito da porta"
                  value={localizacaoDescritiva}
                  onChange={(e) => setLocalizacaoDescritiva(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setEtapa(1)}>← Voltar</Button>
            <Button onClick={handleAnalisar} disabled={analisando}>
              {analisando ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando…</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Analisar com IA</>)}
            </Button>
          </div>
        </div>
      )}

      {/* ========== ETAPA 3: Revisão ========== */}
      {etapa === 3 && laudoIA && (
        <div className="space-y-4">
          {/* Alerta de divergência */}
          {laudo.divergencia_detectada && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-red-700">
                  <AlertTriangle className="h-5 w-5" /> Divergência detectada pela IA
                </div>
                <div className="text-sm text-red-800">
                  {laudo.divergencia_descricao ?? "Os dados da etiqueta lida não batem com o extintor selecionado."}
                </div>
                <div>
                  <Label className="text-xs text-red-700">Justificativa (obrigatória) *</Label>
                  <Textarea
                    rows={2}
                    value={justifDiv}
                    onChange={(e) => setJustifDiv(e.target.value)}
                    placeholder="Explique a divergência (ex: etiqueta apagada, fotografei outro extintor por engano, etc.)"
                    className="bg-white"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Confiança */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Confiança da IA</div>
                <Badge variant={laudoIA.confianca >= 0.7 ? "default" : "destructive"}>
                  {Math.round((laudoIA.confianca ?? 0) * 100)}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* DADOS TÉCNICOS */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="font-semibold text-sm flex items-center gap-2">
                🔧 Dados técnicos extraídos
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs">Fabricante</Label>
                  <Input value={laudo.fabricante ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, fabricante: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={laudo.tipo ?? ""} onValueChange={(v) => setLaudo((p: any) => ({ ...p, tipo: v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Capacidade (kg/L)</Label>
                  <Input type="number" step="0.1" value={laudo.capacidade_kg ?? ""}
                    onChange={(e) => setLaudo((p: any) => ({ ...p, capacidade_kg: e.target.value ? Number(e.target.value) : null }))} />
                </div>
                <div>
                  <Label className="text-xs">Classes de fogo</Label>
                  <Input value={(laudo.classes_fogo ?? []).join(", ")}
                    onChange={(e) => setLaudo((p: any) => ({ ...p, classes_fogo: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) }))}
                    placeholder="A, B, C" />
                </div>
                <div>
                  <Label className="text-xs">Nº cilindro</Label>
                  <Input value={laudo.numero_cilindro ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, numero_cilindro: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Fabricação</Label>
                  <Input value={laudo.data_fabricacao ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, data_fabricacao: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Código INMETRO</Label>
                  <Input value={laudo.codigo_inmetro ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, codigo_inmetro: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Lote INMETRO</Label>
                  <Input value={laudo.lote_inmetro ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, lote_inmetro: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Próx. manut. N2</Label>
                  <Input value={laudo.proxima_manutencao_n2 ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, proxima_manutencao_n2: e.target.value }))} placeholder="AAAA-MM-DD" />
                </div>
                <div>
                  <Label className="text-xs">Próx. manut. N3</Label>
                  <Input value={laudo.proxima_manutencao_n3 ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, proxima_manutencao_n3: e.target.value }))} placeholder="AAAA-MM-DD" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">QR Code INMETRO</Label>
                  <Input value={laudo.qr_inmetro_url ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, qr_inmetro_url: e.target.value }))} placeholder="URL detectada" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CHECKLIST 12 ITENS */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="font-semibold text-sm flex items-center gap-2">
                ✅ Checklist FOR-SFG 08 — pré-marcado pela IA
              </div>
              <p className="text-xs text-muted-foreground">C = Conforme · NC = Não Conforme · NA = Não se aplica</p>
              <div className="space-y-1.5">
                {ITENS_FOR_SFG_08.map((it) => {
                  const v = laudo[it.key] ?? "NA";
                  return (
                    <div key={it.key} className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
                      <span className="flex-1">{it.label}</span>
                      <div className="flex gap-1">
                        {(["C", "NC", "NA"] as const).map((opt) => {
                          const active = v === opt;
                          const cls = opt === "C"
                            ? (active ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50")
                            : opt === "NC"
                            ? (active ? "bg-red-600 text-white border-red-600" : "border-red-300 text-red-700 hover:bg-red-50")
                            : (active ? "bg-slate-500 text-white border-slate-500" : "border-slate-300 text-slate-600 hover:bg-slate-50");
                          return (
                            <button
                              key={opt} type="button"
                              onClick={() => setLaudo((p: any) => ({ ...p, [it.key]: opt }))}
                              className={`px-2.5 py-1 text-xs font-bold rounded border transition-colors ${cls}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* NCs livres + observações */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label>Não conformidades adicionais (livres)</Label>
              <Textarea
                rows={3}
                value={(Array.isArray(laudo.nao_conformidades) ? laudo.nao_conformidades : []).join("\n")}
                onChange={(e) => setLaudo((p: any) => ({
                  ...p, nao_conformidades: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                }))}
                placeholder="Uma por linha"
              />
              <Label className="mt-2">Observações</Label>
              <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </CardContent>
          </Card>

          {/* Assinatura */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label>Assinatura do responsável (opcional, mas recomendado)</Label>
              {assinatura ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Assinado por {assinatura.nome} — {assinatura.cargo}
                  <Button size="sm" variant="ghost" onClick={() => setAssinatura(null)}>trocar</Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setSigOpen(true)}>
                  <PenLine className="h-4 w-4 mr-2" /> Assinar inspeção
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between sticky bottom-0 bg-background py-2">
            <Button variant="outline" onClick={() => setEtapa(2)}>← Voltar</Button>
            <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>
              {salvarMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</> : "Salvar inspeção"}
            </Button>
          </div>
        </div>
      )}

      <SignaturePadDialog
        open={sigOpen}
        onClose={() => setSigOpen(false)}
        onConfirm={async ({ dataUrl }) => {
          setSigOpen(false);
          const nome = user?.user_metadata?.full_name ?? user?.email ?? "Responsável";
          await handleAssinaturaUpload(dataUrl, nome, "Inspetor");
        }}
        title="Assinatura da inspeção"
      />
    </div>
  );
}

// keep MinusCircle import used (silence TS)
void MinusCircle;
