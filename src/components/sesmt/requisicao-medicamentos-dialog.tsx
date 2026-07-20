import { useEffect, useState, lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Pill, FileDown, Eye, Copy, Search, Save } from "lucide-react";
import { toast } from "sonner";
import {
  MEDICAMENTOS_AMBULATORIO_PADRAO,
  MEDICAMENTOS_SUGESTOES,
  buildRequisicaoMedicamentosPdf,
  downloadRequisicaoMedicamentosPdf,
  type MedItem,
} from "@/lib/requisicao-medicamentos-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type jsPDF from "jspdf";
const SignaturePadDialog = lazy(() =>
  import("@/components/signature-pad-dialog").then((m) => ({ default: m.SignaturePadDialog })),
);

type Props = {
  defaultSolicitante?: string;
  trigger?: React.ReactNode;
  /** Quando passado, abre em modo edição e carrega os itens salvos. */
  requisitionId?: string;
  /** Controle externo de abertura (usado quando aberto a partir da lista). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function RequisicaoMedicamentosDialog({
  defaultSolicitante = "",
  trigger,
  requisitionId,
  open: openProp,
  onOpenChange,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setOpenInternal(v);
  };
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editId, setEditId] = useState<string | null>(requisitionId ?? null);
  const [numero, setNumero] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [solicitante, setSolicitante] = useState(defaultSolicitante);
  const [setor, setSetor] = useState("SESMT — Ambulatório");
  const [responsavelTST, setResponsavelTST] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<MedItem[]>(() => MEDICAMENTOS_AMBULATORIO_PADRAO.map((i) => ({ ...i })));
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [busca, setBusca] = useState("");
  const [assinaturaSolicitante, setAssinaturaSolicitante] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState(false);

  const resetNovaRequisicao = () => {
    setEditId(null);
    setNumero("");
    setSolicitante(defaultSolicitante);
    setSetor("SESMT — Ambulatório");
    setResponsavelTST("");
    setObservacoes("");
    setAssinaturaSolicitante(null);
    setItens(MEDICAMENTOS_AMBULATORIO_PADRAO.map((i) => ({ ...i })));
  };

  // Carrega requisição existente quando passada (modo edição)
  useEffect(() => {
    if (!open) return;
    if (!requisitionId) {
      resetNovaRequisicao();
      return;
    }
    setEditId(requisitionId);
    (async () => {
      const { data: req } = await supabase
        .from("purchase_requisitions")
        .select("*")
        .eq("id", requisitionId)
        .maybeSingle();
      if (req) {
        setNumero(req.numero ?? "");
        setSolicitante(req.solicitante ?? "");
        setSetor(req.setor ?? "SESMT — Ambulatório");
        setResponsavelTST((req as any).responsavel_tst ?? "");
        setObservacoes(req.observacoes ?? "");
        setAssinaturaSolicitante(req.signature_solicitante ?? null);
      }
      const { data: rows } = await supabase
        .from("purchase_requisition_items")
        .select("*")
        .eq("requisition_id", requisitionId)
        .order("item_numero");
      if (rows && rows.length > 0) {
        setItens(
          rows.map((r: any) => {
            // Recupera "apresentacao" que foi salva no formato "descricao — apresentacao"
            const raw = String(r.descricao ?? "");
            const sep = raw.lastIndexOf(" — ");
            const descricao = sep > 0 ? raw.slice(0, sep) : raw;
            const apresentacao = sep > 0 ? raw.slice(sep + 3) : "";
            return {
              descricao,
              apresentacao,
              unidade: r.unidade ?? "UN",
              quantidade: Number(r.quantidade ?? 0),
              justificativa: r.observacao ?? "",
            };
          }),
        );
      }
    })();
  }, [open, requisitionId]);

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

  const baixar = async () => {
    if (!validar()) return;
    await downloadRequisicaoMedicamentosPdf({ numero, solicitante, setor, responsavelTST, observacoes, itens, assinaturaSolicitanteDataUrl: assinaturaSolicitante ?? undefined });
    toast.success("PDF gerado");
  };
  const visualizar = async () => {
    if (!validar()) return;
    const doc = await buildRequisicaoMedicamentosPdf({ numero, solicitante, setor, responsavelTST, observacoes, itens, assinaturaSolicitanteDataUrl: assinaturaSolicitante ?? undefined });
    setPreviewDoc(doc);
  };

  async function gerarNumero(): Promise<string> {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    const start = `${yyyy}-${mm}-01`;
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const end = endDate.toISOString().slice(0, 10);
    const { count } = await supabase
      .from("purchase_requisitions")
      .select("id", { count: "exact", head: true })
      .gte("data_requisicao", start)
      .lt("data_requisicao", end);
    const seq = String((count ?? 0) + 1).padStart(3, "0");
    return `${seq}/${mm}/${yyyy}`;
  }

  async function salvarNoSigmo() {
    if (!validar()) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      let id = editId;
      if (id) {
        const { error } = await supabase
          .from("purchase_requisitions")
          .update({
            solicitante,
            setor,
            responsavel_tst: responsavelTST.trim() || null,
            observacoes,
            signature_solicitante: assinaturaSolicitante,
            signature_solicitante_height: assinaturaSolicitante ? 22 : null,
            titulo: "Medicamentos Ambulatório",
          })
          .eq("id", id);
        if (error) throw error;
        await supabase.from("purchase_requisition_items").delete().eq("requisition_id", id);
      } else {
        const novoNumero = numero || (await gerarNumero());
        const { data, error } = await supabase
          .from("purchase_requisitions")
          .insert({
            numero: novoNumero,
            titulo: "Medicamentos Ambulatório",
            data_requisicao: today,
            classificacao: "MEDICAMENTOS" as any,
            solicitante,
            setor,
            responsavel_tst: responsavelTST.trim() || null,
            observacoes,
            signature_solicitante: assinaturaSolicitante,
            signature_solicitante_height: assinaturaSolicitante ? 22 : null,
            codigo_formulario: "FOR-COMP: 03",
            revisao: "01",
            data_revisao: today,
            pagina: "01/01",
            status: "PENDENTE",
            created_by: user?.id ?? null,
          })
          .select("id, numero")
          .single();
        if (error) throw error;
        id = data.id;
        setEditId(id);
        setNumero(data.numero);
      }

      const rows = itens.map((it, idx) => ({
        requisition_id: id!,
        item_numero: idx + 1,
        descricao: `${it.descricao}${it.apresentacao ? ` — ${it.apresentacao}` : ""}`,
        quantidade: Number(it.quantidade) || 0,
        unidade: it.unidade || "UN",
        observacao: it.justificativa ?? "",
      }));
      if (rows.length > 0) {
        const { error: itErr } = await supabase.from("purchase_requisition_items").insert(rows);
        if (itErr) throw itErr;
      }
      qc.invalidateQueries({ queryKey: ["purchase-reqs"] });
      toast.success(editId ? "Requisição atualizada" : "Requisição salva no SIGMO");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {openProp === undefined && (
          <DialogTrigger asChild>
            {trigger ?? (
              <Button variant="outline" className="gap-2">
                <Pill className="h-4 w-4 text-rose-600" /> Medicamentos Ambulatório
              </Button>
            )}
          </DialogTrigger>
        )}
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-rose-600" />
              {editId ? `Requisição Nº ${numero} — Medicamentos` : "Requisição de Medicamentos — Ambulatório SESMT"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Itens de uso diário (sem medicação controlada). Edite quantidades, salve no SIGMO para ficar na lista de requisições, gere o PDF ou assine.
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
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
              <Label className="text-xs flex items-center gap-1 mb-1 text-slate-900 dark:text-slate-100">
                <Search className="h-3 w-3" /> Buscar e adicionar medicamento (ex: dipirona 1g, buscopan, oxímetro…)
              </Label>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o nome do medicamento ou insumo"
                className="h-9 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
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
                    <th className="px-2 py-2 w-36">Apresentação</th>
                    <th className="px-2 py-2 w-20">Unidade</th>
                    <th className="px-2 py-2 w-24 text-center">Qtd</th>
                    <th className="px-2 py-2 w-48">Justificativa</th>
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
                          className="h-8 text-center font-bold w-24"
                          type="number"
                          min={0}
                          step={1}
                          value={String(it.quantidade)}
                          onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-8"
                          placeholder="Ex: reposição, urgência..."
                          value={it.justificativa ?? ""}
                          onChange={(e) => updateItem(idx, { justificativa: e.target.value })}
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
              <div className="p-2 border-t bg-slate-50 dark:bg-slate-900/40 flex justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addItemVazio}
                  className="gap-1 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                  title="Adicionar novo item"
                >
                  <Plus className="h-4 w-4" /> Adicionar item
                </Button>
              </div>
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

            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Assinatura do Solicitante
                </Label>
                <div className="flex gap-2">
                  {assinaturaSolicitante && (
                    <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setAssinaturaSolicitante(null)}>
                      Limpar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setPadOpen(true)}>
                    {assinaturaSolicitante ? "Substituir assinatura" : "Assinar requisição"}
                  </Button>
                </div>
              </div>
              {assinaturaSolicitante ? (
                <div className="bg-white border rounded p-2 flex items-center justify-center">
                  <img src={assinaturaSolicitante} alt="Assinatura do solicitante" className="max-h-24 object-contain" />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded">
                  Clique em <b>Assinar requisição</b> para desenhar, importar ou usar uma assinatura salva.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button variant="outline" onClick={visualizar}><Eye className="h-4 w-4 mr-2" /> Visualizar</Button>
            <Button variant="outline" onClick={baixar}>
              <FileDown className="h-4 w-4 mr-2" /> Baixar PDF
            </Button>
            <Button
              className="bg-rose-700 hover:bg-rose-800 text-white"
              onClick={salvarNoSigmo}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : editId ? "Salvar alterações" : "Salvar no SIGMO"}
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

      {padOpen && (
        <Suspense fallback={null}>
          <SignaturePadDialog
            open={padOpen}
            onClose={() => setPadOpen(false)}
            onConfirm={(r) => {
              setAssinaturaSolicitante(r.dataUrl);
              setPadOpen(false);
              toast.success("Assinatura anexada à requisição");
            }}
            title="Assinar Requisição de Medicamentos"
          />
        </Suspense>
      )}
    </>
  );
}