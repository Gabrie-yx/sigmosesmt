ALTER TABLE public.assinaturas_termos_consentimento
  ADD COLUMN IF NOT EXISTS consente_imagem boolean,
  ADD COLUMN IF NOT EXISTS modalidade text NOT NULL DEFAULT 'ELETRONICA',
  ADD COLUMN IF NOT EXISTS scan_path text,
  ADD COLUMN IF NOT EXISTS scan_url text,
  ADD COLUMN IF NOT EXISTS versao_termo integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS dispositivo text,
  ADD COLUMN IF NOT EXISTS dpo_nome text,
  ADD COLUMN IF NOT EXISTS dpo_email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assinaturas_termos_modalidade_chk'
  ) THEN
    ALTER TABLE public.assinaturas_termos_consentimento
      ADD CONSTRAINT assinaturas_termos_modalidade_chk
      CHECK (modalidade IN ('ELETRONICA', 'PAPEL_DIGITALIZADO'));
  END IF;
END $$;

UPDATE public.assinaturas_termos_consentimento
SET versao_termo = 1
WHERE versao_termo IS NULL;

COMMENT ON COLUMN public.assinaturas_termos_consentimento.consente_imagem IS
  'Opt-in explícito para uso da foto no sistema. NULL = termo antigo (v1) sem escolha registrada em coluna própria.';
COMMENT ON COLUMN public.assinaturas_termos_consentimento.versao_termo IS
  '1 = modelo antigo (com ratificação retroativa); 2 = modelo LGPD em 3 blocos.';