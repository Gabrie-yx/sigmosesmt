DELETE FROM public.training_matrix_sector_courses;
DELETE FROM public.training_matrix_role_courses;

-- 1) UNIVERSAIS para todas as funções ativas
INSERT INTO public.training_matrix_role_courses (role_id, course_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.training_matrix_courses c
WHERE COALESCE(r.ativo, true) = true
  AND c.codigo IN ('INTEGRACAO','NR-05','NR-06')
ON CONFLICT DO NOTHING;

-- 2) Específicos por função
WITH map(role_name, codigos) AS (
  VALUES
    ('Almoxarife',                  ARRAY['NR-07','NR-11','NR-17','NR-20','NR-23','NR-34']),
    ('Auxiliar de Almoxarifado',    ARRAY['NR-07','NR-11','NR-17','NR-20','NR-23','NR-34']),
    ('Líder de Almoxarifado',       ARRAY['NR-07','NR-11','NR-17','NR-20','NR-23','NR-34','NR-35']),
    ('Auxiliar de Montagem',        ARRAY['NR-12','NR-17','NR-20','NR-23','NR-33','NR-34','NR-35']),
    ('Auxiliar de Serviços Gerais', ARRAY['NR-07','NR-17','NR-23','NR-34','NR-35']),
    ('Eletricista Júnior',          ARRAY['NR-07','NR-10','NR-10-SEP','NR-12','NR-17','NR-23','NR-34','NR-35']),
    ('Eletricista Pleno',           ARRAY['NR-07','NR-10','NR-10-SEP','NR-12','NR-17','NR-20','NR-23','NR-34','NR-35']),
    ('Eletricista',                 ARRAY['NR-07','NR-10','NR-10-SEP','NR-12','NR-17','NR-20','NR-23','NR-34','NR-35']),
    ('Eletricista de Alta Tensão',  ARRAY['NR-07','NR-10','NR-10-SEP','NR-12','NR-17','NR-20','NR-23','NR-34','NR-35']),
    ('Encarregado de Produção/Montagem', ARRAY['NR-12','NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Encarregado',                 ARRAY['NR-12','NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Encarregado de Manutenção Mecânica', ARRAY['NR-10','NR-12','NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Líder de Produção',           ARRAY['NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Montador I',                  ARRAY['NR-07','NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Montador II',                 ARRAY['NR-07','NR-12','NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Motorista',                   ARRAY['NR-11','NR-17','NR-20','NR-34']),
    ('Operador de Guindaste',       ARRAY['NR-11','NR-12','NR-17','NR-20','NR-34','NR-35','OP-GUINDASTE']),
    ('Operador de Máquinas Pesadas',ARRAY['NR-11','NR-12','NR-17','NR-20','NR-23','NR-34','NR-35']),
    ('Soldador',                    ARRAY['NR-23','NR-33','NR-34','NR-35']),
    ('Caldeireiro',                 ARRAY['NR-12','NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Pintor Industrial',           ARRAY['NR-20','NR-23','NR-33','NR-34','NR-35']),
    ('Pintura e Tratamento (Pintor/Jatista)', ARRAY['NR-20','NR-23','NR-33','NR-34','NR-35']),
    ('Operacional Metalurgia (Soldador/Maçariqueiro)', ARRAY['NR-23','NR-33','NR-34','NR-35']),
    ('Operacional Montagem (Montador/Auxiliar)', ARRAY['NR-12','NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Movimentação de Cargas (Operador/Rigger)', ARRAY['NR-11','NR-12','NR-17','NR-34','NR-35']),
    ('Operador de Caldeira',        ARRAY['NR-12','NR-13','NR-17','NR-20','NR-23','NR-34']),
    ('Operador de Vaso de Pressão', ARRAY['NR-12','NR-13','NR-17','NR-23','NR-34']),
    ('Operador de Empilhadeira',    ARRAY['NR-11','NR-12','NR-17','NR-34']),
    ('Operador de Ponte Rolante',   ARRAY['NR-11','NR-12','NR-17','NR-34','NR-35']),
    ('Operador de Máquinas',        ARRAY['NR-12','NR-17','NR-23','NR-34']),
    ('Mecânico Industrial',         ARRAY['NR-10','NR-12','NR-13','NR-17','NR-23','NR-33','NR-34']),
    ('LIXADOR',                     ARRAY['NR-17','NR-23','NR-34','NR-35']),
    ('Revisor Final',               ARRAY['NR-17','NR-23','NR-34','NR-35']),
    ('Auxiliar de Produção',        ARRAY['NR-12','NR-17','NR-23','NR-34','NR-35']),
    ('Apoio e Serviços Gerais',     ARRAY['NR-17','NR-23','NR-34']),
    ('Auxiliar de Limpeza',         ARRAY['NR-17','NR-23','NR-34']),
    ('Cozinha e Refeitório',        ARRAY['NR-17','NR-23']),
    ('Elétrica',                    ARRAY['NR-07','NR-10','NR-10-SEP','NR-12','NR-17','NR-23','NR-34','NR-35']),
    ('Administrativo e TST',        ARRAY['NR-17','NR-23']),
    ('Técnico de Segurança',        ARRAY['NR-17','NR-23','NR-33','NR-34','NR-35']),
    ('Trabalhador em Altura',       ARRAY['NR-23','NR-34','NR-35']),
    ('Trabalhador em Espaço Confinado', ARRAY['NR-23','NR-33','NR-34','NR-35'])
),
expanded AS (
  SELECT m.role_name, u.cod
  FROM map m, unnest(m.codigos) AS u(cod)
)
INSERT INTO public.training_matrix_role_courses (role_id, course_id)
SELECT r.id, c.id
FROM expanded e
JOIN public.roles r ON r.name = e.role_name
JOIN public.training_matrix_courses c ON c.codigo = e.cod
ON CONFLICT DO NOTHING;