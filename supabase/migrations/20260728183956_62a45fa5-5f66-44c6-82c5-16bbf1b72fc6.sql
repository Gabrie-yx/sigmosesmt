ALTER TABLE public.oss_templates
  ADD COLUMN IF NOT EXISTS origem_riscos TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS riscos_hash TEXT,
  ADD COLUMN IF NOT EXISTS riscos_sincronizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complemento_sesmt TEXT,
  ADD COLUMN IF NOT EXISTS pgr_versao_id UUID REFERENCES public.pgr_versoes(id);

ALTER TABLE public.oss_emissoes
  ADD COLUMN IF NOT EXISTS riscos_hash TEXT,
  ADD COLUMN IF NOT EXISTS origem_riscos TEXT,
  ADD COLUMN IF NOT EXISTS pgr_versao_id UUID REFERENCES public.pgr_versoes(id);

CREATE INDEX IF NOT EXISTS idx_oss_templates_pgr_versao ON public.oss_templates(pgr_versao_id);
CREATE INDEX IF NOT EXISTS idx_oss_emissoes_pgr_versao ON public.oss_emissoes(pgr_versao_id);

UPDATE public.oss_templates t
SET pgr_versao_id = v.id
FROM public.pgr_versoes v
WHERE v.status = 'VIGENTE' AND t.pgr_versao_id IS NULL;

UPDATE public.oss_templates
SET riscos_hash = md5(concat_ws('|', coalesce(riscos_texto,''), coalesce(risco_fisico,''), coalesce(risco_quimico,''), coalesce(risco_biologico,''), coalesce(risco_ergonomico,''), coalesce(risco_acidente,''), coalesce(risco_psicossocial,''))),
    riscos_sincronizado_em = coalesce(riscos_sincronizado_em, now())
WHERE riscos_hash IS NULL;