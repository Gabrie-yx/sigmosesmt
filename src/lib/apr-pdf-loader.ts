import { supabase } from "@/integrations/supabase/client";
import { gerarAPR, type APRPdfRisco, type APRPdfAssinatura } from "@/lib/apr-pdf";
import { formatDateBR } from "@/lib/utils-date";
import dmnLogo from "@/assets/dmn-logo.png";

export async function buildAprPdf(aprId: string, opts?: { encSig?: string | null; tstSig?: string | null }) {
  const [{ data: a }, { data: rs }, { data: ass }] = await Promise.all([
    supabase.from("aprs").select("*").eq("id", aprId).maybeSingle(),
    supabase.from("apr_riscos").select("*").eq("apr_id", aprId).order("ordem"),
    supabase.from("apr_assinaturas").select("*").eq("apr_id", aprId).order("papel").order("ordem"),
  ]);
  if (!a) throw new Error("APR não encontrada");

  const apr: any = a;
  const [empresaQ, cascoQ, encQ, tstQ, pteQ, ptesLinkQ] = await Promise.all([
    apr.empresa_id ? supabase.from("companies").select("name,cnpj").eq("id", apr.empresa_id).maybeSingle() : Promise.resolve({ data: null } as any),
    apr.casco_id ? supabase.from("cascos").select("numero,nome").eq("id", apr.casco_id).maybeSingle() : Promise.resolve({ data: null } as any),
    apr.encarregado_id ? supabase.from("employees").select("nome").eq("id", apr.encarregado_id).maybeSingle() : Promise.resolve({ data: null } as any),
    apr.tst_id ? supabase.from("employees").select("nome").eq("id", apr.tst_id).maybeSingle() : Promise.resolve({ data: null } as any),
    apr.pte_id ? supabase.from("ptes").select("numero").eq("id", apr.pte_id).maybeSingle() : Promise.resolve({ data: null } as any),
    supabase.from("ptes").select("numero").eq("apr_id", aprId),
  ]);
  const empresa: any = empresaQ.data;
  const casco: any = cascoQ.data;
  const enc: any = encQ.data;
  const tst: any = tstQ.data;
  const pte: any = pteQ.data;
  const ptesVinculadas = (ptesLinkQ.data ?? []).map((p: any) => p.numero).filter(Boolean);

  return gerarAPR({
    logoUrl: dmnLogo,
    matrizNome: "J C S CONSTRUÇÃO NAVAL LTDA",
    matrizCnpj: "13.378.697/0001-80",
    numero: apr.numero ?? "APR-RASCUNHO",
    data_emissao: formatDateBR(apr.data_emissao),
    data_inicio: apr.data_emissao ? formatDateBR(apr.data_emissao) : null,
    data_fim: apr.data_validade ? formatDateBR(apr.data_validade) : null,
    hora_inicio: apr.hora_inicio,
    hora_fim: apr.hora_fim,
    hora_inicio_sexta: apr.hora_inicio_sexta,
    hora_fim_sexta: apr.hora_fim_sexta,
    dias_semana: apr.dias_semana ?? null,
    validade_dias: apr.validade_dias ?? null,
    data_validade: apr.data_validade ? formatDateBR(apr.data_validade) : null,
    empresa_nome: empresa?.name ?? null,
    empresa_cnpj: empresa?.cnpj ?? null,
    casco_numero: casco?.numero ?? null,
    casco_nome: casco?.nome ?? null,
    local: apr.local,
    setor: apr.setor,
    atividade: apr.atividade_descricao,
    servico_detalhado: apr.observacoes_gerais ?? null,
    elaborado_por: tst?.nome ?? null,
    encarregado: empresa?.name ?? enc?.nome,
    tst: tst?.nome,
    pte_numero: pte?.numero ?? null,
    condicoes_climaticas: apr.condicoes_climaticas,
    observacoes: apr.observacoes_gerais,
    texto_gerais: apr.texto_gerais ?? null,
    exige_pte: !!apr.exige_pte,
    ptes_vinculadas: ptesVinculadas,
    riscos: (rs ?? []).map((r: any) => ({
      ordem: r.ordem,
      passo: r.passo_a_passo ?? null,
      risco_nome: r.risco_nome,
      risco_categoria: r.risco_categoria,
      efeitos_danos: r.efeitos_danos,
      probabilidade: r.probabilidade,
      severidade: r.severidade,
      nivel_risco: r.probabilidade + r.severidade,
      acoes_preventivas: r.acoes_preventivas,
      epis: r.epis ?? [],
      nrs: r.nrs ?? [],
      responsavel_acoes: r.responsavel_acoes,
    } as APRPdfRisco)),
    assinaturas: (ass ?? []).map((a: any) => ({
      papel: a.papel, nome: a.nome, cpf: a.cpf, funcao: a.funcao,
    } as APRPdfAssinatura)),
    encSig: opts?.encSig ?? null,
    tstSig: opts?.tstSig ?? null,
  });
}

export async function abrirAprPdf(aprId: string) {
  const doc = await buildAprPdf(aprId);
  window.open(doc.output("bloburl"), "_blank");
}

export async function imprimirAprPdf(aprId: string) {
  const doc = await buildAprPdf(aprId);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

export async function baixarAprPdf(aprId: string, numero?: string | null) {
  const doc = await buildAprPdf(aprId);
  doc.save(`${numero ?? "apr"}.pdf`);
}