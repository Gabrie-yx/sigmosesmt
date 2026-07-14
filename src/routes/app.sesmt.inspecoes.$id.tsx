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
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, Camera, Upload, Plus, Trash2, AlertTriangle, ShieldAlert, Video, FileText, Info, FileDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { gerarInspecaoPdf } from "@/lib/inspecao-pdf";

export const Route = createFileRoute("/app/sesmt/inspecoes/$id")({
  component: InspecaoDetail,
});

const BUCKET = "inspecoes-fotos";

const CLASSE_CLS: Record<string, string> = {
  BAIXO: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40",
  MODERADO: "bg-yellow-500/15 text-yellow-200 border border-yellow-500/40",
  ALTO: "bg-orange-500/15 text-orange-200 border border-orange-500/40",
  CRITICO: "bg-red-500/20 text-red-100 border border-red-500/50",
};

async function sha256(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comprime foto de celular pra evitar "insuficiência de memória" no Chrome Android.
// Fotos modernas têm 12MP (~5MB); redimensionamos pra 1600px lado maior + JPEG 0.8 (~300KB).
// Usa createImageBitmap (streaming, libera memória) ao invés de dataURL/FileReader.
async function comprimirImagem(file: File, maxDim = 1600, quality = 0.8): Promise<File> {
  // Se já é pequeno (<800KB), não mexe
  if (file.size < 800 * 1024) return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob = "convertToBlob" in canvas
      ? await (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality })
      : await new Promise((res, rej) =>
          (canvas as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error("toBlob falhou"))), "image/jpeg", quality)
        );
    // Se compressão piorou (raro), devolve original
    if (blob.size >= file.size) return file;
    const nome = file.name.replace(/\.(heic|heif|png|webp|jpg|jpeg)$/i, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg", lastModified: file.lastModified });
  } catch (e) {
    console.warn("[inspecao] compressão falhou, enviando original", e);
    return file;
  } finally {
    bitmap?.close?.();
  }
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
      const { data, error } = await supabase
        .from("inspecao_ncs")
        .select("*, catalogo_nrs_itens(prazo_dias_sugerido, gravidade_sugerida, texto_oficial)")
        .eq("inspecao_id", id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: planosResumo = [], isLoading: planosResumoLoading } = useQuery({
    queryKey: ["inspecao-planos-resumo", ncs.map((n: any) => n.id).join(",")],
    enabled: ncs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecao_ncs_planos")
        .select("nc_id")
        .in("nc_id", ncs.map((n: any) => n.id));
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
    mutationFn: async (files: File[]) => {
      if (!user) throw new Error("Sessão expirada");
      if (!files.length) throw new Error("Selecione pelo menos uma foto");
      const geo = await getGeo();
      for (const original of files) {
        if (!original.type.startsWith("image/") && !/\.(heic|heif)$/i.test(original.name)) {
          throw new Error(`${original.name} não é uma imagem válida`);
        }
        // Comprime ANTES do hash pra não estourar memória em fotos de 12MP
        const file = await comprimirImagem(original);
        const hash = await sha256(file);
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${id}/${Date.now()}-${crypto.randomUUID()}-${hash.slice(0, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "image/jpeg" });
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
        if (error) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Foto(s) enviada(s)");
      qc.invalidateQueries({ queryKey: ["inspecao-fotos", id] });
      qc.invalidateQueries({ queryKey: ["inspecao-fotos-urls"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro no upload"),
  });

  const selecionarFotos = (files: FileList | null) => {
    const selecionadas = Array.from(files ?? []);
    if (!selecionadas.length) return;
    uploadFoto.mutate(selecionadas);
  };

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
      if (novo === "publicada") {
        if (fotos.length === 0) throw new Error("Antes de publicar, anexe ao menos uma foto como evidência da inspeção.");
        // NCs são OPCIONAIS: uma inspeção sem achados é publicada como "conforme".
        // Se houver NCs registradas, cada uma precisa de plano de ação (PDCA).
        if (ncs.length > 0) {
          const ids = ncs.map((n: any) => n.id);
          const { data: planos, error: planosErr } = await supabase.from("inspecao_ncs_planos").select("nc_id").in("nc_id", ids);
          if (planosErr) throw planosErr;
          const comPlano = new Set((planos ?? []).map((p: any) => p.nc_id));
          if (ids.some((ncId: string) => !comPlano.has(ncId))) {
            throw new Error("Cada NC registrada precisa de pelo menos uma ação PDCA (responsável/prazo). Adicione o plano ou remova a NC.");
          }
        }
      }
      const patch: any = { status: novo };
      if (novo === "publicada") { patch.publicada_em = new Date().toISOString(); patch.revisada_por = user?.id; }
      if (novo !== "publicada") { patch.publicada_em = null; }
      const { error } = await supabase.from("inspecoes").update(patch).eq("id", id);
      if (error) throw error;

      // Ao publicar: espelha cada NC da inspeção em nao_conformidades (alimenta indicadores).
      if (novo === "publicada" && ncs.length > 0 && insp) {
        const origens = ncs.map((n: any) => `inspecao_nc:${n.id}`);
        const { data: jaExistem } = await supabase
          .from("nao_conformidades")
          .select("pendencia_origem")
          .in("pendencia_origem", origens);
        const existentes = new Set((jaExistem ?? []).map((r: any) => r.pendencia_origem));
        const sevMap: Record<string, string> = { BAIXO: "BAIXA", MODERADO: "MEDIA", ALTO: "ALTA", CRITICO: "CRITICA" };
        const novas = ncs
          .filter((n: any) => !existentes.has(`inspecao_nc:${n.id}`))
          .map((n: any) => ({
            company_id: insp.empresa_id ?? null,
            titulo: `${n.nr_codigo}${n.nr_item ? ` ${n.nr_item}` : ""} — ${insp.local_descricao}`,
            descricao: n.descricao,
            origem: `Inspeção de Segurança · ${format(new Date(insp.data_inspecao + "T00:00:00"), "dd/MM/yyyy")}`,
            severidade: sevMap[n.classe_risco] ?? "MEDIA",
            status: "ABERTA",
            data_identificacao: insp.data_inspecao,
            classificacao: "Não Conformidade",
            norma: n.nr_codigo,
            requisito: n.nr_item ?? null,
            acao_imediata: n.recomendacao ?? null,
            emitente: user?.email ?? null,
            departamento: "SESMT",
            created_by: user?.id ?? null,
            pendencia_origem: `inspecao_nc:${n.id}`,
          }));
        if (novas.length > 0) {
          const { error: ncErr } = await supabase.from("nao_conformidades").insert(novas);
          if (ncErr) throw ncErr;
        }
        return { publicadas: novas.length, total: ncs.length };
      }
      return { publicadas: 0, total: ncs.length };
    },
    onSuccess: (r: any) => {
      if (r?.publicadas > 0) toast.success(`Publicada · ${r.publicadas} NC(s) enviada(s) ao painel de Não Conformidades`);
      else toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["inspecao", id] });
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      qc.invalidateQueries({ queryKey: ["nao_conformidades"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const baixarPdf = useMutation({
    mutationFn: async () => {
      if (fotos.length === 0) throw new Error("O relatório final exige evidência fotográfica. Reabra a inspeção e anexe as fotos.");
      if (ncs.length === 0) throw new Error("O relatório final exige pelo menos uma NC registrada com matriz 5x5 e plano de ação.");
      const planosPorNc: Record<string, any[]> = {};
      if (ncs.length > 0) {
        const ids = ncs.map((n: any) => n.id);
        const { data, error } = await supabase.from("inspecao_ncs_planos").select("*").in("nc_id", ids).order("created_at");
        if (error) throw error;
        (data ?? []).forEach((p: any) => {
          (planosPorNc[p.nc_id] = planosPorNc[p.nc_id] ?? []).push(p);
        });
        if (ids.some((ncId: string) => !planosPorNc[ncId]?.length)) {
          throw new Error("O relatório final exige plano de ação PDCA para cada NC.");
        }
      }
      await gerarInspecaoPdf({
        inspecao: insp,
        fotos,
        ncs,
        planosPorNc,
        rubrica,
        responsavelNome: user?.email ?? null,
      });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar PDF"),
  });

  if (isLoading || !insp) return <div className="p-6 text-muted-foreground text-sm">Carregando...</div>;

  const ncsComPlano = new Set((planosResumo ?? []).map((p: any) => p.nc_id));
  const faltaPlano = ncs.length > 0 && (planosResumoLoading || ncs.some((n: any) => !ncsComPlano.has(n.id)));
  // NC é opcional: publicada sem NC = inspeção conforme. Só é "incompleta" se falta foto ou se tem NC sem plano.
  const publicadoIncompleto = insp.status === "publicada" && (fotos.length === 0 || faltaPlano);
  const editable = insp.status === "rascunho" || insp.status === "em_revisao" || (publicadoIncompleto && canManage);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/app/sesmt/inspecoes" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Inspeções
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight text-foreground">
                {insp.local_descricao}
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-1 flex gap-2 flex-wrap">
                <span>{format(new Date(insp.data_inspecao + "T00:00:00"), "dd/MM/yyyy")}</span>
                {insp.companies && <span>· {insp.companies.nome_fantasia ?? insp.companies.name}</span>}
                {insp.tipo_local && <span>· {insp.tipo_local}</span>}
                <span>· Grau de risco {insp.companies?.grau_risco ?? "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{insp.status}</Badge>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => baixarPdf.mutate()} disabled={baixarPdf.isPending}>
                <FileDown className="h-3.5 w-3.5" /> {baixarPdf.isPending ? "Gerando..." : "Baixar PDF"}
              </Button>
              {insp.status === "publicada" && canManage && (
                <Button size="sm" variant="outline" onClick={() => alterarStatus.mutate("em_revisao")} disabled={alterarStatus.isPending}>Reabrir edição</Button>
              )}
              {editable && canManage && insp.status !== "publicada" && (
                <Button size="sm" variant="outline" onClick={() => alterarStatus.mutate("publicada")}>Publicar</Button>
              )}
              {editable && !canManage && insp.status === "rascunho" && (
                <Button size="sm" variant="outline" onClick={() => alterarStatus.mutate("em_revisao")}>Enviar p/ revisão</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          {publicadoIncompleto && (
            <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 text-amber-100 p-2 flex items-center justify-between gap-2 flex-wrap">
              <span><b>Inspeção publicada incompleta.</b> Reabra a edição para anexar evidências, registrar NCs e montar o PDCA antes do PDF final.</span>
              {canManage && <Button size="sm" variant="outline" className="h-7" onClick={() => alterarStatus.mutate("em_revisao")}>Reabrir agora</Button>}
            </div>
          )}
          {insp.escopo && <div><b>Escopo:</b> {insp.escopo}</div>}
          {insp.participantes && <div><b>Participantes:</b> {insp.participantes}</div>}
        </CardContent>
      </Card>


      {/* FOTOS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-wide text-foreground flex items-center gap-2">
            <Camera className="h-4 w-4" /> Evidências fotográficas
            <Tooltip><TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">Toda foto é registrada com hash SHA-256, timestamp e GPS quando disponível — evidência rastreável.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editable && (
            <div className="flex gap-2 flex-wrap">
              <label className={`inline-flex items-center gap-2 text-xs bg-primary text-primary-foreground px-3 py-2 rounded cursor-pointer hover:bg-primary/90 ${uploadFoto.isPending ? "opacity-70 pointer-events-none" : ""}`}>
                <Upload className="h-3.5 w-3.5" /> {uploadFoto.isPending ? "Enviando..." : "Enviar foto"}
                <input type="file" multiple accept="image/*,.heic,.heif" className="hidden" disabled={uploadFoto.isPending}
                  onChange={(e) => { selecionarFotos(e.currentTarget.files); e.currentTarget.value = ""; }} />
              </label>
              <label className={`inline-flex items-center gap-2 text-xs border border-border bg-card text-foreground px-3 py-2 rounded cursor-pointer hover:bg-accent ${uploadFoto.isPending ? "opacity-70 pointer-events-none" : ""}`}>
                <Camera className="h-3.5 w-3.5" /> Tirar foto
                <input type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" disabled={uploadFoto.isPending}
                  onChange={(e) => { selecionarFotos(e.currentTarget.files); e.currentTarget.value = ""; }} />
              </label>
              <CftvDialog onSubmit={(p) => addCftv.mutate(p)} />
            </div>
          )}
          {!editable && publicadoIncompleto && canManage && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 text-amber-100 text-xs p-2 flex items-center justify-between gap-2 flex-wrap">
              <span>Para anexar fotos agora, reabra a inspeção. O sistema não deve gerar relatório final sem evidência.</span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => alterarStatus.mutate("em_revisao")}>Reabrir para anexar</Button>
            </div>
          )}
          {fotos.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sem fotos ainda.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {fotos.map((f: any) => (
                <div key={f.id} className="relative border rounded overflow-hidden bg-muted/40">
                  {f.fonte === "cftv" ? (
                    <div className="aspect-video flex flex-col items-center justify-center text-muted-foreground text-[10px] p-2">
                      <Video className="h-6 w-6 mb-1" />
                      <div className="truncate max-w-full text-center">{f.camera_ref ?? "CFTV"}</div>
                      <a href={f.storage_path.replace(/^cftv:\/\//, "")} target="_blank" rel="noreferrer" className="text-primary underline mt-1">abrir</a>
                    </div>
                  ) : (
                    <img src={(fotoUrls as any)[f.storage_path]} alt="" className="aspect-video object-cover w-full" />
                  )}
                  <div className="text-[9px] p-1 text-muted-foreground truncate" title={f.hash_sha256}>
                    #{f.hash_sha256.slice(0, 10)} · {f.timestamp_captura ? format(new Date(f.timestamp_captura), "dd/MM HH:mm") : "s/timestamp"}
                  </div>
                  {editable && (
                    <button onClick={() => removerFoto.mutate(f)} className="absolute top-1 right-1 bg-background/80 rounded p-1 hover:bg-red-500/20">
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
          <CardTitle className="text-sm font-black uppercase tracking-wide text-foreground flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Não conformidades ({ncs.length})
          </CardTitle>
          {editable && <NcDialog inspecaoId={id} fotos={fotos} nrs={nrs} rubrica={rubrica} grauRisco={insp.companies?.grau_risco ?? 3} empresaId={insp.empresa_id ?? null} />}
        </CardHeader>
        <CardContent>
          {ncs.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nenhuma NC registrada.</div>
          ) : (
            <div className="space-y-2">
              {ncs.map((nc: any) => (
                <div key={nc.id} className="border rounded p-3 space-y-1 bg-card">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{nc.nr_codigo}{nc.nr_item ? ` · ${nc.nr_item}` : ""}</Badge>
                    <Badge className={CLASSE_CLS[nc.classe_risco] + " text-[10px]"}>{nc.classe_risco} · P{nc.probabilidade}×S{nc.severidade}={nc.risco_calculado}</Badge>
                    {nc.gradacao_nr28 && <Badge variant="secondary" className="text-[10px]">NR-28 {nc.gradacao_nr28}: R$ {Number(nc.multa_estimada ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Badge>}
                  </div>
                  <div className="text-sm text-foreground">{nc.descricao}</div>
                  {nc.recomendacao && <div className="text-xs text-muted-foreground"><b>Recomendação:</b> {nc.recomendacao}</div>}
                  <NcPlanos
                    ncId={nc.id}
                    editable={editable}
                    empresaId={insp.empresa_id ?? null}
                    prazoSugerido={nc.catalogo_nrs_itens?.prazo_dias_sugerido ?? null}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rubrica visível */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-wide text-foreground flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Rubrica da matriz 5x5 (referência)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 text-[11px] text-muted-foreground">
          <div>
            <div className="font-bold text-foreground mb-1">Probabilidade</div>
            {rubrica.filter((r: any) => r.eixo === "P").map((r: any) => (
              <div key={r.id}><b>P{r.nivel} — {r.rotulo}:</b> {r.definicao}</div>
            ))}
          </div>
          <div>
            <div className="font-bold text-foreground mb-1">Severidade</div>
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

function NcDialog({ inspecaoId, fotos, nrs, rubrica, grauRisco, empresaId }: { inspecaoId: string; fotos: any[]; nrs: any[]; rubrica: any[]; grauRisco: number; empresaId: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [foto_id, setFotoId] = useState<string>("");
  const [nr_codigo, setNrCodigo] = useState("");
  const [nr_item, setNrItem] = useState("");
  const [catalogo_item_id, setCatalogoItemId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [recomendacao, setRecomendacao] = useState("");
  const [probabilidade, setP] = useState(3);
  const [severidade, setS] = useState(3);
  const [gradacao, setGradacao] = useState<string>("I2");
  const [empregados, setEmpregados] = useState<number>(0);
  const [empregadosManual, setEmpregadosManual] = useState(false);

  const rP = useMemo(() => rubrica.filter((r) => r.eixo === "P"), [rubrica]);
  const rS = useMemo(() => rubrica.filter((r) => r.eixo === "S"), [rubrica]);

  // Itens oficiais da NR selecionada
  const { data: nrItens = [] } = useQuery({
    queryKey: ["catalogo-nr-itens", nr_codigo],
    enabled: !!nr_codigo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_nrs_itens")
        .select("id, item, texto_oficial, prazo_dias_sugerido, gravidade_sugerida")
        .eq("nr_codigo", nr_codigo)
        .eq("ativo", true)
        .order("item");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Nº real de empregados ativos da empresa alvo
  const { data: empregadosReais } = useQuery({
    queryKey: ["empresa-empregados-ativos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", empresaId!)
        .eq("status", "ativo");
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Sincroniza contagem real → input (a menos que usuário tenha editado manualmente)
  const empregadosFinal = empregadosManual ? empregados : (empregadosReais ?? 0);

  const { data: nr28 } = useQuery({
    queryKey: ["nr28", gradacao, grauRisco, empregadosFinal],
    enabled: !!gradacao && empregadosFinal > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("inspecao_nr28_valores")
        .select("valor_reais, portaria_ref")
        .eq("gradacao", gradacao).eq("grau_risco", grauRisco)
        .lte("faixa_min_empregados", empregadosFinal)
        .or(`faixa_max_empregados.gte.${empregadosFinal},faixa_max_empregados.is.null`)
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
      if (!catalogo_item_id) throw new Error("Selecione o item oficial da NR");
      if (!descricao.trim()) throw new Error("Descreva a NC");
      const { error } = await supabase.from("inspecao_ncs").insert({
        inspecao_id: inspecaoId,
        foto_id: foto_id || null,
        nr_codigo, nr_item: nr_item || null,
        catalogo_item_id: catalogo_item_id || null,
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
      setNrCodigo(""); setNrItem(""); setCatalogoItemId(""); setDescricao(""); setRecomendacao(""); setP(3); setS(3);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const classe = probabilidade * severidade >= 15 ? "CRITICO" : probabilidade * severidade >= 8 ? "ALTO" : probabilidade * severidade >= 4 ? "MODERADO" : "BAIXO";
  const itemSelecionado = nrItens.find((i: any) => i.id === catalogo_item_id);

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
              <Select value={nr_codigo} onValueChange={(v) => { setNrCodigo(v); setCatalogoItemId(""); setNrItem(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {nrs.map((n: any) => (<SelectItem key={n.codigo} value={n.codigo}>{n.codigo} — {n.titulo}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Item da NR *</Label>
              <Select
                value={catalogo_item_id}
                onValueChange={(v) => {
                  setCatalogoItemId(v);
                  const it = nrItens.find((i: any) => i.id === v);
                  if (it) {
                    setNrItem(it.item);
                    if (!descricao.trim()) setDescricao(it.texto_oficial);
                  }
                }}
                disabled={!nr_codigo}
              >
                <SelectTrigger>
                  <SelectValue placeholder={nr_codigo ? (nrItens.length ? "Selecione o item oficial" : "Sem itens cadastrados") : "Escolha a NR antes"} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {nrItens.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.item} — {i.texto_oficial.slice(0, 60)}{i.texto_oficial.length > 60 ? "…" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {itemSelecionado && (
            <div className="rounded border border-primary/40 bg-primary/10 text-foreground text-[11px] p-2">
              <div className="font-black">{nr_codigo} {itemSelecionado.item}</div>
              <div className="mt-1">{itemSelecionado.texto_oficial}</div>
              {itemSelecionado.prazo_dias_sugerido && (
                <div className="mt-1 text-primary">Prazo sugerido pela norma: <b>{itemSelecionado.prazo_dias_sugerido} dias</b> · gravidade sugerida: <b>{itemSelecionado.gravidade_sugerida}</b></div>
              )}
            </div>
          )}
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

          <div className="border rounded p-3 bg-muted/40 space-y-2">
            <div className="text-xs font-black uppercase tracking-wide text-foreground">Matriz de risco 5x5</div>
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
            <div className="text-xs text-muted-foreground">Risco = {probabilidade * severidade} → <Badge className={CLASSE_CLS[classe]}>{classe}</Badge></div>
          </div>

          <div className="border rounded p-3 bg-muted/40 space-y-2">
            <div className="text-xs font-black uppercase tracking-wide text-foreground">Multa estimada NR-28 (grau {grauRisco})</div>
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
              <div>
                <Label>Nº de empregados</Label>
                <Input
                  type="number"
                  value={empregadosFinal}
                  onChange={(e) => { setEmpregadosManual(true); setEmpregados(Number(e.target.value)); }}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {empregadosManual
                    ? <>Valor manual. <button className="underline" onClick={() => { setEmpregadosManual(false); }}>Voltar ao real ({empregadosReais ?? 0})</button></>
                    : <>Contagem automática da empresa: <b>{empregadosReais ?? 0}</b> ativos.</>}
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
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

function NcPlanos({ ncId, editable, empresaId, prazoSugerido }: { ncId: string; editable: boolean; empresaId: string | null; prazoSugerido: number | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: planos = [] } = useQuery({
    queryKey: ["inspecao-nc-planos", ncId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecao_ncs_planos")
        .select("*, employees:responsavel_id(nome)")
        .eq("nc_id", ncId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: empregados = [] } = useQuery({
    queryKey: ["empresa-employees-plano", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome")
        .eq("company_id", empresaId!)
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const prazoInicial = () => {
    if (!prazoSugerido) return "";
    const d = new Date();
    d.setDate(d.getDate() + prazoSugerido);
    return d.toISOString().slice(0, 10);
  };
  const [acao, setAcao] = useState("");
  const [respId, setRespId] = useState<string>("");
  const [prazo, setPrazo] = useState<string>(prazoInicial);
  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!acao.trim()) throw new Error("Ação obrigatória");
      const emp = empregados.find((e: any) => e.id === respId);
      const { error } = await supabase.from("inspecao_ncs_planos").insert({
        nc_id: ncId,
        acao: acao.trim(),
        responsavel_id: respId || null,
        responsavel_nome: emp?.nome ?? null,
        prazo: prazo || null,
        prazo_dias_sugerido: prazoSugerido ?? null,
        criada_por: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(respId ? "Plano criado — responsável notificado" : "Plano criado");
      setAcao(""); setRespId(""); setPrazo(prazoInicial());
      qc.invalidateQueries({ queryKey: ["inspecao-nc-planos", ncId] });
      qc.invalidateQueries({ queryKey: ["inspecao-planos-resumo"] });
    },
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
      <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Plano de ação (PDCA)</div>
      {prazoSugerido && (
        <div className="text-[10px] text-primary">Prazo sugerido pela norma: <b>{prazoSugerido} dias</b> a partir de hoje.</div>
      )}
      {planos.map((p: any) => (
        <div key={p.id} className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="text-[9px]">{p.fase_pdca}</Badge>
          <span className="flex-1">{p.acao}</span>
          {(p.employees?.nome || p.responsavel_nome) && <span className="text-muted-foreground">{p.employees?.nome ?? p.responsavel_nome}</span>}
          {p.prazo && <span className="text-muted-foreground">{format(new Date(p.prazo + "T00:00:00"), "dd/MM/yy")}</span>}
          {editable && p.fase_pdca !== "ENCERRADO" && <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => avancar.mutate(p)}>avançar</Button>}
        </div>
      ))}
      {editable && (
        <div className="flex gap-2 items-end pt-1 flex-wrap">
          <Input placeholder="Nova ação..." value={acao} onChange={(e) => setAcao(e.target.value)} className="h-7 text-xs flex-1 min-w-[160px]" />
          <Select value={respId} onValueChange={setRespId}>
            <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent position="popper" side="top" align="end" sideOffset={4} avoidCollisions={false} className="max-h-60 z-[100]">
              {empregados.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem funcionários ativos nesta empresa.</div>
              ) : (
                empregados.map((e: any) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))
              )}
            </SelectContent>
          </Select>
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-7 text-xs w-36" />
          <Button size="sm" variant="outline" className="h-7" onClick={() => add.mutate()}><Plus className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}
