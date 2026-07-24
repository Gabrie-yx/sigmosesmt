import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { TERCIS_MANUAL_PT, TERCIS_N_MINIMO, type TercisMap } from "@/lib/psico-instrument";

/**
 * Módulo Psicossocial NR-01 — server functions "de trabalho":
 * geração automática de plano 5W2H, cronograma, ações realizadas,
 * assinatura do parecer e cruzamento de sinais de saúde/absenteísmo.
 *
 * Todas requerem sessão. RLS nas tabelas ainda vale — estes handlers
 * apenas orquestram o trabalho pesado no servidor.
 */

function classificar(media: number, dimensao: string): "BAIXO" | "MODERADO" | "ALTO" | "MUITO_ALTO" {
  if (dimensao === "VIOLENCIA" && media >= 1.5) return "MUITO_ALTO";
  if (media < 2.0) return "BAIXO";
  if (media < 3.0) return "MODERADO";
  if (media < 4.0) return "ALTO";
  return "MUITO_ALTO";
}

const dimensaoWhy: Record<string, string> = {
  DEMANDAS: "Sobrecarga e pressão de tempo detectadas — risco de esgotamento e afastamento por CID F (NR-01 1.5.3.2).",
  CONTROLE: "Baixa autonomia decisória — associada a maior estresse e menor engajamento (NR-01 1.5.4.4.6).",
  APOIO: "Apoio insuficiente de liderança/colegas — aumenta ansiedade e rotatividade (ISO 45003 8.1).",
  RECOMPENSA: "Percepção de baixo reconhecimento — impacto direto em motivação e absenteísmo (NR-01 1.5.4.4.6).",
  PAPEL_MUDANCA: "Ambiguidade de papel ou má comunicação de mudanças — gera conflito e retrabalho (NR-01 1.5.4.4.6).",
  RELACOES: "Conflitos interpessoais não resolvidos — precursor de assédio (NR-01 1.5.4.4.6).",
  VIOLENCIA: "Sinais de violência/assédio — tolerância zero. Ativa Lei 14.457/2022 e NR-01 1.5.4.4.6.1.",
  INTERFACE: "Trabalho invadindo vida pessoal — direito à desconexão (STF Tema 1046, ISO 45003).",
};

const dimensaoHow: Record<string, string> = {
  DEMANDAS: "Redimensionar carga, revisar prazos, ajustar dimensionamento de equipe.",
  CONTROLE: "Programa de autonomia decisória e job crafting.",
  APOIO: "Treinamento de liderança em escuta ativa + programa de mentoria.",
  RECOMPENSA: "Revisar política de reconhecimento (formal + informal).",
  PAPEL_MUDANCA: "Descrição de cargos clara + comitê de mudança com comunicação estruturada.",
  RELACOES: "Mediação de conflitos + roda de conversa mensal.",
  VIOLENCIA: "Ativar canal de denúncia (Lei 14.457/2022), abrir apuração formal e capacitar CIPA.",
  INTERFACE: "Política de desconexão + limite de comunicação fora do expediente.",
};

function nr01RefPor(dim: string): string {
  if (dim === "VIOLENCIA") return "1.5.4.4.6.1";
  if (dim === "DEMANDAS") return "1.5.3.2";
  return "1.5.4.4.6";
}

