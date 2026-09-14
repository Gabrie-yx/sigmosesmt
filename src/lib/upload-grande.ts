import * as tus from "tus-js-client";
import { supabase, SUPABASE_ENDPOINT } from "@/integrations/supabase/client";

/** Acima disso usamos envio em partes (resumable/TUS). */
export const LIMITE_UPLOAD_SIMPLES = 6 * 1024 * 1024; // 6MB

/**
 * Envia um arquivo para o Storage.
 * Arquivos pequenos vão no upload normal; arquivos grandes vão em partes
 * (TUS), o que evita o erro "Failed to fetch" em PDFs de dezenas de MB.
 */
export async function uploadArquivo(
  bucket: string,
  path: string,
  file: File,
  opts?: { onProgress?: (pct: number) => void },
): Promise<void> {
  if (file.size <= LIMITE_UPLOAD_SIMPLES) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
    if (error) throw error;
    opts?.onProgress?.(100);
    return;
  }

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_ENDPOINT}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${token}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024, // exigido pelo Supabase Storage
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (err) => reject(err),
      onProgress: (sent, total) => {
        if (total) opts?.onProgress?.(Math.round((sent / total) * 100));
      },
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]!);
      upload.start();
    });
  });
}
