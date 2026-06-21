import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldAlert, CheckCircle2, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";

export type RevalidarItem = {
  id: string;
  numero: string;
  cascoLabel?: string | null;
  data_validade?: string | null;
  validade_dias: number;
  exige_pte: boolean;
  ptesVinculadas: number;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: RevalidarItem[];
  onOpenApr: (aprId: string) => void;
  onDone?: () => void;
}

export function RevalidarLoteDialog({ open, onOpenChange, items, onOpenApr, onDone }: Props) {
  const qc = useQueryClient();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const auto = useMemo(
    () => items.filter((i) => !i.exige_pte || i.ptesVinculadas > 0),
    [items],
  );
  const manual = useMemo(
    () => items.filter((i) => i.exige_pte && i.ptesVinculadas === 0),
    [items],
  );

  const revalidar = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const results: { id: string; ok: boolean; error?: string }[] = [];
      for (const it of auto) {
        if (done.has(it.id)) continue;
        const d = new Date(today + "T00:00:00");
        d.setDate(d.getDate() + (it.validade_dias || 0));
        const novaValidade = d.toISOString().slice(0, 10);
        const { error } = await supabase
          .from("aprs")
          .update({
            data_emissao: today,
            data_validade: novaValidade,
            status: "ATIVA",
          })
          .eq("id", it.id);
        if (error) {
          results.push({ id: it.id, ok: false, error: error.message });
        } else {
          results.push({ id: it.id, ok: true });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const newDone = new Set(done);
      const newErrors = { ...errors };
      let okCount = 0;
      let failCount = 0;
      for (const r of results) {
        if (r.ok) {
          newDone.add(r.id);
          delete newErrors[r.id];
          okCount++;
        } else {
          newErrors[r.id] = r.error ?? "Falha";
          failCount++;
        }
      }
      setDone(newDone);
      setErrors(newErrors);
      qc.invalidateQueries({ queryKey: ["aprs"] });
      qc.invalidateQueries({ queryKey: ["ptes-by-apr"] });
      if (okCount > 0) toast.success(`${okCount} APR(s) revalidada(s)`);
      if (failCount > 0) toast.error(`${failCount} falharam — confira a lista`);
      onDone?.();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function close() {
    setDone(new Set());
    setErrors({});
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-100">
            <RefreshCw className="h-5 w-5" /> Revalidar APRs em lote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {auto.length > 0 && (
            <section className="rounded-lg border border-emerald-500/30 bg-emerald-950/15">
              <header className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" /> Prontas para revalidar ({auto.length})
                </div>
                <Button
                  size="sm"
                  className="h-7 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white hover:from-emerald-500 hover:to-emerald-700"
                  onClick={() => revalidar.mutate()}
                  disabled={revalidar.isPending || auto.every((i) => done.has(i.id))}
                >
                  {revalidar.isPending
                    ? "Processando..."
                    : auto.every((i) => done.has(i.id))
                      ? "Concluído"
                      : `Revalidar todas (${auto.filter((i) => !done.has(i.id)).length})`}
                </Button>
              </header>
              <ul className="divide-y divide-white/5">
                {auto.map((it) => {
                  const ok = done.has(it.id);
                  const err = errors[it.id];
                  return (
                    <li key={it.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="font-bold text-rose-100 w-28 truncate">{it.numero}</span>
                      {it.cascoLabel && (
                        <span className="text-rose-200/70">{it.cascoLabel}</span>
                      )}
                      <span className="text-rose-200/50 ml-auto">
                        vencia {it.data_validade ? formatDateBR(it.data_validade) : "—"}
                      </span>
                      <span className="text-rose-200/60">+{it.validade_dias}d</span>
                      {ok ? (
                        <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40 text-[9px]">
                          OK
                        </Badge>
                      ) : err ? (
                        <Badge variant="destructive" className="text-[9px]" title={err}>
                          ERRO
                        </Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {manual.length > 0 && (
            <section className="rounded-lg border border-amber-500/30 bg-amber-950/15">
              <header className="flex items-center gap-2 px-3 py-2 border-b border-amber-500/20 text-xs font-black uppercase text-amber-200">
                <ShieldAlert className="h-4 w-4" /> Precisam resolver PTE ({manual.length})
              </header>
              <ul className="divide-y divide-white/5">
                {manual.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="font-bold text-rose-100 w-28 truncate">{it.numero}</span>
                    {it.cascoLabel && (
                      <span className="text-rose-200/70">{it.cascoLabel}</span>
                    )}
                    <span className="text-amber-200/80 ml-auto">PTE pendente</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-400/40 text-amber-100 hover:bg-amber-500/10"
                      onClick={() => onOpenApr(it.id)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Abrir APR
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="px-3 py-2 text-[10px] text-amber-200/70">
                Resolva a PTE dentro da APR, salve, e ela some daqui automaticamente.
              </p>
            </section>
          )}

          {items.length === 0 && (
            <div className="text-center text-xs text-rose-200/60 py-8">
              Nenhuma APR selecionada.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}