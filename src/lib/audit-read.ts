// Trilha de leitura — registra em audit_logs quem abriu uma tela sensível.
// Fire-and-forget: nunca deve derrubar a UI (a função SQL também engole erro).
import { supabase } from "@/integrations/supabase/client";

export type ReadEntity =
  | "employees"          // ficha do funcionário (dados pessoais/CPF)
  | "employee_atestados" // ficha médica / CID
  | "employee_exams"     // ASO
  | "companies"          // dossiê de contratada
  | "hora_extra_sabado"  // folha implícita (extras)
  | "employee_saidas_expediente"
  | "ppp_emissoes"       // PPP (INSS)
  | "prestadores_saude"; // dados médicos de terceiros

export async function logRead(
  entity: ReadEntity,
  entityId: string,
  contexto: Record<string, unknown> = {},
): Promise<void> {
  try {
    await (supabase as any).rpc("log_read", {
      _entity: entity,
      _entity_id: entityId,
      _contexto: contexto,
    });
  } catch {
    // silencioso — trilha de leitura nunca bloqueia a tela
  }
}