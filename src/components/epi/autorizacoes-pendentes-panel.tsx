import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { PdfSignerDialog } from "@/components/pdf-signer-dialog";
import { openTermoPerdaPdf } from "@/lib/epi-termo-perda-pdf";
import {
  MOTIVO_EPI_LABEL, MOTIVO_EPI_COR, tempoRestante,
  type AutorizacaoEpi, type MotivoEntregaEpi,
} from "@/lib/epi-autorizacoes";
import {
  PackageCheck, Clock, AlertTriangle, Ban, User, Building2, CheckCircle2,
} from "lucide-react";

type Row = AutorizacaoEpi & {
  employees?: {
    nome: string; cpf: string | null; matricula: string | null;
    assinatura_url: string | null; company_id: string | null;
    companies?: { name: string | null } | null;
    roles?: { name: string | null } | null;
  } | null;
};

const SELECT = `
  *,
  employees:employee_id ( nome, cpf, matricula, assinatura_url, company_id,
    companies:company_id ( name ), roles:role_id ( name ) )
`;

/** Hook compartilhado: autorizações pendentes (não expiradas). */
export function useAutorizacoesPendentes() {
  return useQuery({
    queryKey: ["epi_autorizacoes", "pendentes"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("epi_autorizacoes")
        .select(SELECT)
        .eq("status", "PENDENTE")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const vencidas = rows.filter((r) => new Date(r.expira_em).getTime() <= Date.now());
      if (vencidas.length) {
        // best-effort: marca as vencidas como expiradas
        await (supabase as any)
          .from("epi_autorizacoes")
          .update({ status: "EXPIRADA" })
          .in("id", vencidas.map((v) => v.id));
      }
      return rows.filter((r) => new Date(r.expira_em).getTime() > Date.now());
    },
  });
}

export function AutorizacoesPendentesPanel({ compact = false }: { compact?: boolean }) {
  const { data: rows = [], isLoading } = useAutorizacoesPendentes();
  const [entregar, setEntregar] = useState<Row | null>(null);

  if (isLoading) return null;
  if (!rows.length) {
    if (compact) return null;
    return (
      <Card className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        Nenhuma entrega de EPI aguardando o almoxarifado.
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4 border-primary/40 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
            Entregas autorizadas aguardando o almoxarifado
          </h3>
          <Badge className="bg-primary text-primary-foreground">{rows.length}</Badge>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <LinhaAutorizacao key={r.id} row={r} onEntregar={() => setEntregar(r)} />
          ))}
        </div>
      </Card>
      <EntregarDialog row={entregar} onClose={() => setEntregar(null)} />
    </>
  );
}

