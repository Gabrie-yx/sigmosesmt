import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ClipboardList, HourglassIcon, ShieldAlert, Users,
  ChevronDown, ChevronUp, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/app/extra-sabado-aprovacoes")({
  component: AprovacoesPage,
});

type Convocacao = {
  id: string; data: string; tipo_convocacao: "SABADO"|"DIAS_UTEIS";
  horario_inicio: string; horario_fim: string;
  justificativa: string; status: "PENDENTE"|"APROVADA"|"INDEFERIDA";
  lider_nome: string; qtd_marcados: number; criado_em: string;
};

function AprovacoesPage() {
  const { isAdmin, isSupervisorExtraGeral, loading } = useAuth();
  const qc = useQueryClient();
  const [aberta, setAberta] = useState<string | null>(null);
  const [indeferirId, setIndeferirId] = useState<string | null>(null);

  const podeDecidir = isAdmin || isSupervisorExtraGeral;

  const { data: convs, isLoading } = useQuery({
    queryKey: ["convocacoes-supervisor"],
    enabled: podeDecidir,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_convocacoes_pendentes_supervisor");
      if (error) throw error;
      return (data ?? []) as Convocacao[];
    },
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("decidir_convocacao_extra", {
        _hora_extra_id: id, _aprovar: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convocação aprovada");
      qc.invalidateQueries({ queryKey: ["convocacoes-supervisor"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando…</div>;

  if (!podeDecidir) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
        <h1 className="text-xl font-black">Sem acesso</h1>
        <p className="text-sm text-muted-foreground">
          Apenas o Supervisor Geral (Anderson) ou administradores podem aprovar convocações de extra.
        </p>
        <Button asChild variant="secondary"><Link to="/app">Voltar</Link></Button>
      </div>
    );
  }

  const pendentes = (convs ?? []).filter(c => c.status === "PENDENTE");
  const decididas = (convs ?? []).filter(c => c.status !== "PENDENTE");

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-black">Convocações de Extra</h1>
          <p className="text-sm text-muted-foreground">Aprovar ou indeferir com base na justificativa do líder.</p>
        </div>
      </div>

      {/* Pendentes */}
      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-amber-600 mb-3 flex items-center gap-2">
          <HourglassIcon className="h-4 w-4" /> Pendentes ({pendentes.length})
        </h2>
        {isLoading ? (
          <div className="text-sm text-slate-500">Carregando…</div>
        ) : pendentes.length === 0 ? (
          <div className="text-sm text-slate-500 border rounded-lg p-4 text-center">Sem convocações pendentes.</div>
        ) : (
          <div className="space-y-2">
            {pendentes.map(c => (
              <ConvocacaoCard key={c.id} c={c} aberta={aberta === c.id}
                onToggle={() => setAberta(aberta === c.id ? null : c.id)}
                onAprovar={() => aprovar.mutate(c.id)}
                onIndeferir={() => setIndeferirId(c.id)}
                aprovando={aprovar.isPending}
              />
            ))}
          </div>
        )}
      </section>

      {/* Histórico */}
      {decididas.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Histórico ({decididas.length})
          </h2>
          <div className="space-y-2">
            {decididas.map(c => (
              <ConvocacaoCard key={c.id} c={c} aberta={aberta === c.id}
                onToggle={() => setAberta(aberta === c.id ? null : c.id)}
              />
            ))}
          </div>
        </section>
      )}

      <IndeferirDialog
        convId={indeferirId}
        onClose={() => setIndeferirId(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["convocacoes-supervisor"] })}
      />
    </div>
  );
}

function ConvocacaoCard({ c, aberta, onToggle, onAprovar, onIndeferir, aprovando }: {
  c: Convocacao; aberta: boolean; onToggle: () => void;
  onAprovar?: () => void; onIndeferir?: () => void; aprovando?: boolean;
}) {
  const dataFmt = new Date(c.data + "T12:00").toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short",
  });
  const badge = c.status === "PENDENTE" ? "bg-amber-100 text-amber-800 border-amber-300"
    : c.status === "APROVADA" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : "bg-red-100 text-red-800 border-red-300";

  return (
    <div className="rounded-xl border bg-card">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold">{c.lider_nome}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded border font-black ${badge}`}>{c.status}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
              {c.tipo_convocacao === "DIAS_UTEIS" ? "Dia útil" : "Sábado"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {dataFmt} · {c.horario_inicio}–{c.horario_fim} · <Users className="inline h-3 w-3" /> {c.qtd_marcados}
          </div>
        </div>
        {aberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {aberta && (
        <div className="p-3 border-t space-y-3 bg-muted/20">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Justificativa</div>
            <div className="text-sm whitespace-pre-wrap">{c.justificativa}</div>
          </div>
          {c.status === "PENDENTE" && onAprovar && onIndeferir && (
            <div className="flex gap-2">
              <Button onClick={onAprovar} disabled={aprovando} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
              </Button>
              <Button onClick={onIndeferir} variant="destructive" className="flex-1">
                <XCircle className="h-4 w-4 mr-1" /> Indeferir
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IndeferirDialog({ convId, onClose, onDone }: {
  convId: string | null; onClose: () => void; onDone: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirmar() {
    if (motivo.trim().length < 5) return toast.error("Motivo muito curto");
    setSaving(true);
    const { error } = await supabase.rpc("decidir_convocacao_extra", {
      _hora_extra_id: convId, _aprovar: false, _motivo: motivo,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Convocação indeferida");
    setMotivo("");
    onDone();
    onClose();
  }

  return (
    <Dialog open={!!convId} onOpenChange={(o) => { if (!o) { onClose(); setMotivo(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Indeferir convocação</DialogTitle>
          <DialogDescription>O líder verá o motivo. Seja objetivo.</DialogDescription>
        </DialogHeader>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4}
          placeholder="Ex: escopo já coberto pela produção contratada, sem urgência para justificar hora extra..." />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmar} disabled={saving}>
            {saving ? "Enviando…" : "Confirmar indeferimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
