ALTER TABLE public.nao_conformidades
  ALTER COLUMN data_limite TYPE text USING to_char(data_limite, 'DD/MM/YYYY'),
  ALTER COLUMN novo_prazo TYPE text USING to_char(novo_prazo, 'DD/MM/YYYY'),
  ALTER COLUMN prazo_verificacao_eficacia TYPE text USING to_char(prazo_verificacao_eficacia, 'DD/MM/YYYY'),
  ALTER COLUMN data_implementacao TYPE text USING to_char(data_implementacao, 'DD/MM/YYYY');