function LinhaAutorizacao({ row, onEntregar }: { row: Row; onEntregar: () => void }) {
  const qc = useQueryClient();
  const t = tempoRestante(row.expira_em);
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("epi_autorizacoes")
        .update({ status: "CANCELADA", cancelado_motivo: "Cancelada no almoxarifado" })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epi_autorizacoes"] });
      toast.success("Autorização cancelada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border bg-background p-3 flex flex-wrap items-center gap-3">
      <div className="min-w-[180px] flex-1">
        <div className="flex items-center gap-1.5 font-bold text-sm">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          {row.employees?.nome ?? "Funcionário"}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Building2 className="h-3 w-3" />
          {row.employees?.companies?.name ?? "—"}
        </div>
      </div>
      <div className="min-w-[180px] flex-1">
        <div className="text-sm font-semibold">{row.epi_descricao}</div>
        <div className="text-[11px] text-muted-foreground">
          QTD {row.quantidade}
          {row.tamanho ? ` · tam. ${row.tamanho}` : ""}
          {row.estoque_epi_id ? " · item já definido" : " · item a definir"}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Badge className={`${MOTIVO_EPI_COR[row.motivo as MotivoEntregaEpi]} text-[10px]`}>
          {MOTIVO_EPI_LABEL[row.motivo as MotivoEntregaEpi] ?? row.motivo}
        </Badge>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> expira em {t.label}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground max-w-[160px]">
        Autorizado por<br />
        <strong className="text-foreground">{row.autorizado_por_nome ?? "—"}</strong>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <Button size="sm" onClick={onEntregar}>
          <PackageCheck className="h-4 w-4 mr-1.5" /> Entregar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => cancelar.mutate()}
          disabled={cancelar.isPending}
        >
          <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

function EntregarDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user, isAdmin, roles } = useAuth();
  const [estoqueId, setEstoqueId] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [qtd, setQtd] = useState("1");
  const [pdf, setPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  const excecao = !isAdmin && roles.includes("tst" as any)
    && !roles.includes("almoxarifado" as any);

  useEffect(() => {
    if (row) {
      setEstoqueId(row.estoque_epi_id ?? "");
      setTamanho(row.tamanho ?? "");
      setQtd(String(row.quantidade ?? 1));
    }
  }, [row]);

  const { data: itens = [] } = useQuery({
    queryKey: ["estoque_epi_opcoes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("id, nome_material, ca, quantidade_atual")
        .order("nome_material");
      if (error) throw error;
      return data ?? [];
    },
  });

  const item = useMemo(() => itens.find((i: any) => i.id === estoqueId) ?? null, [itens, estoqueId]);
  const q = Math.max(1, Number(qtd) || 1);
  const saldoInsuficiente = !!item && (item as any).quantidade_atual < q;
  const semAssinatura = !row?.employees?.assinatura_url;

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!row) return;
      if (!item) throw new Error("Escolha o item do estoque que será entregue");
      if (saldoInsuficiente) throw new Error(`Saldo insuficiente (atual: ${(item as any).quantidade_atual})`);

      const emp = row.employees;
      const hoje = new Date().toISOString().slice(0, 10);

      // 1) baixa atômica no estoque
      const { error: rpcErr } = await supabase.rpc("registrar_entrega_epi", {
        _epi_id: (item as any).id,
        _cpf: emp?.cpf ?? "",
        _nome: emp?.nome ?? "",
        _qtd: q,
      });
      if (rpcErr) throw rpcErr;

      // 2) registro na ficha do colaborador (assinatura puxada da ficha)
      const assinatura = emp?.assinatura_url ?? null;
      const { data: inserted, error } = await (supabase as any).from("epi_deliveries").insert({
        employee_id: row.employee_id,
        item: (item as any).nome_material,
        ca: (item as any).ca ?? null,
        tamanho: tamanho || null,
        qtd: q,
        data_entrega: hoje,
        motivo_entrega: row.motivo,
        data_devolucao_prevista: row.motivo === "EMPRESTIMO" ? row.previsao_devolucao : null,
        observacoes: row.observacoes,
        assinatura_snapshot: assinatura,
        assinatura_data: assinatura ? new Date().toISOString() : null,
      }).select("id").single();
      if (error) throw error;

      // 3) fecha a autorização
      const { error: upErr } = await (supabase as any).from("epi_autorizacoes").update({
        status: "ENTREGUE",
        estoque_epi_id: (item as any).id,
        tamanho: tamanho || null,
        quantidade: q,
        entregue_por: user?.id ?? null,
        entregue_por_nome: user?.email ?? null,
        entregue_em: new Date().toISOString(),
        entrega_excecao: excecao,
        epi_delivery_id: inserted?.id ?? null,
      }).eq("id", row.id);
      if (upErr) throw upErr;

      // 4) termo de responsabilidade (perda/extravio)
      if (row.gera_termo) {
        const { fname, bytes } = openTermoPerdaPdf({
          emp: { nome: emp?.nome, cpf: emp?.cpf, matricula: emp?.matricula },
          company: { name: emp?.companies?.name ?? null },
          role: { name: emp?.roles?.name ?? null },
          item: (item as any).nome_material,
          ca: (item as any).ca ?? null,
          qtd: q,
          data_entrega: hoje,
          observacoes: row.observacoes,
          assinaturaColaboradorDataUrl: assinatura,
        });
        setPdf({ bytes, name: fname });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epi_autorizacoes"] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Entrega registrada e estoque baixado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" /> Registrar entrega
            </DialogTitle>
            <DialogDescription>
              {row?.employees?.nome} — {row?.epi_descricao}
              {row?.tamanho ? ` (tam. ${row.tamanho})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Item do estoque a entregar
              </Label>
              <Select value={estoqueId} onValueChange={setEstoqueId}>
                <SelectTrigger><SelectValue placeholder="Escolha o item / variação" /></SelectTrigger>
                <SelectContent>
                  {itens.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome_material} · saldo {i.quantidade_atual ?? 0}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Tamanho / variação
                </Label>
                <Input value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="Ex.: 41, GG" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Quantidade
                </Label>
                <Input type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} />
              </div>
            </div>

            {saldoInsuficiente && (
              <div className="rounded-lg border-2 border-destructive/50 bg-destructive/10 p-3 text-xs text-foreground flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                Saldo insuficiente no estoque para este item.
              </div>
            )}

            {semAssinatura && (
              <div className="rounded-lg border-2 border-primary/40 bg-muted p-3 text-xs text-foreground flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
                O funcionário ainda não tem assinatura cadastrada na ficha. A entrega pode ser
                concluída, mas a assinatura ficará pendente de coleta.
              </div>
            )}

            {excecao && (
              <div className="rounded-lg border bg-muted p-3 text-xs text-muted-foreground">
                Esta baixa será registrada como <strong className="text-foreground">exceção do TST</strong> (fora do
                almoxarifado) no histórico.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => confirmar.mutate()}
              disabled={confirmar.isPending || !estoqueId || saldoInsuficiente}
            >
              {confirmar.isPending ? "Registrando…" : "Confirmar entrega e baixar estoque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfSignerDialog
        open={!!pdf}
        onClose={() => setPdf(null)}
        source={pdf?.bytes ?? null}
        nomeArquivo={pdf?.name ?? "termo.pdf"}
        modulo="termo_perda"
      />
    </>
  );
}
