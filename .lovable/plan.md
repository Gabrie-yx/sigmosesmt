## Objetivo

Permitir que o sistema leia a **Lista de Presença digitalizada** (foto/PDF anexado na turma) e gere automaticamente os participantes, cruzando com a base de funcionários. O usuário apenas revisa e confirma.

## Como vai funcionar (visão do usuário)

1. Dentro da turma, ao lado do botão "Participantes", aparece um novo botão **"🤖 Extrair da Lista (IA)"**.
2. Só fica habilitado se houver um anexo do tipo `LISTA_PRESENCA` (imagem ou PDF).
3. Ao clicar, abre um modal com:
   - Spinner "Analisando lista com IA..."
   - Depois, uma tabela com os nomes detectados, em 3 categorias:
     - ✅ **Match exato** com a base de funcionários (pré-selecionado)
     - ⚠️ **Match aproximado** (mostra "Detectado: João Sliva → Sugestão: João Silva" — usuário confirma)
     - ❌ **Não encontrado** (mostra o nome lido, sem match — usuário pode buscar manualmente ou ignorar)
4. Botão **"Adicionar X participantes"** insere todos os confirmados na turma.

## Arquitetura técnica

### Backend
- **Server function** `src/lib/cursos-ocr.functions.ts` → `extrairParticipantesDaLista`
  - Input: `{ trainingId, anexoPath }`
  - Lê o arquivo do Storage (bucket de anexos), converte para base64
  - Chama **Lovable AI Gateway** com `google/gemini-3-flash-preview` usando **tool calling** (structured output)
  - Prompt: "Extraia todos os nomes presentes nesta lista de presença. Para cada um, retorne {nome, assinou: bool, matricula?, cargo?, empresa?}"
  - Cruza resultado com `employees` (busca por nome com `ilike` + similaridade via `pg_trgm` se ativo, senão fuzzy match no client)
  - Retorna `{ detectados: [...], matchExato: [...], matchAproximado: [...], naoEncontrados: [...] }`

### Frontend
- Novo componente `src/components/cursos/extrair-lista-ia-dialog.tsx`
- Botão no `cursos-ministrados-panel.tsx` (próximo ao "Participantes")
- Após confirmação, insere em massa via `supabase.from("training_attendees").insert([...])`

## Pré-requisitos

- ✅ **Lovable AI Gateway**: já é nativo, só ativar (vou usar o `ai_gateway--enable`). Sem custo de setup, só consumo por uso (~R$ 0,02 por lista).
- ✅ **Storage**: anexos já estão lá, só preciso baixar via signed URL.
- ✅ **Tabela `training_attendees`**: já existe, sem migration necessária.

## Tratamento de erros

- Arquivo > 20MB → mensagem "Lista muito grande, reduza a resolução"
- IA não conseguiu ler → "Não foi possível extrair nomes. Verifique se a imagem está legível"
- 429/402 do gateway → toasts amigáveis ("Limite atingido, tente em 1 min" / "Créditos esgotados")
- Funcionário já cadastrado na turma → marca como "já adicionado" e pula

## O que NÃO faz (limites combinados)

- Não identifica pessoa pela assinatura em si (grafotécnica)
- Não dispensa revisão humana — sempre exige confirmação antes de inserir
- Não funciona bem em listas 100% manuscritas (mas pra modelo impresso fica excelente)

## Próximo passo

Se aprovar, eu já implemento na sequência: migration (nenhuma necessária) → server function → componente de dialog → botão no painel. ~10-15 min de trabalho.