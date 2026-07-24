import { supabase } from "@/integrations/supabase/client";
import { compressSignatureForPdf, compressSignaturesBatch } from "@/lib/signature-utils";
import { gerarHoraExtraSabadoPDF } from "@/lib/hora-extra-sabado-pdf";
import dmnLogo from "@/assets/dmn-logo.png";
import type jsPDF from "jspdf";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

async function imageToDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export type BuildHoraExtraSabadoPdfInput = {
  fichaId: string;
  solicitanteNome?: string | null;
};

export type BuildHoraExtraSabadoPdfResult = {
  doc: jsPDF;
  fileName: string;
};

/**
 * Reconstrói o PDF oficial da ficha de Hora Extra / Sábado a partir do ID.
 * Mesma lógica usada no desktop (app.employees.hora-extra-sabado) para que a
 * versão mobile (/extra-sabado) gere um documento idêntico e possa
 * compartilhar via WhatsApp/Web Share.
 */
export async function buildHoraExtraSabadoPdf(
  input: BuildHoraExtraSabadoPdfInput,
): Promise<BuildHoraExtraSabadoPdfResult | null> {
  const { fichaId, solicitanteNome } = input;

  const { data: rec } = await supabase
    .from("hora_extra_sabado")
    .select("*, companies(name)")
    .eq("id", fichaId)
    .maybeSingle();
  if (!rec) return null;

  const tstRaw = (rec as any).assinatura_tst_data ?? null;
  const gestorRaw = (rec as any).assinatura_gestor_data ?? null;
  const [tst, gestor] = await Promise.all([
    compressSignatureForPdf(tstRaw),
    compressSignatureForPdf(gestorRaw),
  ]);

  const { data: list, error: listError } = await supabase
    .from("hora_extra_sabado_funcionarios")
    .select("*, employees(id, company_id, assinatura_url, companies(name))")
    .eq("hora_extra_id", fichaId)
    .order("ordem");
  if (listError) throw listError;

  const logo = await imageToDataUrl(dmnLogo);

  const sigsCompactas = await compressSignaturesBatch(
    (list ?? []).map((f: any) => f.employees?.assinatura_url ?? null),
  );
  const empresaPadrao = (rec as any).companies?.name ?? "EXTERNOS";
  const grupos = new Map<string, any[]>();
  (list ?? []).forEach((f: any, idx: number) => {
    const empNome =
      f.employees?.companies?.name ??
      (f.externo ? "EXTERNOS" : empresaPadrao);
    if (!grupos.has(empNome)) grupos.set(empNome, []);
    grupos.get(empNome)!.push({ ...f, _sigCompacta: sigsCompactas[idx] });
  });
  const ordenadas = Array.from(grupos.entries()).sort(([a], [b]) => {
    if (a === "EXTERNOS") return 1;
    if (b === "EXTERNOS") return -1;
    return a.localeCompare(b, "pt-BR");
  });
  const empresasEnvolvidas = ordenadas.map(([e]) => e);
  const paginas = ordenadas.map(([empresaNome, fs]) => ({
    empresaNome,
    funcionarios: fs.map((f: any) => ({
      nome: f.nome,
      transporte: f.transporte,
      alimentacao: f.alimentacao,
      presenca: f.presenca,
      assinaturaDataUrl: f._sigCompacta ?? f.employees?.assinatura_url ?? null,
    })),
  }));

  const d = new Date((rec as any).data + "T12:00:00");
  const ddmmyyyy = d.toLocaleDateString("pt-BR");
  const dia = DIAS[d.getDay()];
  const horario =
    (rec as any).horario_inicio && (rec as any).horario_fim
      ? `${(rec as any).horario_inicio} às ${(rec as any).horario_fim}`
      : (rec as any).horario_inicio || "—";

  const doc = gerarHoraExtraSabadoPDF({
    data: ddmmyyyy,
    diaSemana: dia,
    turno: (rec as any).turno,
    horario,
    setor: (rec as any).setor,
    centroCusto: (rec as any).centro_custo,
    tipoEfetivo: (rec as any).tipo_efetivo as any,
    observacao: (rec as any).observacao,
    logoDataUrl: logo,
    assinaturaTstDataUrl: tst,
    assinaturaGestorDataUrl: gestor,
    solicitanteNome: solicitanteNome ?? null,
    empresasEnvolvidas,
    paginas,
  });

  return {
    doc,
    fileName: `hora-extra-${(rec as any).data}.pdf`,
  };
}