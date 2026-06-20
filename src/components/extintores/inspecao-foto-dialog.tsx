import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, RotateCcw, Loader2, Sparkles, CheckCircle2, AlertTriangle, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const BUCKET = "extintores-inspecoes";
const MAX_AVARIAS = 4;

type Slot = "etiqueta" | "manometro" | "inmetro" | "avarias";

type FotoState = {
  file: File | null;
  previewUrl: string | null;
  path: string | null;
  uploading: boolean;
};
const empty = (): FotoState => ({ file: null, previewUrl: null, path: null, uploading: false });

type AvariaFoto = {
  id: string;
  file: File | null;
  previewUrl: string | null;
  path: string | null;
  uploading: boolean;
};

const SLOT_INFO: Record<Exclude<Slot, "avarias">, { titulo: string; abaCurta: string; instrucao: string; obrigatoria: boolean; emoji: string }> = {
  etiqueta: {
    emoji: "🏷️",
    abaCurta: "Etiqueta",
    titulo: "Foto 1 — Corpo + etiqueta principal",
    instrucao: "Centralize a ETIQUETA PRINCIPAL (fabricante, tipo ABC/BC, classes de fogo e capacidade). Mostre o corpo inteiro.",
    obrigatoria: true,
  },
  manometro: {
    emoji: "📊",
    abaCurta: "Manômetro",
    titulo: "Foto 2 — Manômetro + lacre + pino + mangueira",
    instrucao: "Aproxime o suficiente para enquadrar a AGULHA do manômetro, o LACRE plástico, o PINO de segurança e a MANGUEIRA.",
    obrigatoria: true,
  },
  inmetro: {
    emoji: "🟢",
    abaCurta: "INMETRO",
    titulo: "Foto 3 — Selo INMETRO + etiqueta de manutenção",
    instrucao: "Mostre o SELO VERDE do INMETRO (códigos e QR Code) E a ETIQUETA AMARELA de manutenção (datas N2/N3).",
    obrigatoria: true,
  },
};

const ORDEM: Slot[] = ["etiqueta", "manometro", "inmetro", "avarias"];

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

