
-- Seed initial data (idempotent)
DO $$
DECLARE
  c_dmn uuid; c_jc uuid; c_nb uuid;
  r_id uuid;
  emp_id uuid;
  role_rec RECORD;
  emp_rec RECORD;
BEGIN
  -- ============= COMPANIES =============
  IF NOT EXISTS (SELECT 1 FROM companies WHERE name='DMN') THEN
    INSERT INTO companies (name, type, cnpj, encarregado1) VALUES ('DMN','TERCEIRIZADA','00.000.000/0001-00','João Silva') RETURNING id INTO c_dmn;
  ELSE SELECT id INTO c_dmn FROM companies WHERE name='DMN' LIMIT 1; END IF;

  IF NOT EXISTS (SELECT 1 FROM companies WHERE name='JC') THEN
    INSERT INTO companies (name, type, cnpj, encarregado1) VALUES ('JC','TERCEIRIZADA','00.000.000/0002-00','Carlos Souza') RETURNING id INTO c_jc;
  ELSE SELECT id INTO c_jc FROM companies WHERE name='JC' LIMIT 1; END IF;

  IF NOT EXISTS (SELECT 1 FROM companies WHERE name='NB') THEN
    INSERT INTO companies (name, type, cnpj, encarregado1) VALUES ('NB','CLT','00.000.000/0003-00','Marcelo Lima') RETURNING id INTO c_nb;
  ELSE SELECT id INTO c_nb FROM companies WHERE name='NB' LIMIT 1; END IF;

  -- ============= ROLES =============
  FOR role_rec IN SELECT * FROM (VALUES
    ('Operador de Empilhadeira', ARRAY['NR-11','NR-06']),
    ('Eletricista', ARRAY['NR-10','NR-06','NR-35']),
    ('Eletricista de Alta Tensão', ARRAY['NR-10','NR-10-SEP','NR-35']),
    ('Operador de Ponte Rolante', ARRAY['NR-11','NR-12']),
    ('Soldador', ARRAY['NR-06','NR-18','NR-34']),
    ('Caldeireiro', ARRAY['NR-06','NR-34']),
    ('Mecânico Industrial', ARRAY['NR-12','NR-06']),
    ('Trabalhador em Altura', ARRAY['NR-35','NR-06']),
    ('Trabalhador em Espaço Confinado', ARRAY['NR-33','NR-06']),
    ('Operador de Caldeira', ARRAY['NR-13','NR-06']),
    ('Operador de Vaso de Pressão', ARRAY['NR-13','NR-06']),
    ('Auxiliar de Produção', ARRAY['NR-06']),
    ('Auxiliar de Limpeza', ARRAY['NR-06']),
    ('Operador de Máquinas', ARRAY['NR-12','NR-06']),
    ('Pintor Industrial', ARRAY['NR-06','NR-35']),
    ('Encarregado', ARRAY['NR-05','NR-06']),
    ('Técnico de Segurança', ARRAY['NR-05','NR-06']),
    ('Motorista', ARRAY['NR-06'])
  ) AS t(rname, rnrs) LOOP
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name=role_rec.rname) THEN
      INSERT INTO roles (name, req_aso, req_integra, req_nrs)
      VALUES (role_rec.rname, true, true, role_rec.rnrs);
    END IF;
  END LOOP;

  -- ============= EMPLOYEES (sample subset) =============
  FOR emp_rec IN SELECT * FROM (VALUES
    ('DMN','Operador de Empilhadeira','Antonio Pereira','111.111.111-11','MAT-D001'),
    ('DMN','Eletricista','Bruno Costa','222.222.222-22','MAT-D002'),
    ('DMN','Soldador','Carlos Mendes','333.333.333-33','MAT-D003'),
    ('DMN','Caldeireiro','Daniel Rocha','444.444.444-44','MAT-D004'),
    ('DMN','Mecânico Industrial','Eduardo Lima','555.555.555-55','MAT-D005'),
    ('DMN','Trabalhador em Altura','Fabio Gomes','666.666.666-66','MAT-D006'),
    ('DMN','Operador de Ponte Rolante','Gustavo Santos','777.777.777-77','MAT-D007'),
    ('DMN','Auxiliar de Produção','Henrique Silva','888.888.888-88','MAT-D008'),
    ('DMN','Pintor Industrial','Igor Martins','999.999.999-99','MAT-D009'),
    ('DMN','Soldador','João Almeida','101.010.101-01','MAT-D010'),
    ('JC','Eletricista de Alta Tensão','Lucas Ribeiro','111.222.333-44','MAT-J001'),
    ('JC','Trabalhador em Espaço Confinado','Marcos Oliveira','222.333.444-55','MAT-J002'),
    ('JC','Operador de Caldeira','Nelson Barros','333.444.555-66','MAT-J003'),
    ('JC','Mecânico Industrial','Otavio Carvalho','444.555.666-77','MAT-J004'),
    ('JC','Encarregado','Paulo Henrique','555.666.777-88','MAT-J005'),
    ('JC','Trabalhador em Altura','Rafael Souza','666.777.888-99','MAT-J006'),
    ('JC','Soldador','Sergio Pinto','777.888.999-00','MAT-J007'),
    ('JC','Auxiliar de Produção','Thiago Nunes','888.999.000-11','MAT-J008'),
    ('NB','Técnico de Segurança','Vitor Araujo','111.000.222-33','MAT-N001'),
    ('NB','Operador de Máquinas','Wagner Freitas','222.000.333-44','MAT-N002'),
    ('NB','Motorista','Xavier Lopes','333.000.444-55','MAT-N003'),
    ('NB','Eletricista','Yuri Tavares','444.000.555-66','MAT-N004'),
    ('NB','Auxiliar de Produção','Zilton Cardoso','555.000.666-77','MAT-N005'),
    ('NB','Encarregado','Adriano Vieira','666.000.777-88','MAT-N006'),
    ('NB','Operador de Vaso de Pressão','Bento Moraes','777.000.888-99','MAT-N007'),
    ('NB','Auxiliar de Limpeza','Celso Macedo','888.000.999-00','MAT-N008')
  ) AS t(cname, rname, ename, ecpf, ematr) LOOP
    IF NOT EXISTS (SELECT 1 FROM employees WHERE cpf=emp_rec.ecpf) THEN
      INSERT INTO employees (company_id, role_id, nome, cpf, matricula, status, admissao, data_aso, data_integracao, nrs)
      SELECT
        (SELECT id FROM companies WHERE name=emp_rec.cname LIMIT 1),
        (SELECT id FROM roles WHERE name=emp_rec.rname LIMIT 1),
        emp_rec.ename, emp_rec.ecpf, emp_rec.ematr, 'ATIVO',
        CURRENT_DATE - INTERVAL '2 years',
        CURRENT_DATE - INTERVAL '6 months',
        CURRENT_DATE - INTERVAL '1 year',
        (SELECT jsonb_object_agg(nr, (CURRENT_DATE - INTERVAL '6 months')::text)
         FROM unnest((SELECT req_nrs FROM roles WHERE name=emp_rec.rname LIMIT 1)) AS nr);
    END IF;
  END LOOP;
END $$;
