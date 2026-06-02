import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TTL_MS = 60 * 60 * 1000; // 1 hour

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem gerenciar admins temporários");
}

async function cleanup(supabaseAdmin: any) {
  const nowIso = new Date().toISOString();
  const { data: expired } = await supabaseAdmin
    .from("temp_admins")
    .select("id,user_id")
    .lte("expires_at", nowIso);
  for (const t of expired ?? []) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(t.user_id);
    } catch (e) {
      console.error("Falha ao excluir auth user", t.user_id, e);
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", t.user_id);
    await supabaseAdmin.from("temp_admins").delete().eq("id", t.id);
  }
  return { removed: (expired ?? []).length };
}

export const createTempAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email().max(254),
      password: z.string().min(8).max(72),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);
    await cleanup(supabaseAdmin);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: `Admin temporário (${data.email})`, temp_admin: true },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");

    const userId = created.user.id;
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(rErr.message);
    }

    const { error: tErr } = await supabaseAdmin.from("temp_admins").insert({
      user_id: userId,
      email: data.email,
      expires_at: expiresAt,
      created_by: context.userId,
    });
    if (tErr) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(tErr.message);
    }

    return { user_id: userId, email: data.email, expires_at: expiresAt };
  });

export const cleanupExpiredTempAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);
    return cleanup(supabaseAdmin);
  });

export const revokeTempAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);
    const { data: row } = await supabaseAdmin
      .from("temp_admins")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    try { await supabaseAdmin.auth.admin.deleteUser(row.user_id); } catch (e) { console.error(e); }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", row.user_id);
    await supabaseAdmin.from("temp_admins").delete().eq("id", data.id);
    return { ok: true };
  });