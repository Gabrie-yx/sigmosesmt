import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, RotateCw, RotateCcw, ZoomIn, ZoomOut, X } from "lucide-react";

export type MediaItem = { url: string; name: string };

export function MediaViewerDialog({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: MediaItem[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const open = index !== null;
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => { setRotation(0); setZoom(1); }, [index]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key.toLowerCase() === "r") setRotation((r) => (r + 90) % 360);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open || index === null) return null;
  const item = items[index];
  if (!item) return null;

  function prev() { onIndexChange((index! - 1 + items.length) % items.length); }
  function next() { onIndexChange((index! + 1) % items.length); }

  async function download() {
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      window.open(item.url, "_blank");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 bg-slate-900 border-slate-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-slate-100">
          <div className="text-xs truncate pr-4">{item.name} <span className="text-slate-400">({index + 1}/{items.length})</span></div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800" onClick={() => setRotation((r) => (r - 90 + 360) % 360)} title="Girar -90° (R)">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800" onClick={() => setRotation((r) => (r + 90) % 360)} title="Girar +90° (R)">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} title="Diminuir zoom">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-[10px] w-10 text-center text-slate-300">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800" onClick={() => setZoom((z) => Math.min(5, z + 0.25))} title="Aumentar zoom">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800" onClick={download} title="Baixar">
              <Download className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800" onClick={onClose} title="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center">
          {items.length > 1 && (
            <button onClick={prev} className="absolute left-2 z-10 w-10 h-10 rounded-full bg-slate-800/70 text-white flex items-center justify-center hover:bg-slate-700">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
            <img
              src={item.url}
              alt={item.name}
              style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, transition: "transform 0.15s ease" }}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          </div>
          {items.length > 1 && (
            <button onClick={next} className="absolute right-2 z-10 w-10 h-10 rounded-full bg-slate-800/70 text-white flex items-center justify-center hover:bg-slate-700">
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}