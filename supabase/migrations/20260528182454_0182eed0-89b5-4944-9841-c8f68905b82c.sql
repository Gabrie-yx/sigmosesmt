
-- ============================================================
-- ESCALA MATRIZ DE RISCOS — 39 CARGOS (status: EM_REVISAO)
-- ============================================================
-- IDs dos riscos do catálogo (referência):
--   Ruído                                   = 734d6ec2-3f99-4f32-8f4c-51894c04b45f
--   Calor                                   = 5cf640ba-abba-4d25-9f01-c0e966583562
--   Calor (IBUTG)                           = 1aeaa108-99c5-4684-a779-1ce0762f578f
--   Vibração corpo inteiro                  = 84af4e8f-b434-4cca-ad01-601f9c024d75
--   Vibração (mão-braço)                    = 18d18def-6d64-4efd-9ceb-cae12f5124de
--   Umidade                                 = 3a503a10-40f8-4164-a455-2a984d45017f
--   Radiação UV solda                       = 209e7b6c-2386-4c2d-99e2-25201001b4bc
--   Fumos metálicos (solda)                 = b64e2a51-378c-4cff-81ea-1a03e2a65917
--   Material particulado esmerilhamento     = b49326ef-9697-4f01-9c57-32d63685ba9b
--   Poeira                                  = 9d469e30-3f24-4451-a1aa-96c5b9076989
--   Produtos químicos diversos              = 4bc09a9e-dc84-4f32-a968-73c837c8db5a
--   Tintas e solventes                      = ed3bffae-f480-449c-b5cd-a2c6adc5790f
--   Gases (oxig/GLP/acetileno)              = 54af10b3-3a74-44de-8423-6a529fdde3e6
--   Contato água contaminada                = b92a98a6-c97a-481c-a3a8-893df9c4f7fc
--   Postura forçada                         = b3b3a843-17ee-4ff3-99c7-cffdd9c9a706
--   Postura inadequada                      = 15607e43-e9f5-47c5-9268-b994ae747741
--   Levantamento de material                = e3f22066-ec7e-44ab-b2e8-5dde96a9d6df
--   Esforço físico repetitivo               = 6d763a12-84b0-4486-ada9-45bc919ee921
--   Jornada prolongada                      = c49fb6bd-1e49-467f-8654-72caf0bdce86
--   Choque elétrico                         = 9c1b41ee-3426-4724-aa95-add8c0f8d424
--   Queda de altura                         = a1c23be3-b538-4677-833a-8a7d210de6b0
--   Queda de objetos                        = e18981c2-874b-41a9-8041-a550e1a168f2
--   Queda de mesmo nível                    = 40d2e9a5-4007-4367-96d0-fbdb036cc246
--   Projeção de partículas                  = ddc1b7d3-599e-4602-8a49-75884b0db812
--   Içamento de carga                       = 22785db4-562b-46ab-95d2-a405464044c3
--   Atropelamento                           = 70a3f4c7-e9a6-49a5-9913-d18410bf177d
--   Incêndio e explosão                     = 5c155f8d-a4b2-4af8-b1df-7f81c2361f79
--   Espaço confinado                        = 8f094192-5fab-4904-96b4-b74f7cb98335
--   Ferramentas manuais                     = a4b535bf-9bb9-4bc4-87aa-c858ce168264
--   Contato com peça quente                 = f63a18df-f30d-4163-ba42-a1559bfb72e1

INSERT INTO public.cargo_riscos
  (role_id, risco_id, status_avaliacao, fonte_geradora, observacao,
   insalubridade_grau, periculosidade)
VALUES
-- ============= ADMINISTRATIVO E TST =============
('5baf00d3-2782-466c-98e6-9d02b0502917','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Estação de trabalho / mobiliário','Pré-mapeamento NR-17 — validar com AET',NULL,false),
('5baf00d3-2782-466c-98e6-9d02b0502917','c49fb6bd-1e49-467f-8654-72caf0bdce86','EM_REVISAO','Carga de trabalho administrativa','Pré-mapeamento — validar',NULL,false),

