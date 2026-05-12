import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export function DDSEvidencias({ ddsId }: { ddsId: string }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: itens = [] } = useQuery({
    queryKey: ["dds-evid", ddsId],
    queryFn: async () => (await supabase.from("dds_evidencias").select("*").eq("dds_id", ddsId).order("uploaded_at", { ascending: false })).data ?? [],
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${ddsId}/${Date.now()}.${ext}`;
      const { error: e1 } = await supabase.storage.from("dds-anexos").upload(path, file);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("dds_evidencias").insert({
        dds_id: ddsId, file_path: path, tipo: file.type.startsWith("image") ? "FOTO" : "PDF", descricao: file.name,
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

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-bold uppercase text-slate-500">Evidências / Lista assinada ({itens.length})</div>
        {isEditor && (
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" />Anexar
          </Button>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
      </div>
      <div className="border rounded divide-y">
        {itens.map((it: any) => (
          <div key={it.id} className="px-3 py-1.5 flex items-center gap-2 text-sm">
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
        {itens.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">Nenhuma evidência anexada</div>}
      </div>
    </div>
  );
}