import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { gerarListaPresenca } from "@/lib/lista-presenca-pdf";
import { fetchSignatureAsCleanDataUrl } from "@/lib/signature-utils";
import { GraduationCap, Search, Printer } from "lucide-react";

/**
 * Conteúdo programático default da Integração (NR-01 item 1.5.7).
 * 1h de carga horária. Editável caso o TST queira customizar.
 */
export const CONTEUDO_PROGRAMATICO_DEFAULT = [
  "1. Riscos ocupacionais existentes no estabelecimento e na atividade.",
  "2. Normas Regulamentadoras (NRs) aplicáveis e regras internas da DMN.",
  "3. EPIs obrigatórios — uso correto, conservação e devolução.",
  "4. Procedimentos de emergência, rota de fuga, ponto de encontro e brigada.",
  "5. Estrutura SESMT/CIPA — quem procurar, canais de denúncia e direito de recusa.",
  "6. Direitos e deveres do trabalhador conforme CLT, NR-01 e política de SST.",
].join("\n");

type Emp = {
  id: string;
  nome: string;
  company_id: string | null;
  role_id: string | null;
  assinatura_url: string | null;
  companies: { name: string } | null;
  roles: { name: string } | null;
};

export function IntegracaoDialog({
  open,
  onOpenChange,
  preselectedEmployeeId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preselectedEmployeeId?: string;
  onSaved?: (integracaoId: string) => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [data, setData] = useState(todayISO);
  const [ch, setCh] = useState("1");
  const [instrutor, setInstrutor] = useState("");
  const [local, setLocal] = useState("DMN — Manaus/AM");
  const [conteudo, setConteudo] = useState(CONTEUDO_PROGRAMATICO_DEFAULT);
  const [obs, setObs] = useState("");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [usarAssinaturas, setUsarAssinaturas] = useState(true);
  const [busy, setBusy] = useState(false);

  // Sugere o nome do usuário logado como instrutor
  useEffect(() => {
    if (!open) return;
    if (!instrutor && user?.user_metadata?.full_name) {
      setInstrutor(String(user.user_metadata.full_name));
    } else if (!instrutor && user?.email) {
      setInstrutor(user.email.split("@")[0]);
    }
  }, [open, user, instrutor]);

  useEffect(() => {
    if (open && preselectedEmployeeId) setSel(new Set([preselectedEmployeeId]));
    if (!open) {
      setSel(new Set());
      setBusca("");
    }
  }, [open, preselectedEmployeeId]);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["integracao-employees-all"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, company_id, role_id, assinatura_url, companies(name), roles(name)")
        .eq("status", "ATIVO")
        .order("nome")
        .limit(3000);
      if (error) throw error;
      return (data ?? []) as unknown as Emp[];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.nome.toLowerCase().includes(q) ||
        (e.companies?.name ?? "").toLowerCase().includes(q) ||
        (e.roles?.name ?? "").toLowerCase().includes(q),
    );
  }, [employees, busca]);

  function toggle(id: string) {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSel(n);
  }

  const selecionados = useMemo(
    () => employees.filter((e) => sel.has(e.id)),
    [employees, sel],
  );

  const salvar = useMutation({
    mutationFn: async () => {
      if (selecionados.length === 0) throw new Error("Selecione ao menos 1 funcionário");
      if (!instrutor.trim()) throw new Error("Informe o nome do instrutor");

      // 1) cria integração
      const { data: integ, error: e1 } = await supabase
        .from("integracoes")
        .insert({
          data_integracao: data,
          carga_horaria_h: Number(ch) || 1,
          instrutor_nome: instrutor.trim(),
          local: local.trim() || null,
          conteudo_programatico: conteudo.trim() || null,
          observacoes: obs.trim() || null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      // 2) participantes
      const rows = selecionados.map((e) => ({
        integracao_id: integ.id,
        employee_id: e.id,
        company_id: e.company_id,
        role_id: e.role_id,
        nome_snapshot: e.nome,
        empresa_snapshot: e.companies?.name ?? null,
        cargo_snapshot: e.roles?.name ?? null,
        assinatura_snapshot: usarAssinaturas ? e.assinatura_url : null,
      }));
      const { error: e2 } = await supabase.from("integracao_participantes").insert(rows);
      if (e2) throw e2;

      // 3) Atualiza matriz de treinamento (se houver curso INTEGRACAO)
      const { data: curso } = await supabase
        .from("training_matrix_courses")
        .select("id")
        .eq("categoria", "INTEGRACAO")
        .eq("ativo", true)
        .maybeSingle();
      if (curso?.id) {
        for (const e of selecionados) {
          const { data: existing } = await supabase
            .from("training_matrix_entries")
            .select("id")
            .eq("employee_id", e.id)
            .eq("course_id", curso.id)
            .maybeSingle();
          if (existing?.id) {
            await supabase
              .from("training_matrix_entries")
              .update({ data_realizacao: data, observacao: "Integração NR-01" })
              .eq("id", existing.id);
          } else {
            await supabase.from("training_matrix_entries").insert({
              employee_id: e.id,
              course_id: curso.id,
              data_realizacao: data,
              observacao: "Integração NR-01",
            });
          }
        }
      }

      return integ.id as string;
    },
    onSuccess: async (id) => {
      toast.success(`Integração registrada para ${selecionados.length} funcionário(s).`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["integracoes"] }),
        qc.invalidateQueries({ queryKey: ["employee"] }),
        qc.invalidateQueries({ queryKey: ["matriz-entries"] }),
      ]);
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  async function gerarPdf() {
    if (selecionados.length === 0) return toast.error("Selecione participantes primeiro");
    if (!instrutor.trim()) return toast.error("Informe o instrutor");
    setBusy(true);
    try {
      const participantes = await Promise.all(
        selecionados.map(async (e) => ({
          nome: e.nome,
          empresa: e.companies?.name ?? "",
          cargo: e.roles?.name ?? "",
          assinaturaDataUrl: usarAssinaturas
            ? await fetchSignatureAsCleanDataUrl(e.assinatura_url)
            : null,
        })),
      );
      participantes.sort((a, b) => (a.empresa || "").localeCompare(b.empresa || "") || a.nome.localeCompare(b.nome));
      const [d, m, y] = data.split("-").reverse().join("/").split("/");
      const dataBR = `${d}/${m}/${y}`;
      const pdf = gerarListaPresenca({
        titulo: "INTEGRAÇÃO DE SEGURANÇA — NR-01",
        instrutor: instrutor.trim(),
        assunto: "Integração de Segurança do Trabalho — conteúdo NR-01 item 1.5.7",
        tipo: "IN COMPANY",
        data: dataBR,
        cargaHoraria: `${ch}h`,
        instituicao: "DMN — SESMT",
        local: local || "DMN — Manaus/AM",
        participantes,
        agruparPorEmpresa: true,
        codigo: "FOR-SEG-INT-01",
        revisao: "00",
        dataDocumento: dataBR,
      });
      pdf.output("dataurlnewwindow");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-emerald-400" /> Registrar Integração NR-01
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wide">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wide">Carga horária (h)</Label>
            <Input type="number" min="0.5" step="0.5" value={ch} onChange={(e) => setCh(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px] font-bold uppercase tracking-wide">Instrutor</Label>
            <Input value={instrutor} onChange={(e) => setInstrutor(e.target.value)} placeholder="Nome de quem ministrou" />
          </div>
          <div className="md:col-span-4">
            <Label className="text-[11px] font-bold uppercase tracking-wide">Local</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <Label className="text-[11px] font-bold uppercase tracking-wide">Conteúdo programático (NR-01)</Label>
            <Textarea rows={6} value={conteudo} onChange={(e) => setConteudo(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="md:col-span-4">
            <Label className="text-[11px] font-bold uppercase tracking-wide">Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Label className="text-[11px] font-bold uppercase tracking-wide">Participantes</Label>
              <Badge variant="secondary">{sel.size} selecionado(s)</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={usarAssinaturas} onCheckedChange={setUsarAssinaturas} id="usar-sig" />
              <Label htmlFor="usar-sig" className="text-[10px] uppercase tracking-wide cursor-pointer">
                Estampar assinaturas cadastradas
              </Label>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, empresa ou cargo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          {isLoading ? (
            <div className="text-sm text-muted-foreground p-4 text-center">Carregando…</div>
          ) : (
            <div className="border rounded mt-2 max-h-72 overflow-auto divide-y">
              {filtrados.slice(0, 500).map((e) => {
                const checked = sel.has(e.id);
                const hasSig = !!e.assinatura_url;
                return (
                  <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(e.id)} />
                    <span className="flex-1 truncate">{e.nome}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{e.companies?.name ?? "—"}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{e.roles?.name ?? "—"}</span>
                    {hasSig ? (
                      <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-700">ASS</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">S/ASS</Badge>
                    )}
                  </label>
                );
              })}
              {filtrados.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 text-center">Nenhum funcionário encontrado</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending || busy}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={gerarPdf} disabled={busy || sel.size === 0}>
            <Printer className="h-4 w-4 mr-1" /> Pré-visualizar PDF
          </Button>
          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || sel.size === 0 || !instrutor.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {salvar.isPending ? "Salvando…" : `Registrar (${sel.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}