-- ============= ALMOXARIFE / AUX ALMOXARIFADO =============
('689a2c2a-c17c-457a-a478-c55b713fc4f4','e3f22066-ec7e-44ab-b2e8-5dde96a9d6df','EM_REVISAO','Movimentação manual de itens estocados','NR-17 — validar massa e frequência',NULL,false),
('689a2c2a-c17c-457a-a478-c55b713fc4f4','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Estocagem em prateleiras altas/baixas','NR-17',NULL,false),
('689a2c2a-c17c-457a-a478-c55b713fc4f4','9d469e30-3f24-4451-a1aa-96c5b9076989','EM_REVISAO','Almoxarifado','Validar dosimetria',NULL,false),
('689a2c2a-c17c-457a-a478-c55b713fc4f4','e18981c2-874b-41a9-8041-a550e1a168f2','EM_REVISAO','Estoques em altura','APR específica',NULL,false),
('9ffe6ce9-09a3-4f45-8816-07e0be3317bd','e3f22066-ec7e-44ab-b2e8-5dde96a9d6df','EM_REVISAO','Movimentação manual','NR-17',NULL,false),
('9ffe6ce9-09a3-4f45-8816-07e0be3317bd','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Estocagem','NR-17',NULL,false),
('9ffe6ce9-09a3-4f45-8816-07e0be3317bd','9d469e30-3f24-4451-a1aa-96c5b9076989','EM_REVISAO','Almoxarifado','Validar',NULL,false),

-- ============= APOIO E SERVIÇOS GERAIS / AUX SG / AUX LIMPEZA =============
('3fc08464-78ff-48d4-bf91-b627af138799','4bc09a9e-dc84-4f32-a968-73c837c8db5a','EM_REVISAO','Produtos de limpeza','Anexo 13 NR-15 — validar FISPQ',NULL,false),
('3fc08464-78ff-48d4-bf91-b627af138799','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Atividades de limpeza/apoio','NR-17',NULL,false),
('3fc08464-78ff-48d4-bf91-b627af138799','e3f22066-ec7e-44ab-b2e8-5dde96a9d6df','EM_REVISAO','Movimentação de materiais','NR-17',NULL,false),
('e7779e8d-021c-4da9-a6b8-2f5e3f10360c','4bc09a9e-dc84-4f32-a968-73c837c8db5a','EM_REVISAO','Produtos de limpeza','Validar FISPQ',NULL,false),
('e7779e8d-021c-4da9-a6b8-2f5e3f10360c','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Limpeza/serviços','NR-17',NULL,false),
('e7779e8d-021c-4da9-a6b8-2f5e3f10360c','e3f22066-ec7e-44ab-b2e8-5dde96a9d6df','EM_REVISAO','Movimentação','NR-17',NULL,false),
('ecbae2bc-3a85-4f87-a184-d99642783f34','4bc09a9e-dc84-4f32-a968-73c837c8db5a','EM_REVISAO','Detergentes, desinfetantes','Anexo 13 NR-15 — validar FISPQ',NULL,false),
('ecbae2bc-3a85-4f87-a184-d99642783f34','b92a98a6-c97a-481c-a3a8-893df9c4f7fc','EM_REVISAO','Limpeza de sanitários/áreas molhadas','Anexo 14 NR-15 — validar',NULL,false),
('ecbae2bc-3a85-4f87-a184-d99642783f34','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Atividade de limpeza','NR-17',NULL,false),

-- ============= COZINHA E REFEITÓRIO =============
('3fc4eb89-68c6-464c-a4e2-c55fd561f4cf','5cf640ba-abba-4d25-9f01-c0e966583562','EM_REVISAO','Fogões, fornos, fritadeiras','Validar IBUTG NR-15 anexo 3',NULL,false),
('3fc4eb89-68c6-464c-a4e2-c55fd561f4cf','f63a18df-f30d-4163-ba42-a1559bfb72e1','EM_REVISAO','Manuseio de panelas/utensílios quentes','',NULL,false),
('3fc4eb89-68c6-464c-a4e2-c55fd561f4cf','a4b535bf-9bb9-4bc4-87aa-c858ce168264','EM_REVISAO','Facas, utensílios de corte','',NULL,false),
('3fc4eb89-68c6-464c-a4e2-c55fd561f4cf','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Preparo de refeições em pé','NR-17',NULL,false),

