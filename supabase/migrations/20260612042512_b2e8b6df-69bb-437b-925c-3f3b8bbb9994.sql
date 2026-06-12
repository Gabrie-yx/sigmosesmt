ALTER TABLE public.catalogo_riscos
  ADD COLUMN IF NOT EXISTS codigo_esocial TEXT,
  ADD COLUMN IF NOT EXISTS aposentadoria_especial_anos INT;

CREATE INDEX IF NOT EXISTS catalogo_riscos_codigo_esocial_idx
  ON public.catalogo_riscos (codigo_esocial)
  WHERE codigo_esocial IS NOT NULL AND codigo_esocial <> '';

COMMENT ON COLUMN public.catalogo_riscos.codigo_esocial IS 'Código oficial do agente nocivo (eSocial Tabela 23) — usado em S-2240 e PPP';
COMMENT ON COLUMN public.catalogo_riscos.aposentadoria_especial_anos IS 'Anos exigidos para aposentadoria especial conforme Anexo IV Dec. 3.048/99 (15/20/25), quando aplicável';

CREATE TEMP TABLE _t23 (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  anos INT
) ON COMMIT DROP;

INSERT INTO _t23 (codigo, nome, categoria, anos) VALUES
('01.01.001','Arsênico e seus compostos','QUIMICO',25),
('01.02.001','Asbestos (amianto)','QUIMICO',25),
('01.03.001','Benzeno e seus compostos tóxicos','QUIMICO',25),
('01.04.001','Berílio e seus compostos tóxicos','QUIMICO',25),
('01.05.001','Bromo','QUIMICO',25),
('01.06.001','Cádmio e seus compostos','QUIMICO',25),
('01.07.001','Chumbo e seus compostos','QUIMICO',25),
('01.08.001','Cloro','QUIMICO',25),
('01.09.001','Carvão mineral e seus derivados','QUIMICO',25),
('01.10.001','Cromo e seus compostos tóxicos','QUIMICO',25),
('01.11.001','Dissulfeto de carbono','QUIMICO',25),
('01.12.001','Fósforo e seus compostos tóxicos','QUIMICO',25),
('01.13.001','Iodo','QUIMICO',25),
('01.14.001','Manganês e seus compostos','QUIMICO',25),
('01.15.001','Mercúrio e seus compostos','QUIMICO',25),
('01.16.001','Níquel e seus compostos tóxicos','QUIMICO',25),
('01.17.001','Petróleo, xisto betuminoso, gás natural e seus derivados','QUIMICO',25),
('01.18.001','Sílica livre','QUIMICO',25),
('01.19.001','Carbonetos metálicos (cobalto e tungstênio)','QUIMICO',25),
('01.20.001','Acrilonitrila','QUIMICO',25),
('01.20.002','Aldrin','QUIMICO',25),
('01.20.003','Anilina e homólogos','QUIMICO',25),
('01.20.004','Azida','QUIMICO',25),
('01.20.005','Benzopireno','QUIMICO',25),
('01.20.006','Bismuto','QUIMICO',25),
('01.20.007','Bióxido de manganês','QUIMICO',25),
('01.20.008','Brometo de metila','QUIMICO',25),
('01.20.009','Chumbo tetraetila','QUIMICO',25),
('01.20.010','Cianetos','QUIMICO',25),
('01.20.011','Clordane','QUIMICO',25),
('01.20.012','Cloreto de vinila','QUIMICO',25),
('01.20.013','Cloroprene','QUIMICO',25),
('01.20.014','DDT (dicloro-difenil-tricloretano)','QUIMICO',25),
('01.20.015','Dibromo cloropropano','QUIMICO',25),
('01.20.016','Dimetilnitrosamina','QUIMICO',25),
('01.20.017','Dioxinas e furanos','QUIMICO',25),
('01.20.018','Estricnina','QUIMICO',25),
('01.20.019','Fluor e seus compostos','QUIMICO',25),
('01.20.020','Formaldeído','QUIMICO',25),
('01.20.021','Fosgênio','QUIMICO',25),
('01.20.022','Gás sulfídrico','QUIMICO',25),
('01.20.023','Heptacloro','QUIMICO',25),
('01.20.024','Hexaclorobenzeno','QUIMICO',25),
('01.20.025','Hidrazinas','QUIMICO',25),
('01.20.026','Isocianatos','QUIMICO',25),
('01.20.027','Lindane','QUIMICO',25),
('01.20.028','Mercaptanos','QUIMICO',25),
('01.20.029','Metanol','QUIMICO',25),
('01.20.030','Monóxido de carbono','QUIMICO',25),
('01.20.031','Nitritos e nitratos','QUIMICO',25),
('01.20.032','Óxidos de nitrogênio','QUIMICO',25),
('01.20.033','Ozônio','QUIMICO',25),
('01.20.034','Parathion','QUIMICO',25),
('01.20.035','Pentaclorofenol','QUIMICO',25),
('01.20.036','Selênio e seus compostos','QUIMICO',25),
('01.20.037','Sulfeto de carbono','QUIMICO',25),
('01.20.038','Tálio','QUIMICO',25),
('01.20.039','Tetracloreto de carbono','QUIMICO',25),
('01.20.040','Tolueno','QUIMICO',25),
('01.20.041','Tricloroetileno','QUIMICO',25),
('01.20.042','Urânio e seus compostos','QUIMICO',25),
('01.20.043','Vanádio e seus compostos','QUIMICO',25),
('01.20.044','Xileno','QUIMICO',25),
('01.20.045','Outros agentes químicos avaliados quantitativamente','QUIMICO',25),
('01.21.001','Poeira de madeira','QUIMICO',25),
('01.22.001','Fumos metálicos (solda)','QUIMICO',25),
('01.23.001','Névoas e neblinas de ácidos (sulfúrico, nítrico, clorídrico)','QUIMICO',25),
('01.24.001','Hidrocarbonetos aromáticos policíclicos','QUIMICO',25),
('02.01.001','Ruído','FISICO',25),
('02.01.002','Vibrações localizadas (mão-braço)','FISICO',25),
('02.01.003','Vibrações de corpo inteiro','FISICO',25),
('02.01.004','Calor (sobrecarga térmica - IBUTG)','FISICO',25),
('02.01.005','Radiações ionizantes','FISICO',25),
('02.01.006','Pressão atmosférica anormal (trabalho hiperbárico)','FISICO',25),
('02.01.007','Frio','FISICO',NULL),
('02.01.008','Umidade','FISICO',NULL),
('02.01.009','Radiações não-ionizantes (UV, IR, micro-ondas, laser)','FISICO',NULL),
('03.01.001','Microorganismos e parasitas infecciosos vivos e suas toxinas — área da saúde','BIOLOGICO',25),
('03.01.002','Trabalhos em laboratórios de pesquisa com microorganismos','BIOLOGICO',25),
('03.01.003','Trabalhos com animais infectados','BIOLOGICO',25),
('03.01.004','Coleta e industrialização de lixo','BIOLOGICO',25),
('03.01.005','Esgotos (galerias e tanques)','BIOLOGICO',25),
('04.01.001','Associação de agentes nocivos','OUTROS',25),
('05.01.001','Ausência de agente nocivo ou de atividade prevista em legislação','OUTROS',NULL);

-- match exato por nome (ignora caixa/acento)
UPDATE public.catalogo_riscos cr
   SET codigo_esocial = t.codigo,
       aposentadoria_especial_anos = COALESCE(cr.aposentadoria_especial_anos, t.anos)
  FROM _t23 t
 WHERE cr.codigo_esocial IS NULL
   AND public.unaccent(lower(btrim(cr.nome))) = public.unaccent(lower(btrim(t.nome)));

-- match por palavra-chave para nomes comuns
UPDATE public.catalogo_riscos cr
   SET codigo_esocial = t.codigo,
       aposentadoria_especial_anos = COALESCE(cr.aposentadoria_especial_anos, t.anos)
  FROM _t23 t
 WHERE cr.codigo_esocial IS NULL
   AND (
        (t.codigo='02.01.001' AND public.unaccent(lower(cr.nome)) LIKE '%ruido%')
     OR (t.codigo='02.01.004' AND public.unaccent(lower(cr.nome)) LIKE '%calor%')
     OR (t.codigo='02.01.002' AND public.unaccent(lower(cr.nome)) LIKE '%vibra%' AND public.unaccent(lower(cr.nome)) LIKE '%mao%')
     OR (t.codigo='02.01.003' AND public.unaccent(lower(cr.nome)) LIKE '%vibra%' AND public.unaccent(lower(cr.nome)) LIKE '%corpo%')
     OR (t.codigo='02.01.005' AND public.unaccent(lower(cr.nome)) LIKE '%radia%ionizante%' AND public.unaccent(lower(cr.nome)) NOT LIKE '%nao%ionizante%')
     OR (t.codigo='02.01.009' AND public.unaccent(lower(cr.nome)) LIKE '%nao%ionizante%')
     OR (t.codigo='02.01.009' AND public.unaccent(lower(cr.nome)) LIKE '%ultravioleta%')
     OR (t.codigo='02.01.007' AND public.unaccent(lower(cr.nome)) LIKE '%frio%')
     OR (t.codigo='02.01.008' AND public.unaccent(lower(cr.nome)) LIKE '%umidade%')
     OR (t.codigo='01.18.001' AND public.unaccent(lower(cr.nome)) LIKE '%silica%')
     OR (t.codigo='01.02.001' AND (public.unaccent(lower(cr.nome)) LIKE '%amianto%' OR public.unaccent(lower(cr.nome)) LIKE '%asbesto%'))
     OR (t.codigo='01.22.001' AND public.unaccent(lower(cr.nome)) LIKE '%fumo%solda%')
     OR (t.codigo='01.22.001' AND public.unaccent(lower(cr.nome)) LIKE '%fumos metalico%')
     OR (t.codigo='01.03.001' AND public.unaccent(lower(cr.nome)) LIKE '%benzeno%')
     OR (t.codigo='01.07.001' AND public.unaccent(lower(cr.nome)) LIKE '%chumbo%')
     OR (t.codigo='01.15.001' AND public.unaccent(lower(cr.nome)) LIKE '%mercurio%')
   );

-- insere agentes da Tabela 23 que ainda não constam
INSERT INTO public.catalogo_riscos
  (categoria, nome, efeitos_tipicos, medidas_controle_padrao, nrs_aplicaveis, epis_sugeridos, ativo, codigo_esocial, aposentadoria_especial_anos)
SELECT
  t.categoria, t.nome,
  ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[],
  true, t.codigo, t.anos
FROM _t23 t
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_riscos cr WHERE cr.codigo_esocial = t.codigo
);
