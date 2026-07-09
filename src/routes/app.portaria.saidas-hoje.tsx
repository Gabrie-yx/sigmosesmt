// Lista completa das saídas de funcionário validadas hoje pela portaria.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock3, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SignedAvatarImg } from "@/components/signed-avatar-img";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/portaria/saidas-hoje")({
  component: SaidasHojePage,
  head: () => ({
    meta: [
      { title: "Saídas do dia · Portaria · SIGMO" },
      { name: "description", content: "Todos os funcionários que já saíram no expediente hoje, validados pela portaria." },
    ],
  }),
});

function fmtHora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type Turno = "todos" | "manha" | "tarde" | "noite";
function turnoDe(iso: string): Exclude<Turno, "todos"> {
  const h = new Date(iso).getHours();
  if (h >= 5 && h < 12) return "manha";
  if (h >= 12 && h < 18) return "tarde";
  return "noite";
}

function SaidasHojePage() {
  const [busca, setBusca] = useState("");
  const [turno, setTurno] = useState<Turno>("todos");
  const hoje0 = new Date(); hoje0.setHours(0,0,0,0);

  const { data, isLoading } = useQuery({
    queryKey: ["portaria-saidas-hoje-full"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: vals } = await supabase
        .from("portaria_saidas_funcionarios")
        .select("id, saida_expediente_id, employee_id, validada_at, observacao_portaria")
        .gte("validada_at", hoje0.toISOString())
        .order("validada_at", { ascending: false });
      const list = vals ?? [];
      if (list.length === 0) return [];
      const saidaIds = list.map((v) => v.saida_expediente_id).filter(Boolean) as string[];
      const empIds = list.map((v) => v.employee_id).filter(Boolean) as string[];
      const [saidasRes, empsRes] = await Promise.all([
        saidaIds.length
          ? supabase.from("employee_saidas_expediente").select("id, tipo, com_retorno, horario_retorno, horario_saida, motivo").in("id", saidaIds)
          : Promise.resolve({ data: [] as any[] }),
        empIds.length
          ? supabase.from("employees").select("id, nome, matricula, cpf, foto_url").in("id", empIds)
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

  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (data ?? []).filter((v: any) => {
      if (turno !== "todos" && turnoDe(v.validada_at) !== turno) return false;
      if (!b) return true;
      return (
        (v.emp?.nome ?? "").toLowerCase().includes(b) ||
        (v.emp?.matricula ?? "").toLowerCase().includes(b) ||
        (v.emp?.cpf ?? "").toLowerCase().includes(b)
      );
    });
  }, [data, busca, turno]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-primary/95 to-primary/85 text-primary-foreground border-b border-primary/40 shadow-lg">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2.5">
          <Link to="/app/portaria" className="h-10 w-10 rounded-xl bg-white/15 hover:bg-white/25 grid place-items-center ring-1 ring-white/25 shrink-0" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 leading-none">Portaria</p>
            <h1 className="truncate text-lg font-black leading-tight mt-0.5">Saídas de hoje</h1>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-white/20 ring-1 ring-white/25 px-3 h-9 grid place-items-center font-black text-sm">
            {filtradas.length}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, matrícula ou CPF…"
            className="pl-9 h-11"
          />
        </div>

        <Tabs value={turno} onValueChange={(v) => setTurno(v as Turno)}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="todos" className="text-xs"><Filter className="h-3 w-3 mr-1" />Todos</TabsTrigger>
            <TabsTrigger value="manha" className="text-xs">Manhã</TabsTrigger>
            <TabsTrigger value="tarde" className="text-xs">Tarde</TabsTrigger>
            <TabsTrigger value="noite" className="text-xs">Noite</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
          {isLoading && <div className="p-8 text-center text-xs text-muted-foreground">Carregando…</div>}
          {!isLoading && filtradas.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm font-semibold">Nada por aqui</p>
              <p className="text-xs mt-1">Nenhuma saída {turno !== "todos" ? `no turno ${turno}` : "de hoje"} corresponde à busca.</p>
            </div>
          )}
          {filtradas.map((v: any) => (
            <div key={v.id} className="flex items-start gap-3 px-3 py-3">
              {v.emp?.foto_url ? (
                <SignedAvatarImg src={v.emp.foto_url} className="h-12 w-12 rounded-full object-cover object-top border border-border shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted grid place-items-center text-xs font-black text-muted-foreground shrink-0">
                  {v.emp?.nome?.split(/\s+/).map((p: string) => p[0]).slice(0,2).join("").toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground leading-tight">{v.emp?.nome ?? "—"}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                  <span className="inline-flex items-center gap-0.5"><Clock3 className="h-3 w-3" /> {fmtHora(v.validada_at)}</span>
                  {v.emp?.matricula && <span>· Mat. {v.emp.matricula}</span>}
                  {v.saida?.tipo && (
                    <span className="font-semibold uppercase tracking-wider bg-primary/10 text-primary rounded px-1 py-0.5">
                      {v.saida.tipo}
                    </span>
                  )}
                  <span className={`font-semibold uppercase tracking-wider rounded px-1 py-0.5 ${
                    v.saida?.com_retorno ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"
                  }`}>
                    {v.saida?.com_retorno ? `Retorna ${v.saida.horario_retorno?.slice(0,5) ?? ""}` : "Sem retorno"}
                  </span>
                </div>
                {v.saida?.motivo && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2"><span className="font-semibold text-foreground/80">Motivo:</span> {v.saida.motivo}</p>
                )}
                {v.observacao_portaria && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2"><span className="font-semibold text-foreground/80">Obs. portaria:</span> {v.observacao_portaria}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}