-- ============= AUX MONTAGEM / AUX PRODUÇÃO / MONTADORES =============
('86420ef4-23ac-49ef-a180-c6bb2bd38405','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Ambiente de produção (caldeiraria)','Validar dosimetria — anexo 1 NR-15',NULL,false),
('86420ef4-23ac-49ef-a180-c6bb2bd38405','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Montagem em posições variadas','NR-17',NULL,false),
('86420ef4-23ac-49ef-a180-c6bb2bd38405','e3f22066-ec7e-44ab-b2e8-5dde96a9d6df','EM_REVISAO','Movimentação de peças','NR-17',NULL,false),
('86420ef4-23ac-49ef-a180-c6bb2bd38405','a4b535bf-9bb9-4bc4-87aa-c858ce168264','EM_REVISAO','Ferramentas manuais e elétricas','',NULL,false),
('86420ef4-23ac-49ef-a180-c6bb2bd38405','ddc1b7d3-599e-4602-8a49-75884b0db812','EM_REVISAO','Operações de esmerilhamento próximas','',NULL,false),
('484ab2c3-f558-497a-a792-fa3db42fd2f8','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Ambiente de produção','Validar dosimetria',NULL,false),
('484ab2c3-f558-497a-a792-fa3db42fd2f8','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Auxílio em montagem','NR-17',NULL,false),
('484ab2c3-f558-497a-a792-fa3db42fd2f8','e3f22066-ec7e-44ab-b2e8-5dde96a9d6df','EM_REVISAO','Movimentação de cargas','NR-17',NULL,false),
('484ab2c3-f558-497a-a792-fa3db42fd2f8','a4b535bf-9bb9-4bc4-87aa-c858ce168264','EM_REVISAO','Ferramentas manuais','',NULL,false),
('9ac7de94-f882-4f56-8d0d-b411fab369aa','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Ambiente de montagem','Validar dosimetria',NULL,false),
('9ac7de94-f882-4f56-8d0d-b411fab369aa','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Montagem mecânica','NR-17',NULL,false),
('9ac7de94-f882-4f56-8d0d-b411fab369aa','a4b535bf-9bb9-4bc4-87aa-c858ce168264','EM_REVISAO','Ferramentas manuais e elétricas','',NULL,false),
('9ac7de94-f882-4f56-8d0d-b411fab369aa','ddc1b7d3-599e-4602-8a49-75884b0db812','EM_REVISAO','Esmerilhamento/corte','',NULL,false),
('196d3344-d6ba-4374-bf52-d2431631da09','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Ambiente de montagem','Validar dosimetria',NULL,false),
('196d3344-d6ba-4374-bf52-d2431631da09','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Montagem mecânica avançada','NR-17',NULL,false),
('196d3344-d6ba-4374-bf52-d2431631da09','a4b535bf-9bb9-4bc4-87aa-c858ce168264','EM_REVISAO','Ferramentas','',NULL,false),
('196d3344-d6ba-4374-bf52-d2431631da09','22785db4-562b-46ab-95d2-a405464044c3','EM_REVISAO','Içamento de subconjuntos','APR + NR-11',NULL,false),
('809a9827-6be0-42b2-886e-055aaa29f9d3','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Operacional de montagem','Validar dosimetria',NULL,false),
('809a9827-6be0-42b2-886e-055aaa29f9d3','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Montagem','NR-17',NULL,false),
('809a9827-6be0-42b2-886e-055aaa29f9d3','a4b535bf-9bb9-4bc4-87aa-c858ce168264','EM_REVISAO','Ferramentas','',NULL,false),

-- ============= CALDEIREIRO =============
('7e9d8766-a80f-4e3f-8934-684e0e0b0156','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Caldeiraria — corte, conformação, esmerilhamento','Anexo 1 NR-15 — validar dosimetria',NULL,false),
('7e9d8766-a80f-4e3f-8934-684e0e0b0156','b64e2a51-378c-4cff-81ea-1a03e2a65917','EM_REVISAO','Soldagem associada à atividade de caldeiraria','Anexo 12 NR-15 — validar quantitativo',NULL,false),
('7e9d8766-a80f-4e3f-8934-684e0e0b0156','b49326ef-9697-4f01-9c57-32d63685ba9b','EM_REVISAO','Esmerilhamento de chapas e cordões','Validar concentração',NULL,false),
('7e9d8766-a80f-4e3f-8934-684e0e0b0156','1aeaa108-99c5-4684-a779-1ce0762f578f','EM_REVISAO','Trabalho próximo a peças aquecidas','Anexo 3 NR-15 — IBUTG pendente',NULL,false),
('7e9d8766-a80f-4e3f-8934-684e0e0b0156','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Conformação de chapas','NR-17',NULL,false),
('7e9d8766-a80f-4e3f-8934-684e0e0b0156','ddc1b7d3-599e-4602-8a49-75884b0db812','EM_REVISAO','Esmerilhamento','',NULL,false),

