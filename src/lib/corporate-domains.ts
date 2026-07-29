/**
 * Domínios corporativos do grupo (DMN / ATEM e afins).
 *
 * Regra de segurança (29/07/2026): qualquer conta em domínio corporativo
 * tem MFA OBRIGATÓRIO e SEM período de carência (grace). Sem 2FA verificado
 * (AAL2) a conta não acessa nenhuma área do SIGMO além da tela de segurança.
 *
 * Contas em domínios públicos (gmail, hotmail, etc.) continuam sob a regra
 * anterior: MFA exigido para quem tem papel, com carência de 7 dias.
 */
export const CORPORATE_EMAIL_DOMAINS = [
  "dmnestaleiro.com.br",
  "dmnestaleiro.com",
  "atem.com.br",
  "atem.com",
  "grupoatem.com.br",
] as const;

/** Sufixos de domínio corporativo — cobre subdomínios (ex: ti.atem.com.br). */
export function isCorporateEmail(email?: string | null): boolean {
  if (!email) return false;
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return CORPORATE_EMAIL_DOMAINS.some(
    (d) => domain === d || domain.endsWith(`.${d}`),
  );
}
