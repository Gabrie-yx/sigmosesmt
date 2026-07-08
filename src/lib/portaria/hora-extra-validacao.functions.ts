// Portaria valida hora extra do dia:
// - Dia útil (extra pós-17h): confirma permanência às 17h + registra saída real.
// - Sábado: registra entrada + saída.
// Só aparece na portaria quem está em convocação APROVADA e do dia de hoje.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoValidacao = z.enum(["permanencia", "entrada", "saida"]);

const ConfirmarSchema = z.object({
  funcionarioId: z.string().uuid(),
  tipo: TipoValidacao,
});

const DesfazerSchema = ConfirmarSchema;

function ymdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type HoraExtraHojeFuncionario = {
  id: string;
  hora_extra_id: string;
  nome: string;
  funcao: string | null;
  externo: boolean;
  employee_id: string | null;
  foto_url: string | null;
  permanencia_confirmada_at: string | null;
  permanencia_confirmada_por_nome: string | null;
  entrada_confirmada_at: string | null;
  entrada_confirmada_por_nome: string | null;
  saida_confirmada_at: string | null;
  saida_confirmada_por_nome: string | null;
};

export type HoraExtraHojeConvocacao = {
  id: string;
  data: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  setor: string | null;
  centro_custo: string | null;
  modulo_origem: string | null;
  is_sabado: boolean;
  company_name: string | null;
  funcionarios: HoraExtraHojeFuncionario[];
};

export const listHoraExtraHoje = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HoraExtraHojeConvocacao[]> => {
    const hoje = ymdLocal();
    const { data, error } = await context.supabase
      .from("hora_extra_sabado")
      .select(`
        id, data, horario_inicio, horario_fim, setor, centro_custo, modulo_origem,
        company:company_id(name),
        funcionarios:hora_extra_sabado_funcionarios(
          id, hora_extra_id, nome, funcao, externo, employee_id,
          permanencia_confirmada_at, permanencia_confirmada_por_nome,
          entrada_confirmada_at, entrada_confirmada_por_nome,
          saida_confirmada_at, saida_confirmada_por_nome,
          employees:employee_id(foto_url)
        )
      `)
      .eq("data", hoje)
      .eq("status", "APROVADA")
      .is("deleted_at", null)
      .order("horario_inicio", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((c: any) => {
      // Detecta sábado pela data (evita depender de campo texto).
      const [y, m, d] = String(c.data).split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
      const is_sabado = dt.getDay() === 6;
      const funcs = (c.funcionarios ?? [])
        .filter((f: any) => !f.deleted_at)
        .map((f: any) => ({
          id: f.id,
          hora_extra_id: f.hora_extra_id,
          nome: f.nome,
          funcao: f.funcao,
          externo: !!f.externo,
          employee_id: f.employee_id,
          foto_url: f.employees?.foto_url ?? null,
          permanencia_confirmada_at: f.permanencia_confirmada_at,
          permanencia_confirmada_por_nome: f.permanencia_confirmada_por_nome,
          entrada_confirmada_at: f.entrada_confirmada_at,
          entrada_confirmada_por_nome: f.entrada_confirmada_por_nome,
          saida_confirmada_at: f.saida_confirmada_at,
          saida_confirmada_por_nome: f.saida_confirmada_por_nome,
        }));
      return {
        id: c.id,
        data: c.data,
        horario_inicio: c.horario_inicio,
        horario_fim: c.horario_fim,
        setor: c.setor,
        centro_custo: c.centro_custo,
        modulo_origem: c.modulo_origem,
        is_sabado,
        company_name: c.company?.name ?? null,
        funcionarios: funcs,
      };
    });
  });

async function nomeDoUsuario(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("full_name,email").eq("id", userId).maybeSingle();
  return (data?.full_name || data?.email || "Portaria") as string;
}

export const confirmarValidacaoPortaria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfirmarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const nome = await nomeDoUsuario(context.supabase, context.userId);
    const now = new Date().toISOString();
    const patch: Record<string, any> = {};
    if (data.tipo === "permanencia") {
      patch.permanencia_confirmada_at = now;
      patch.permanencia_confirmada_por = context.userId;
      patch.permanencia_confirmada_por_nome = nome;
    } else if (data.tipo === "entrada") {
      patch.entrada_confirmada_at = now;
      patch.entrada_confirmada_por = context.userId;
      patch.entrada_confirmada_por_nome = nome;
    } else {
      patch.saida_confirmada_at = now;
      patch.saida_confirmada_por = context.userId;
      patch.saida_confirmada_por_nome = nome;
    }
    const { error } = await context.supabase
      .from("hora_extra_sabado_funcionarios")
      .update(patch)
      .eq("id", data.funcionarioId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const desfazerValidacaoPortaria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DesfazerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Só administradores podem desfazer validações.");
    const patch: Record<string, any> = {};
    if (data.tipo === "permanencia") {
      patch.permanencia_confirmada_at = null;
      patch.permanencia_confirmada_por = null;
      patch.permanencia_confirmada_por_nome = null;
    } else if (data.tipo === "entrada") {
      patch.entrada_confirmada_at = null;
      patch.entrada_confirmada_por = null;
      patch.entrada_confirmada_por_nome = null;
    } else {
      patch.saida_confirmada_at = null;
      patch.saida_confirmada_por = null;
      patch.saida_confirmada_por_nome = null;
    }
    const { error } = await context.supabase
      .from("hora_extra_sabado_funcionarios")
      .update(patch)
      .eq("id", data.funcionarioId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });