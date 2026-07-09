
-- Função auxiliar para buscar risco por padrão de nome (case-insensitive)
CREATE OR REPLACE FUNCTION public._get_risco_id(nome_pattern text)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM catalogo_riscos WHERE nome ILIKE nome_pattern AND ativo = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._get_exam_id(cod text)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM exam_catalog WHERE codigo = cod AND ativo = true LIMIT 1;
$$;

-- Insere vínculo apenas se risco e exame existirem
DO $$
DECLARE
  v_naturezas text[] := ARRAY['ADMISSIONAL','PERIODICO','MUDANCA_RISCO','RETORNO_TRABALHO'];
  vinculos record;
BEGIN
  FOR vinculos IN
    SELECT * FROM (VALUES
      -- (padrão do risco, código eSocial exame, periodicidade meses, base legal)
      ('%fumos metálicos%','0356', 12, 'NR-07 Anexo I / PCMSO REV.05'),
      ('%fumos metálicos%','0853', 24, 'NR-07 Anexo I — Raio-X OIT bienal'),
      ('%fumos metálicos%','0414', 12, 'NR-07 — controle hematológico'),
      ('%sílica cristalina%','0356', 12, 'NR-22 / NR-07 — vigilância pneumoconiose'),
      ('%sílica cristalina%','0853', 12, 'NR-22 — Raio-X OIT anual'),
      ('%monóxido de carbono%','0414', 12, 'NR-07 — carboxihemoglobina'),
      ('%monóxido de carbono%','0295', 12, 'NR-07 — avaliação neurológica'),
      ('%ozônio%','0356', 12, 'NR-07 — irritante respiratório'),
      ('%ozônio%','0295', 12, 'NR-07 — avaliação clínica'),
      ('%névoas e vapores de tinta%','0414', 12, 'NR-07 — solventes orgânicos'),
      ('%névoas e vapores de tinta%','0295', 12, 'NR-07 — avaliação hepatorrenal'),
      ('%esmerilhamento%','0356', 12, 'NR-07 — poeiras minerais'),
      ('%esmerilhamento%','0853', 24, 'NR-07 — Raio-X tórax bienal'),
      ('%óleos e graxas%','0295', 12, 'NR-07 — dermatoses ocupacionais'),
      ('%iluminação inadequada%','0298', 12, 'NR-17 — ergonomia visual'),
      ('%sentado prolongado%','0295', 12, 'NR-17 — avaliação musculoesquelética'),
      ('%em pé prolongado%','0295', 12, 'NR-17 — avaliação musculoesquelética'),
      ('%pressão psicológica%','0295', 12, 'NR-01 / NR-17 — riscos psicossociais'),
      ('%prensagem%','0295', 12, 'NR-12 — avaliação clínica'),
      ('%corte por ferramenta%','0295', 12, 'NR-12 — avaliação clínica'),
      ('%soterramento%','0295', 12, 'NR-18 — avaliação clínica'),
      ('%colisão%','0298', 12, 'NR-11 — acuidade visual condutor'),
      ('%colisão%','0295', 12, 'NR-11 — avaliação clínica condutor'),
      ('%fungos e mofo%','0295', 12, 'NR-07 — risco biológico'),
      ('%fungos e mofo%','0356', 24, 'NR-07 — vigilância respiratória')
    ) AS v(risco_pattern, exam_codigo, periodicidade, base_legal)
  LOOP
    INSERT INTO public.risco_exames (risco_id, exam_id, naturezas, periodicidade_meses, obrigatorio, base_legal, ativo)
    SELECT 
      public._get_risco_id(vinculos.risco_pattern),
      public._get_exam_id(vinculos.exam_codigo),
      v_naturezas,
      vinculos.periodicidade,
      true,
      vinculos.base_legal,
      true
    WHERE public._get_risco_id(vinculos.risco_pattern) IS NOT NULL
      AND public._get_exam_id(vinculos.exam_codigo) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.risco_exames 
        WHERE risco_id = public._get_risco_id(vinculos.risco_pattern)
          AND exam_id = public._get_exam_id(vinculos.exam_codigo)
      );
  END LOOP;
END $$;

-- Cleanup helpers
DROP FUNCTION public._get_risco_id(text);
DROP FUNCTION public._get_exam_id(text);