-- ============= ELÉTRICA / ELETRICISTAS (4) =============
('1dfb85f7-a6b2-4cb8-a766-5dc7e4952d2a','9c1b41ee-3426-4724-aa95-add8c0f8d424','EM_REVISAO','Sistemas e instalações elétricas','NR-10',NULL,false),
('1dfb85f7-a6b2-4cb8-a766-5dc7e4952d2a','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Manutenção elétrica','NR-17',NULL,false),
('bcab0633-62bb-453d-8e43-dd6fbadca6e3','9c1b41ee-3426-4724-aa95-add8c0f8d424','EM_REVISAO','Painéis e circuitos energizados','NR-10 — validar enquadramento NR-16',NULL,false),
('bcab0633-62bb-453d-8e43-dd6fbadca6e3','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Manutenção elétrica','NR-17',NULL,false),
('bcab0633-62bb-453d-8e43-dd6fbadca6e3','a1c23be3-b538-4677-833a-8a7d210de6b0','EM_REVISAO','Eventual trabalho em altura','NR-35 quando aplicável',NULL,false),
('cd906f28-6612-48a7-be6c-4ff0142da59a','9c1b41ee-3426-4724-aa95-add8c0f8d424','EM_REVISAO','Atividades elétricas básicas','NR-10',NULL,false),
('cd906f28-6612-48a7-be6c-4ff0142da59a','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Atividade elétrica','NR-17',NULL,false),
('873d39bf-12f3-4648-a6a9-999ef02f9f14','9c1b41ee-3426-4724-aa95-add8c0f8d424','EM_REVISAO','Painéis energizados','NR-10 — validar NR-16',NULL,false),
('873d39bf-12f3-4648-a6a9-999ef02f9f14','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Manutenção elétrica','NR-17',NULL,false),
('873d39bf-12f3-4648-a6a9-999ef02f9f14','a1c23be3-b538-4677-833a-8a7d210de6b0','EM_REVISAO','Trabalho em altura eventual','NR-35',NULL,false),
('353fdee5-7629-4b8a-bf12-710658188bb2','9c1b41ee-3426-4724-aa95-add8c0f8d424','EM_REVISAO','Sistema elétrico de potência (SEP) >250V','NR-10 — PERICULOSIDADE confirmada',NULL,true),
('353fdee5-7629-4b8a-bf12-710658188bb2','a1c23be3-b538-4677-833a-8a7d210de6b0','EM_REVISAO','Subestações e postes','NR-35',NULL,false),
('353fdee5-7629-4b8a-bf12-710658188bb2','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Operação em alta tensão','NR-17',NULL,false),

-- ============= ENCARREGADOS / LÍDER =============
('b1172d54-9bed-4734-9e5b-114399077953','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Ambiente fabril','Validar dosimetria',NULL,false),
('b1172d54-9bed-4734-9e5b-114399077953','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Gestão e supervisão','NR-17',NULL,false),
('b1172d54-9bed-4734-9e5b-114399077953','c49fb6bd-1e49-467f-8654-72caf0bdce86','EM_REVISAO','Cobertura de turnos','NR-17',NULL,false),
('1ea90f01-50c8-410b-b8bd-452e19cf8fbd','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Oficina de manutenção','Validar dosimetria',NULL,false),
('1ea90f01-50c8-410b-b8bd-452e19cf8fbd','4bc09a9e-dc84-4f32-a968-73c837c8db5a','EM_REVISAO','Óleos, graxas, solventes','Validar FISPQ',NULL,false),
('1ea90f01-50c8-410b-b8bd-452e19cf8fbd','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Supervisão e execução','NR-17',NULL,false),
('c38c7e3a-72e3-461f-a0ac-3fe373aa5dda','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Galpão de produção','Validar dosimetria',NULL,false),
('c38c7e3a-72e3-461f-a0ac-3fe373aa5dda','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Supervisão de campo','NR-17',NULL,false),
('c38c7e3a-72e3-461f-a0ac-3fe373aa5dda','c49fb6bd-1e49-467f-8654-72caf0bdce86','EM_REVISAO','Cobertura de turnos','NR-17',NULL,false),
('e20c842e-ff26-46d0-8d89-9ec4e50cb71b','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Linha de produção','Validar dosimetria',NULL,false),
('e20c842e-ff26-46d0-8d89-9ec4e50cb71b','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Coordenação de equipe','NR-17',NULL,false),

