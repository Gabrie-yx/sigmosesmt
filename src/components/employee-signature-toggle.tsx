import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PenLine, Check } from "lucide-react";

/**
 * Toggle reutilizável "Usar assinatura digital cadastrada".
 * - Busca employees.assinatura_url do funcionário
 * - Quando ligado, dispara onChange(dataUrl); quando desligado, onChange(null)
 * - Lembra a preferência por contexto via localStorage
 */
export function EmployeeSignatureToggle({
  employeeId,
  context,
  onChange,
  label = "Usar assinatura digital cadastrada",
  defaultOn = true,
}: {
  employeeId: string | null | undefined;
  context: string; // ex: "saida-expediente", "termo-perda"
  onChange: (dataUrl: string | null) => void;
  label?: string;
  defaultOn?: boolean;
}) {
  const storageKey = `sig-toggle:${context}`;
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOn;
    const v = window.localStorage.getItem(storageKey);
    return v == null ? defaultOn : v === "1";
  });

  const { data, isLoading } = useQuery({
    queryKey: ["employee-signature", employeeId],
    enabled: !!employeeId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("nome, assinatura_url")
        .eq("id", employeeId!)
        .maybeSingle();
      return data ?? null;
    },
  });

  const sigUrl = (data as any)?.assinatura_url ?? null;
  const nome = (data as any)?.nome ?? "funcionário";

  useEffect(() => {
    if (!employeeId) {
      onChange(null);
      return;
    }
    if (on && sigUrl) onChange(sigUrl);
    else onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, sigUrl, employeeId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, on ? "1" : "0");
    }
  }, [on, storageKey]);

  if (!employeeId) return null;

  const hasSig = !!sigUrl;

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <PenLine className="h-4 w-4 mt-0.5 text-brand shrink-0" />
        <div className="min-w-0">
          <Label className="text-[11px] font-bold uppercase tracking-wide">{label}</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
            {isLoading
              ? "Verificando assinatura cadastrada…"
              : hasSig
                ? `${nome} já possui assinatura cadastrada na ficha. Será estampada automaticamente no PDF.`
                : `${nome} ainda não tem assinatura cadastrada. Suba o PNG na ficha do funcionário para usar este recurso.`}
          </p>
          {hasSig && on && (
            <div className="mt-1.5 flex items-center gap-2">
              <img
                src={sigUrl}
                alt="Assinatura"
                className="h-9 bg-white/90 border border-white/10 rounded px-1 object-contain"
              />
              <span className="text-[10px] text-emerald-300 font-bold inline-flex items-center gap-0.5">
                <Check className="h-3 w-3" /> Ativa
              </span>
            </div>
          )}
        </div>
      </div>
      <Switch checked={on && hasSig} disabled={!hasSig} onCheckedChange={setOn} />
    </div>
  );
}