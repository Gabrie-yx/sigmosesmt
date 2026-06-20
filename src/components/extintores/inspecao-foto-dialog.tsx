import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, RotateCcw, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const BUCKET = "extintores-inspecoes";

type Slot = "etiqueta" | "manometro" | "inmetro" | "extra";

type FotoState = {
  file: File | null;
  previewUrl: string | null;
  path: string | null;
  uploading: boolean;
};
const empty = (): FotoState => ({ file: null, previewUrl: null, path: null, uploading: false });

const SLOT_INFO: Record<Slot, { titulo: string; abaCurta: string; instrucao: string; obrigatoria: boolean; emoji: string }> = {
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
    instrucao: "Aproxime o suficiente para a IA ver a AGULHA do manômetro, o LACRE plástico, o PINO de segurança e a MANGUEIRA.",
    obrigatoria: true,
  },
  inmetro: {
    emoji: "🟢",
    abaCurta: "INMETRO",
    titulo: "Foto 3 — Selo INMETRO + etiqueta de manutenção",
    instrucao: "Mostre o SELO VERDE do INMETRO (códigos e QR Code) E a ETIQUETA AMARELA de manutenção (datas N2/N3).",
    obrigatoria: true,
  },
  extra: {
    emoji: "📍",
    abaCurta: "Extra",
    titulo: "Foto 4 — Extra (localização / NC)",
    instrucao: "OPCIONAL. Foto ampla da sinalização de piso, acesso, ou evidência de não conformidade (corrosão, dano, obstrução).",
    obrigatoria: false,
  },
};

const ORDEM: Slot[] = ["etiqueta", "manometro", "inmetro", "extra"];

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
  slot: Slot;
  foto: FotoState;
  onSelect: (slot: Slot, file: File) => void;
  onClear: (slot: Slot) => void;
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
  const [extra, setExtra] = useState<FotoState>(empty());

  const setterFor = (slot: Slot) =>
    slot === "etiqueta" ? setEtiqueta : slot === "manometro" ? setManometro : slot === "inmetro" ? setInmetro : setExtra;
  const stateFor = (slot: Slot): FotoState =>
    slot === "etiqueta" ? etiqueta : slot === "manometro" ? manometro : slot === "inmetro" ? inmetro : extra;

  const handleSelectFoto = async (slot: Slot, file: File) => {
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

  const handleClearFoto = (slot: Slot) => setterFor(slot)(empty());

  const obrigatoriasOk = !!etiqueta.path && !!manometro.path && !!inmetro.path;
  const uploading = [etiqueta, manometro, inmetro, extra].some((f) => f.uploading);
  const totalFeitas = [etiqueta, manometro, inmetro].filter((f) => !!f.path).length;

  const reset = () => {
    setEtiqueta(empty()); setManometro(empty()); setInmetro(empty()); setExtra(empty());
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
    try {
      sessionStorage.setItem(
        `inspecao-foto-prefill:${extintor.id}`,
        JSON.stringify({
          etiqueta_path: etiqueta.path,
          manometro_path: manometro.path,
          inmetro_path: inmetro.path,
          extra_path: extra.path,
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
        extra: extra.path ?? undefined,
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
          {totalFeitas}/3 fotos obrigatórias enviadas {extra.path ? "· extra: ✓" : ""}
        </div>

        <Tabs value={aba} onValueChange={(v) => setAba(v as Slot)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {ORDEM.map((s) => {
              const f = stateFor(s);
              const done = !!f.path;
              return (
                <TabsTrigger key={s} value={s} className="relative text-xs">
                  {SLOT_INFO[s].abaCurta}
                  {done && <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-1" />}
                  {!SLOT_INFO[s].obrigatoria && (
                    <span className="ml-1 text-[9px] text-muted-foreground">(opc)</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {ORDEM.map((s) => (
            <TabsContent key={s} value={s} className="mt-4">
              <TabFoto slot={s} foto={stateFor(s)} onSelect={handleSelectFoto} onClear={handleClearFoto} />
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
              <><Sparkles className="h-4 w-4 mr-2" /> Iniciar análise IA →</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}