-- ============= LIXADOR =============
('45578bd4-bd46-440e-b0d1-364436280036','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Lixadeiras, esmerilhadeiras','Anexo 1 NR-15 — validar dosimetria',NULL,false),
('45578bd4-bd46-440e-b0d1-364436280036','b49326ef-9697-4f01-9c57-32d63685ba9b','EM_REVISAO','Lixamento de superfícies metálicas','Anexo 12 NR-15 — validar quantitativo',NULL,false),
('45578bd4-bd46-440e-b0d1-364436280036','18d18def-6d64-4efd-9ceb-cae12f5124de','EM_REVISAO','Lixadeira manual','Anexo 8 NR-15 — validar VMB',NULL,false),
('45578bd4-bd46-440e-b0d1-364436280036','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Lixamento em posições variadas','NR-17',NULL,false),
('45578bd4-bd46-440e-b0d1-364436280036','ddc1b7d3-599e-4602-8a49-75884b0db812','EM_REVISAO','Projeção de partículas no lixamento','',NULL,false),

-- ============= MECÂNICO INDUSTRIAL =============
('dccc2f8a-2a00-416f-bd4a-d7d9db225085','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Oficina mecânica','Validar dosimetria',NULL,false),
('dccc2f8a-2a00-416f-bd4a-d7d9db225085','4bc09a9e-dc84-4f32-a968-73c837c8db5a','EM_REVISAO','Óleos, graxas, solventes de manutenção','Anexo 13 NR-15 — validar FISPQ',NULL,false),
('dccc2f8a-2a00-416f-bd4a-d7d9db225085','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Manutenção em equipamentos','NR-17',NULL,false),
('dccc2f8a-2a00-416f-bd4a-d7d9db225085','a4b535bf-9bb9-4bc4-87aa-c858ce168264','EM_REVISAO','Ferramentas manuais e elétricas','',NULL,false),
('dccc2f8a-2a00-416f-bd4a-d7d9db225085','e18981c2-874b-41a9-8041-a550e1a168f2','EM_REVISAO','Manutenção sob equipamentos suspensos','APR',NULL,false),

-- ============= MOTORISTA =============
('4d004d02-8c6e-46cf-827b-e412992df39d','84af4e8f-b434-4cca-ad01-601f9c024d75','EM_REVISAO','Cabine de veículo','Anexo 8 NR-15 — validar',NULL,false),
('4d004d02-8c6e-46cf-827b-e412992df39d','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Direção prolongada','NR-17',NULL,false),
('4d004d02-8c6e-46cf-827b-e412992df39d','c49fb6bd-1e49-467f-8654-72caf0bdce86','EM_REVISAO','Trajetos longos','NR-17',NULL,false),

-- ============= MOVIMENTAÇÃO DE CARGAS / RIGGER =============
('fffa7e99-6d96-497d-8692-d32219ff9bde','22785db4-562b-46ab-95d2-a405464044c3','EM_REVISAO','Operações de içamento','NR-11 — APR',NULL,false),
('fffa7e99-6d96-497d-8692-d32219ff9bde','e18981c2-874b-41a9-8041-a550e1a168f2','EM_REVISAO','Cargas suspensas','APR',NULL,false),
('fffa7e99-6d96-497d-8692-d32219ff9bde','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Ambiente fabril','Validar dosimetria',NULL,false),
('fffa7e99-6d96-497d-8692-d32219ff9bde','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Posicionamento de cargas','NR-17',NULL,false),

-- ============= OPERADOR DE CALDEIRA =============
('9289dae2-a55c-4460-a67a-bdfe938cfac6','1aeaa108-99c5-4684-a779-1ce0762f578f','EM_REVISAO','Casa de caldeiras','Anexo 3 NR-15 — IBUTG pendente',NULL,false),
('9289dae2-a55c-4460-a67a-bdfe938cfac6','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Caldeira em operação','Validar dosimetria',NULL,false),
('9289dae2-a55c-4460-a67a-bdfe938cfac6','5c155f8d-a4b2-4af8-b1df-7f81c2361f79','EM_REVISAO','Vasos sob pressão e combustível','NR-13 — validar NR-16 conforme inflamável',NULL,false),
('9289dae2-a55c-4460-a67a-bdfe938cfac6','f63a18df-f30d-4163-ba42-a1559bfb72e1','EM_REVISAO','Tubulações e válvulas aquecidas','',NULL,false),

