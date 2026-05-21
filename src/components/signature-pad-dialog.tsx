import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser, Check, X, Upload } from "lucide-react";

export type AssinaturaResult = {
  dataUrl: string;
  nome: string;
  cargo?: string;
  registro?: string;
  cbo?: string;
};

export function SignaturePadDialog({
  open,
  onClose,
  onConfirm,
  title = "Assinar documento",
  defaultNome = "",
  defaultCargo = "TÉCNICO EM SEGURANÇA DO TRABALHO / BOMBEIRO PROFISSIONAL CIVIL",
  defaultRegistro = "0016640/MTE-AM",
  defaultCbo = "3516-05",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (r: AssinaturaResult) => void;
  title?: string;
  defaultNome?: string;
  defaultCargo?: string;
  defaultRegistro?: string;
  defaultCbo?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const hasInk = useRef(false);
  const [nome, setNome] = useState(defaultNome);
  const [cargo, setCargo] = useState(defaultCargo);
  const [registro, setRegistro] = useState(defaultRegistro);
  const [cbo, setCbo] = useState(defaultCbo);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    if (open) {
      setNome(defaultNome);
      setCargo(defaultCargo);
      setRegistro(defaultRegistro);
      setCbo(defaultCbo);
    }
  }, [open, defaultNome, defaultCargo, defaultRegistro, defaultCbo]);

  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.floor(rect.width * ratio);
    c.height = Math.floor(rect.height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    hasInk.current = false;
    setEmpty(true);
  }, [open]);

  function getPt(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPt.current = getPt(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPt(e);
    ctx.beginPath();
    ctx.moveTo(lastPt.current!.x, lastPt.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPt.current = p;
    hasInk.current = true;
    if (empty) setEmpty(false);
  }
  function up() { drawing.current = false; lastPt.current = null; }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const ratio = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    hasInk.current = false;
    setEmpty(true);
  }

  function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        const rect = c.getBoundingClientRect();
        clear();
        const ratio = Math.min(rect.width / img.width, rect.height / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
        hasInk.current = true;
        setEmpty(false);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function confirm() {
    if (empty) return;
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    onConfirm({
      dataUrl,
      nome: nome.trim(),
      cargo: cargo.trim(),
      registro: registro.trim(),
      cbo: cbo.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sig-nome">Nome completo</Label>
            <Input id="sig-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Francisco Bandeira ALMEIDA" />
          </div>
          <div>
            <Label htmlFor="sig-cargo">Cargo / função</Label>
            <Input id="sig-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="sig-reg">Registro (CRP/MTE)</Label>
              <Input id="sig-reg" value={registro} onChange={(e) => setRegistro(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sig-cbo">CBO</Label>
              <Input id="sig-cbo" value={cbo} onChange={(e) => setCbo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Assine no quadro abaixo</Label>
            <canvas
              ref={canvasRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
              className="mt-1 w-full h-56 rounded-md border border-slate-300 bg-white touch-none cursor-crosshair"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clear}>
              <Eraser className="h-4 w-4 mr-1" /> Limpar
            </Button>
            <label className="inline-flex items-center gap-1 text-xs text-slate-600 cursor-pointer border rounded-md px-3 py-1.5 hover:bg-slate-50">
              <Upload className="h-4 w-4" /> Carregar imagem
              <input type="file" accept="image/*" className="hidden" onChange={uploadFile} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><X className="h-4 w-4 mr-1" />Cancelar</Button>
          <Button onClick={confirm} disabled={empty}><Check className="h-4 w-4 mr-1" />Inserir assinatura no PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}