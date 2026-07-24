import { createServerFn } from "@tanstack/react-start";

export type PsicoValidateResult =
  | {
      ok: true;
      campanha: { id: string; titulo: string; descricao: string | null; instrumento: string; termo_lgpd: string | null };
      ghe: { id: string | null; label: string | null };
    }
  | { ok: false; motivo: string };

/**
 * Valida o token psicossocial direto no servidor (SSR-friendly).
 * Usado pelo loader da rota /psico/$token pra evitar o round-trip
 * client-side de fetch("/api/public/psico/:hash") que estava fazendo
 * a página abrir só depois de 2 esperas em série.
 */
export const validatePsicoToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    if (!input?.token || typeof input.token !== "string") throw new Error("token_invalido");
    return { token: input.token };
  })
  .handler(async ({ data }): Promise<PsicoValidateResult> => {
    const { createHash } = await import("crypto");
    const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
    const hash = sha256(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tok, error } = await supabaseAdmin
      .from("psico_tokens")
      .select("id, campanha_id, ghe_id, usado_em, expira_em")
      .eq("token_hash", hash)
      .maybeSingle();

    if (error) return { ok: false, motivo: "DB" };
    if (!tok) return { ok: false, motivo: "TOKEN_INVALIDO" };
    if (tok.usado_em) return { ok: false, motivo: "TOKEN_JA_USADO" };
    if (new Date(tok.expira_em).getTime() < Date.now())
      return { ok: false, motivo: "TOKEN_EXPIRADO" };

    const { data: camp } = await supabaseAdmin
      .from("psico_campanhas")
      .select("id, titulo, descricao, status, instrumento, termo_lgpd")
      .eq("id", tok.campanha_id)
      .maybeSingle();

    if (!camp || camp.status !== "ATIVA") return { ok: false, motivo: "CAMPANHA_INATIVA" };

    let gheLabel: string | null = null;
    if (tok.ghe_id) {
      const { data: g } = await supabaseAdmin
        .from("pgr_ghe")
        .select("numero, setor")
        .eq("id", tok.ghe_id)
        .maybeSingle();
      if (g) gheLabel = `GHE ${g.numero} — ${g.setor}`;
    }

    return {
      ok: true,
      campanha: {
        id: camp.id,
        titulo: camp.titulo,
        descricao: camp.descricao,
        instrumento: camp.instrumento,
        termo_lgpd: (camp as any).termo_lgpd ?? null,
      },
      ghe: { id: tok.ghe_id, label: gheLabel },
    };
  });