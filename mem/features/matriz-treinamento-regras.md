---
name: Matriz de Treinamento — regras
description: Matriz exige cursos SÓ por função (role_id); setor não é usado. Lógica única em matriz-queries.ts para a tela geral e a aba MATRIZ da ficha.
type: feature
---
- Cursos exigidos = `training_matrix_role_courses` pelo `role_id` do funcionário. `training_matrix_sector_courses` está morta (não usar, não citar "setor" na UI).
- Fonte única: `src/lib/matriz-queries.ts` (`computeCellStatus`, queries paginadas, `invalidateMatriz`, `saveMatrizEntry` com upsert). A tela `/app/matriz-treinamento` e a aba MATRIZ da ficha do funcionário devem usar sempre esses helpers.
- Status "A INICIAR" = turma futura em `trainings`/`training_attendees` (APROVADO/PRESENTE) ou data de realização futura — vale nas duas telas.
- Triggers `sync_attendee_to_matrix`/`sync_training_to_matrix` gravam `data_realizacao` e limpam `status_override` quando era PENDENTE/EM_ANDAMENTO.
- Todas as leituras da matriz são paginadas (`fetchAllRows`) para não bater no teto de 1000 linhas do PostgREST.
