import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Image as ImageIcon, ClipboardList, PenLine } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DDSAttendeesEditor } from "@/components/dds-attendees-editor";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { PDFDocument } from "pdf-lib";
import { openStorageFile, FileViewerHost } from "@/components/file-viewer";

export function DDSEvidencias({ ddsId }: { ddsId: string }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const listaRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [esperados, setEsperados] = useState(0);
  const [signTarget, setSignTarget] = useState<any | null>(null);

  const { data: itens = [] } = useQuery({
    queryKey: ["dds-evid", ddsId],
    queryFn: async () => (await supabase.from("dds_evidencias").select("*").eq("dds_id", ddsId).order("uploaded_at", { ascending: false })).data ?? [],
  });

  const upload = useMutation({
    mutationFn: async ({ file, tipo }: { file: File; tipo: "LISTA_PRESENCA" | "FOTO_DDS" }) => {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${ddsId}/${Date.now()}.${ext}`;
      const { error: e1 } = await supabase.storage.from("dds-anexos").upload(path, file);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("dds_evidencias").insert({
        dds_id: ddsId, file_path: path, tipo, descricao: file.name,
      });
      if (e2) throw e2;
      return tipo;
    },
    onSuccess: async (tipo) => {
      qc.invalidateQueries({ queryKey: ["dds-evid", ddsId] });
      toast.success("Evidência enviada");
      if (tipo === "LISTA_PRESENCA") {
        const { data } = await supabase.from("dds").select("participantes_esperados").eq("id", ddsId).maybeSingle();
        setEsperados((data as any)?.participantes_esperados ?? 0);
        setConfirmOpen(true);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (item: any) => {
      await supabase.storage.from("dds-anexos").remove([item.file_path]);
      const { error } = await supabase.from("dds_evidencias").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dds-evid", ddsId] }); toast.success("Evidência removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function abrir(path: string) {
    const name = path.split("/").pop();
    await openStorageFile("dds-anexos", path, name);
  }

  async function assinarPdf(item: any, dataUrl: string, height: number) {
    try {
      const path: string = item.file_path;
      if (!path.toLowerCase().endsWith(".pdf")) {
        toast.error("Só dá pra carimbar assinatura em arquivos PDF");
        return;
      }
      const { data: signed } = await supabase.storage.from("dds-anexos").createSignedUrl(path, 60);
      if (!signed?.signedUrl) throw new Error("Não consegui baixar o PDF");
      const pdfBytes = await fetch(signed.signedUrl).then((r) => r.arrayBuffer());
      const pdf = await PDFDocument.load(pdfBytes);
      const pngBytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const png = await pdf.embedPng(pngBytes);
      const page = pdf.getPages()[pdf.getPageCount() - 1];
      const { width: pw, height: ph } = page.getSize();
      // height vem em "px UI" (20..140). Converte pra pt mantendo proporção do PNG.
      const targetH = Math.max(40, Math.min(180, height * 1.2));
      const ratio = png.width / png.height;
      const targetW = targetH * ratio;
      const x = (pw - targetW) / 2;
      const y = Math.max(40, ph * 0.08);
      page.drawImage(png, { x, y, width: targetW, height: targetH });
      const out = await pdf.save();
      const blob = new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" });
      const { error } = await supabase.storage.from("dds-anexos").update(path, blob, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (error) throw error;
      toast.success("Assinatura aplicada no PDF");
      setSignTarget(null);
      qc.invalidateQueries({ queryKey: ["dds-evid", ddsId] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao assinar PDF");
    }
  }

  const lista = itens.filter((i: any) => i.tipo === "LISTA_PRESENCA");
  const fotos = itens.filter((i: any) => i.tipo === "FOTO_DDS");
  const outros = itens.filter((i: any) => i.tipo !== "LISTA_PRESENCA" && i.tipo !== "FOTO_DDS");

  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancel = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const f of fotos) {
        const { data } = await supabase.storage.from("dds-anexos").createSignedUrl(f.file_path, 60 * 10);
        if (data?.signedUrl) next[f.id] = data.signedUrl;
      }
      if (!cancel) setThumbs(next);
    })();
    return () => { cancel = true; };
  }, [fotos.map((f: any) => f.id).join(",")]);

  function Section({ title, icon, hint, items, onAttach, accept, multiple }: {
    title: string; icon: React.ReactNode; hint: string; items: any[];
    onAttach: () => void; accept: string; multiple: boolean;
  }) {
    return (
      <div className="border rounded p-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600">
            {icon}{title} <span className="text-slate-400 font-normal normal-case">({items.length})</span>
          </div>
          {isEditor && (
            <Button size="sm" variant="outline" onClick={onAttach}>
              <Upload className="h-3.5 w-3.5 mr-1" />Anexar
            </Button>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mb-1">{hint}</div>
        <div className="divide-y">
          {items.map((it: any) => (
            <div key={it.id} className="px-1 py-1 flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-slate-400" />
              <button className="flex-1 text-left truncate hover:underline" onClick={() => abrir(it.file_path)}>{it.descricao ?? it.file_path}</button>
              <span className="text-[10px] text-muted-foreground">{new Date(it.uploaded_at).toLocaleDateString("pt-BR")}</span>
              {isEditor && it.file_path.toLowerCase().endsWith(".pdf") && (
                <Button size="sm" variant="outline" onClick={() => setSignTarget(it)} title="Carimbar assinatura no PDF">
                  <PenLine className="h-3.5 w-3.5 mr-1" />Assinar
                </Button>
              )}
              {isAdmin && (
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover evidência?")) del.mutate(it); }}>
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              )}
            </div>
          ))}
          {items.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">Nenhum arquivo</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Section
        title="Lista de presença assinada"
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        hint="Suba 1 PDF ou foto da folha assinada pelos participantes."
        items={lista}
        onAttach={() => listaRef.current?.click()}
        accept="application/pdf,image/*"
        multiple={false}
      />
      <Section
        title="Fotos do DDS"
        icon={<ImageIcon className="h-3.5 w-3.5" />}
        hint="Anexe de 2 a 4 fotos do momento do DDS (recomendado)."
        items={fotos}
        onAttach={() => fotosRef.current?.click()}
        accept="image/*"
        multiple={true}
      />
      {fotos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {fotos.map((f: any) => (
            <button
              key={f.id}
              onClick={() => abrir(f.file_path)}
              className="aspect-square border rounded overflow-hidden bg-slate-100 hover:ring-2 hover:ring-primary"
              title={f.descricao}
            >
              {thumbs[f.id] ? (
                <img src={thumbs[f.id]} alt={f.descricao} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">…</div>
              )}
            </button>
          ))}
        </div>
      )}
      {outros.length > 0 && (
        <Section
          title="Outros anexos"
          icon={<FileText className="h-3.5 w-3.5" />}
          hint="Arquivos antigos, sem categoria."
          items={outros}
          onAttach={() => listaRef.current?.click()}
          accept="application/pdf,image/*"
          multiple={false}
        />
      )}
      <input ref={listaRef} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate({ file: f, tipo: "LISTA_PRESENCA" }); e.target.value = ""; }} />
      <input ref={fotosRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (fotos.length + files.length > 4) { toast.error("Máximo 4 fotos por DDS"); e.target.value = ""; return; }
          files.forEach((f) => upload.mutate({ file: f, tipo: "FOTO_DDS" }));
          e.target.value = "";
        }} />
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar presenças reais</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-2">
            Confira a lista assinada que você acabou de subir e marque apenas quem realmente assinou.
            Isto trava o número oficial de presentes e a aderência do DDS.
          </div>
          <DDSAttendeesEditor ddsId={ddsId} esperados={esperados} onSaved={() => setConfirmOpen(false)} />
        </DialogContent>
      </Dialog>
      <SignaturePadDialog
        open={!!signTarget}
        onClose={() => setSignTarget(null)}
        onConfirm={(r) => signTarget && assinarPdf(signTarget, r.dataUrl, r.height)}
        title="Carimbar assinatura no PDF"
      />
      <FileViewerHost />
    </div>
  );
}