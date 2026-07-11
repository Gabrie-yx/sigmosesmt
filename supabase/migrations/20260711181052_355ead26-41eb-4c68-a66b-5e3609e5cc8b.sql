INSERT INTO public.document_templates (codigo, nome, modulo_alvo, motor_render_id, descricao, ordem) VALUES
  ('FORCP-GP-16','Avaliação de Reação do Treinamento','trainings','reacao-treinamento-pdf','Kirkpatrick Nível 1 — anônimo, entregue no lote de Cursos Ministrados.',101),
  ('FORCP-GP-12','Avaliação de Eficácia do Treinamento','trainings',NULL,'Kirkpatrick Nível 3 — aplicado após 30-90 dias pelo superior imediato.',102)
ON CONFLICT (codigo) DO NOTHING;