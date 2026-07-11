import { useState } from "react";
import JSZip from "jszip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, PenLine, X, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import { gerarAvaliacaoReacao, preloadTemplateReacao } from "@/lib/reacao-treinamento-pdf";
import { baixarBlob } from "@/lib/lista-presenca-pdf";

type Props = {
  open: boolean;
  onClose: () => void;
  turma: any;
  course: any;
  participantesCount: number;
};

export function ReacaoGerarDialog({ open, onClose, turma, course, participantesCount }: Props) {
  const [qtd, setQtd] = useState(Math.max(1, participantesCount));
  const [tstNome, setTstNome] = useState("");
  const [tstSig, setTstSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickSig() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/png,image/jpeg";
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) {
        toast.error("Imagem maior que 5MB");
        return;
      }
      try {
        const bm = await createImageBitmap(f, { imageOrientation: "from-image" } as any);
        const scale = Math.min(1, 800 / bm.width);
        const w = Math.round(bm.width * scale);
        const h = Math.round(bm.height * scale);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")!.drawImage(bm, 0, 0, w, h);
        setTstSig(c.toDataURL("image/png"));
      } catch {
        const r = new FileReader();
        r.onload = () => setTstSig(String(r.result || ""));
        r.readAsDataURL(f);
      }
    };
    inp.click();
  }

  function buildParams() {
    const tipoMap: Record<string, "INTERNO" | "EXTERNO"> = {
      INTERNO: "INTERNO",
      EXTERNO: "EXTERNO",
      IN_COMPANY: "EXTERNO",
    };
    return {
      data: formatDateBR(turma.data_realizacao),
      tipo: tipoMap[turma.tipo_realizacao] ?? "INTERNO",
      instrutor: turma.instrutor ?? "",
      instituicao: turma.instituicao ?? "",
      treinamento: course ? `${course.codigo} — ${course.nome}` : "",
      cargaHoraria: turma.carga_horaria_h ? `${turma.carga_horaria_h}h` : "",
      tstNome: tstNome.trim() || undefined,
      tstAssinaturaDataUrl: tstSig,
    };
  }

  async function gerarZip() {
    setBusy(true);
    try {
      const params = buildParams();
      // Baixa o PDF-template UMA vez e reaproveita em todas as cópias do lote.
      const templateBytes = await preloadTemplateReacao();
      const zip = new JSZip();
      for (let i = 1; i <= qtd; i++) {
        const blob = await gerarAvaliacaoReacao({ ...params, templatePdfBytes: templateBytes });
        const nn = String(i).padStart(2, "0");
        zip.file(`reacao_${course.codigo}_${turma.data_realizacao}_${nn}.pdf`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      baixarBlob(content, `reacao_${course.codigo}_${turma.data_realizacao}.zip`);
      toast.success(`${qtd} avaliações geradas`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDFs");
    } finally {
      setBusy(false);
    }
  }

  async function gerarUnico() {
    try {
      const blob = await gerarAvaliacaoReacao(buildParams());
      baixarBlob(blob, `reacao_${course.codigo}_${turma.data_realizacao}_modelo.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-amber-600" />
            Gerar Avaliações de Reação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-foreground">
          <div className="bg-amber-500/10 border border-amber-400/40 rounded p-3 text-[11px] text-amber-200">
            <b>FORCP-GP-16</b> — Formulário individual e <b>anônimo</b> (Kirkpatrick Nível 1).
            Cabeçalho já pré-preenchido. Participantes marcam à caneta; depois você anexa os preenchidos.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Curso</Label>
              <div className="text-xs font-bold mt-1 text-foreground">{course?.codigo}</div>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Data</Label>
              <div className="text-xs font-bold mt-1 text-foreground">{formatDateBR(turma.data_realizacao)}</div>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Instrutor</Label>
              <div className="text-xs font-bold mt-1 truncate text-foreground">{turma.instrutor ?? "—"}</div>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Participantes</Label>
              <div className="text-xs font-bold mt-1 text-foreground">{participantesCount}</div>
            </div>
          </div>

          <div>
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Quantidade de PDFs a gerar</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={qtd}
              onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Sugerido: {participantesCount} (1 por participante). Ajuste se precisar de extras.
            </p>
          </div>

          <div>
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Nome do Técnico em Segurança</Label>
            <Input
              value={tstNome}
              onChange={(e) => setTstNome(e.target.value)}
              placeholder="Seu nome completo"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Assinatura do TST</Label>
            <div className="mt-1 flex items-center gap-2">
              {tstSig ? (
                <>
                  <img src={tstSig} alt="Assinatura" className="h-12 border bg-white px-2 rounded object-contain" />
                  <Button variant="ghost" size="sm" onClick={() => setTstSig(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={pickSig}>
                  <PenLine className="h-4 w-4 mr-1" /> Carregar assinatura (PNG/JPG)
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              A mesma assinatura é aplicada em todos os PDFs do lote.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Fechar</Button>
          <Button variant="outline" onClick={gerarUnico} disabled={busy}>
            <Download className="h-4 w-4 mr-1" /> 1 modelo
          </Button>
          <Button onClick={gerarZip} disabled={busy} className="bg-amber-600 hover:bg-amber-700">
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Gerar {qtd} (ZIP)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}