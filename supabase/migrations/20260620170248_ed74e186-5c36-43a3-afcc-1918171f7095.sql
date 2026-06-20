UPDATE auth.users
SET raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{full_name}', '"Francisco Bandeira Almeida"')
WHERE email = 'fbandeira.br@gmail.com';

UPDATE public.profiles
SET full_name = 'Francisco Bandeira Almeida'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'fbandeira.br@gmail.com');