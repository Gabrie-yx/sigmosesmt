INSERT INTO public.user_module_access (user_id, module, enabled)
VALUES ('e97b68f2-6d1c-4872-b0af-1a58a010de0b', 'manutencao', true)
ON CONFLICT (user_id, module) DO UPDATE
SET enabled = EXCLUDED.enabled,
    updated_at = now();

INSERT INTO public.user_menu_access (user_id, menu_key, enabled)
VALUES
  ('e97b68f2-6d1c-4872-b0af-1a58a010de0b', '/app/manutencao/eletrica/requisicao-compras', true),
  ('e97b68f2-6d1c-4872-b0af-1a58a010de0b', '/app/manutencao/mecanica/requisicao-compras', true)
ON CONFLICT (user_id, menu_key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    updated_at = now();