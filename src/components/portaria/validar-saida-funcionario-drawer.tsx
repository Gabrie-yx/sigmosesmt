// Drawer "Validar Saída de Funcionário".
// Busca por CPF/nome as autorizações do SESMT (employee_saidas_expediente)
// que ainda não foram validadas fisicamente (não existe linha em
// portaria_saidas_funcionarios). Ao confirmar, grava o check-out físico e
// o registro entra na trilha de auditoria via trigger.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SignedAvatarImg } from "@/components/signed-avatar-img";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, Search, User, AlertCircle, Clock, ArrowRightCircle } from "lucide-react";
import { formatCPFFromDigits, onlyDigits } from "@/lib/validators/cpf";

type SaidaAutorizada = {
  id: string;
  employee_id: string;
  data: string;
  horario_saida: string;
  horario_retorno: string | null;
  com_retorno: boolean;
  tipo: string;
  motivo: string | null;
  observacao: string | null;
  employees: { id: string; nome: string; cpf: string | null; foto_url: string | null; matricula: string | null };
};

export function ValidarSaidaFuncionarioDrawer({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [selecionada, setSelecionada] = useState<SaidaAutorizada | null>(null);
  const [obs, setObs] = useState("");

  // Lista de saídas do dia sem validação física
  const { data: pendentes, isLoading, refetch } = useQuery({
    queryKey: ["portaria-saidas-pendentes"],
    enabled: open,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      // Últimos 3 dias (o funcionário pode ter autorizado ontem e sair hoje cedo)
      const desde = new Date(); desde.setDate(desde.getDate() - 3);
      const desdeIso = desde.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("employee_saidas_expediente")
        .select("id, employee_id, data, horario_saida, horario_retorno, com_retorno, tipo, motivo, observacao, employees:employee_id(id,nome,cpf,foto_url,matricula)")
        .gte("data", desdeIso)
        .lte("data", hoje)
        .order("data", { ascending: false })
        .order("horario_saida", { ascending: false });
      if (error) throw error;
      // filtra as que já foram validadas
      const ids = (data ?? []).map((s: any) => s.id);
      if (ids.length === 0) return [];
      const { data: validadas } = await supabase
        .from("portaria_saidas_funcionarios")
        .select("saida_expediente_id")
        .in("saida_expediente_id", ids);
      const validSet = new Set((validadas ?? []).map((v: any) => v.saida_expediente_id));
      return (data ?? []).filter((s: any) => !validSet.has(s.id)) as SaidaAutorizada[];
    },
  });

  useEffect(() => { if (!open) { setSelecionada(null); setObs(""); setQ(""); } }, [open]);

  const filtered = (pendentes ?? []).filter((s) => {
    if (!q.trim()) return true;
    const n = q.trim().toLowerCase();
    const cpfDig = onlyDigits(q);
    return (
      s.employees?.nome?.toLowerCase().includes(n) ||
      (cpfDig && (s.employees?.cpf ?? "").includes(cpfDig))
    );
  });

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!selecionada) throw new Error("Nenhuma saída selecionada");
      const { error } = await supabase.from("portaria_saidas_funcionarios").insert({
        saida_expediente_id: selecionada.id,
        employee_id: selecionada.employee_id,
        validada_por_user_id: user?.id ?? null,
        observacao_portaria: obs.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saída validada");
      qc.invalidateQueries({ queryKey: ["portaria-saidas-pendentes"] });
      qc.invalidateQueries({ queryKey: ["portaria-kpis"] });
      setSelecionada(null); setObs(""); refetch();
    },
    onError: (e: any) => toast.error("Falha: " + e.message),
  });

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="bg-amber-500 text-white">
          <DrawerTitle className="font-black text-lg">Validar Saída de Funcionário</DrawerTitle>
          <p className="text-[10px] uppercase tracking-widest text-white/80">Confirme visualmente antes de liberar a saída física</p>
        </DrawerHeader>

        <div className="p-4 overflow-y-auto flex-1">
          {!selecionada ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por CPF ou nome…" className="h-12 pl-10 text-base" autoFocus />
              </div>

              {isLoading ? (
                <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-bold uppercase tracking-widest">Nenhuma saída autorizada pendente</p>
                  <p className="text-xs mt-1">Peça ao SESMT para gerar a autorização primeiro.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((s) => (
                    <button key={s.id} onClick={() => setSelecionada(s)}
                      className="w-full text-left rounded-2xl bg-white border-2 border-slate-200 hover:border-amber-400 p-3 flex items-center gap-3 shadow-sm">
                      {s.employees?.foto_url
                        ? <SignedAvatarImg src={s.employees.foto_url} className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow" />
                        : <div className="h-14 w-14 rounded-full bg-slate-300 text-white font-black flex items-center justify-center">
                            {s.employees?.nome?.split(/\s+/).map((p) => p[0]).slice(0,2).join("").toUpperCase()}
                          </div>}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate">{s.employees?.nome}</p>
                        <p className="text-[10px] text-slate-500">{s.employees?.cpf ? formatCPFFromDigits(s.employees.cpf) : ""}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">{s.tipo}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">{s.com_retorno ? "COM RETORNO" : "SEM RETORNO"}</span>
                          <span className="text-[9px] text-slate-500 inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {s.horario_saida?.slice(0,5)} · {new Date(s.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <ArrowRightCircle className="h-6 w-6 text-amber-500 flex-none" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center">
                {selecionada.employees?.foto_url
                  ? <SignedAvatarImg src={selecionada.employees.foto_url} className="h-40 w-40 rounded-3xl object-cover ring-4 ring-white shadow-lg" />
                  : <div className="h-40 w-40 rounded-3xl bg-slate-300 text-white font-black text-4xl flex items-center justify-center ring-4 ring-white shadow-lg">
                      {selecionada.employees?.nome?.split(/\s+/).map((p) => p[0]).slice(0,2).join("").toUpperCase()}
                    </div>}
                <h3 className="font-black text-xl mt-3">{selecionada.employees?.nome}</h3>
                <p className="text-xs text-slate-500">{selecionada.employees?.cpf ? formatCPFFromDigits(selecionada.employees.cpf) : ""} · Mat. {selecionada.employees?.matricula ?? "—"}</p>
              </div>

              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 text-xs uppercase tracking-widest font-bold">Tipo</span><span className="font-black">{selecionada.tipo}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 text-xs uppercase tracking-widest font-bold">Retorno</span><span className="font-black">{selecionada.com_retorno ? `Sim (${selecionada.horario_retorno?.slice(0,5) ?? "—"})` : "Não"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 text-xs uppercase tracking-widest font-bold">Horário</span><span className="font-black">{selecionada.horario_saida?.slice(0,5)}</span></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-widest font-bold block">Motivo</span><span className="text-sm">{selecionada.motivo ?? "—"}</span></div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observação (opcional)</label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="mt-1" placeholder="Ex.: saiu de moto, sem uniforme, etc." />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelecionada(null)} className="h-14">Voltar</Button>
                <Button onClick={() => confirmar.mutate()} disabled={confirmar.isPending}
                  className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest">
                  {confirmar.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5 mr-1" /> Confirmar Saída</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}