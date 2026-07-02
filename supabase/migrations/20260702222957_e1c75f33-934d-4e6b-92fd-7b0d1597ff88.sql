
CREATE POLICY "rc_cotacoes_bucket_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rc-cotacoes');

CREATE POLICY "rc_cotacoes_bucket_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rc-cotacoes' AND public.pode_gerenciar_compras(auth.uid()));

CREATE POLICY "rc_cotacoes_bucket_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rc-cotacoes' AND public.pode_gerenciar_compras(auth.uid()));

CREATE POLICY "rc_cotacoes_bucket_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rc-cotacoes' AND public.pode_gerenciar_compras(auth.uid()));
