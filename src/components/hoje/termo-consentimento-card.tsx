import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, ChevronRight, FileSignature } from "lucide-react";
import { TermoConsentimentoDialog } from "@/components/employees/termo-consentimento-dialog";

export function TermoConsentimentoCard() {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery({
    queryKey: ["termos-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_termos_consentimento_status")
        .select("employee_id, nome, status_probatorio, company_id")
        .order("nome");
      if (error) throw error;
      const rows = data ?? [];
      const blindados = rows.filter((r: any) => r.status_probatorio === "BLINDADO").length;
      const pendentes = rows.filter((r: any) => r.status_probatorio === "PENDENTE_TERMO");
      const semSig = rows.filter((r: any) => r.status_probatorio === "SEM_ASSINATURA").length;
      const total = rows.length;
      return { total, blindados, pendentes, semSig };
    },
  });

  const pendentes = data?.pendentes ?? [];
  const pendCount = pendentes.length;
  const cobertura = data && data.total > 0 ? Math.round((data.blindados / data.total) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-14 pt-4">
      <Card className={`p-5 glass-card transition-colors ${pendCount > 0 ? "hover:border-amber-400/40" : "hover:border-emerald-400/40"}`}>
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${
            pendCount > 0
              ? "bg-amber-500/15 border-amber-400/30"
              : "bg-emerald-500/15 border-emerald-400/30"
          }`}>
            {pendCount > 0
              ? <ShieldAlert className="h-6 w-6 text-amber-300" />
              : <ShieldCheck className="h-6 w-6 text-emerald-300" />}
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-amber-300/80 font-black">
              Blindagem Jurídica das Assinaturas (Lei 14.063/2020)
            </div>
            <div className="text-xl font-black text-rose-50">
              {data?.blindados ?? 0} blindados · {pendCount} pendentes · {data?.semSig ?? 0} sem assinatura
            </div>
            <div className="text-xs text-[rgba(245,225,225,0.6)] mt-0.5">
              Cobertura atual: <strong className="text-rose-100">{cobertura}%</strong> ·
              Pendentes têm assinatura cadastrada mas <em>nunca</em> assinaram o Termo de Consentimento (retroativo).
            </div>
          </div>
          {pendCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-amber-400/40 text-amber-100 hover:bg-amber-400/10"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Recolher" : `Ver ${pendCount}`}
              <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </Button>
          )}
        </div>

        {expanded && pendCount > 0 && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="text-[10px] uppercase tracking-widest text-rose-100/70 font-black mb-2">
              Funcionários pendentes
            </div>
            <div className="max-h-72 overflow-auto divide-y divide-white/5 rounded-lg border border-white/10">
              {pendentes.slice(0, 200).map((p: any) => (
                <button
                  key={p.employee_id}
                  onClick={() => setSelected(p.employee_id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-amber-400/5 text-left"
                >
                  <span className="text-sm text-rose-50 truncate">{p.nome}</span>
                  <Badge className="bg-amber-500/15 text-amber-200 border border-amber-400/30 text-[10px]">
                    <FileSignature className="h-3 w-3 mr-1" /> Gerar termo
                  </Badge>
                </button>
              ))}
              {pendCount > 200 && (
                <div className="text-[10px] text-center text-muted-foreground py-2">
                  Mostrando 200 de {pendCount}. Filtre na lista de funcionários para ver o resto.
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <TermoConsentimentoDialog
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        employeeId={selected}
      />
    </div>
  );
}