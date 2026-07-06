CREATE POLICY "ponto pdfs read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ponto-pdfs');
CREATE POLICY "ponto pdfs write auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ponto-pdfs');
CREATE POLICY "ponto pdfs update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'ponto-pdfs');
CREATE POLICY "ponto pdfs delete auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ponto-pdfs');