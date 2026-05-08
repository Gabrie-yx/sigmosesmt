## Diagnóstico

**Do I know what the issue is?** Sim.

O problema principal é o guard de `/app`: ele chama `supabase.auth.getSession()` dentro do `beforeLoad`. Em TanStack Start isso pode rodar antes da sessão do Supabase ser restaurada no navegador, então o sistema acha que não existe usuário e manda para `/login`, mesmo com login válido.

Também encontrei estes pontos relacionados:
- `useAuth()` marca `loading=false` antes de terminar de carregar os papéis (`admin`, `tst`, etc.), causando estado instável.
- `/app/users` repete o mesmo padrão frágil no `beforeLoad` e pode redirecionar admin antes do papel carregar.
- A função `handle_new_user()` existe, mas não há trigger ativo no banco; isso explica perfis ausentes e inconsistência na tela de usuários.
- O login navega para `/app` imediatamente após autenticar, sem esperar a sessão ficar realmente disponível para as rotas protegidas.

## Plano de correção

1. **Estabilizar autenticação no frontend**
   - Ajustar `useAuth()` para carregar sessão e papéis como uma única etapa.
   - Manter `loading=true` até a sessão e os papéis terminarem de carregar.
   - Tratar erro ao carregar papéis sem derrubar a aplicação.

2. **Corrigir o guard de `/app`**
   - Remover o redirecionamento prematuro do `beforeLoad`.
   - Fazer o layout `/app` renderizar uma tela de carregamento enquanto a sessão hidrata.
   - Só mostrar o sistema quando houver sessão válida.
   - Redirecionar para `/login` apenas depois de confirmar que não há usuário logado.

3. **Corrigir `/app/users`**
   - Tirar a validação de admin do `beforeLoad` frágil.
   - Usar o estado central do `useAuth()` para aguardar os papéis.
   - Mostrar bloqueio/redirect apenas quando tiver certeza de que o usuário não é admin.

4. **Ajustar login/cadastro**
   - Após login, aguardar a sessão estar disponível antes de navegar para `/app`.
   - Evitar tentativa incorreta de inserir papel admin quando o cadastro ainda não tem sessão ativa.
   - Melhorar mensagens de erro para “email não confirmado” e credenciais inválidas.

5. **Corrigir inconsistência de perfis no banco**
   - Criar uma migração para preencher `profiles` faltantes dos usuários já existentes.
   - Evitar depender de perfis ausentes na tela de usuários.
   - Não armazenar papéis em `profiles`; manter `user_roles`, como já está correto.

6. **Validar**
   - Conferir logs de auth e browser depois da mudança.
   - Testar fluxo: login → `/app` → navegar entre Painel, Usuários, Colaboradores → logout.
   - Confirmar que o usuário `gabriel.a.almeida.br@gmail.com` continua admin.

<lov-actions>
<lov-open-history>View History</lov-open-history>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>