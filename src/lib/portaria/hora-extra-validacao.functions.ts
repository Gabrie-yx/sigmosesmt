// Portaria valida hora extra do dia:
// - Dia útil (extra pós-17:30): confirma permanência às 17:30 + registra saída real.
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
  solicitante_key: string;
  solicitante_nome: string;
  solicitante_funcao: string | null;
  solicitante_setor: string | null;
  is_sabado: boolean;
  company_name: string | null;
  funcionarios: HoraExtraHojeFuncionario[];
};

export const listHoraExtraHoje = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HoraExtraHojeConvocacao[]> => {
    const nowLocal = new Date();
    const y = nowLocal.getFullYear();
    const m = String(nowLocal.getMonth() + 1).padStart(2, "0");
    const day = String(nowLocal.getDate()).padStart(2, "0");
    const hoje = `${y}-${m}-${day}`;
    const { data, error } = await context.supabase
      .from("hora_extra_sabado")
      .select(`
        id, data, horario_inicio, horario_fim, setor, centro_custo, modulo_origem,
        created_by, lider_id, aberto_por_nome, criado_automatico_por_nome,
        company:company_id(name),
        lider:lider_id(
          id, observacao,
          employee:employee_id(id, nome, setor, roles(name))
        ),
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

    const one = (v: any) => Array.isArray(v) ? v[0] : v;
    const createdByIds = Array.from(new Set((data ?? []).map((c: any) => c.created_by).filter(Boolean)));
    const liderPorUser = new Map<string, any>();
    const marcadorPorUser = new Map<string, any>();
    const employeePorId = new Map<string, any>();
    const employeePorNome = new Map<string, any>();
    if (createdByIds.length > 0) {
      const [{ data: lideres }, { data: marcadores }] = await Promise.all([
        context.supabase
          .from("hora_extra_lideres")
          .select("user_id, observacao, employee:employee_id(id, nome, setor, roles(name))")
          .in("user_id", createdByIds),
        context.supabase
          .from("hora_extra_marcadores")
          .select("user_id, nome, self_employee_id")
          .in("user_id", createdByIds),
      ]);
      (lideres ?? []).forEach((l: any) => { if (l.user_id) liderPorUser.set(l.user_id, l); });
      (marcadores ?? []).forEach((m: any) => { if (m.user_id) marcadorPorUser.set(m.user_id, m); });

      const nomesSolicitantes = Array.from(new Set(
        [
          ...(data ?? []).flatMap((c: any) => [c.aberto_por_nome, c.criado_automatico_por_nome]),
          ...(marcadores ?? []).map((m: any) => m.nome),
        ]
          .filter(Boolean),
      ));
      const employeeIds = Array.from(new Set((marcadores ?? []).map((m: any) => m.self_employee_id).filter(Boolean)));
      if (nomesSolicitantes.length > 0 || employeeIds.length > 0) {
        let q = context.supabase.from("employees").select("id, nome, setor, roles(name)");
        if (employeeIds.length > 0) q = q.in("id", employeeIds);
        const { data: empsById } = employeeIds.length > 0 ? await q : { data: [] as any[] };
        (empsById ?? []).forEach((e: any) => {
          employeePorId.set(String(e.id), e);
          employeePorNome.set(String(e.nome).toLowerCase(), e);
        });
        const { data: emps } = await context.supabase
          .from("employees")
          .select("id, nome, setor, roles(name)")
          .in("nome", nomesSolicitantes);
        (emps ?? []).forEach((e: any) => employeePorNome.set(String(e.nome).toLowerCase(), e));
      }
    }

    return (data ?? []).map((c: any) => {
      // Detecta sábado pela data (evita depender de campo texto).
      const [y, m, d] = String(c.data).split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
      const is_sabado = dt.getDay() === 6;
      const liderRel = one(c.lider);
      const liderByUser = c.created_by ? liderPorUser.get(c.created_by) : null;
      const marcadorByUser = c.created_by ? marcadorPorUser.get(c.created_by) : null;
      const employeeBySolicitanteName = (c.aberto_por_nome ?? c.criado_automatico_por_nome)
        ? employeePorNome.get(String(c.aberto_por_nome ?? c.criado_automatico_por_nome).toLowerCase())
        : null;
      const employeeByMarcador = marcadorByUser?.self_employee_id
        ? employeePorId.get(String(marcadorByUser.self_employee_id))
        : marcadorByUser?.nome
          ? employeePorNome.get(String(marcadorByUser.nome).toLowerCase())
          : null;
      const liderEmployee = one(
        liderRel?.employee
        ?? liderRel?.employees
        ?? liderByUser?.employee
        ?? liderByUser?.employees
        ?? employeeByMarcador
        ?? employeeBySolicitanteName,
      );
      const liderRole = one(liderEmployee?.roles);
      const solicitanteNome =
        liderEmployee?.nome ?? marcadorByUser?.nome ?? c.aberto_por_nome ?? c.criado_automatico_por_nome ?? "Solicitante";
      const solicitanteFuncao = liderRole?.name ?? liderRel?.observacao ?? liderByUser?.observacao ?? "Convocador de hora extra";
      const solicitanteSetor = liderEmployee?.setor ?? c.setor ?? c.modulo_origem ?? null;
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
        solicitante_key: String(c.lider_id ?? c.created_by ?? solicitanteNome ?? c.id),
        solicitante_nome: solicitanteNome,
        solicitante_funcao: solicitanteFuncao,
        solicitante_setor: solicitanteSetor,
        is_sabado,
        company_name: one(c.company)?.name ?? null,
        funcionarios: funcs,
      };
    });
  });

export const confirmarValidacaoPortaria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfirmarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: perfil } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const nome = (perfil?.full_name || "Portaria") as string;
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
      .update(patch as any)
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
      .update(patch as any)
      .eq("id", data.funcionarioId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });