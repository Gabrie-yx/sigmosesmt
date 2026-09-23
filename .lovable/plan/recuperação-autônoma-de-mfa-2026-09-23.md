# Recuperação autônoma de MFA

## Objetivo
Permitir que o próprio usuário recupere o acesso após perder ou trocar o celular, sem SQL, suporte técnico ou IA.

## Implementação
- Adicionar no desafio de MFA a opção **“Perdi acesso ao autenticador”**.
- Pedir novamente a senha da conta antes de qualquer remoção.
- Validar a senha no servidor e remover somente os fatores MFA da própria conta.
- Encerrar todas as sessões após a recuperação e voltar ao login para cadastrar um novo autenticador.
- Registrar a recuperação no histórico de auditoria.
- Corrigir a tela de Segurança para reconhecer fatores removidos e permitir gerar um novo QR Code sem erro de AAL2.
- Adicionar, na administração de usuários, uma ação para um administrador redefinir o MFA de outro usuário como contingência.

## Segurança
- A recuperação nunca permitirá informar outro usuário: o alvo será sempre a identidade validada da sessão.
- A senha atual será obrigatória e não será armazenada nem registrada.
- A redefinição administrativa continuará restrita ao papel administrador e ficará auditada.
- O sistema exibirá confirmação clara de que todas as sessões serão encerradas.

## Validação
- Testar o fluxo completo: login com senha → desafio MFA → recuperação → novo login → cadastro do novo QR Code.
- Verificar que senha errada não remove o MFA e que usuários comuns não conseguem redefinir o MFA de terceiros.
