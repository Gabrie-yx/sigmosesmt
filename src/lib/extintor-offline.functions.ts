import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "extintores-inspecoes";

const FileUploadSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  base64: z.string().min(1),
});

const InspecaoOfflineSchema = z.object({
  extintor_id: z.string().uuid().nullable().optional(),
  foto_etiqueta: FileUploadSchema,
  foto_manometro: FileUploadSchema,
  foto_inmetro: FileUploadSchema.nullable().optional(),
  foto_extra: FileUploadSchema.nullable().optional(),
  gps_lat: z.number().nullable().optional(),
  gps_lng: z.number().nullable().optional(),
  gps_accuracy: z.number().nullable().optional(),
  localizacao_descritiva: z.string().nullable().optional(),
  laudo_ia: z.any().nullable().optional(),
  laudo_revisado: z.any().nullable().optional(),
  dados_extraidos: z.any().nullable().optional(),
  confianca_ia: z.number().nullable().optional(),
  status_geral: z.enum(["conforme", "nao_conforme", "pendente_revisao"]),
  nao_conformidades: z.array(z.string()).default([]),
  precisa_revisao: z.boolean().default(false),
  justificativa_divergencia: z.string().nullable().optional(),
  assinatura_path: z.string().nullable().optional(),
  assinado_por_nome: z.string().nullable().optional(),
  assinado_por_cargo: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

async function uploadBase64File(
  supabase: any,
  file: z.infer<typeof FileUploadSchema>,
): Promise<string> {
  const buffer = Buffer.from(file.base64, "base64");
  const path = `${crypto.randomUUID()}-${file.name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(`Erro ao enviar ${file.name}: ${error.message}`);
  return path;
}

/**
 * Sincroniza uma inspeção de extintor criada offline.
 * Faz upload das fotos e insere o registro no banco.
 */
export const syncExtintorInspecaoOffline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InspecaoOfflineSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const [foto_etiqueta_path, foto_manometro_path, foto_inmetro_path, foto_extra_path] =
      await Promise.all([
        uploadBase64File(supabase, data.foto_etiqueta),
        uploadBase64File(supabase, data.foto_manometro),
        data.foto_inmetro ? uploadBase64File(supabase, data.foto_inmetro) : Promise.resolve(null),
        data.foto_extra ? uploadBase64File(supabase, data.foto_extra) : Promise.resolve(null),
      ]);

    const { data: row, error } = await supabase
      .from("extintor_inspecoes_fotos")
      .insert({
        extintor_id: data.extintor_id,
        foto_etiqueta_path,
        foto_manometro_path,
        foto_inmetro_path,
        foto_extra_path,
        gps_lat: data.gps_lat,
        gps_lng: data.gps_lng,
        gps_accuracy: data.gps_accuracy,
        localizacao_descritiva: data.localizacao_descritiva,
        laudo_ia: data.laudo_ia,
        laudo_revisado: data.laudo_revisado,
        dados_extraidos: data.dados_extraidos,
        confianca_ia: data.confianca_ia,
        status_geral: data.status_geral,
        nao_conformidades: data.nao_conformidades,
        precisa_revisao: data.precisa_revisao,
        justificativa_divergencia: data.justificativa_divergencia,
        assinatura_path: data.assinatura_path,
        assinado_por_nome: data.assinado_por_nome,
        assinado_por_cargo: data.assinado_por_cargo,
        observacoes: data.observacoes,
        inspecionado_por: userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
