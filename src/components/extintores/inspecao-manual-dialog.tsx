import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ClipboardEdit, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Extintor = { id: string; numero?: string | null; tipo_agente?: string | null; localizacao?: string | null };

export function InspecaoManualDialog({
  extintor,
  open,
  onOpenChange,
  userId,
  userNome,
  onSaved,
}: {
  extintor: Extintor | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId?: string;
  userNome?: string;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<{
    conforme: boolean | null;
    nao_conformidade: string;
    observacoes: string;
    responsavel_nome: string;
    responsavel_registro: string;
  }>({
    conforme: null,
    nao_conformidade: "",
    observacoes: "",
    responsavel_nome: userNome ?? "",
    responsavel_registro: "",
  });

  useEffect(() => {
    setForm((p) => ({ ...p, responsavel_nome: userNome ?? p.responsavel_nome }));
  }, [userNome]);

  // reset ao reabrir
  useEffect(() => {
    if (open) {
      setForm({
        conforme: null,
        nao_conformidade: "",
        observacoes: "",
        responsavel_nome: userNome ?? "",
        responsavel_registro: "",
      });
    }
  }, [open, userNome]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!extintor) throw new Error("Extintor não selecionado");
      const nome = (form.responsavel_nome || "").trim();
      if (!nome) throw new Error("Informe o responsável pela inspeção");
      if (form.conforme === null) throw new Error("Selecione CONFORME ou NÃO CONFORME antes de salvar");
      if (form.conforme === false && !form.nao_conformidade.trim()) {
        throw new Error("Descreva a não conformidade encontrada");
      }
      const hoje = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("extintor_inspecoes").insert({
        extintor_id: extintor.id,
        data_inspecao: hoje,
        conforme: form.conforme!,
        nao_conformidade: form.conforme ? null : (form.nao_conformidade || null),
        observacoes: form.observacoes || null,
        responsavel_nome: nome,
        responsavel_registro: form.responsavel_registro || null,
        created_by: userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inspeção manual registrada");
      qc.invalidateQueries({ queryKey: ["extintor-inspecoes"] });
      qc.invalidateQueries({ queryKey: ["hist-manual", extintor?.id] });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar inspeção"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardEdit className="h-5 w-5 text-emerald-500" />
            Inspeção manual (sem fotos)
          </DialogTitle>
          <DialogDescription>
            Use quando a inspeção for visual no local, sem possibilidade de fotos.
          </DialogDescription>
          {extintor && (
            <div className="text-xs text-muted-foreground mt-1">
              Extintor: <strong className="text-red-500 font-mono">{extintor.numero}</strong>
              {extintor.tipo_agente && <> · {extintor.tipo_agente}</>}
              {extintor.localizacao && <> · {extintor.localizacao}</>}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 text-cyan-400 shrink-0" />
            Data registrada: <strong>hoje</strong>. Responsável: pré-preenchido com seu usuário.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Responsável *</Label>
              <Input
                value={form.responsavel_nome}
                onChange={(e) => setForm((p) => ({ ...p, responsavel_nome: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Registro / matrícula</Label>
              <Input
                placeholder="Ex.: TST-2210"
                value={form.responsavel_registro}
                onChange={(e) => setForm((p) => ({ ...p, responsavel_registro: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-md border px-3 py-2 bg-muted/30 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resultado da inspeção *
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, conforme: true }))}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ${
                  form.conforme === true
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_-4px_rgba(16,185,129,0.6)]"
                    : "border-slate-700 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" /> CONFORME
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, conforme: false }))}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ${
                  form.conforme === false
                    ? "border-red-500 bg-red-500/15 text-red-300 shadow-[0_0_12px_-4px_rgba(239,68,68,0.6)]"
                    : "border-slate-700 text-slate-400 hover:border-red-500/40 hover:text-red-300"
                }`}
              >
                <AlertTriangle className="h-4 w-4" /> NÃO CONFORME
              </button>
            </div>
            {form.conforme === null && (
              <div className="text-[11px] text-amber-400">
                Escolha CONFORME ou NÃO CONFORME — não há valor padrão.
              </div>
            )}
          </div>

          {form.conforme === false && (
            <div>
              <Label className="text-xs">Descrição da NC *</Label>
              <Textarea
                rows={3}
                placeholder="O que está fora do padrão? (ex.: lacre rompido, manômetro na faixa vermelha…)"
                value={form.nao_conformidade}
                onChange={(e) => setForm((p) => ({ ...p, nao_conformidade: e.target.value }))}
              />
            </div>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              placeholder="Notas adicionais (opcional)"
              value={form.observacoes}
              onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-1.5">
            <ClipboardEdit className="h-4 w-4" />
            {salvar.isPending ? "Salvando…" : "Registrar inspeção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}