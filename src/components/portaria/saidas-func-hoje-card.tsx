// Card do cockpit da Portaria — funcionários que já saíram hoje (validação confirmada).
// Fonte: portaria_saidas_funcionarios (validada_at) + employee_saidas_expediente + employees.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { UserCheck, Clock3, ChevronRight, LogOut } from "lucide-react";
import { SignedAvatarImg } from "@/components/signed-avatar-img";

function fmtHora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SaidasFuncHojeCard({ limit = 5, showLink = true }: { limit?: number; showLink?: boolean }) {
  const hoje0 = new Date(); hoje0.setHours(0,0,0,0);

  const { data } = useQuery({
    queryKey: ["portaria-saidas-func-hoje", limit],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data: vals } = await supabase
        .from("portaria_saidas_funcionarios")
        .select("id, saida_expediente_id, employee_id, validada_at, observacao_portaria")
        .gte("validada_at", hoje0.toISOString())
        .order("validada_at", { ascending: false })
        .limit(limit);
      const list = vals ?? [];
      if (list.length === 0) return [];
      const saidaIds = list.map((v) => v.saida_expediente_id).filter(Boolean) as string[];
      const empIds = list.map((v) => v.employee_id).filter(Boolean) as string[];
      const [saidasRes, empsRes] = await Promise.all([
        saidaIds.length
          ? supabase.from("employee_saidas_expediente")
              .select("id, tipo, com_retorno, horario_retorno, horario_saida, motivo")
              .in("id", saidaIds)
          : Promise.resolve({ data: [] as any[] }),
        empIds.length
          ? supabase.from("employees").select("id, nome, matricula, foto_url").in("id", empIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const sMap = new Map((saidasRes.data ?? []).map((s: any) => [s.id, s]));
      const eMap = new Map((empsRes.data ?? []).map((e: any) => [e.id, e]));
      return list.map((v) => ({
        ...v,
        saida: sMap.get(v.saida_expediente_id) ?? null,
        emp: eMap.get(v.employee_id) ?? null,
      }));
    },
  });

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-muted/40">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5" /> Funcionários que saíram hoje
        </div>
        {showLink && (
          <Link to="/app/portaria/saidas" className="text-[10px] font-black uppercase tracking-wider text-primary inline-flex items-center gap-0.5">
            Ver painel <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="divide-y divide-border">
        {(!data || data.length === 0) && (
          <div className="p-6 text-center text-muted-foreground">
            <LogOut className="h-6 w-6 mx-auto opacity-40 mb-2" />
            <p className="text-xs font-semibold">Ninguém saiu ainda hoje</p>
          </div>
        )}
        {data?.map((v: any) => (
          <div key={v.id} className="flex items-center gap-3 px-3 py-2.5">
            {v.emp?.foto_url ? (
              <SignedAvatarImg src={v.emp.foto_url} className="h-10 w-10 rounded-full object-cover object-top border border-border shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted grid place-items-center text-[10px] font-black text-muted-foreground shrink-0">
                {v.emp?.nome?.split(/\s+/).map((p: string) => p[0]).slice(0,2).join("").toUpperCase() ?? "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate text-foreground">{v.emp?.nome ?? "—"}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-0.5"><Clock3 className="h-3 w-3" /> Saiu {fmtHora(v.validada_at)}</span>
                {v.emp?.matricula && <span>· Mat. {v.emp.matricula}</span>}
                {v.saida?.tipo && (
                  <span className="font-semibold uppercase tracking-wider bg-primary/10 text-primary rounded px-1 py-0.5">
                    {v.saida.tipo}
                  </span>
                )}
              </div>
            </div>
            <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 ${
              v.saida?.com_retorno
                ? "bg-amber-500/15 text-amber-600"
                : "bg-emerald-500/15 text-emerald-600"
            }`}>
              {v.saida?.com_retorno ? `Retorna ${v.saida.horario_retorno?.slice(0,5) ?? ""}` : "Sem retorno"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}