 import { useState, useMemo } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/use-auth";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
import { Wind, Plus, Trash2, AlertTriangle, CheckCircle2, Gauge, Clock, Wrench, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CatalogoGasesManager } from "@/components/sesmt/CatalogoGasesManager";
 import { toast } from "sonner";
 
 type Gas = {
   id: string;
   nome: string;
   simbolo: string;
   unidade: string;
   limite_min: number | null;
   limite_max: number | null;
   descricao_limite: string | null;
   ordem: number;
   ativo: boolean;
 };
 
 type Leitura = {
   gas_id: string;
   simbolo: string;
   unidade: string;
   valor: number | null;
   limite_min: number | null;
   limite_max: number | null;
   fora_limite: boolean;
 };
 
 type Medicao = {
   id: string;
   pte_id: string;
   momento: "ENTRADA" | "PERIODICA" | "SAIDA";
   medido_em: string;
   equipamento_marca: string | null;
   equipamento_modelo: string | null;
   equipamento_serie: string | null;
   calibracao_data: string | null;
   calibracao_validade: string | null;
   executor_id: string | null;
   executor_nome: string | null;
   leituras: Leitura[];
   tem_fora_limite: boolean;
   observacao: string | null;
   created_at: string;
 };
 
 function calcForaLimite(valor: number | null, min: number | null, max: number | null): boolean {
   if (valor === null || Number.isNaN(valor)) return false;
   if (min !== null && valor < min) return true;
   if (max !== null && valor > max) return true;
   return false;
 }
 
 function dtLocal(): string {
   const d = new Date();
   const pad = (n: number) => String(n).padStart(2, "0");
   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
 }
 
 export function PteAtmosferaTab({ petId, employees }: { petId: string | null; employees: any[] }) {
   const qc = useQueryClient();
  const { user, isEditor, isModerator } = useAuth();
   const [showForm, setShowForm] = useState(false);
  const [showCatalogo, setShowCatalogo] = useState(false);
 
   const { data: gases = [] } = useQuery({
     queryKey: ["catalogo-gases-ativos"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("catalogo_gases_atmosfericos")
         .select("*")
         .eq("ativo", true)
         .order("ordem");
       if (error) throw error;
       return (data ?? []) as Gas[];
     },
   });
 
   const { data: medicoes = [] } = useQuery({
     queryKey: ["pte-medicoes-atmosfericas", petId],
     enabled: !!petId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("pte_medicoes_atmosfericas")
         .select("*")
         .eq("pte_id", petId!)
         .order("medido_em", { ascending: false });
       if (error) throw error;
       return (data ?? []) as unknown as Medicao[];
     },
   });
 
   const emptyLeituras = useMemo<Leitura[]>(
     () =>
       gases.map((g) => ({
         gas_id: g.id,
         simbolo: g.simbolo,
         unidade: g.unidade,
         valor: null,
         limite_min: g.limite_min,
         limite_max: g.limite_max,
         fora_limite: false,
       })),
     [gases]
   );
 
   const [form, setForm] = useState({
     momento: "ENTRADA" as "ENTRADA" | "PERIODICA" | "SAIDA",
     medido_em: dtLocal(),
     equipamento_marca: "",
     equipamento_modelo: "",
     equipamento_serie: "",
     calibracao_data: "",
     calibracao_validade: "",
     executor_id: "",
     observacao: "",
     leituras: [] as Leitura[],
   });
 
   function abrirForm() {
     setForm((f) => ({ ...f, medido_em: dtLocal(), leituras: emptyLeituras }));
     setShowForm(true);
   }
 
   function setLeituraValor(idx: number, raw: string) {
     setForm((f) => {
       const next = [...f.leituras];
       const v = raw === "" ? null : Number(raw);
       const cur = next[idx];
       next[idx] = {
         ...cur,
         valor: v,
         fora_limite: calcForaLimite(v, cur.limite_min, cur.limite_max),
       };
       return { ...f, leituras: next };
     });
   }
 
   const create = useMutation({
     mutationFn: async () => {
       if (!petId) throw new Error("Salve a Permissão primeiro");
       if (form.leituras.length === 0) throw new Error("Nenhum gás no catálogo ativo");
       if (form.leituras.some((l) => l.valor === null)) throw new Error("Preencha todos os valores dos gases");
 
       const executor = employees.find((e: any) => e.id === form.executor_id);
       const payload = {
         pte_id: petId,
         momento: form.momento,
         medido_em: new Date(form.medido_em).toISOString(),
         equipamento_marca: form.equipamento_marca || null,
         equipamento_modelo: form.equipamento_modelo || null,
         equipamento_serie: form.equipamento_serie || null,
         calibracao_data: form.calibracao_data || null,
         calibracao_validade: form.calibracao_validade || null,
         executor_id: form.executor_id || null,
         executor_nome: executor?.nome ?? null,
         leituras: form.leituras as any,
         observacao: form.observacao || null,
         created_by: user?.id ?? null,
       };
       const { error } = await supabase.from("pte_medicoes_atmosfericas").insert(payload as any);
       if (error) throw error;
     },
     onSuccess: () => {
       toast.success("Medição registrada");
       qc.invalidateQueries({ queryKey: ["pte-medicoes-atmosfericas", petId] });
       setShowForm(false);
     },
     onError: (err: any) => toast.error(err.message ?? "Erro ao salvar medição"),
   });
 
   const remove = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from("pte_medicoes_atmosfericas").delete().eq("id", id);
       if (error) throw error;
     },
     onSuccess: () => {
       toast.success("Medição removida");
       qc.invalidateQueries({ queryKey: ["pte-medicoes-atmosfericas", petId] });
     },
     onError: (err: any) => toast.error(err.message ?? "Erro ao remover"),
   });
 
   if (!petId) {
     return (
       <div className="mt-6 rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/50 p-6 text-center">
         <Wind className="h-8 w-8 text-cyan-600 mx-auto mb-2" />
         <p className="text-xs font-black uppercase tracking-wider text-cyan-900">FM-SGI-05 — Medição Atmosférica</p>
         <p className="text-[11px] font-bold text-cyan-700 mt-1">
           Salve a Permissão de Entrada primeiro para registrar as medições.
         </p>
       </div>
     );
   }
 
   return (
    <>
    <div className="mt-6 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-white p-5 space-y-4">
       <div className="flex items-center justify-between flex-wrap gap-2">
         <div className="flex items-center gap-2">
           <Wind className="h-5 w-5 text-cyan-700" />
           <h3 className="text-xs font-black uppercase tracking-widest text-cyan-900">
             FM-SGI-05 — Medição Atmosférica (NR-33)
           </h3>
           {medicoes.length > 0 && (
             <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-700 text-white">
               {medicoes.length} {medicoes.length === 1 ? "registro" : "registros"}
             </span>
           )}
         </div>
         {isEditor && !showForm && (
            <div className="flex items-center gap-2">
              {isModerator && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCatalogo(true)}
                  className="text-[10px] font-black uppercase tracking-wider border-cyan-300 text-cyan-800 hover:bg-cyan-50"
                >
                  <Settings2 className="h-3 w-3 mr-1" /> Gerenciar gases
                </Button>
              )}
              <Button type="button" size="sm" onClick={abrirForm} className="bg-cyan-700 hover:bg-cyan-800 text-white text-[10px] font-black uppercase tracking-wider">
                <Plus className="h-3 w-3 mr-1" /> Nova Medição
              </Button>
            </div>
         )}
       </div>
 
       {/* Lista de medições existentes */}
       {medicoes.length === 0 && !showForm && (
         <div className="text-center py-6 text-[11px] font-bold uppercase text-cyan-600">
           Nenhuma medição registrada. NR-33 exige medição antes da entrada e reavaliações periódicas.
         </div>
       )}
 
       {medicoes.map((m) => (
         <div
           key={m.id}
           className={`rounded-xl p-4 border-2 bg-white ${m.tem_fora_limite ? "border-red-400" : "border-cyan-200"}`}
         >
           <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
             <div className="flex items-center gap-2 flex-wrap">
               <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                 m.momento === "ENTRADA" ? "bg-blue-100 text-blue-800" :
                 m.momento === "PERIODICA" ? "bg-amber-100 text-amber-800" :
                 "bg-slate-200 text-slate-700"
               }`}>{m.momento}</span>
               <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                 <Clock className="h-3 w-3" /> {new Date(m.medido_em).toLocaleString("pt-BR")}
               </span>
               {m.executor_nome && (
                 <span className="text-[10px] font-bold text-slate-600">por {m.executor_nome}</span>
               )}
               {m.tem_fora_limite ? (
                 <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-600 text-white flex items-center gap-1">
                   <AlertTriangle className="h-3 w-3" /> FORA DO LIMITE
                 </span>
               ) : (
                 <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-green-600 text-white flex items-center gap-1">
                   <CheckCircle2 className="h-3 w-3" /> CONFORME
                 </span>
               )}
             </div>
             {isEditor && (
               <Button
                 type="button"
                 size="sm"
                 variant="ghost"
                 onClick={() => {
                   if (confirm("Remover esta medição?")) remove.mutate(m.id);
                 }}
                 className="h-7 px-2 text-red-600 hover:bg-red-50"
               >
                 <Trash2 className="h-3 w-3" />
               </Button>
             )}
           </div>
 
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
             {m.leituras.map((l, i) => (
               <div
                 key={i}
                 className={`rounded-lg p-2 border ${l.fora_limite ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}
               >
                 <div className="text-[9px] font-black uppercase text-slate-500">{l.simbolo}</div>
                 <div className={`text-base font-black ${l.fora_limite ? "text-red-700" : "text-slate-800"}`}>
                   {l.valor ?? "—"} <span className="text-[10px] font-bold">{l.unidade}</span>
                 </div>
                 <div className="text-[9px] font-bold text-slate-500 mt-0.5">
                   {l.limite_min !== null && `≥${l.limite_min} `}
                   {l.limite_max !== null && `≤${l.limite_max}`}
                 </div>
               </div>
             ))}
           </div>
 
           {(m.equipamento_marca || m.equipamento_modelo || m.equipamento_serie) && (
             <div className="text-[10px] font-bold text-slate-600 flex items-center gap-1 flex-wrap">
               <Wrench className="h-3 w-3" />
               {[m.equipamento_marca, m.equipamento_modelo, m.equipamento_serie && `S/N ${m.equipamento_serie}`].filter(Boolean).join(" · ")}
               {m.calibracao_validade && (
                 <span className="ml-2">
                   Calibração válida até {new Date(m.calibracao_validade).toLocaleDateString("pt-BR")}
                 </span>
               )}
             </div>
           )}
 
           {m.observacao && (
             <div className="text-[10px] font-bold text-slate-700 mt-2 italic">"{m.observacao}"</div>
           )}
         </div>
       ))}
 
       {/* Formulário de nova medição */}
       {showForm && (
         <div className="rounded-xl p-4 border-2 border-cyan-500 bg-white space-y-3">
           <div className="flex items-center gap-2 mb-2">
             <Gauge className="h-4 w-4 text-cyan-700" />
             <h4 className="text-xs font-black uppercase tracking-widest text-cyan-900">Nova Medição</h4>
           </div>
 
           <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
             <div>
               <Label className="text-[10px] font-black uppercase text-slate-600">Momento *</Label>
               <select
                 value={form.momento}
                 onChange={(e) => setForm({ ...form, momento: e.target.value as any })}
                 className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-cyan-500"
               >
                 <option value="ENTRADA">Entrada</option>
                 <option value="PERIODICA">Periódica</option>
                 <option value="SAIDA">Saída</option>
               </select>
             </div>
             <div>
               <Label className="text-[10px] font-black uppercase text-slate-600">Data/Hora *</Label>
               <Input
                 type="datetime-local"
                 value={form.medido_em}
                 onChange={(e) => setForm({ ...form, medido_em: e.target.value })}
                 className="h-9 text-xs"
               />
             </div>
             <div>
               <Label className="text-[10px] font-black uppercase text-slate-600">Executor</Label>
               <select
                 value={form.executor_id}
                 onChange={(e) => setForm({ ...form, executor_id: e.target.value })}
                 className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500"
               >
                 <option value="">— selecione —</option>
                 {employees.map((e: any) => (
                   <option key={e.id} value={e.id}>{e.nome}</option>
                 ))}
               </select>
             </div>
           </div>
 
           <div>
             <Label className="text-[10px] font-black uppercase text-slate-600 mb-2 block">Leituras dos Gases *</Label>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
               {form.leituras.map((l, idx) => (
                 <div key={l.gas_id} className={`rounded-lg p-2 border ${l.fora_limite ? "border-red-400 bg-red-50" : "border-cyan-200 bg-cyan-50/40"}`}>
                   <div className="text-[9px] font-black uppercase text-slate-700">
                     {l.simbolo} <span className="font-bold text-slate-500">({l.unidade})</span>
                   </div>
                   <Input
                     type="number"
                     step="0.1"
                     placeholder="0.0"
                     value={l.valor ?? ""}
                     onChange={(e) => setLeituraValor(idx, e.target.value)}
                     className={`h-8 text-sm font-black mt-1 ${l.fora_limite ? "border-red-400 text-red-700" : ""}`}
                   />
                   <div className="text-[8px] font-bold text-slate-500 mt-1">
                     {l.limite_min !== null && `≥${l.limite_min} `}
                     {l.limite_max !== null && `≤${l.limite_max}`}
                   </div>
                 </div>
               ))}
             </div>
             {form.leituras.some((l) => l.fora_limite) && (
               <div className="mt-2 rounded-lg bg-red-50 border-2 border-red-300 px-3 py-2 text-[10px] font-black uppercase text-red-800 flex items-center gap-2">
                 <AlertTriangle className="h-4 w-4" /> Atenção: leitura fora dos limites NR-33. Avalie ventilação/exaustão antes de liberar a entrada.
               </div>
             )}
           </div>
 
           <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
             <div>
               <Label className="text-[10px] font-black uppercase text-slate-600">Marca do Equip.</Label>
               <Input value={form.equipamento_marca} onChange={(e) => setForm({ ...form, equipamento_marca: e.target.value })} className="h-9 text-xs" placeholder="Ex: Dräger" />
             </div>
             <div>
               <Label className="text-[10px] font-black uppercase text-slate-600">Modelo</Label>
               <Input value={form.equipamento_modelo} onChange={(e) => setForm({ ...form, equipamento_modelo: e.target.value })} className="h-9 text-xs" placeholder="Ex: X-am 5000" />
             </div>
             <div>
               <Label className="text-[10px] font-black uppercase text-slate-600">Nº Série</Label>
               <Input value={form.equipamento_serie} onChange={(e) => setForm({ ...form, equipamento_serie: e.target.value })} className="h-9 text-xs" placeholder="S/N" />
             </div>
             <div>
               <Label className="text-[10px] font-black uppercase text-slate-600">Última Calibração</Label>
               <Input type="date" value={form.calibracao_data} onChange={(e) => setForm({ ...form, calibracao_data: e.target.value })} className="h-9 text-xs" />
             </div>
             <div>
               <Label className="text-[10px] font-black uppercase text-slate-600">Validade Calib.</Label>
               <Input type="date" value={form.calibracao_validade} onChange={(e) => setForm({ ...form, calibracao_validade: e.target.value })} className="h-9 text-xs" />
             </div>
           </div>
 
           <div>
             <Label className="text-[10px] font-black uppercase text-slate-600">Observações</Label>
             <Textarea
               value={form.observacao}
               onChange={(e) => setForm({ ...form, observacao: e.target.value })}
               rows={2}
               className="text-xs"
               placeholder="Condições de ventilação, anomalias, ações tomadas..."
             />
           </div>
 
           <div className="flex gap-2 pt-1">
             <Button
               type="button"
               size="sm"
               disabled={create.isPending}
               onClick={() => create.mutate()}
               className="bg-cyan-700 hover:bg-cyan-800 text-white text-[10px] font-black uppercase tracking-wider"
             >
               Registrar Medição
             </Button>
             <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-[10px] font-black uppercase tracking-wider">
               Cancelar
             </Button>
           </div>
         </div>
       )}
     </div>
   );
 }