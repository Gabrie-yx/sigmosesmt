import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { gerarPacoteRescisaoPdf } from "@/lib/rescisao-pacote-pdf";

type Props = {
  emp: any;
  companyName?: string | null;
  roleName?: string | null;
  open: boolean;
  onClose: () => void;
};

/** Regenera o PDF do pacote de rescisão a partir do snapshot em `desligamento_pacotes`
 *  e exibe dentro do sistema via PDFPreviewDialog. */
export function PacoteRescisaoViewDialog({ emp, companyName, roleName, open, onClose }: Props) {
  const [doc, setDoc] = useState<jsPDF | null>(null);

  const { data: pacote } = useQuery({
    queryKey: ["desligamento-pacote-view", emp?.id],
    enabled: !!emp?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("desligamento_pacotes" as any)
        .select("*")
        .eq("employee_id", emp.id)
        .eq("status", "EMITIDO")
        .order("emitido_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // Puxa nº do PPP quando existir referência
  const { data: pppNumero } = useQuery({
    queryKey: ["desligamento-pacote-ppp", pacote?.ppp_emissao_id],
    enabled: !!pacote?.ppp_emissao_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ppp_emissoes")
        .select("numero")
        .eq("id", pacote.ppp_emissao_id)
        .maybeSingle();
      return (data as any)?.numero ?? null;
    },
  });

  // Puxa dados do ASO vinculado (se houver)
  const { data: asoRow } = useQuery({
    queryKey: ["desligamento-pacote-aso", pacote?.aso_exam_id],
    enabled: !!pacote?.aso_exam_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_exams")
        .select("data_realizacao, aptidao")
        .eq("id", pacote.aso_exam_id)
        .maybeSingle();
      return data as any;
    },
  });

  const fileName = useMemo(
    () => `pacote_rescisao_${(emp?.nome ?? "").toLowerCase().replace(/\s+/g, "_")}.pdf`,
    [emp?.nome],
  );

  useEffect(() => {
    if (!open || !pacote) { setDoc(null); return; }
    try {
      const generated = gerarPacoteRescisaoPdf({
        emp: { nome: emp.nome, cpf: emp.cpf, matricula: emp.matricula, admissao: emp.admissao },
        company: companyName ? { name: companyName } : null,
        role: roleName ? { name: roleName } : null,
        data_desligamento: pacote.data_desligamento,
        motivo: pacote.motivo,
        motivo_detalhe: pacote.motivo_detalhe,
        regularizacao: !!pacote.regularizacao,
        aso: pacote.aso_dispensado
          ? { dispensado: true, dispensa_justificativa: pacote.aso_dispensa_justificativa }
          : { data: asoRow?.data_realizacao, aptidao: asoRow?.aptidao },
        ppp_numero: pppNumero ?? null,
        epis_devolvidos: pacote.epis_devolvidos ?? [],
        epis_pendentes: pacote.epis_pendentes ?? [],
        oss_afetadas: pacote.oss_afetadas ?? [],
        checklist: pacote.checklist ?? {},
        observacoes: pacote.observacoes,
        sha256: pacote.sha256_snapshot ?? pacote.id,
      });
      setDoc(generated);
    } catch (e) {
      console.error("[PacoteView] falha ao regenerar PDF", e);
      setDoc(null);
    }
  }, [open, pacote, pppNumero, asoRow, emp, companyName, roleName]);

  return (
    <PDFPreviewDialog
      open={open}
      onClose={() => { setDoc(null); onClose(); }}
      doc={doc}
      fileName={fileName}
      title={`Pacote de Rescisão SST — ${emp?.nome ?? ""}`}
    />
  );
}