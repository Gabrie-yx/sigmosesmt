import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, Camera, Upload, Plus, Trash2, AlertTriangle, ShieldAlert, Video, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/app/sesmt/inspecoes/$id")({
  component: InspecaoDetail,
});

const BUCKET = "inspecoes-fotos";

const CLASSE_CLS: Record<string, string> = {
  BAIXO: "bg-emerald-100 text-emerald-800",
  MODERADO: "bg-yellow-100 text-yellow-800",
  ALTO: "bg-orange-100 text-orange-800",
  CRITICO: "bg-red-200 text-red-900",
};

async function sha256(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getGeo(): Promise<{ lat: number; lng: number; acc: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => resolve(null),
      { timeout: 3000, maximumAge: 60000 }
    );
  });
}

function InspecaoDetail() {
  const { id } = useParams({ from: "/app/sesmt/inspecoes/$id" });
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const canManage = roles?.some((r) => r === "admin" || r === "tst");

  const { data: insp, isLoading } = useQuery({
    queryKey: ["inspecao", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*, companies(name, nome_fantasia, grau_risco)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: fotos = [] } = useQuery({
    queryKey: ["inspecao-fotos", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspecao_fotos").select("*").eq("inspecao_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ncs = [] } = useQuery({
    queryKey: ["inspecao-ncs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspecao_ncs").select("*").eq("inspecao_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: nrs = [] } = useQuery({
    queryKey: ["catalogo-nrs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalogo_nrs").select("codigo, titulo").eq("ativo", true).order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rubrica = [] } = useQuery({
    queryKey: ["matriz-rubrica"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspecao_matriz_rubrica").select("*").order("eixo").order("nivel");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fotoUrls = {} } = useQuery({
    queryKey: ["inspecao-fotos-urls", fotos.map((f: any) => f.storage_path).join(",")],
    enabled: fotos.length > 0,
    queryFn: async () => {
      const paths = fotos.filter((f: any) => f.fonte !== "cftv" || f.storage_path.startsWith("cftv://")).map((f: any) => f.storage_path).filter((p: string) => !p.startsWith("cftv://"));
      const map: Record<string, string> = {};
      if (paths.length) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
        data?.forEach((r) => { if (r.path && r.signedUrl) map[r.path] = r.signedUrl; });
      }
      return map;
    },
  });

  const uploadFoto = useMutation({
    mutationFn: async (files: FileList) => {
      if (!user) throw new Error("Sessão expirada");
      const geo = await getGeo();
      for (const file of Array.from(files)) {
        const hash = await sha256(file);
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${id}/${Date.now()}-${hash.slice(0, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error } = await supabase.from("inspecao_fotos").insert({
          inspecao_id: id,
          fonte: "celular",
          storage_path: path,
          hash_sha256: hash,
          timestamp_captura: new Date(file.lastModified).toISOString(),
          gps_lat: geo?.lat ?? null,
          gps_lng: geo?.lng ?? null,
          gps_accuracy: geo?.acc ?? null,
          tirada_por: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Foto(s) enviada(s)");
      qc.invalidateQueries({ queryKey: ["inspecao-fotos", id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro no upload"),
  });

  const addCftv = useMutation({
    mutationFn: async (payload: { url: string; camera: string; ts: string; legenda: string }) => {
      if (!user) throw new Error("Sessão expirada");
      const hash = await sha256(new Blob([payload.url + payload.ts]));
      const { error } = await supabase.from("inspecao_fotos").insert({
        inspecao_id: id,
        fonte: "cftv",
        storage_path: `cftv://${payload.url}`,
        hash_sha256: hash,
        timestamp_captura: payload.ts ? new Date(payload.ts).toISOString() : null,
        camera_ref: payload.camera || null,
        legenda: payload.legenda || null,
        tirada_por: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto de CFTV registrada");
      qc.invalidateQueries({ queryKey: ["inspecao-fotos", id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const removerFoto = useMutation({
    mutationFn: async (foto: any) => {
      if (!foto.storage_path.startsWith("cftv://")) {
        await supabase.storage.from(BUCKET).remove([foto.storage_path]);
      }
      const { error } = await supabase.from("inspecao_fotos").delete().eq("id", foto.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspecao-fotos", id] }),
  });

  const alterarStatus = useMutation({
    mutationFn: async (novo: string) => {
      const patch: any = { status: novo };
      if (novo === "publicada") { patch.publicada_em = new Date().toISOString(); patch.revisada_por = user?.id; }
      const { error } = await supabase.from("inspecoes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["inspecao", id] });
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  if (isLoading || !insp) return <div className="p-6 text-slate-500 text-sm">Carregando...</div>;

  const editable = insp.status === "rascunho" || insp.status === "em_revisao";

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/app/sesmt/inspecoes" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Inspeções
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900">
                {insp.local_descricao}
              </CardTitle>
              <div className="text-xs text-slate-500 mt-1 flex gap-2 flex-wrap">
                <span>{format(new Date(insp.data_inspecao + "T00:00:00"), "dd/MM/yyyy")}</span>
                {insp.companies && <span>· {insp.companies.nome_fantasia ?? insp.companies.name}</span>}
                {insp.tipo_local && <span>· {insp.tipo_local}</span>}
                <span>· Grau de risco {insp.companies?.grau_risco ?? "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{insp.status}</Badge>
              {editable && canManage && (
                <Button size="sm" variant="outline" onClick={() => alterarStatus.mutate("publicada")}>Publicar</Button>
              )}
              {editable && !canManage && insp.status === "rascunho" && (
                <Button size="sm" variant="outline" onClick={() => alterarStatus.mutate("em_revisao")}>Enviar p/ revisão</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-1">
          {insp.escopo && <div><b>Escopo:</b> {insp.escopo}</div>}
          {insp.participantes && <div><b>Participantes:</b> {insp.participantes}</div>}
        </CardContent>
      </Card>

      {/* FOTOS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-800 flex items-center gap-2">
            <Camera className="h-4 w-4" /> Evidências fotográficas
            <Tooltip><TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-slate-400 cursor-help" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">Toda foto é registrada com hash SHA-256, timestamp e GPS quando disponível — evidência rastreável.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editable && (
            <div className="flex gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 text-xs bg-emerald-600 text-white px-3 py-2 rounded cursor-pointer hover:bg-emerald-700">
                <Upload className="h-3.5 w-3.5" /> Enviar foto
                <input type="file" multiple accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { if (e.target.files?.length) uploadFoto.mutate(e.target.files); e.currentTarget.value = ""; }} />
              </label>
              <CftvDialog onSubmit={(p) => addCftv.mutate(p)} />
            </div>
          )}
          {fotos.length === 0 ? (
            <div className="text-xs text-slate-500">Sem fotos ainda.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {fotos.map((f: any) => (
                <div key={f.id} className="relative border rounded overflow-hidden bg-slate-50">
                  {f.fonte === "cftv" ? (
                    <div className="aspect-video flex flex-col items-center justify-center text-slate-500 text-[10px] p-2">
                      <Video className="h-6 w-6 mb-1" />
                      <div className="truncate max-w-full text-center">{f.camera_ref ?? "CFTV"}</div>
                      <a href={f.storage_path.replace(/^cftv:\/\//, "")} target="_blank" rel="noreferrer" className="text-emerald-700 underline mt-1">abrir</a>
                    </div>
                  ) : (
                    <img src={(fotoUrls as any)[f.storage_path]} alt="" className="aspect-video object-cover w-full" />
                  )}
                  <div className="text-[9px] p-1 text-slate-500 truncate" title={f.hash_sha256}>
                    #{f.hash_sha256.slice(0, 10)} · {f.timestamp_captura ? format(new Date(f.timestamp_captura), "dd/MM HH:mm") : "s/timestamp"}
                  </div>
                  {editable && (
                    <button onClick={() => removerFoto.mutate(f)} className="absolute top-1 right-1 bg-white/90 rounded p-1 hover:bg-red-50">
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* NCs */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-800 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Não conformidades ({ncs.length})
          </CardTitle>
          {editable && <NcDialog inspecaoId={id} fotos={fotos} nrs={nrs} rubrica={rubrica} grauRisco={insp.companies?.grau_risco ?? 3} />}
        </CardHeader>
        <CardContent>
          {ncs.length === 0 ? (
            <div className="text-xs text-slate-500">Nenhuma NC registrada.</div>
          ) : (
            <div className="space-y-2">
              {ncs.map((nc: any) => (
                <div key={nc.id} className="border rounded p-3 space-y-1 bg-white">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{nc.nr_codigo}{nc.nr_item ? ` · ${nc.nr_item}` : ""}</Badge>
                    <Badge className={CLASSE_CLS[nc.classe_risco] + " text-[10px]"}>{nc.classe_risco} · P{nc.probabilidade}×S{nc.severidade}={nc.risco_calculado}</Badge>
                    {nc.gradacao_nr28 && <Badge variant="secondary" className="text-[10px]">NR-28 {nc.gradacao_nr28}: R$ {Number(nc.multa_estimada ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Badge>}
                  </div>
                  <div className="text-sm text-slate-800">{nc.descricao}</div>
                  {nc.recomendacao && <div className="text-xs text-slate-600"><b>Recomendação:</b> {nc.recomendacao}</div>}
                  <NcPlanos ncId={nc.id} editable={editable} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rubrica visível */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-wide text-slate-700 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Rubrica da matriz 5x5 (referência)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 text-[11px] text-slate-600">
          <div>
            <div className="font-bold text-slate-800 mb-1">Probabilidade</div>
            {rubrica.filter((r: any) => r.eixo === "P").map((r: any) => (
              <div key={r.id}><b>P{r.nivel} — {r.rotulo}:</b> {r.definicao}</div>
            ))}
          </div>
          <div>
            <div className="font-bold text-slate-800 mb-1">Severidade</div>
            {rubrica.filter((r: any) => r.eixo === "S").map((r: any) => (
              <div key={r.id}><b>S{r.nivel} — {r.rotulo}:</b> {r.definicao}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CftvDialog({ onSubmit }: { onSubmit: (p: { url: string; camera: string; ts: string; legenda: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [camera, setCamera] = useState("");
  const [ts, setTs] = useState("");
  const [legenda, setLegenda] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Video className="h-3.5 w-3.5" /> Importar CFTV</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Importar foto de câmera fixa (CFTV)</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>URL da imagem/snapshot *</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Câmera / identificação</Label><Input value={camera} onChange={(e) => setCamera(e.target.value)} placeholder="Ex.: CFTV-04 Portaria" /></div>
            <div><Label>Timestamp da captura</Label><Input type="datetime-local" value={ts} onChange={(e) => setTs(e.target.value)} /></div>
          </div>
          <div><Label>Legenda</Label><Textarea rows={2} value={legenda} onChange={(e) => setLegenda(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => { if (!url.trim()) return toast.error("URL obrigatória"); onSubmit({ url: url.trim(), camera, ts, legenda }); setOpen(false); setUrl(""); setCamera(""); setTs(""); setLegenda(""); }}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NcDialog({ inspecaoId, fotos, nrs, rubrica, grauRisco }: { inspecaoId: string; fotos: any[]; nrs: any[]; rubrica: any[]; grauRisco: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [foto_id, setFotoId] = useState<string>("");
  const [nr_codigo, setNrCodigo] = useState("");
  const [nr_item, setNrItem] = useState("");
  const [descricao, setDescricao] = useState("");
  const [recomendacao, setRecomendacao] = useState("");
  const [probabilidade, setP] = useState(3);
  const [severidade, setS] = useState(3);
  const [gradacao, setGradacao] = useState<string>("I2");
  const [empregados, setEmpregados] = useState<number>(100);

  const rP = useMemo(() => rubrica.filter((r) => r.eixo === "P"), [rubrica]);
  const rS = useMemo(() => rubrica.filter((r) => r.eixo === "S"), [rubrica]);

  const { data: nr28 } = useQuery({
    queryKey: ["nr28", gradacao, grauRisco, empregados],
    enabled: !!gradacao && empregados > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("inspecao_nr28_valores")
        .select("valor_reais, portaria_ref")
        .eq("gradacao", gradacao).eq("grau_risco", grauRisco)
        .lte("faixa_min_empregados", empregados)
        .or(`faixa_max_empregados.gte.${empregados},faixa_max_empregados.is.null`)
        .order("faixa_min_empregados", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!nr_codigo) throw new Error("Selecione a NR");
      if (!descricao.trim()) throw new Error("Descreva a NC");
      const { error } = await supabase.from("inspecao_ncs").insert({
        inspecao_id: inspecaoId,
        foto_id: foto_id || null,
        nr_codigo, nr_item: nr_item || null,
        descricao: descricao.trim(),
        recomendacao: recomendacao.trim() || null,
        probabilidade, severidade,
        gradacao_nr28: gradacao,
        multa_estimada: nr28?.valor_reais ?? null,
        criada_por: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("NC registrada");
      qc.invalidateQueries({ queryKey: ["inspecao-ncs", inspecaoId] });
      setOpen(false);
      setNrCodigo(""); setNrItem(""); setDescricao(""); setRecomendacao(""); setP(3); setS(3);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const classe = probabilidade * severidade >= 15 ? "CRITICO" : probabilidade * severidade >= 8 ? "ALTO" : probabilidade * severidade >= 4 ? "MODERADO" : "BAIXO";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Nova NC</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar não conformidade</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>NR *</Label>
              <Select value={nr_codigo} onValueChange={setNrCodigo}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {nrs.map((n: any) => (<SelectItem key={n.codigo} value={n.codigo}>{n.codigo} — {n.titulo}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Item</Label><Input value={nr_item} onChange={(e) => setNrItem(e.target.value)} placeholder="Ex.: 34.11.6.1" /></div>
          </div>
          <div>
            <Label>Foto vinculada</Label>
            <Select value={foto_id} onValueChange={setFotoId}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                {fotos.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.fonte} · {f.hash_sha256.slice(0, 8)} · {f.camera_ref ?? "—"}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Descrição da NC *</Label><Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div><Label>Recomendação</Label><Textarea rows={2} value={recomendacao} onChange={(e) => setRecomendacao(e.target.value)} /></div>

          <div className="border rounded p-3 bg-slate-50 space-y-2">
            <div className="text-xs font-black uppercase tracking-wide text-slate-700">Matriz de risco 5x5</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Probabilidade</Label>
                <Select value={String(probabilidade)} onValueChange={(v) => setP(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rP.map((r) => (<SelectItem key={r.id} value={String(r.nivel)}>P{r.nivel} — {r.rotulo}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severidade</Label>
                <Select value={String(severidade)} onValueChange={(v) => setS(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rS.map((r) => (<SelectItem key={r.id} value={String(r.nivel)}>S{r.nivel} — {r.rotulo}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-xs text-slate-600">Risco = {probabilidade * severidade} → <Badge className={CLASSE_CLS[classe]}>{classe}</Badge></div>
          </div>

          <div className="border rounded p-3 bg-slate-50 space-y-2">
            <div className="text-xs font-black uppercase tracking-wide text-slate-700">Multa estimada NR-28 (grau {grauRisco})</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gradação</Label>
                <Select value={gradacao} onValueChange={setGradacao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I1">I1 — Leve</SelectItem>
                    <SelectItem value="I2">I2 — Média</SelectItem>
                    <SelectItem value="I3">I3 — Grave</SelectItem>
                    <SelectItem value="I4">I4 — Gravíssima</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nº de empregados</Label><Input type="number" value={empregados} onChange={(e) => setEmpregados(Number(e.target.value))} /></div>
            </div>
            <div className="text-xs text-slate-600">
              {nr28 ? <>Valor: <b>R$ {Number(nr28.valor_reais).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b> ({nr28.portaria_ref})</> : "Faixa não encontrada"}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar NC</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NcPlanos({ ncId, editable }: { ncId: string; editable: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: planos = [] } = useQuery({
    queryKey: ["inspecao-nc-planos", ncId],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspecao_ncs_planos").select("*").eq("nc_id", ncId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [acao, setAcao] = useState("");
  const [resp, setResp] = useState("");
  const [prazo, setPrazo] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!acao.trim()) throw new Error("Ação obrigatória");
      const { error } = await supabase.from("inspecao_ncs_planos").insert({
        nc_id: ncId, acao: acao.trim(), responsavel_nome: resp || null, prazo: prazo || null, criada_por: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { setAcao(""); setResp(""); setPrazo(""); qc.invalidateQueries({ queryKey: ["inspecao-nc-planos", ncId] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
  const avancar = useMutation({
    mutationFn: async (p: any) => {
      const ordem = ["PLAN", "DO", "CHECK", "ACT", "ENCERRADO"];
      const idx = ordem.indexOf(p.fase_pdca);
      const nova = ordem[Math.min(idx + 1, ordem.length - 1)];
      const patch: any = { fase_pdca: nova };
      if (nova === "ENCERRADO") patch.encerrada_em = new Date().toISOString();
      const { error } = await supabase.from("inspecao_ncs_planos").update(patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspecao-nc-planos", ncId] }),
  });
  return (
    <div className="mt-2 border-t pt-2 space-y-1">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Plano de ação (PDCA)</div>
      {planos.map((p: any) => (
        <div key={p.id} className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="text-[9px]">{p.fase_pdca}</Badge>
          <span className="flex-1">{p.acao}</span>
          {p.responsavel_nome && <span className="text-slate-500">{p.responsavel_nome}</span>}
          {p.prazo && <span className="text-slate-500">{format(new Date(p.prazo + "T00:00:00"), "dd/MM/yy")}</span>}
          {editable && p.fase_pdca !== "ENCERRADO" && <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => avancar.mutate(p)}>avançar</Button>}
        </div>
      ))}
      {editable && (
        <div className="flex gap-2 items-end pt-1">
          <Input placeholder="Nova ação..." value={acao} onChange={(e) => setAcao(e.target.value)} className="h-7 text-xs" />
          <Input placeholder="Responsável" value={resp} onChange={(e) => setResp(e.target.value)} className="h-7 text-xs w-32" />
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-7 text-xs w-32" />
          <Button size="sm" variant="outline" className="h-7" onClick={() => add.mutate()}><Plus className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}
