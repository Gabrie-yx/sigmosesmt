import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarTemplates,
  historicoTemplate,
  novaRevisaoTemplate,
  signedUrlTemplate,
  homologarVersao,
  arquivarVersao,
  restaurarVersao,
} from "@/lib/templates-documentos.functions";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Upload, History, Download, ShieldAlert, CheckCircle2, Archive, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/templates-documentos")({
  component: TemplatesDocumentosPage,
});

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    HOMOLOGADA: { label: "Homologada", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    EM_HOMOLOGACAO: { label: "Em homologação", cls: "bg-amber-500/20 text-amber-200 border-amber-500/30" },
    SUPERSEDIDA: { label: "Superseded", cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  };
  const s = map[status] ?? { label: status, cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

function TemplatesDocumentosPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="p-8 flex flex-col items-center gap-3 text-center border-rose-500/30 bg-rose-500/5">
          <ShieldAlert className="w-10 h-10 text-rose-400" />
          <h2 className="text-lg font-semibold text-rose-200">Acesso restrito</h2>
          <p className="text-sm text-rose-100/70">
            Somente administradores podem gerenciar templates homologados de documentos.
          </p>
        </Card>
      </div>
    );
  }

  return <PainelInterno />;
}

function PainelInterno() {
  const listar = useServerFn(listarTemplates);
  const { data: templates } = useSuspenseQuery({
    queryKey: ["document-templates"],
    queryFn: () => listar(),
  });

  const [uploadFor, setUploadFor] = useState<any>(null);
  const [historyFor, setHistoryFor] = useState<any>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-rose-300" />
          <h1 className="text-2xl font-bold text-rose-50">Templates de Documentos (FOR-SEG)</h1>
        </div>
        <p className="text-sm text-rose-100/70 max-w-3xl">
          Painel de gestão dos formulários homologados pela ISO 9001 (PROCO-SGI-SST-01).
          Upload de nova revisão arquiva o PDF oficial e cria uma pendência para o motor de render alinhar.
          Enquanto isso, o sistema continua emitindo pela revisão anterior com selo no rodapé.
        </p>
      </header>

      <div className="grid gap-3">
        {templates.map((t: any) => (
          <Card key={t.id} className="p-4 border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-950/60">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/30">{t.codigo}</span>
                  <h3 className="font-semibold text-rose-50">{t.nome}</h3>
                  {t.motor_render_id ? null : (
                    <Badge variant="outline" className="text-xs bg-slate-500/20 text-slate-300 border-slate-500/30">Sem motor</Badge>
                  )}
                </div>
                {t.descricao && <p className="text-xs text-rose-100/60 mt-1">{t.descricao}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-rose-100/80">
                  {t.versao_atual ? (
                    <>
                      <span className="font-medium">Rev.{String(t.versao_atual.revisao).padStart(2, "0")}</span>
                      {statusBadge(t.versao_atual.status)}
                      <span className="text-rose-100/50">Enviada em {fmtDate(t.versao_atual.uploaded_at)}</span>
                    </>
                  ) : (
                    <span className="italic text-rose-100/40">— sem modelo enviado —</span>
                  )}
                  {t.pendente && (
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-200 border-amber-500/30 gap-1">
                      <AlertCircle className="w-3 h-3" /> Motor precisa alinhar
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {t.total_versoes > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setHistoryFor(t)}>
                    <History className="w-4 h-4 mr-1" /> Histórico ({t.total_versoes})
                  </Button>
                )}
                <Button size="sm" onClick={() => setUploadFor(t)}>
                  <Upload className="w-4 h-4 mr-1" />
                  {t.versao_atual ? "Nova revisão" : "Enviar 1º modelo"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {uploadFor && <UploadDialog template={uploadFor} onClose={() => setUploadFor(null)} />}
      {historyFor && <HistoryDialog template={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function UploadDialog({ template, onClose }: { template: any; onClose: () => void }) {
  const qc = useQueryClient();
  const novaRevisao = useServerFn(novaRevisaoTemplate);
  const [file, setFile] = useState<File | null>(null);
  const [motivo, setMotivo] = useState("");
  const [uploading, setUploading] = useState(false);

  const proximaRev = ((template.versao_atual?.revisao ?? 0) as number) + 1;

  async function submit() {
    if (!file) return toast.error("Selecione o PDF.");
    if (motivo.trim().length < 3) return toast.error("Descreva o motivo da alteração.");
    if (file.size > 20 * 1024 * 1024) return toast.error("Arquivo maior que 20 MB.");
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await novaRevisao({
        data: {
          templateId: template.id,
          fileName: file.name,
          contentType: file.type || "application/pdf",
          base64: b64,
          motivo: motivo.trim(),
        },
      });
      toast.success(`Rev.${String(proximaRev).padStart(2, "0")} arquivada. Pendência criada para o motor.`);
      qc.invalidateQueries({ queryKey: ["document-templates"] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template.codigo} — Nova revisão</DialogTitle>
          <DialogDescription>
            Vai ser arquivada como <strong>Rev.{String(proximaRev).padStart(2, "0")}</strong> · status "Em homologação".
            A revisão anterior fica marcada como Superseded (não é apagada).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Arquivo PDF (max 20 MB)</Label>
            <Input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-rose-100/60 mt-1">
                {file.name} — {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
          <div>
            <Label>Motivo da alteração</Label>
            <Textarea
              placeholder="Ex.: Adequação ao parecer SGI 07/2026 — inclusão do campo de assinatura do gerente."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
          <Button onClick={submit} disabled={uploading || !file || motivo.trim().length < 3}>
            {uploading ? "Enviando..." : "Confirmar upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ template, onClose }: { template: any; onClose: () => void }) {
  const qc = useQueryClient();
  const hist = useServerFn(historicoTemplate);
  const signedUrl = useServerFn(signedUrlTemplate);
  const homologar = useServerFn(homologarVersao);
  const arquivar = useServerFn(arquivarVersao);
  const restaurar = useServerFn(restaurarVersao);

  const { data: versoes, isLoading, refetch } = useQuery({
    queryKey: ["document-template-history", template.id],
    queryFn: () => hist({ data: { templateId: template.id } }),
  });

  async function baixar(id: string) {
    try {
      const { url } = await signedUrl({ data: { versionId: id } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar download.");
    }
  }
  async function act(fn: () => Promise<any>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await refetch();
      qc.invalidateQueries({ queryKey: ["document-templates"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha.");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.codigo} — Histórico de revisões</DialogTitle>
          <DialogDescription>{template.nome}</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-rose-100/60">Carregando...</p>}
        <div className="space-y-3">
          {(versoes ?? []).map((v: any) => (
            <Card key={v.id} className={`p-3 border ${v.deleted_at ? "border-slate-700/50 opacity-60" : "border-rose-500/20"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-rose-100">Rev.{String(v.revisao).padStart(2, "0")}</span>
                    {statusBadge(v.status)}
                    {v.deleted_at && <Badge variant="outline" className="bg-slate-500/20 text-slate-300">Arquivada</Badge>}
                  </div>
                  <p className="text-xs text-rose-100/60 mt-1">
                    {v.arquivo_nome} · {fmtDate(v.uploaded_at)}
                  </p>
                  <p className="text-xs text-rose-100/80 mt-1"><strong>Motivo:</strong> {v.motivo_alteracao}</p>
                  {v.arquivo_hash && (
                    <p className="text-[10px] font-mono text-rose-100/40 mt-1 break-all">SHA-256: {v.arquivo_hash}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Button size="sm" variant="outline" onClick={() => baixar(v.id)}>
                    <Download className="w-3 h-3 mr-1" /> Baixar
                  </Button>
                  {v.status === "EM_HOMOLOGACAO" && !v.deleted_at && (
                    <Button size="sm" variant="outline" className="text-emerald-300 border-emerald-500/40"
                      onClick={() => act(() => homologar({ data: { versionId: v.id } }), "Revisão homologada.")}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Homologar
                    </Button>
                  )}
                  {!v.deleted_at ? (
                    <Button size="sm" variant="outline" className="text-amber-300 border-amber-500/40"
                      onClick={() => {
                        if (!confirm("Arquivar esta revisão? (soft delete — pode ser restaurada)")) return;
                        act(() => arquivar({ data: { versionId: v.id } }), "Revisão arquivada.");
                      }}>
                      <Archive className="w-3 h-3 mr-1" /> Arquivar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline"
                      onClick={() => act(() => restaurar({ data: { versionId: v.id } }), "Revisão restaurada.")}>
                      <RotateCcw className="w-3 h-3 mr-1" /> Restaurar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {(versoes ?? []).length === 0 && !isLoading && (
            <p className="text-sm text-rose-100/50 italic">Nenhuma revisão registrada ainda.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}