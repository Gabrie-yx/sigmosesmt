import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, XCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { extrairParticipantesDaLista } from "@/lib/cursos-ocr.functions";
import { supabase } from "@/integrations/supabase/client";

type Match = {
  detectado: { nome: string; assinou: boolean; matricula?: string };
  employee_id: string;
  nome_base: string;
  score: number;
  ja_inscrito: boolean;
};

export function ExtrairListaIADialog({
  trainingId,
  anexoPath,
  onClose,
  onConfirmado,
}: {
  trainingId: string;
  anexoPath: string;
  onClose: () => void;
  onConfirmado: () => void;
}) {
  const extrair = useServerFn(extrairParticipantesDaLista);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [matchExato, setMatchExato] = useState<Match[]>([]);
  const [matchAprox, setMatchAprox] = useState<Match[]>([]);
  const [naoEnc, setNaoEnc] = useState<Array<{ nome: string; assinou: boolean }>>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await extrair({ data: { trainingId, anexoPath } });
        if (cancelled) return;
        if (res.error) setErro(res.error);
        setMatchExato(res.matchExato ?? []);
        setMatchAprox(res.matchAproximado ?? []);
        setNaoEnc(res.naoEncontrados ?? []);
        // Pré-seleciona match exato não-inscrito
        const ini: Record<string, boolean> = {};
        (res.matchExato ?? []).forEach((m: Match) => {
          if (!m.ja_inscrito) ini[m.employee_id] = true;
        });
        setSel(ini);
      } catch (e: any) {
        if (!cancelled) setErro(e?.message ?? "Erro ao analisar lista");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inserir = useMutation({
    mutationFn: async () => {
      const ids = Object.entries(sel).filter(([, v]) => v).map(([k]) => k);
      if (ids.length === 0) return { count: 0 };
      const rows = ids.map((employee_id) => ({
        training_id: trainingId,
        employee_id,
        situacao: "PRESENTE" as const,
      }));
      const { error } = await supabase.from("training_attendees").insert(rows);
      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: ({ count }) => {
      toast.success(`${count} participante(s) adicionado(s)`);
      onConfirmado();
      onClose();
    },
    onError: (e: any) => toast.error(`Falha: ${e?.message ?? "erro"}`),
  });

  const totalSelecionados = Object.values(sel).filter(Boolean).length;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Extrair Participantes da Lista (IA)
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
            <div className="text-sm text-slate-600">Analisando lista com IA de visão...</div>
            <div className="text-[10px] text-slate-400">Isso pode levar 10-30 segundos</div>
          </div>
        )}

        {!loading && erro && (
          <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
            <div className="font-bold mb-1">⚠️ {erro}</div>
            <div className="text-xs text-red-600">Verifique se a lista de presença está legível e tente novamente.</div>
          </div>
        )}

        {!loading && !erro && (
          <div className="flex-1 overflow-auto space-y-4 pr-1">
            {/* Match exato */}
            {matchExato.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase text-emerald-700 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Match exato ({matchExato.length})
                </h3>
                <div className="space-y-1">
                  {matchExato.map((m) => (
                    <Row key={m.employee_id + m.detectado.nome} match={m} checked={!!sel[m.employee_id]} onToggle={(v) => setSel((s) => ({ ...s, [m.employee_id]: v }))} tone="emerald" />
                  ))}
                </div>
              </section>
            )}

            {/* Match aproximado */}
            {matchAprox.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase text-amber-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Match aproximado ({matchAprox.length}) — confirme antes de adicionar
                </h3>
                <div className="space-y-1">
                  {matchAprox.map((m) => (
                    <Row key={m.employee_id + m.detectado.nome} match={m} checked={!!sel[m.employee_id]} onToggle={(v) => setSel((s) => ({ ...s, [m.employee_id]: v }))} tone="amber" />
                  ))}
                </div>
              </section>
            )}

            {/* Não encontrados */}
            {naoEnc.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-1">
                  <XCircle className="h-4 w-4" /> Não encontrados na base ({naoEnc.length})
                </h3>
                <div className="space-y-1">
                  {naoEnc.map((n, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-slate-50 text-xs">
                      <XCircle className="h-3.5 w-3.5 text-slate-400" />
                      <span className="flex-1 text-slate-700">{n.nome}</span>
                      <span className="text-[10px] text-slate-400 italic">cadastre o funcionário primeiro</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {matchExato.length === 0 && matchAprox.length === 0 && naoEnc.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-500">Nenhum nome detectado.</div>
            )}
          </div>
        )}

        {!loading && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              <UserCheck className="h-3.5 w-3.5 inline mr-1" />
              {totalSelecionados} selecionado(s) para adicionar
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" disabled={totalSelecionados === 0 || inserir.isPending} onClick={() => inserir.mutate()}>
                {inserir.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Adicionar {totalSelecionados} participante(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ match, checked, onToggle, tone }: { match: Match; checked: boolean; onToggle: (v: boolean) => void; tone: "emerald" | "amber" }) {
  const border = tone === "emerald" ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40";
  const namesDiffer = match.detectado.nome.trim().toLowerCase() !== match.nome_base.trim().toLowerCase();
  return (
    <div className={`flex items-center gap-2 p-2 rounded border ${border} text-xs ${match.ja_inscrito ? "opacity-50" : ""}`}>
      <Checkbox checked={checked} disabled={match.ja_inscrito} onCheckedChange={(v) => onToggle(!!v)} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-slate-800 truncate">{match.nome_base}</div>
        {namesDiffer && (
          <div className="text-[10px] text-slate-500 truncate">
            Lido: <span className="italic">{match.detectado.nome}</span>
          </div>
        )}
      </div>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
        {Math.round(match.score * 100)}%
      </span>
      {match.detectado.assinou ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">✓ assinou</span>
      ) : (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">sem assinatura</span>
      )}
      {match.ja_inscrito && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">já inscrito</span>}
    </div>
  );
}