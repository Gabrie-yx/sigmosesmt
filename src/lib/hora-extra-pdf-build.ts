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

/**
 * PDF consolidado: junta VÁRIAS fichas de hora extra (de setores/módulos
 * diferentes) num único formulário, agrupando os funcionários por empresa
 * — igual ao PDF gerado quando se cria a hora extra pelo painel de
 * Funcionários. Usado pelo Administrativo (Anderson) para imprimir todas
 * as convocações do dia num só arquivo.
 */
export async function buildHoraExtraConsolidadoPdf(
  ids: string[],
  opts?: { dataOverride?: string; tituloExtra?: string | null },
): Promise<{ doc: jsPDF; fileName: string } | null> {
  if (ids.length === 0) return null;

  const { data: recs, error: recsErr } = await supabase
    .from("hora_extra_sabado")
    .select("*, companies(name)")
    .in("id", ids);
  if (recsErr) throw new Error(recsErr.message);
  if (!recs || recs.length === 0) return null;

  const { data: list, error: listError } = await supabase
    .from("hora_extra_sabado_funcionarios")
    .select("*, employees(id, company_id, assinatura_url, companies(name))")
    .in("hora_extra_id", ids)
    .order("ordem");
  if (listError) throw new Error(listError.message);

  const logo = await imageToDataUrl(dmnLogo);
  const sigsCompactas = await compressSignaturesBatch(
    (list ?? []).map((f: any) => f.employees?.assinatura_url ?? null),
  );

  // Mapa id → ficha para achar a empresa padrão de cada funcionário externo.
  const recById = new Map<string, any>();
  for (const r of recs) recById.set(r.id, r);

  const grupos = new Map<string, any[]>();
  (list ?? []).forEach((f: any, idx: number) => {
    const ficha = recById.get(f.hora_extra_id);
    const empresaPadrao = ficha?.companies?.name ?? "EXTERNOS";
    const empNome =
      f.employees?.companies?.name ??
      (f.externo ? "EXTERNOS" : empresaPadrao);
    if (!grupos.has(empNome)) grupos.set(empNome, []);
    grupos.get(empNome)!.push({ ...f, _sigCompacta: sigsCompactas[idx] });
  });

  // Dedup dentro da mesma empresa (mesmo nome não repetir se estiver em duas fichas)
  for (const [emp, arr] of grupos) {
    const seen = new Set<string>();
    const dedup: any[] = [];
    for (const f of arr) {
      const key = (f.employee_id ?? `${(f.nome ?? "").toLowerCase().trim()}`);
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(f);
    }
    grupos.set(emp, dedup);
  }

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

  // Metadados do cabeçalho — todas as fichas devem ser do mesmo dia
  const dataYmd = opts?.dataOverride ?? String(recs[0].data);
  const d = new Date(dataYmd + "T12:00:00");
  const ddmmyyyy = d.toLocaleDateString("pt-BR");
  const dia = DIAS[d.getDay()];

  // Horário: pega o menor início e o maior fim entre as fichas
  const inicios = recs.map((r: any) => r.horario_inicio).filter(Boolean).sort();
  const fins = recs.map((r: any) => r.horario_fim).filter(Boolean).sort();
  const horario = inicios.length && fins.length
    ? `${inicios[0]} às ${fins[fins.length - 1]}`
    : inicios[0] ?? fins[fins.length - 1] ?? "—";

  // Turnos únicos
  const turnos = Array.from(new Set(recs.map((r: any) => r.turno).filter(Boolean)));
  const turno = turnos.length === 1 ? turnos[0] : turnos.length > 1 ? turnos.join(" / ") : null;

  // Setores: junta únicos preservando ordem
  const setoresSet = new Set<string>();
  for (const r of recs) {
    const raw = (r as any).setor as string | null;
    if (raw) raw.split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => setoresSet.add(s));
  }
  const setorConsolidado = setoresSet.size > 0 ? Array.from(setoresSet).join(" · ") : "CONSOLIDADO";

  const doc = gerarHoraExtraSabadoPDF({
    data: ddmmyyyy,
    diaSemana: dia,
    turno,
    horario,
    setor: setorConsolidado,
    centroCusto: null,
    tipoEfetivo: "DMN",
    observacao: opts?.tituloExtra ?? null,
    logoDataUrl: logo,
    assinaturaTstDataUrl: null,
    assinaturaGestorDataUrl: null,
    solicitanteNome: "Consolidado — Administrativo",
    empresasEnvolvidas,
    paginas,
  });

  return { doc, fileName: `hora-extra-consolidado-${dataYmd}.pdf` };
}