function TabFoto({
  slot, foto, onSelect, onClear,
}: {
  slot: Exclude<Slot, "avarias">;
  foto: FotoState;
  onSelect: (slot: Exclude<Slot, "avarias">, file: File) => void;
  onClear: (slot: Exclude<Slot, "avarias">) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const info = SLOT_INFO[slot];
  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold flex items-center gap-2 flex-wrap">
          <span className="text-lg">{info.emoji}</span>
          <span>{info.titulo}</span>
          {info.obrigatoria
            ? <Badge variant="destructive" className="text-[10px]">obrigatória</Badge>
            : <Badge variant="outline" className="text-[10px]">opcional</Badge>}
        </div>
        <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 leading-relaxed">
          <strong>📷 Como fazer:</strong> {info.instrucao}
        </div>
      </div>

      {foto.previewUrl ? (
        <div className="relative">
          <img src={foto.previewUrl} alt={info.titulo} className="w-full max-h-80 object-contain rounded border bg-black/30" />
          {foto.uploading && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" size="sm" variant="outline"
              onClick={() => { onClear(slot); inputRef.current?.click(); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Trocar foto
            </Button>
            {foto.path && !foto.uploading && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> enviada
              </span>
            )}
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full h-40 border-dashed"
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
    </div>
  );
}

function TabAvarias({
  avarias, onAdd, onRemove,
}: {
  avarias: AvariaFoto[];
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const podeAdicionar = avarias.length < MAX_AVARIAS;
  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold flex items-center gap-2 flex-wrap">
          <span className="text-lg">⚠️</span>
          <span>Foto 4 — Avarias / Evidências extras</span>
          <Badge variant="outline" className="text-[10px]">opcional · até {MAX_AVARIAS}</Badge>
        </div>
        <div className="mt-2 rounded-md bg-orange-500/10 border border-orange-500/30 px-3 py-2 text-xs text-orange-200 leading-relaxed">
          <strong>⚠️ Quando usar:</strong> houver <strong>corrosão, ferrugem, amassado, lacre rompido,
          mangueira danificada</strong>, sinalização de piso ausente ou qualquer evidência de não
          conformidade. Tire uma foto por avaria.
        </div>
      </div>

      {avarias.length === 0 && (
        <div className="text-xs text-muted-foreground italic text-center py-2">
          Nenhuma avaria registrada. Se o extintor está visualmente perfeito, pode pular esta etapa.
        </div>
      )}

      {avarias.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {avarias.map((a, i) => (
            <div key={a.id} className="relative rounded-md border bg-black/30 overflow-hidden">
              {a.previewUrl && (
                <img src={a.previewUrl} alt={`Avaria ${i + 1}`} className="w-full h-32 object-cover" />
              )}
              {a.uploading && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              <div className="absolute top-1 left-1">
                <Badge variant="outline" className="text-[10px] bg-slate-950/80 border-orange-400/40 text-orange-200">
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" /> {i + 1}
                </Badge>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute top-1 right-1 h-7 w-7 p-0"
                onClick={() => onRemove(a.id)}
                disabled={a.uploading}
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {a.path && !a.uploading && (
                <div className="absolute bottom-1 right-1">
                  <span className="text-[10px] text-emerald-300 flex items-center gap-1 bg-slate-950/80 px-1.5 py-0.5 rounded">
                    <CheckCircle2 className="h-3 w-3" /> ok
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {podeAdicionar && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 border-dashed border-orange-500/40 hover:bg-orange-500/10"
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="h-5 w-5 mr-1" /> <Camera className="h-4 w-4 mr-2" />
          Adicionar foto de avaria ({avarias.length}/{MAX_AVARIAS})
        </Button>
      )}

      <input
        ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAdd(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function ExtintorInspecaoFotoDialog({
  extintor,
  open,
  onOpenChange,
}: {
  extintor: { id: string; numero?: string | null; tipo_agente?: string | null; localizacao?: string | null } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [aba, setAba] = useState<Slot>("etiqueta");
  const [etiqueta, setEtiqueta] = useState<FotoState>(empty());
  const [manometro, setManometro] = useState<FotoState>(empty());
  const [inmetro, setInmetro] = useState<FotoState>(empty());
  const [avarias, setAvarias] = useState<AvariaFoto[]>([]);

  const setterFor = (slot: Exclude<Slot, "avarias">) =>
    slot === "etiqueta" ? setEtiqueta : slot === "manometro" ? setManometro : setInmetro;
  const stateFor = (slot: Exclude<Slot, "avarias">): FotoState =>
    slot === "etiqueta" ? etiqueta : slot === "manometro" ? manometro : inmetro;

  const handleSelectFoto = async (slot: Exclude<Slot, "avarias">, file: File) => {
    const setter = setterFor(slot);
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
      setter(empty());
    }
  };

  const handleClearFoto = (slot: Exclude<Slot, "avarias">) => setterFor(slot)(empty());

  const handleAddAvaria = async (file: File) => {
    if (avarias.length >= MAX_AVARIAS) {
      toast.error(`Máximo de ${MAX_AVARIAS} fotos de avaria.`);
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const previewUrl = URL.createObjectURL(file);
    setAvarias((prev) => [...prev, { id, file, previewUrl, path: null, uploading: true }]);
    try {
      const blob = await compressImage(file);
      const path = `${user!.id}/${Date.now()}-avaria.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/jpeg", upsert: false,
      });
      if (error) throw error;
      setAvarias((prev) => prev.map((a) => a.id === id ? { ...a, path, uploading: false } : a));
    } catch (e: any) {
      toast.error(`Falha no upload: ${e.message ?? e}`);
      setAvarias((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleRemoveAvaria = (id: string) => {
    setAvarias((prev) => prev.filter((a) => a.id !== id));
  };

  const obrigatoriasOk = !!etiqueta.path && !!manometro.path && !!inmetro.path;
  const uploading = [etiqueta, manometro, inmetro].some((f) => f.uploading) || avarias.some((a) => a.uploading);
  const totalFeitas = [etiqueta, manometro, inmetro].filter((f) => !!f.path).length;
  const avariasOk = avarias.filter((a) => a.path).length;

  const reset = () => {
    setEtiqueta(empty()); setManometro(empty()); setInmetro(empty()); setAvarias([]);
    setAba("etiqueta");
  };

  const handleContinuar = () => {
    if (!extintor) return;
    if (!obrigatoriasOk) {
      toast.error("Envie as 3 fotos obrigatórias antes de continuar.");
      return;
    }
    if (uploading) {
      toast.error("Aguarde os uploads terminarem.");
      return;
    }
    const avariasPaths = avarias.map((a) => a.path).filter((p): p is string => !!p);
    // Para manter compatibilidade com o handoff atual: a primeira avaria vai como foto_extra_path.
    const extraPath = avariasPaths[0] ?? null;
    try {
      sessionStorage.setItem(
        `inspecao-foto-prefill:${extintor.id}`,
        JSON.stringify({
          etiqueta_path: etiqueta.path,
          manometro_path: manometro.path,
          inmetro_path: inmetro.path,
          extra_path: extraPath,
          avarias_paths: avariasPaths,
          ts: Date.now(),
        }),
      );
    } catch {/* ignore */}
    onOpenChange(false);
    reset();
    navigate({
      to: "/app/extintores-inspecao-foto",
      search: {
        extintor: extintor.id,
        handoff: "1",
        etiqueta: etiqueta.path,
        manometro: manometro.path,
        inmetro: inmetro.path,
        extra: extraPath ?? undefined,
      } as any,
    });
  };

  const irProxima = () => {
    const idx = ORDEM.indexOf(aba);
    if (idx < ORDEM.length - 1) setAba(ORDEM[idx + 1]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-red-500" />
            Inspeção por Foto (FOR-SFG 08)
          </DialogTitle>
          <DialogDescription>
            Envie as fotos obrigatórias para iniciar a análise automática do extintor.
          </DialogDescription>
          {extintor && (
            <div className="text-xs text-muted-foreground mt-1">
              Inspecionando: <strong className="text-red-500 font-mono">{extintor.numero}</strong>
              {extintor.tipo_agente && <> · {extintor.tipo_agente}</>}
              {extintor.localizacao && <> · {extintor.localizacao}</>}
            </div>
          )}
        </DialogHeader>

        <div className="text-xs text-muted-foreground">
          {totalFeitas}/3 fotos obrigatórias enviadas
          {avariasOk > 0 && <> · <span className="text-orange-300">{avariasOk} avaria{avariasOk > 1 ? "s" : ""}</span></>}
        </div>

        <Tabs value={aba} onValueChange={(v) => setAba(v as Slot)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {ORDEM.map((s) => {
              if (s === "avarias") {
                return (
                  <TabsTrigger key={s} value={s} className="relative text-xs">
                    Avarias
                    {avariasOk > 0 && (
                      <Badge className="ml-1 h-4 px-1 text-[9px] bg-orange-500/30 text-orange-200 border-orange-400/40">
                        {avariasOk}
                      </Badge>
                    )}
                    <span className="ml-1 text-[9px] text-muted-foreground">(opc)</span>
                  </TabsTrigger>
                );
              }
              const info = SLOT_INFO[s];
              const done = !!stateFor(s).path;
              return (
                <TabsTrigger key={s} value={s} className="relative text-xs">
                  {info.abaCurta}
                  {done && <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-1" />}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {ORDEM.map((s) => (
            <TabsContent key={s} value={s} className="mt-4">
              {s === "avarias" ? (
                <TabAvarias avarias={avarias} onAdd={handleAddAvaria} onRemove={handleRemoveAvaria} />
              ) : (
                <TabFoto slot={s} foto={stateFor(s)} onSelect={handleSelectFoto} onClear={handleClearFoto} />
              )}
              <div className="flex justify-end mt-3">
                {ORDEM.indexOf(s) < ORDEM.length - 1 && (
                  <Button type="button" size="sm" variant="ghost" onClick={irProxima}>
                    Próxima foto →
                  </Button>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleContinuar}
            disabled={!obrigatoriasOk || uploading}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Iniciar análise →</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}