import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Pill, FileDown, Eye, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import {
  MEDICAMENTOS_AMBULATORIO_PADRAO,
  MEDICAMENTOS_SUGESTOES,
  buildRequisicaoMedicamentosPdf,
  downloadRequisicaoMedicamentosPdf,
  type MedItem,
} from "@/lib/requisicao-medicamentos-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";

type Props = {
  defaultSolicitante?: string;
  trigger?: React.ReactNode;
};

export function RequisicaoMedicamentosDialog({ defaultSolicitante = "", trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [solicitante, setSolicitante] = useState(defaultSolicitante);
  const [setor, setSetor] = useState("SESMT — Ambulatório");
  const [responsavelTST, setResponsavelTST] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<MedItem[]>(() => MEDICAMENTOS_AMBULATORIO_PADRAO.map((i) => ({ ...i })));
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [busca, setBusca] = useState("");

  const updateItem = (idx: number, patch: Partial<MedItem>) => {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => setItens((arr) => arr.filter((_, i) => i !== idx));
  const duplicateItem = (idx: number) =>
    setItens((arr) => {
      const novo = { ...arr[idx] };
      const out = [...arr];
      out.splice(idx + 1, 0, novo);
      return out;
    });
  const addItemVazio = () =>
    setItens((arr) => [...arr, { descricao: "", apresentacao: "", unidade: "UN", quantidade: 1 }]);
  const addItemSugestao = (sug: MedItem) => {
    setItens((arr) => [...arr, { ...sug }]);
    setBusca("");
    toast.success(`${sug.descricao} adicionado`);
  };

  const sugestoesFiltradas = (() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    const pool = [...MEDICAMENTOS_SUGESTOES, ...MEDICAMENTOS_AMBULATORIO_PADRAO];
    const seen = new Set<string>();
    return pool
      .filter((i) => {
        const k = i.descricao.toLowerCase();
        if (seen.has(k)) return false;
        if (!k.includes(q)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 8);
  })();

  const resetPadrao = () => {
    setItens(MEDICAMENTOS_AMBULATORIO_PADRAO.map((i) => ({ ...i })));
    toast.success("Lista padrão restaurada");
  };

  const validar = (): boolean => {
    if (!solicitante.trim()) { toast.error("Informe o solicitante"); return false; }
    if (itens.length === 0) { toast.error("Adicione ao menos 1 item"); return false; }
    const semDesc = itens.findIndex((i) => !i.descricao.trim());
    if (semDesc >= 0) { toast.error(`Item ${semDesc + 1} sem descrição`); return false; }
    return true;
  };

  const baixar = () => {
    if (!validar()) return;
    downloadRequisicaoMedicamentosPdf({ solicitante, setor, responsavelTST, observacoes, itens });
    toast.success("PDF gerado");
  };
  const visualizar = () => {
    if (!validar()) return;
    setPreviewDoc(buildRequisicaoMedicamentosPdf({ solicitante, setor, responsavelTST, observacoes, itens }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" className="gap-2">
              <Pill className="h-4 w-4 text-rose-600" /> Medicamentos Ambulatório
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-rose-600" />
              Requisição de Medicamentos — Ambulatório SESMT
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Itens de uso diário (sem medicação controlada). Edite quantidades, adicione ou remova itens e gere o PDF.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Solicitante *</Label>
                <Input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Nome do solicitante" />
              </div>
              <div>
                <Label>Setor</Label>
                <Input value={setor} onChange={(e) => setSetor(e.target.value)} />
              </div>
              <div>
                <Label>TST Responsável</Label>
                <Input value={responsavelTST} onChange={(e) => setResponsavelTST(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                Itens ({itens.length}) — total {itens.reduce((a, i) => a + Number(i.quantidade || 0), 0)} un
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={resetPadrao}>Restaurar padrão</Button>
                <Button size="sm" className="bg-rose-700 hover:bg-rose-800 text-white" onClick={addItemVazio}>
                  <Plus className="h-3 w-3 mr-1" /> Item personalizado
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-3">
              <Label className="text-xs flex items-center gap-1 mb-1">
                <Search className="h-3 w-3" /> Buscar e adicionar medicamento (ex: dipirona 1g, buscopan, oxímetro…)
              </Label>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o nome do medicamento ou insumo"
                className="h-9 bg-white dark:bg-slate-900"
              />
              {sugestoesFiltradas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sugestoesFiltradas.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => addItemSugestao(s)}
                      className="text-xs px-2 py-1 rounded border bg-white dark:bg-slate-900 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
                    >
                      <Plus className="h-3 w-3 inline mr-1 text-rose-600" />
                      {s.descricao} <span className="text-muted-foreground">· {s.apresentacao}</span>
                    </button>
                  ))}
                </div>
              )}
              {busca.trim() && sugestoesFiltradas.length === 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Nada no catálogo. Use <b>+ Item personalizado</b> pra digitar do zero.
                </div>
              )}
              </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-left">
                  <tr>
                    <th className="px-2 py-2 w-8">#</th>
                    <th className="px-2 py-2">Medicamento / Insumo</th>
                    <th className="px-2 py-2 w-40">Apresentação</th>
                    <th className="px-2 py-2 w-24">Unidade</th>
                    <th className="px-2 py-2 w-16 text-center">Qtd</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <Input className="h-8" value={it.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} />
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8" value={it.apresentacao} onChange={(e) => updateItem(idx, { apresentacao: e.target.value })} />
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8" value={it.unidade} onChange={(e) => updateItem(idx, { unidade: e.target.value })} />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-8 text-center font-bold"
                          type="number"
                          min={0}
                          value={String(it.quantidade)}
                          onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) || 0 })}
                        />
                      </td>
                     <td className="px-1 py-1 text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-sky-600" title="Duplicar (criar variação)" onClick={() => duplicateItem(idx)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" title="Remover" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Validade mínima 12 meses, entrega no ambulatório, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button variant="outline" onClick={visualizar}><Eye className="h-4 w-4 mr-2" /> Visualizar</Button>
            <Button className="bg-rose-700 hover:bg-rose-800" onClick={baixar}>
              <FileDown className="h-4 w-4 mr-2" /> Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewDoc && (
        <PDFPreviewDialog
          open={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          doc={previewDoc}
          fileName={`requisicao-medicamentos-${new Date().toISOString().slice(0, 10)}.pdf`}
          title="Pré-visualização — Requisição de Medicamentos"
        />
      )}
    </>
  );
}