-- ============= OP EMPILHADEIRA =============
('7c2611a7-c046-4c09-9c28-cd3412af1e33','84af4e8f-b434-4cca-ad01-601f9c024d75','EM_REVISAO','Empilhadeira em operação','Anexo 8 NR-15 — validar VCI',NULL,false),
('7c2611a7-c046-4c09-9c28-cd3412af1e33','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Ruído do motor/ambiente','Validar dosimetria',NULL,false),
('7c2611a7-c046-4c09-9c28-cd3412af1e33','70a3f4c7-e9a6-49a5-9913-d18410bf177d','EM_REVISAO','Risco mútuo de atropelamento','NR-11',NULL,false),
('7c2611a7-c046-4c09-9c28-cd3412af1e33','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Operação prolongada','NR-17',NULL,false),

-- ============= OP GUINDASTE =============
('a5229b0c-0bf6-4d1a-83ea-eba2f382c3a5','22785db4-562b-46ab-95d2-a405464044c3','EM_REVISAO','Içamento com guindaste','NR-11 — APR',NULL,false),
('a5229b0c-0bf6-4d1a-83ea-eba2f382c3a5','84af4e8f-b434-4cca-ad01-601f9c024d75','EM_REVISAO','Cabine','Anexo 8 NR-15 — validar VCI',NULL,false),
('a5229b0c-0bf6-4d1a-83ea-eba2f382c3a5','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Operação em cabine','NR-17',NULL,false),
('a5229b0c-0bf6-4d1a-83ea-eba2f382c3a5','e18981c2-874b-41a9-8041-a550e1a168f2','EM_REVISAO','Carga suspensa','APR',NULL,false),

-- ============= OP MÁQUINAS =============
('b392c375-e770-4cc5-8fa7-29eb441d290e','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Máquinas operatrizes','Validar dosimetria',NULL,false),
('b392c375-e770-4cc5-8fa7-29eb441d290e','18d18def-6d64-4efd-9ceb-cae12f5124de','EM_REVISAO','Vibração de máquinas','Anexo 8 NR-15',NULL,false),
('b392c375-e770-4cc5-8fa7-29eb441d290e','ddc1b7d3-599e-4602-8a49-75884b0db812','EM_REVISAO','Cavacos e partículas','NR-12',NULL,false),
('b392c375-e770-4cc5-8fa7-29eb441d290e','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Operação de máquinas','NR-17',NULL,false),

-- ============= OP MÁQUINAS PESADAS =============
('57b50af1-5a74-4a9c-aed5-27637c4d3855','84af4e8f-b434-4cca-ad01-601f9c024d75','EM_REVISAO','Cabine de máquina pesada','Anexo 8 NR-15 — validar VCI',NULL,false),
('57b50af1-5a74-4a9c-aed5-27637c4d3855','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Motor e ambiente','Validar dosimetria',NULL,false),
('57b50af1-5a74-4a9c-aed5-27637c4d3855','70a3f4c7-e9a6-49a5-9913-d18410bf177d','EM_REVISAO','Convivência com pedestres','Sinalização',NULL,false),
('57b50af1-5a74-4a9c-aed5-27637c4d3855','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Operação prolongada','NR-17',NULL,false),

-- ============= OP PONTE ROLANTE =============
('785f3814-794c-4bb4-a523-9ae2f5675268','22785db4-562b-46ab-95d2-a405464044c3','EM_REVISAO','Içamento com ponte rolante','NR-11',NULL,false),
('785f3814-794c-4bb4-a523-9ae2f5675268','e18981c2-874b-41a9-8041-a550e1a168f2','EM_REVISAO','Cargas suspensas','APR',NULL,false),
('785f3814-794c-4bb4-a523-9ae2f5675268','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Postura olhando pra cima','NR-17',NULL,false),
('785f3814-794c-4bb4-a523-9ae2f5675268','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Galpão de produção','Validar dosimetria',NULL,false),

-- ============= OP VASO DE PRESSÃO =============
('f3c0b996-5da5-4317-bdef-a3ed65daabcc','5c155f8d-a4b2-4af8-b1df-7f81c2361f79','EM_REVISAO','Vasos sob pressão','NR-13 — validar enquadramento NR-16',NULL,false),
('f3c0b996-5da5-4317-bdef-a3ed65daabcc','1aeaa108-99c5-4684-a779-1ce0762f578f','EM_REVISAO','Proximidade a vasos aquecidos','Anexo 3 NR-15',NULL,false),
('f3c0b996-5da5-4317-bdef-a3ed65daabcc','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Sala de máquinas/processos','Validar dosimetria',NULL,false),

