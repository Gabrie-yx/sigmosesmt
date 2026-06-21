import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Siren, Plus, Search, AlertTriangle, ShieldAlert, FileText, Camera, Paperclip, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/incidentes")({
  component: IncidentesPage,
});

const TIPO_LABEL: Record<string, string> = {
  QUASE_ACIDENTE: "Quase-acidente",
  INCIDENTE: "Incidente",
  ACIDENTE_SEM_AFASTAMENTO: "Acidente s/ afast.",
  ACIDENTE_COM_AFASTAMENTO: "Acidente c/ afast.",
  DOENCA_OCUPACIONAL: "Doença ocupacional",
};
const GRAV_STYLES: Record<string, string> = {
  LEVE: "bg-slate-100 text-slate-700 border-slate-200",
  MODERADA: "bg-amber-100 text-amber-700 border-amber-200",
  GRAVE: "bg-orange-100 text-orange-700 border-orange-200",
  FATAL: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_STYLES: Record<string, string> = {
  REGISTRADO: "bg-red-100 text-red-700 border-red-200",
  EM_INVESTIGACAO: "bg-amber-100 text-amber-700 border-amber-200",
  INVESTIGADO: "bg-blue-100 text-blue-700 border-blue-200",
  CONCLUIDO: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function IncidentesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [evidOpen, setEvidOpen] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const inlineFileRef = useRef<HTMLInputElement>(null);
  const inlineCamRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    descricao: "", tipo: "QUASE_ACIDENTE", gravidade: "LEVE",
    data_ocorrencia: new Date().toISOString().slice(0, 16), local: "",
    causa_raiz: "", acoes_corretivas: "", cat_numero: "", cat_emitida: false,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["incidentes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidentes")
        .select("*").order("data_ocorrencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.descricao.trim()) throw new Error("Informe a descrição");
      const { data, error } = await supabase.from("incidentes").insert({
        descricao: form.descricao, tipo: form.tipo, gravidade: form.gravidade,
        data_ocorrencia: new Date(form.data_ocorrencia).toISOString(),
        local: form.local || null,
        causa_raiz: form.causa_raiz || null, acoes_corretivas: form.acoes_corretivas || null,
        cat_emitida: form.cat_emitida, cat_numero: form.cat_numero || null,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      const newId = data?.id as string;
      // upload das fotos anexadas no próprio formulário
      for (const file of pendingFiles) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${newId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("incident-photos")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("incidente_evidencias").insert({
          incidente_id: newId,
          file_path: path,
          tipo: file.type.startsWith("image/") ? "FOTO" : "ANEXO",
          descricao: file.name,
          uploaded_by: user?.id ?? null,
        });
        if (insErr) throw insErr;
      }
      return newId;
    },
    onSuccess: () => {
      toast.success(pendingFiles.length
        ? `Incidente registrado com ${pendingFiles.length} evidência(s)`
        : "Incidente registrado");
      setOpen(false);
      setForm({ descricao: "", tipo: "QUASE_ACIDENTE", gravidade: "LEVE",
        data_ocorrencia: new Date().toISOString().slice(0, 16), local: "",
        causa_raiz: "", acoes_corretivas: "", cat_numero: "", cat_emitida: false });
      setPendingFiles([]);
      qc.invalidateQueries({ queryKey: ["incidentes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i: any) =>
      i.descricao?.toLowerCase().includes(s) || i.local?.toLowerCase().includes(s));
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    quase: items.filter((i: any) => i.tipo === "QUASE_ACIDENTE").length,
    investigando: items.filter((i: any) => i.status === "EM_INVESTIGACAO" || i.status === "REGISTRADO").length,
    graves: items.filter((i: any) => i.gravidade === "GRAVE" || i.gravidade === "FATAL").length,
  }), [items]);

  return (
    <div className="p-6 space-y-6">
      {evidOpen && (
        <EvidenciasDialog incidenteId={evidOpen} onClose={() => setEvidOpen(null)} userId={user?.id ?? null} />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Siren className="h-6 w-6 text-red-600" /> Incidentes e Investigação
          </h1>
          <p className="text-sm text-slate-500">Registro de quase-acidentes, incidentes e acidentes — ciclo AGIR (PDCA)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-700 hover:bg-red-800"><Plus className="h-4 w-4 mr-1" /> Novo registro</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Registrar Incidente</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Gravidade</Label>
                  <Select value={form.gravidade} onValueChange={(v) => setForm({ ...form, gravidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEVE">Leve</SelectItem>
                      <SelectItem value="MODERADA">Moderada</SelectItem>
                      <SelectItem value="GRAVE">Grave</SelectItem>
                      <SelectItem value="FATAL">Fatal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data e hora</Label><Input type="datetime-local" value={form.data_ocorrencia} onChange={(e) => setForm({ ...form, data_ocorrencia: e.target.value })} /></div>
                <div><Label>Local</Label><Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Onde ocorreu" /></div>
              </div>
              <div><Label>Descrição *</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
              <div><Label>Causa raiz</Label><Textarea value={form.causa_raiz} onChange={(e) => setForm({ ...form, causa_raiz: e.target.value })} rows={2} /></div>
              <div><Label>Ações corretivas</Label><Textarea value={form.acoes_corretivas} onChange={(e) => setForm({ ...form, acoes_corretivas: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-1 flex items-center gap-2 pb-2">
                  <input type="checkbox" id="cat" checked={form.cat_emitida} onChange={(e) => setForm({ ...form, cat_emitida: e.target.checked })} />
                  <Label htmlFor="cat" className="text-sm">CAT emitida</Label>
                </div>
                <div className="col-span-2"><Label>Nº da CAT</Label><Input value={form.cat_numero} onChange={(e) => setForm({ ...form, cat_numero: e.target.value })} disabled={!form.cat_emitida} /></div>
              </div>
              <div className="border rounded-md p-3 space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Camera className="h-4 w-4 text-red-600" /> Evidências (fotos / anexos)
                </Label>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" size="sm" variant="outline" onClick={() => inlineCamRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-1" /> Tirar foto
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => inlineFileRef.current?.click()}>
                    <Paperclip className="h-4 w-4 mr-1" /> Anexar arquivos
                  </Button>
                  <input
                    ref={inlineCamRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) setPendingFiles((p) => [...p, ...Array.from(e.target.files!)]);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={inlineFileRef}
                    type="file"
                    accept="image/*,application/pdf,video/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) setPendingFiles((p) => [...p, ...Array.from(e.target.files!)]);
                      e.target.value = "";
                    }}
                  />
                </div>
                {pendingFiles.length === 0 ? (
                  <div className="text-xs text-slate-500">Nenhuma foto anexada. Use os botões acima para registrar local, danos e EPIs.</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {pendingFiles.map((f, idx) => {
                      const url = URL.createObjectURL(f);
                      const isImg = f.type.startsWith("image/");
                      return (
                        <div key={idx} className="relative group border rounded overflow-hidden bg-slate-50 aspect-square">
                          {isImg ? (
                            <img src={url} alt={f.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <FileText className="h-8 w-8" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingFiles((p) => p.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 truncate">
                            {f.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-red-700 hover:bg-red-800">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{stats.total}</div></div><FileText className="h-7 w-7 text-slate-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Quase-acidentes</div><div className="text-2xl font-bold text-amber-600">{stats.quase}</div></div><AlertTriangle className="h-7 w-7 text-amber-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Investigando</div><div className="text-2xl font-bold text-blue-600">{stats.investigando}</div></div><Siren className="h-7 w-7 text-blue-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Graves/fatais</div><div className="text-2xl font-bold text-red-600">{stats.graves}</div></div><ShieldAlert className="h-7 w-7 text-red-400" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Registros</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-sm text-slate-500">Carregando...</div> :
            filtered.length === 0 ? <div className="text-sm text-slate-500 text-center py-8">Nenhum incidente registrado.</div> :
            <div className="space-y-2">
              {filtered.map((i: any) => (
                <div key={i.id} className="border rounded-lg p-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 line-clamp-1">{i.descricao}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {new Date(i.data_ocorrencia).toLocaleString("pt-BR")}
                        {i.local && ` · ${i.local}`}
                        {i.cat_emitida && ` · CAT ${i.cat_numero || "emitida"}`}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0 justify-end">
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setEvidOpen(i.id)}>
                        <ImageIcon className="h-3.5 w-3.5" /> Evidências
                      </Button>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600">{TIPO_LABEL[i.tipo]}</Badge>
                      <Badge variant="outline" className={GRAV_STYLES[i.gravidade]}>{i.gravidade}</Badge>
                      <Badge variant="outline" className={STATUS_STYLES[i.status]}>{i.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}

function EvidenciasDialog({ incidenteId, onClose, userId }: { incidenteId: string; onClose: () => void; userId: string | null }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["incidente-evid", incidenteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidente_evidencias")
        .select("*")
        .eq("incidente_id", incidenteId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async ({ file, tipo }: { file: File; tipo: string }) => {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${incidenteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("incident-photos").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("incidente_evidencias").insert({
        incidente_id: incidenteId,
        file_path: path,
        tipo,
        descricao: file.name,
        uploaded_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evidência anexada");
      qc.invalidateQueries({ queryKey: ["incidente-evid", incidenteId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro no upload"),
  });

  const del = useMutation({
    mutationFn: async (item: any) => {
      await supabase.storage.from("incident-photos").remove([item.file_path]);
      const { error } = await supabase.from("incidente_evidencias").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evidência removida");
      qc.invalidateQueries({ queryKey: ["incidente-evid", incidenteId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const abrir = async (path: string) => {
    const { data, error } = await supabase.storage.from("incident-photos").createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return toast.error("Não foi possível abrir");
    window.open(data.signedUrl, "_blank");
  };

  const handleFiles = (files: FileList | null, tipo: string) => {
    if (!files) return;
    Array.from(files).forEach((file) => upload.mutate({ file, tipo }));
  };

  const isImage = (p: string) => /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(p);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-red-600" /> Evidências do incidente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => camRef.current?.click()} className="bg-red-700 hover:bg-red-800">
              <Camera className="h-4 w-4 mr-1" /> Tirar foto
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-1" /> Anexar arquivos
            </Button>
            <input
              ref={camRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(e) => { handleFiles(e.target.files, "FOTO"); e.target.value = ""; }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,video/*"
              multiple
              hidden
              onChange={(e) => { handleFiles(e.target.files, "ANEXO"); e.target.value = ""; }}
            />
          </div>
          {isLoading ? (
            <div className="text-sm text-slate-500">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-8 border-2 border-dashed rounded-lg">
              Nenhuma evidência ainda. Tire fotos do local, danos, EPIs, etc.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((it: any) => (
                <div key={it.id} className="group relative border rounded-lg overflow-hidden bg-slate-50">
                  <button
                    onClick={() => abrir(it.file_path)}
                    className="w-full aspect-square flex items-center justify-center text-slate-400 hover:bg-slate-100"
                  >
                    {isImage(it.file_path) ? (
                      <ThumbImg path={it.file_path} />
                    ) : (
                      <FileText className="h-10 w-10" />
                    )}
                  </button>
                  <div className="px-2 py-1 text-[10px] text-slate-600 truncate" title={it.descricao}>
                    {it.descricao}
                  </div>
                  <button
                    onClick={() => { if (confirm("Remover esta evidência?")) del.mutate(it); }}
                    className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThumbImg({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useMemo(() => {
    supabase.storage.from("incident-photos").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);
  if (!url) return <ImageIcon className="h-8 w-8" />;
  return <img src={url} alt="" className="w-full h-full object-cover" />;
}