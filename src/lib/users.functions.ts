import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODULES = ["sesmt", "estoque", "producao", "manutencao", "portaria", "usuarios"] as const;
const ROLES = ["admin", "moderador", "editor", "viewer"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem gerenciar usuários");
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email().max(254),
      full_name: z.string().min(2).max(120),
      role: z.enum(ROLES),
      modules: z.array(z.enum(MODULES)).default([]),
      redirect_to: z.string().url(),
    })
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    // Cria registro de convite (papel + módulos serão aplicados via trigger ao aceitar)
    const { error: invErr } = await supabaseAdmin.from("user_invites").insert({
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      modules: data.modules,
      invited_by: context.userId,
    });
    if (invErr) throw new Error(invErr.message);

    // Envia o email padrão do Supabase com link para definir senha
    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name },
      redirectTo: data.redirect_to,
    });
    if (mailErr) {
      // se falhar o email, remove o convite para não ficar órfão
      await supabaseAdmin.from("user_invites").delete().eq("email", data.email).is("accepted_at", null);
      throw new Error(mailErr.message);
    }

    return { ok: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ invite_id: z.string().uuid(), redirect_to: z.string().url() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: inv, error } = await supabaseAdmin
      .from("user_invites")
      .select("email, full_name")
      .eq("id", data.invite_id)
      .maybeSingle();
    if (error || !inv) throw new Error("Convite não encontrado");
    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
      data: { full_name: inv.full_name },
      redirectTo: data.redirect_to,
    });
    if (mailErr) throw new Error(mailErr.message);
    return { ok: true };
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ invite_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.from("user_invites").delete().eq("id", data.invite_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid(), role: z.enum(ROLES) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      modules: z.array(z.enum(MODULES)),
    })
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Apaga e reinsere
    await supabaseAdmin.from("user_module_access").delete().eq("user_id", data.user_id);
    if (data.modules.length > 0) {
      const rows = data.modules.map((m) => ({ user_id: data.user_id, module: m, enabled: true }));
      const { error } = await supabaseAdmin.from("user_module_access").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode remover a si mesmo");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_module_access").delete().eq("user_id", data.user_id);
    try {
      await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    } catch (e) {
      console.error("auth.admin.deleteUser falhou", e);
    }
    return { ok: true };
  });

export const listUsersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);

    const ids = list.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }, { data: mods }, { data: invites }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("user_module_access").select("user_id, module, enabled").in("user_id", ids),
      supabaseAdmin.from("user_invites").select("*").is("accepted_at", null).order("created_at", { ascending: false }),
    ]);

    const users = list.users.map((u) => {
      const factors = (u as any).factors ?? [];
      const mfaActive = factors.some((f: any) => f.status === "verified");
      return {
        id: u.id,
        email: u.email ?? "",
        full_name: profiles?.find((p) => p.id === u.id)?.full_name ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
        mfa_active: mfaActive,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as string),
        modules: (mods ?? []).filter((m) => m.user_id === u.id && m.enabled).map((m) => m.module as string),
      };
    });

    return { users, invites: invites ?? [] };
  });