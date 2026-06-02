import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const EDITOR_ROLES = ["admin", "moderador", "editor", "tst"] as const;

const UploadEmployeePhotoSchema = z.object({
  employeeId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1).max(80),
  base64: z.string().min(1),
});

const EmployeePhotoIdSchema = z.object({
  employeeId: z.string().uuid(),
});

function extFromFile(fileName: string, contentType: string) {
  const rawExt = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (rawExt && /^[a-z0-9]{2,5}$/.test(rawExt) && rawExt !== "svg") return rawExt;
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";
  return "jpg";
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  if (binary.length > MAX_PHOTO_BYTES) {
    throw new Error("A foto deve ter no máximo 10MB.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

function avatarPathFromUrl(publicUrl?: string | null) {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    const marker = "/avatars/";
    const idx = url.pathname.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

async function assertCanManageEmployeePhotos(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", EDITOR_ROLES)
    .limit(1);

  if (error) throw new Error("Não foi possível validar sua permissão.");
  if (!data?.length) throw new Error("Sem permissão para alterar foto de colaborador.");
}

export const uploadEmployeePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UploadEmployeePhotoSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!ALLOWED_IMAGE_TYPES.has(data.contentType)) {
      throw new Error("Formato de imagem não permitido. Use JPG, PNG, WEBP ou GIF.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageEmployeePhotos(supabaseAdmin, context.userId);

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id, foto_url")
      .eq("id", data.employeeId)
      .single();

    if (employeeError || !employee) throw new Error("Colaborador não encontrado.");

    const ext = extFromFile(data.fileName, data.contentType);
    const path = `employees/${data.employeeId}/${Date.now()}.${ext}`;
    const body = decodeBase64(data.base64);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, body, { upsert: true, contentType: data.contentType });

    if (uploadError) throw new Error(`Erro ao gravar a foto: ${uploadError.message}`);

    const { data: publicUrl } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ foto_url: publicUrl.publicUrl })
      .eq("id", data.employeeId);

    if (updateError) {
      await supabaseAdmin.storage.from("avatars").remove([path]);
      throw new Error(`Erro ao vincular a foto ao colaborador: ${updateError.message}`);
    }

    const oldPath = avatarPathFromUrl(employee.foto_url);
    if (oldPath && oldPath !== path) {
      await supabaseAdmin.storage.from("avatars").remove([oldPath]);
    }

    return { publicUrl: publicUrl.publicUrl };
  });

export const removeEmployeePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EmployeePhotoIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageEmployeePhotos(supabaseAdmin, context.userId);

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id, foto_url")
      .eq("id", data.employeeId)
      .single();

    if (employeeError || !employee) throw new Error("Colaborador não encontrado.");

    const path = avatarPathFromUrl(employee.foto_url);
    if (path) {
      await supabaseAdmin.storage.from("avatars").remove([path]);
    }

    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ foto_url: null })
      .eq("id", data.employeeId);

    if (updateError) throw new Error(`Erro ao remover a foto: ${updateError.message}`);

    return { ok: true };
  });