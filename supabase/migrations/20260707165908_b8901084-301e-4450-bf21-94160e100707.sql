-- Bloco 1 / Onda 1 — fotos de colaborador viram privadas.
-- Antes de flipar o bucket avatars pra privado, garantir que usuários
-- autenticados consigam LER (createSignedUrl exige SELECT). Ninguém anônimo
-- consegue mais bater no /object/public/avatars/... — é signed URL ou 401.
CREATE POLICY "avatars_select_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');