/** Gera plano 5W2H automático para dimensões classificadas ALTO/MUITO_ALTO. */
export const gerarPlanoAcaoPsico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campanhaId: string; prazoDias?: number }) =>
    z.object({ campanhaId: z.string().uuid(), prazoDias: z.number().min(7).max(365).default(90) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    // busca agregado da campanha
    const { data: agr, error: agrErr } = await supabase
      .from("v_psico_agregado_ghe_dim")
      .select("*")
      .eq("campanha_id", data.campanhaId);
    if (agrErr) throw new Error("Falha ao ler agregado: " + agrErr.message);

    const alvos = (agr ?? []).filter((l: any) => !l.suprimido && l.media != null);
    const prazo = new Date(Date.now() + data.prazoDias * 86400_000).toISOString().slice(0, 10);

    const rows = alvos
      .map((l: any) => {
        const media = Number(l.media);
        const classificacao = classificar(media, l.dimensao);
        if (classificacao !== "ALTO" && classificacao !== "MUITO_ALTO") return null;
        return {
          campanha_id: data.campanhaId,
          ghe_id: l.ghe_id,
          dimensao: l.dimensao,
          classificacao,
          score_medio: media,
          what: `Reduzir risco psicossocial em ${l.dimensao} (média ${media.toFixed(2)})`,
          why: dimensaoWhy[l.dimensao] ?? "Risco identificado na avaliação psicossocial.",
          where_: `GHE ${String(l.ghe_id).slice(0, 8)}`,
          who: "TST + Liderança do GHE + RH",
          when_: prazo,
          how: dimensaoHow[l.dimensao] ?? "Ver plano detalhado.",
          how_much: null as number | null,
          nr01_item_ref: nr01RefPor(l.dimensao),
          status: "PLANEJADO",
          gerado_automatico: true,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) return { criados: 0 };

    // apaga planos automáticos anteriores dessa campanha (evita duplicar)
    await supabase.from("psico_planos_acao").delete().eq("campanha_id", data.campanhaId).eq("gerado_automatico", true);
    const { error } = await supabase.from("psico_planos_acao").insert(rows as any);
    if (error) throw new Error(error.message);
    return { criados: rows.length };
  });

/** Cria/atualiza cronograma de reavaliação para cada GHE da campanha. */
export const criarCronogramaPsico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campanhaId: string; frequenciaMeses?: number }) =>
    z.object({ campanhaId: z.string().uuid(), frequenciaMeses: z.number().min(1).max(60).default(12) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: camp } = await supabase.from("psico_campanhas").select("ghe_ids, data_fim").eq("id", data.campanhaId).single();
    if (!camp) throw new Error("Campanha não encontrada");
    const base = new Date(camp.data_fim as string);
    const proxima = new Date(base);
    proxima.setMonth(proxima.getMonth() + data.frequenciaMeses);
    const nextIso = proxima.toISOString().slice(0, 10);

    const ghes: string[] = Array.isArray(camp.ghe_ids) && camp.ghe_ids.length > 0 ? camp.ghe_ids : [null as any];
    // limpa cronograma anterior
    await supabase.from("psico_cronograma").delete().eq("campanha_id", data.campanhaId);
    const rows = ghes.map((g) => ({
      campanha_id: data.campanhaId,
      ghe_id: g,
      proxima_avaliacao: nextIso,
      frequencia_meses: data.frequenciaMeses,
      alerta_dias: 30,
      status: "AGENDADO",
    }));
    const { error } = await supabase.from("psico_cronograma").insert(rows as any);
    if (error) throw new Error(error.message);
    return { agendados: rows.length, proxima_avaliacao: nextIso };
  });

