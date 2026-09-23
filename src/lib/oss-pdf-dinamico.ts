import { supabase } from "@/integrations/supabase/client";
import { buildOssPdf } from "@/lib/oss-pdf";
import { getOssCargoContent, mergeOssContent } from "@/lib/oss-cargo-content";

/**
 * Gera o PDF da OS SEMPRE a partir do cargo atual (matriz de riscos + EPIs).
 * Enquanto a OS não estiver assinada, qualquer alteração no cargo reflete
 * automaticamente — não é preciso refazer a OS.
 */
export async function buildOssPdfDinamico(emissaoId: string) {
  const { data: em, error } = await supabase
    .from("oss_emissoes")
    .select("*, employees(nome, cpf, matricula, admissao, rg, assinatura_url, companies(name, cnpj), roles(name, cbo)), oss_templates(titulo, setor, cbo)")
    .eq("id", emissaoId)
    .single();
  if (error) throw error;
  const e = em as any;

  const { data: epiRows } = await supabase.from("estoque_epi").select("nome_material, ca");
  const episCatalog = (epiRows ?? [])
    .filter((r: any) => r.nome_material && r.ca)
    .map((r: any) => ({ nome: r.nome_material as string, ca: r.ca as string }));

  let conteudo = e.conteudo_snapshot ?? {};
  try {
    const current = await getOssCargoContent(e.employee_id);
    conteudo = mergeOssContent(conteudo, current.payload);
    if (JSON.stringify(conteudo) !== JSON.stringify(e.conteudo_snapshot ?? {})) {
      await supabase.from("oss_emissoes").update({ conteudo_snapshot: conteudo } as any).eq("id", e.id);
    }
  } catch (err) {
    console.warn("[oss] não foi possível atualizar pelo cargo:", err);
  }

  const doc = buildOssPdf({
    revisao: e.template_revisao,
    emitido_em: e.emitido_em,
    expira_em: e.expira_em,
    motivo_emissao: e.motivo_emissao,
    funcionario: {
      nome: e.employees?.nome ?? "—",
      cpf: e.employees?.cpf ?? null,
      matricula: e.employees?.matricula ?? null,
      admissao: e.employees?.admissao ?? null,
      rg: e.employees?.rg ?? null,
    },
    cargo: e.cargo_snapshot,
    cbo: conteudo?.cbo ?? e.employees?.roles?.cbo ?? null,
    setor: conteudo?.setor ?? e.oss_templates?.setor ?? null,
    empresa: e.employees?.companies?.name ?? null,
    empresa_cnpj: e.employees?.companies?.cnpj ?? null,
    conteudo,
    episCatalog,
    assinaturaColaboradorDataUrl: e.employees?.assinatura_url ?? null,
  } as any);
  return { doc, name: `OS-${e.cargo_snapshot}-${e.employees?.nome ?? "func"}.pdf` };
}
