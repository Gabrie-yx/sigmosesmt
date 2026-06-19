import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { ArrowLeft, Camera, MapPin, Sparkles, CheckCircle2, AlertTriangle, RotateCcw, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import {
  analisarFotosExtintor,
  salvarInspecaoFoto,
} from "@/lib/extintor-inspecao-foto.functions";

export const Route = createFileRoute("/app/extintores-inspecao-foto")({
  component: InspecaoFotoPage,
  head: () => ({ meta: [{ title: "Inspeção de Extintor por Foto · SIGMO" }] }),
});

const BUCKET = "extintores-inspecoes";
const TIPOS = ["ABC", "BC", "A", "AP", "CO2", "PQS", "PQS_K", "OUTRO"] as const;
const PRESSAO_LABEL: Record<string, string> = {
  OK_VERDE: "OK (verde)",
  BAIXA_VERMELHO: "Baixa (vermelho)",
  ALTA_AMARELO: "Alta (amarelo)",
  ILEGIVEL: "Ilegível",
};

type Slot = "etiqueta" | "manometro" | "lacre";

type FotoState = {
  file: File | null;
  previewUrl: string | null;
  path: string | null;
  uploading: boolean;
};

const initialFoto = (): FotoState => ({ file: null, previewUrl: null, path: null, uploading: false });

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
  slot, label, hint, foto, onSelect, onClear, obrigatoria,
}: {
  slot: Slot;
  label: string;
  hint: string;
  foto: FotoState;
  onSelect: (slot: Slot, file: File) => void;
  onClear: (slot: Slot) => void;
  obrigatoria: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium flex items-center gap-2">
              {label}
              {obrigatoria && <Badge variant="destructive" className="text-[10px]">obrigatória</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
          </div>
        </div>
        {foto.previewUrl ? (
          <div className="relative">
            <img src={foto.previewUrl} alt={label} className="w-full max-h-72 object-contain rounded border bg-black/5" />
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
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
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

function InspecaoFotoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [extintorId, setExtintorId] = useState<string>("NOVO");
  const [etiqueta, setEtiqueta] = useState<FotoState>(initialFoto());
  const [manometro, setManometro] = useState<FotoState>(initialFoto());
  const [lacre, setLacre] = useState<FotoState>(initialFoto());
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsErro, setGpsErro] = useState<string | null>(null);
  const [localizacaoDescritiva, setLocalizacaoDescritiva] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [laudoIA, setLaudoIA] = useState<any | null>(null);
  const [laudo, setLaudo] = useState<any>({});
  const [analisando, setAnalisando] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [assinatura, setAssinatura] = useState<{ path: string; nome: string; cargo: string } | null>(null);

  // GPS automático ao montar
  useEffect(() => {
    if (!("geolocation" in navigator)) { setGpsErro("Geolocalização não suportada"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => setGpsErro(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const extintores = useQuery({
    queryKey: ["extintores-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("extintores").select("id,numero,tipo,localizacao").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSelectFoto = async (slot: Slot, file: File) => {
    const setter = slot === "etiqueta" ? setEtiqueta : slot === "manometro" ? setManometro : setLacre;
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
    const setter = slot === "etiqueta" ? setEtiqueta : slot === "manometro" ? setManometro : setLacre;
    setter(initialFoto());
  };

  const analisarFn = useServerFn(analisarFotosExtintor);
  const salvarFn = useServerFn(salvarInspecaoFoto);

  const handleAnalisar = async () => {
    if (!etiqueta.path || !manometro.path) {
      toast.error("Envie ao menos as fotos de etiqueta e manômetro.");
      return;
    }
    if (etiqueta.uploading || manometro.uploading || lacre.uploading) {
      toast.error("Aguarde os uploads terminarem.");
      return;
    }
    setAnalisando(true);
    try {
      const { laudo: l } = await analisarFn({
        data: {
          foto_etiqueta_path: etiqueta.path,
          foto_manometro_path: manometro.path,
          foto_lacre_path: lacre.path ?? null,
        },
      });
      setLaudoIA(l);
      setLaudo({ ...l });
      setEtapa(3);
      if ((l?.confianca ?? 0) < 0.7) {
        toast.warning("Confiança baixa — revise os dados com atenção antes de salvar.");
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
      const status_geral: "conforme" | "nao_conforme" | "pendente_revisao" = ncs.length === 0
        ? "conforme"
        : "nao_conforme";
      return await salvarFn({
        data: {
          extintor_id: extintorId === "NOVO" ? null : extintorId,
          foto_etiqueta_path: etiqueta.path!,
          foto_manometro_path: manometro.path!,
          foto_lacre_path: lacre.path ?? null,
          gps_lat: gps?.lat ?? null,
          gps_lng: gps?.lng ?? null,
          gps_accuracy: gps?.accuracy ?? null,
          localizacao_descritiva: localizacaoDescritiva || null,
          laudo_ia: laudoIA,
          laudo_revisado: laudo,
          confianca_ia: laudoIA?.confianca ?? null,
          status_geral,
          nao_conformidades: ncs,
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
      navigate({ to: "/app/extintores" });
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
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

  return (
    <div className="container py-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/extintores"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <h1 className="text-xl font-semibold">Inspeção por Foto</h1>
        </div>
        <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> IA</Badge>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`flex-1 h-1.5 rounded ${etapa >= n ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Etapa {etapa} de 3 — {etapa === 1 ? "Fotos" : etapa === 2 ? "Localização" : "Revisão & assinatura"}
      </p>

      {/* ETAPA 1: Fotos */}
      {etapa === 1 && (
        <div className="space-y-3">
          <FotoCapture
            slot="etiqueta" label="1. Etiqueta / corpo do extintor"
            hint="Centralize a etiqueta. A IA vai ler marca, tipo, capacidade, validade e patrimônio."
            foto={etiqueta} onSelect={handleSelectFoto} onClear={handleClearFoto} obrigatoria
          />
          <FotoCapture
            slot="manometro" label="2. Manômetro"
            hint="Aproxime o suficiente para ver a agulha e as faixas (verde/vermelho/amarelo)."
            foto={manometro} onSelect={handleSelectFoto} onClear={handleClearFoto} obrigatoria
          />
          <FotoCapture
            slot="lacre" label="3. Lacre e contexto (opcional)"
            hint="Foto mais ampla mostrando lacre, mangueira, sinalização e acesso."
            foto={lacre} onSelect={handleSelectFoto} onClear={handleClearFoto} obrigatoria={false}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => setEtapa(2)}
              disabled={!etiqueta.path || !manometro.path || etiqueta.uploading || manometro.uploading || lacre.uploading}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {/* ETAPA 2: Vincular e localização */}
      {etapa === 2 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label>Vincular a um extintor existente (opcional)</Label>
              <Select value={extintorId} onValueChange={setExtintorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOVO">— Inspeção avulsa (sem vínculo) —</SelectItem>
                  {(extintores.data ?? []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      Nº {e.numero} · {e.tipo} · {e.localizacao ?? "sem local"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

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
            <Button variant="outline" onClick={() => setEtapa(1)}>Voltar</Button>
            <Button onClick={handleAnalisar} disabled={analisando}>
              {analisando ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando…</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Analisar com IA</>)}
            </Button>
          </div>
        </div>
      )}

      {/* ETAPA 3: Revisão */}
      {etapa === 3 && laudoIA && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Confiança da IA</div>
                <Badge variant={laudoIA.confianca >= 0.7 ? "default" : "destructive"}>
                  {Math.round((laudoIA.confianca ?? 0) * 100)}%
                </Badge>
              </div>
              {laudoIA.confianca < 0.7 && (
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Confiança baixa — revise tudo antes de salvar.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label>Marca</Label>
                <Input value={laudo.marca ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, marca: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={laudo.tipo ?? ""} onValueChange={(v) => setLaudo((p: any) => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Capacidade (kg/L)</Label>
                <Input type="number" step="0.1" value={laudo.capacidade_kg ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, capacidade_kg: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <Label>Fabricação</Label>
                <Input value={laudo.data_fabricacao ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, data_fabricacao: e.target.value }))} />
              </div>
              <div>
                <Label>Validade</Label>
                <Input value={laudo.validade ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, validade: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Nº patrimônio</Label>
                <Input value={laudo.num_patrimonio ?? ""} onChange={(e) => setLaudo((p: any) => ({ ...p, num_patrimonio: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Manômetro</Label>
                <Select value={laudo.pressao_manometro ?? ""} onValueChange={(v) => setLaudo((p: any) => ({ ...p, pressao_manometro: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRESSAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="col-span-2 sm:col-span-1 flex items-center gap-2 text-sm mt-2">
                <input type="checkbox" checked={!!laudo.lacre_integro} onChange={(e) => setLaudo((p: any) => ({ ...p, lacre_integro: e.target.checked }))} /> Lacre íntegro
              </label>
              <label className="col-span-2 sm:col-span-1 flex items-center gap-2 text-sm mt-2">
                <input type="checkbox" checked={!!laudo.mangueira_ok} onChange={(e) => setLaudo((p: any) => ({ ...p, mangueira_ok: e.target.checked }))} /> Mangueira OK
              </label>
              <label className="col-span-2 sm:col-span-1 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!laudo.sinalizacao_ok} onChange={(e) => setLaudo((p: any) => ({ ...p, sinalizacao_ok: e.target.checked }))} /> Sinalização OK
              </label>
              <label className="col-span-2 sm:col-span-1 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!laudo.obstrucao} onChange={(e) => setLaudo((p: any) => ({ ...p, obstrucao: e.target.checked }))} /> Acesso obstruído
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label>Não conformidades detectadas</Label>
              <Textarea
                rows={3}
                value={(Array.isArray(laudo.nao_conformidades) ? laudo.nao_conformidades : []).join("\n")}
                onChange={(e) => setLaudo((p: any) => ({ ...p, nao_conformidades: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }))}
                placeholder="Uma por linha"
              />
              <Label className="mt-2">Observações</Label>
              <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </CardContent>
          </Card>

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
            <Button variant="outline" onClick={() => setEtapa(2)}>Voltar</Button>
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