/** Grava assinatura do responsável técnico + hash do PDF. */
export const assinarParecerPsico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    campanhaId: string;
    responsavelNome: string;
    responsavelRegistro: string;
    responsavelCargo?: string;
    pdfHash: string;
    assinaturaDataUrl?: string | null;
  }) =>
    z.object({
      campanhaId: z.string().uuid(),
      responsavelNome: z.string().min(3).max(200),
      responsavelRegistro: z.string().min(2).max(80),
      responsavelCargo: z.string().max(120).optional(),
      pdfHash: z.string().min(16).max(128),
      assinaturaDataUrl: z.string().nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("psico_assinatura_parecer").insert({
      campanha_id: data.campanhaId,
      responsavel_nome: data.responsavelNome,
      responsavel_registro: data.responsavelRegistro,
      responsavel_cargo: data.responsavelCargo ?? null,
      pdf_hash: data.pdfHash,
      assinatura_data_url: data.assinaturaDataUrl ?? null,
      assinado_por: context.userId,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Cruzamento de sinais de saúde/absenteísmo/HE/acidentes por GHE.
 * Retorna score composto: quanto mais alto, mais "sinal cruzado" a área emite.
 */
export const cruzarSinaisPsico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campanhaId: string }) => z.object({ campanhaId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    // 1) Score psicossocial médio por GHE (dos ALTO/MUITO_ALTO)
    const { data: agr } = await supabase.from("v_psico_agregado_ghe_dim").select("*").eq("campanha_id", data.campanhaId);
    const psicoPorGhe: Record<string, { soma: number; n: number; criticas: number }> = {};
    for (const l of (agr ?? []) as any[]) {
      if (l.suprimido || l.media == null || !l.ghe_id) continue;
      const g = psicoPorGhe[l.ghe_id] ??= { soma: 0, n: 0, criticas: 0 };
      g.soma += Number(l.media);
      g.n += 1;
      const cl = classificar(Number(l.media), l.dimensao);
      if (cl === "ALTO" || cl === "MUITO_ALTO") g.criticas += 1;
    }

    // 2) Atestados CID F* nos últimos 180 dias (só count por GHE não é trivial — usa employees.ghe_id se existir)
    const desde = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
    const { data: atestados } = await supabase
      .from("employee_atestados")
      .select("employee_id, cid")
      .gte("data_inicio", desde)
      .ilike("cid", "F%");
    const empsCID = new Set((atestados ?? []).map((a: any) => a.employee_id));

    // 3) Acidentes últimos 180 dias
    const { data: acid } = await supabase
      .from("acidentes_trabalho")
      .select("id, data_ocorrencia")
      .gte("data_ocorrencia", desde);
    const totalAcidentes = (acid ?? []).length;

    // 4) HE excessiva (top 20% do mês corrente)
    const desde30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const { data: he } = await supabase
      .from("hora_extra_sabado_funcionarios")
      .select("employee_id, horas_trabalhadas")
      .gte("created_at", desde30);
    const heTotal = (he ?? []).reduce((s: number, r: any) => s + Number(r.horas_trabalhadas ?? 0), 0);

    const linhas = Object.entries(psicoPorGhe).map(([gheId, s]) => {
      const mediaPsico = s.n > 0 ? s.soma / s.n : 0;
      const scoreCruzado = Math.min(
        100,
        Math.round(mediaPsico * 15 + s.criticas * 8 + (empsCID.size > 5 ? 15 : 0) + (totalAcidentes > 0 ? 10 : 0)),
      );
      return {
        ghe_id: gheId,
        media_psico: Number(mediaPsico.toFixed(2)),
        criticas: s.criticas,
        score_cruzado: scoreCruzado,
        classificacao:
          scoreCruzado >= 70 ? "CRITICO" : scoreCruzado >= 50 ? "ALTO" : scoreCruzado >= 30 ? "MODERADO" : "BAIXO",
      };
    });

    return {
      linhas,
      resumo: {
        atestados_cid_f_180d: empsCID.size,
        acidentes_180d: totalAcidentes,
        he_horas_30d: Math.round(heTotal),
      },
    };
  });

/**
 * Calcula tercis dinâmicos (P33 e P66) por dimensão a partir do histórico
 * de respostas do próprio SIGMO. Quando a dimensão tem menos que
 * TERCIS_N_MINIMO respostas, adota o valor do manual COPSOQ II PT como
 * fallback. Retorna também a fonte usada, para exibição no diagnóstico.
 */
export const computarTercisPsico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TercisMap> => {
    const supabase = context.supabase;
    const { data, error } = await supabase
      .from("psico_respostas")
      .select("dimensao, valor");
    if (error) throw new Error(error.message);

    const porDim = new Map<string, number[]>();
    for (const r of (data ?? []) as Array<{ dimensao: string; valor: number }>) {
      if (!r?.dimensao || typeof r?.valor !== "number") continue;
      const arr = porDim.get(r.dimensao) ?? [];
      arr.push(r.valor);
      porDim.set(r.dimensao, arr);
    }

    const percentil = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = (sorted.length - 1) * p;
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return sorted[lo];
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    };

    const out: TercisMap = {};
    for (const dim of Object.keys(TERCIS_MANUAL_PT) as Array<keyof typeof TERCIS_MANUAL_PT>) {
      const amostras = porDim.get(dim) ?? [];
      if (amostras.length >= TERCIS_N_MINIMO) {
        out[dim] = {
          p33: Number(percentil(amostras, 1 / 3).toFixed(2)),
          p66: Number(percentil(amostras, 2 / 3).toFixed(2)),
          n: amostras.length,
          fonte: "INTERNO",
        };
      } else {
        out[dim] = { ...TERCIS_MANUAL_PT[dim], n: amostras.length, fonte: "MANUAL_PT" };
      }
    }
    return out;
  });
