
CREATE POLICY "auth read inspecoes-fotos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'inspecoes-fotos');
CREATE POLICY "auth write inspecoes-fotos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'inspecoes-fotos');
CREATE POLICY "auth update inspecoes-fotos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'inspecoes-fotos') WITH CHECK (bucket_id = 'inspecoes-fotos');
CREATE POLICY "auth delete inspecoes-fotos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'inspecoes-fotos');
