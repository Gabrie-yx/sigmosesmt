import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ListChecks } from "lucide-react";
import { toast } from "sonner";
import type jsPDF from "jspdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import {
  gerarPdfRequisicaoDoc,
  rcPdfFileName,
  type RcPdfReq,
} from "@/lib/requisicao-compra-pdf";

type Req = {
  id: string;
  numero: string;
  data_requisicao: string;
  solicitante: string;
  setor: string | null;
  status: string;
  classificacao: string;
  titulo?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-300",
  EM_COTACAO: "bg-violet-100 text-violet-800 border-violet-300",
  COTADA: "bg-blue-100 text-blue-800 border-blue-300",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-300",
  INDEFERIDA: "bg-rose-100 text-rose-800 border-rose-300",
  EM_RECEBIMENTO: "bg-cyan-100 text-cyan-800 border-cyan-300",
  CONCLUIDA: "bg-slate-200 text-slate-800 border-slate-400",
  DEVOLVIDA: "bg-orange-100 text-orange-800 border-orange-300",
};

function fmt(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

/**
 * Listagem das RCs do setor (setorFixo) com botão "Visualizar PDF"
 * usando o mesmo gerador homologado FOR-COMP 03 do módulo SESMT.
 * Assim toda RC — de qualquer módulo — sai no mesmo padrão.
 */
export function MinhasRcsList({ setorFixo }: { setorFixo: string }) {
  const { data: reqs = [], isLoading } = useQuery({
    queryKey: ["purchase-reqs", "setor", setorFixo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requisitions")
        .select("id,numero,data_requisicao,solicitante,setor,status,classificacao,titulo")
        .eq("setor", setorFixo)
        .order("data_requisicao", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });

  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [pdfReq, setPdfReq] = useState<Req | null>(null);
  const [openPreview, setOpenPreview] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function visualizar(req: Req) {
    if (loadingId) return;
    setLoadingId(req.id);
    try {
      const [{ data: full, error: e1 }, { data: itens, error: e2 }, { data: cots, error: e3 }] =
        await Promise.all([
          supabase
            .from("purchase_requisitions")
            .select(
              "id,numero,titulo,data_requisicao,classificacao,solicitante,setor,fornecedor,obra_construcao,obra_manutencao,codigo_formulario,revisao,data_revisao,pagina,status,motivo_indeferimento,signature_solicitante,signature_solicitante_height,decidido_por_nome,decidido_assinatura_url,decidido_em,cotador_nome,cotacao_at",
            )
            .eq("id", req.id)
            .maybeSingle(),
          supabase
            .from("purchase_requisition_items")
            .select("item_numero,descricao,quantidade,unidade,observacao")
            .eq("requisition_id", req.id)
            .order("item_numero"),
          supabase
            .from("rc_cotacoes")
            .select("fornecedor,valor,prazo_entrega_dias,condicao_pagamento,frete,is_vencedora")
            .eq("rc_id", req.id)
            .order("is_vencedora", { ascending: false })
            .order("valor", { ascending: true }),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (!full) throw new Error("RC não encontrada");
      const doc = await gerarPdfRequisicaoDoc(
        full as unknown as RcPdfReq,
        itens ?? [],
        (cots ?? []) as any,
      );
      setPdfDoc(doc);
      setPdfReq(req);
      setOpenPreview(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao gerar o PDF da RC");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ListChecks className="h-5 w-5 text-red-700" />
          Requisições do setor — {setorFixo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : reqs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma RC emitida ainda por este setor.</p>
        ) : (
          <div className="space-y-2">
            {reqs.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2 bg-white dark:bg-slate-900"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      RC {r.numero}
                    </span>
                    <Badge className={STATUS_STYLE[r.status] ?? ""} variant="outline">
                      {r.status}
                    </Badge>
                    <span className="text-xs text-slate-500">{fmt(r.data_requisicao)}</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {r.solicitante} · {r.classificacao}
                    {r.titulo ? ` · ${r.titulo}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingId === r.id}
                  onClick={() => visualizar(r)}
                  title="Visualizar / Imprimir / Baixar PDF (FOR-COMP 03)"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  {loadingId === r.id ? "Gerando…" : "Visualizar PDF"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <PDFPreviewDialog
        open={openPreview}
        onClose={() => {
          setOpenPreview(false);
          setPdfDoc(null);
          setPdfReq(null);
        }}
        doc={pdfDoc}
        fileName={pdfReq ? rcPdfFileName(pdfReq) : "requisicao.pdf"}
        title={pdfReq ? `RC ${pdfReq.numero}` : "Requisição"}
      />
    </Card>
  );
}