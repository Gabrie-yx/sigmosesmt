import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TTL_HOURS = 48;
const ALL_MODULES = ["sesmt", "estoque", "producao", "manutencao", "portaria", "usuarios"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem gerar acessos de investidor");
}

async function cleanupExpired(supabaseAdmin: any) {
  const nowIso = new Date().toISOString();
  const { data: expired } = await supabaseAdmin
    .from("temp_investors")
    .select("id,user_id")
    .lte("expires_at", nowIso);
  for (const t of expired ?? []) {
    try { await supabaseAdmin.auth.admin.deleteUser(t.user_id); } catch (e) { console.error(e); }
    await supabaseAdmin.from("user_module_access").delete().eq("user_id", t.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", t.user_id);
    await supabaseAdmin.from("temp_investors").delete().eq("id", t.id);
  }
}

function genPassword(len = 14): string {
  // Sem caracteres ambíguos (0/O, 1/l/I)
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += charset[bytes[i] % charset.length];
  return out;
}

function genEmail(): string {
  // CSPRNG — 12 hex chars (~48 bits) para evitar enumeração
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `investidor.${suffix}@sigmo.app`;
}

export const createInvestorAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.supabase, context.userId);
    await cleanupExpired(supabaseAdmin);

    const email = genEmail();
    const password = genPassword(14);
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000).toISOString();

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Investidor (acesso temporário)", temp_investor: true },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    const userId = created.user.id;

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "viewer" });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(rErr.message);
    }

    const moduleRows = ALL_MODULES.map((m) => ({ user_id: userId, module: m, enabled: true }));
    const { error: mErr } = await supabaseAdmin.from("user_module_access").insert(moduleRows);
    if (mErr) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(mErr.message);
    }

    const { error: tErr } = await supabaseAdmin.from("temp_investors").insert({
      user_id: userId,
      email,
      expires_at: expiresAt,
      created_by: context.userId,
    });
    if (tErr) {
      await supabaseAdmin.from("user_module_access").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(tErr.message);
    }

    return { email, password, expires_at: expiresAt };
  });