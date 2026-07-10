import { supabase } from "@/integrations/supabase/client";
import { gerarHoraExtraSabadoPDF } from "@/lib/hora-extra-sabado-pdf";
import { compressSignatureForPdf, compressSignaturesBatch } from "@/lib/signature-utils";
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

/**
 * Monta o PDF de uma ficha de hora extra a partir do ID. Reusado pelo
 * módulo do solicitante e pelo painel do Administrativo (Anderson) para
 * gerar / baixar / compartilhar.
 */
export async function buildHoraExtraPdf(
  id: string,
  solicitanteNome?: string | null,
): Promise<{ doc: jsPDF; fileName: string } | null> {
  const { data: rec } = await supabase
    .from("hora_extra_sabado")
    .select("*, companies(name)")
    .eq("id", id)
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
    .eq("hora_extra_id", id)
    .order("ordem");
  if (listError) throw new Error(listError.message);

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

  const d = new Date(rec.data + "T12:00:00");
  const ddmmyyyy = d.toLocaleDateString("pt-BR");
  const dia = DIAS[d.getDay()];
  const horario = rec.horario_inicio && rec.horario_fim
    ? `${rec.horario_inicio} às ${rec.horario_fim}`
    : rec.horario_inicio || "—";

  const doc = gerarHoraExtraSabadoPDF({
    data: ddmmyyyy,
    diaSemana: dia,
    turno: rec.turno,
    horario,
    setor: rec.setor,
    centroCusto: rec.centro_custo,
    tipoEfetivo: rec.tipo_efetivo as any,
    observacao: rec.observacao,
    logoDataUrl: logo,
    assinaturaTstDataUrl: tst,
    assinaturaGestorDataUrl: gestor,
    solicitanteNome:
      solicitanteNome
      ?? (rec as any).aberto_por_nome
      ?? (rec as any).criado_automatico_por_nome
      ?? null,
    empresasEnvolvidas,
    paginas,
  });

  return { doc, fileName: `hora-extra-${rec.data}.pdf` };
}