-- ============= PINTOR INDUSTRIAL =============
('b7e8a183-f967-41f1-b197-a0091609b6db','ed3bffae-f480-449c-b5cd-a2c6adc5790f','EM_REVISAO','Pintura com pistola de tintas industriais','Anexo 13 NR-15 — INSALUBRIDADE MÁXIMA preliminar (hidrocarbonetos aromáticos)','MAXIMO',false),
('b7e8a183-f967-41f1-b197-a0091609b6db','b49326ef-9697-4f01-9c57-32d63685ba9b','EM_REVISAO','Preparação de superfície (lixamento)','Validar quantitativo',NULL,false),
('b7e8a183-f967-41f1-b197-a0091609b6db','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Pintura em peças grandes','NR-17',NULL,false),

-- ============= PINTURA E TRATAMENTO (PINTOR/JATISTA) =============
('a2c05caa-988d-4395-a4d1-4d02ec71627e','ed3bffae-f480-449c-b5cd-a2c6adc5790f','EM_REVISAO','Tintas, vernizes, solventes','Anexo 13 NR-15 — INSALUBRIDADE MÁXIMA preliminar','MAXIMO',false),
('a2c05caa-988d-4395-a4d1-4d02ec71627e','9d469e30-3f24-4451-a1aa-96c5b9076989','EM_REVISAO','Jateamento abrasivo','Anexo 12 NR-15 — sílica/abrasivo','MAXIMO',false),
('a2c05caa-988d-4395-a4d1-4d02ec71627e','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Equipamentos de jato','Anexo 1 NR-15 — validar dosimetria',NULL,false),
('a2c05caa-988d-4395-a4d1-4d02ec71627e','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Atividade em cabine de pintura','NR-17',NULL,false),

-- ============= REVISOR FINAL =============
('3b8effa6-98fa-482e-a7c5-92e3f61570f7','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Inspeção de peças em posições variadas','NR-17',NULL,false),
('3b8effa6-98fa-482e-a7c5-92e3f61570f7','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Ambiente fabril','Validar dosimetria',NULL,false),

-- ============= TÉCNICO DE SEGURANÇA =============
('2d3493ae-a036-48f0-bf5a-8421ffbd67c3','15607e43-e9f5-47c5-9268-b994ae747741','EM_REVISAO','Estação administrativa','NR-17',NULL,false),
('2d3493ae-a036-48f0-bf5a-8421ffbd67c3','734d6ec2-3f99-4f32-8f4c-51894c04b45f','EM_REVISAO','Inspeções em campo','Eventual',NULL,false),

-- ============= TRABALHADOR EM ALTURA =============
('38ed0461-71ee-47f6-8ad7-2c2c4a3ebc6e','a1c23be3-b538-4677-833a-8a7d210de6b0','EM_REVISAO','Atividades acima de 2m','NR-35 — APR + PT',NULL,false),
('38ed0461-71ee-47f6-8ad7-2c2c4a3ebc6e','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Trabalho em andaimes/plataformas','NR-17',NULL,false),

-- ============= TRABALHADOR EM ESPAÇO CONFINADO =============
('24ef1406-6a19-4cb6-b488-7c76d822aae0','8f094192-5fab-4904-96b4-b74f7cb98335','EM_REVISAO','Tanques, vasos, dutos','NR-33 — PET obrigatória',NULL,false),
('24ef1406-6a19-4cb6-b488-7c76d822aae0','54af10b3-3a74-44de-8423-6a529fdde3e6','EM_REVISAO','Atmosfera potencialmente perigosa','NR-33 — monitoramento contínuo',NULL,false),
('24ef1406-6a19-4cb6-b488-7c76d822aae0','a1c23be3-b538-4677-833a-8a7d210de6b0','EM_REVISAO','Acesso vertical eventual','NR-35',NULL,false),
('24ef1406-6a19-4cb6-b488-7c76d822aae0','b3b3a843-17ee-4ff3-99c7-cffdd9c9a706','EM_REVISAO','Posturas restritas em confinado','NR-17',NULL,false)
ON CONFLICT (role_id, risco_id) DO NOTHING;
