import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PdfSignerDialog } from "@/components/pdf-signer-dialog";
import { buildOssPdf } from "@/lib/oss-pdf";
import { PenTool, Loader2 } from "lucide-react";
import { toast } from "sonner";

type EmInput = {
  id: string;
  employee_id: string;
  template_revisao: number;
  cargo_snapshot: string;
  motivo_emissao: string;
  emitido_em: string;
  expira_em: string | null;
  conteudo_snapshot: any;
  employees?: {
    nome: string;
    cpf: string | null;
    matricula: string | null;
    admissao: string | null;
    rg?: string | null;
    companies?: { name: string | null; cnpj: string | null } | null;
    roles?: { name: string | null; cbo?: string | null } | null;
  } | null;
  oss_templates?: { titulo: string; setor: string | null } | null;
};

/**
 * Botão "Assinar" embarcado no painel OS:
 * 1. Gera o PDF da OS a partir do snapshot (sem download/upload manual)
 * 2. Abre o PdfSignerDialog com os bytes pré-carregados
 * 3. Ao salvar, faz upload no bucket oss-pdfs e atualiza a linha oss_emissoes
 *    → fica imediatamente visível na ficha do funcionário (mesma tabela)
 */
export function OssAssinarButton({ em }: { em: EmInput }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);

  const abrir = useMutation({
    mutationFn: async () => {
      setLoading(true);
      const { data: epiRows } = await supabase
        .from("estoque_epi")
        .select("nome_material, ca");
      const episCatalog = (epiRows ?? [])
        .filter((r: any) => r.nome_material && r.ca)
        .map((r: any) => ({ nome: r.nome_material as string, ca: r.ca as string }));
      const doc = buildOssPdf({
        revisao: em.template_revisao,
        emitido_em: em.emitido_em,
        expira_em: em.expira_em,
        motivo_emissao: em.motivo_emissao,
        funcionario: {
          nome: em.employees?.nome ?? "—",
          cpf: em.employees?.cpf ?? null,
          matricula: em.employees?.matricula ?? null,
          admissao: em.employees?.admissao ?? null,
          rg: em.employees?.rg ?? null,
        },
        cargo: em.cargo_snapshot,
        cbo: em.conteudo_snapshot?.cbo ?? em.employees?.roles?.cbo ?? null,
        setor: em.oss_templates?.setor ?? null,
        empresa: em.employees?.companies?.name ?? null,
        empresa_cnpj: em.employees?.companies?.cnpj ?? null,
        conteudo: em.conteudo_snapshot,
        episCatalog,
      });
      const ab = doc.output("arraybuffer") as ArrayBuffer;
      return new Uint8Array(ab);
    },
    onSuccess: (data) => {
      setBytes(data);
      setOpen(true);
      setLoading(false);
    },
    onError: (e: any) => {
      setLoading(false);
      toast.error("Falha ao gerar PDF: " + e.message);
    },
  });

  const handleSigned = async (info: { path: string; signedBytes: Uint8Array }) => {
    try {
      // Faz upload também no bucket oss-pdfs (linha mestre da OS)
      const blob = new Blob([info.signedBytes as BlobPart], { type: "application/pdf" });
      const path = `${em.id}/${Date.now()}-assinado.pdf`;
      const { error: upErr } = await supabase.storage
        .from("oss-pdfs")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      const { error } = await supabase
        .from("oss_emissoes")
        .update({
          pdf_assinado_path: path,
          status: "ASSINADO",
          assinado_em: new Date().toISOString(),
        })
        .eq("id", em.id);
      if (error) throw error;

      toast.success("OS assinada e vinculada à ficha do funcionário!");
      qc.invalidateQueries({ queryKey: ["oss-emissoes"] });
      qc.invalidateQueries({ queryKey: ["employee-oss", em.employee_id] });
      qc.invalidateQueries({ queryKey: ["pend-oss"] });
      setOpen(false);
    } catch (e: any) {
      toast.error("Erro ao salvar na OS: " + e.message);
    }
  };

  const fileName = `OSS-${em.cargo_snapshot}-${em.employees?.nome ?? "func"}.pdf`;

  return (
    <>
      <Button
        size="sm"
        className="bg-rose-600 hover:bg-rose-700 text-white h-8"
        onClick={() => abrir.mutate()}
        disabled={loading || abrir.isPending}
        title="Assinar OS direto no sistema (sem download/upload)"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <PenTool className="h-3.5 w-3.5 mr-1" />}
        Assinar
      </Button>

      {open && bytes && (
        <PdfSignerDialog
          open={open}
          onClose={() => setOpen(false)}
          source={bytes}
          nomeArquivo={fileName}
          modulo="oss"
          referenciaId={em.id}
          onSigned={handleSigned}
        />
      )}
    </>
  );
}