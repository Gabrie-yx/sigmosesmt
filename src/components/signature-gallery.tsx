import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PenTool, Trash2, Plus, Check, ImageIcon, Pencil } from "lucide-react";
import { toast } from "sonner";

interface UserSignature {
  id: string;
  label: string;
  signature_data: string;
  is_default: boolean;
}

interface SignatureGalleryProps {
  onSelect?: (signature: string) => void;
  trigger?: React.ReactNode;
}

export function SignatureGallery({ onSelect, trigger }: SignatureGalleryProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newData, setNewData] = useState<string | null>(null);

  const { data: signatures = [], isLoading } = useQuery({
    queryKey: ["user-signatures", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_signatures")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserSignature[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newData || !newLabel.trim() || !user?.id) return;
      const { error } = await supabase.from("user_signatures").insert({
        user_id: user.id,
        label: newLabel.trim(),
        signature_data: newData,
        is_default: signatures.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-signatures"] });
      toast.success("Assinatura adicionada à galeria");
      setIsAdding(false);
      setNewLabel("");
      setNewData(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLabelMutation = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase
        .from("user_signatures")
        .update({ label: label.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-signatures"] });
      toast.success("Nome atualizado");
      setEditingId(null);
      setNewLabel("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_signatures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-signatures"] });
      toast.success("Assinatura removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) return;
      await supabase.from("user_signatures").update({ is_default: false }).eq("user_id", user.id);
      const { error } = await supabase.from("user_signatures").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-signatures"] });
      toast.success("Assinatura padrão atualizada");
    },
  });

  const onFileUpload = (file: File | null) => {
    if (!file) return;
    if (file.type !== "image/png") return toast.error("A assinatura deve estar no formato PNG");
    if (file.size > 1.5 * 1024 * 1024) return toast.error("Arquivo muito grande (máx. 1.5MB)");

    const reader = new FileReader();
    reader.onload = () => setNewData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const startEditing = (sig: UserSignature) => {
    setEditingId(sig.id);
    setNewLabel(sig.label);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <PenTool className="h-4 w-4 mr-2" />
            Galeria de Assinaturas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-red-700" />
            Minhas Assinaturas
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isAdding ? (
            <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
              <h3 className="font-bold text-sm">Nova Assinatura</h3>
              <div className="space-y-2">
                <Label>Nome/Identificação (ex: "Assinatura Francisco")</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Digite um nome para identificar"
                />
              </div>
              <div className="space-y-2">
                <Label>Arquivo PNG (Fundo transparente)</Label>
                <div className="flex items-center gap-4">
                  <div className="h-24 w-48 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-white overflow-hidden">
                    {newData ? (
                      <img src={newData} alt="Preview" className="h-full w-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-slate-200" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <div className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 px-4 py-2 transition-colors">
                      Selecionar Arquivo
                    </div>
                    <input
                      type="file"
                      accept="image/png"
                      className="hidden"
                      onChange={(e) => onFileUpload(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancelar</Button>
                <Button
                  className="bg-red-700 hover:bg-red-800"
                  disabled={!newData || !newLabel.trim() || addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                >
                  Salvar na Galeria
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setIsAdding(true)}
                className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors text-slate-500 hover:text-red-700 hover:border-red-200"
              >
                <Plus className="h-8 w-8" />
                <span className="font-bold text-sm">Adicionar Nova</span>
              </button>

              {signatures.map((sig) => (
                <div
                  key={sig.id}
                  className={`border rounded-lg p-3 group relative transition-all ${
                    sig.is_default ? "border-red-200 bg-red-50/30" : "hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    {editingId === sig.id ? (
                      <div className="flex items-center gap-1 w-full">
                        <Input
                          size={1}
                          className="h-6 text-[11px] py-0 px-2 flex-1"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") updateLabelMutation.mutate({ id: sig.id, label: newLabel });
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-emerald-600"
                          onClick={() => updateLabelMutation.mutate({ id: sig.id, label: newLabel })}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-1 truncate">
                        <span className="text-[11px] font-bold uppercase truncate">{sig.label}</span>
                        <button
                          onClick={() => startEditing(sig)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-red-700"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {sig.is_default && editingId !== sig.id && (
                      <Check className="h-3.5 w-3.5 text-red-700 flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="h-20 w-full flex items-center justify-center bg-white/50 rounded mb-3">
                    <img src={sig.signature_data} alt={sig.label} className="h-full w-full object-contain" />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-[11px]"
                      onClick={() => {
                        if (onSelect) onSelect(sig.signature_data);
                        setOpen(false);
                      }}
                    >
                      Usar esta
                    </Button>
                    {!sig.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[11px]"
                        onClick={() => setDefaultMutation.mutate(sig.id)}
                      >
                        Padrão
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-700"
                      onClick={() => {
                        if (confirm("Excluir esta assinatura da galeria?")) deleteMutation.mutate(sig.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && signatures.length === 0 && !isAdding && (
            <div className="text-center py-12 text-slate-400">
              <PenTool className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Sua galeria está vazia.</p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Fechar Galeria</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
