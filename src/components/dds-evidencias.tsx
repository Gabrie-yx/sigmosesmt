import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Image as ImageIcon, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export function DDSEvidencias({ ddsId }: { ddsId: string }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const listaRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<HTMLInputElement>(null);

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
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dds-evid", ddsId] }); toast.success("Evidência enviada"); },
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
    const { data } = await supabase.storage.from("dds-anexos").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const lista = itens.filter((i: any) => i.tipo === "LISTA_PRESENCA");
  const fotos = itens.filter((i: any) => i.tipo === "FOTO_DDS");
  const outros = itens.filter((i: any) => i.tipo !== "LISTA_PRESENCA" && i.tipo !== "FOTO_DDS");

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
    </div>
  );
}