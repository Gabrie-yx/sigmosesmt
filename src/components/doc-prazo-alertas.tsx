import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { daysUntil, formatDateBR } from "@/lib/utils-date";

export const DIAS_ALERTA_PADRAO = 30;
const LS_KEY = "sigmo:doc-alertas:ultimo-modal";

type Item = {
  id: string;
  titulo: string;
  vence: string;
  tipo: "Vencimento" | "Prazo";
  dias: number;
};

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DocPrazoAlertas() {
  const { user, roles } = useAuth();
  const podeVer = roles.includes("admin") || roles.includes("moderador" as any);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [silenciando, setSilenciando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [novaData, setNovaData] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["doc-prazo-alertas"],
    enabled: podeVer && !!user,
    refetchInterval: 10 * 60 * 1000,
    queryFn: async () => {
      const [docs, cats] = await Promise.all([
        supabase
          .from("controle_documentos")
          .select("id,titulo,prazo,data_validade,dias_alerta,alerta_adiado_ate,alerta_silenciado_em,status,categoria_id")
          .not("status", "in", "(RESOLVIDO,CANCELADO)"),
        supabase.from("controle_doc_categorias").select("id,dias_alerta_padrao"),
      ]);
      if (docs.error) throw docs.error;
      const catMap = new Map((cats.data ?? []).map((c: any) => [c.id, c.dias_alerta_padrao]));
      const hoje = hojeISO();
      const out: Item[] = [];
      for (const d of (docs.data ?? []) as any[]) {
        if (d.alerta_silenciado_em) continue;
        if (d.alerta_adiado_ate && d.alerta_adiado_ate > hoje) continue;
        const vence = d.data_validade || d.prazo;
        if (!vence) continue;
        const dias = daysUntil(vence);
        if (dias === null) continue;
        const limite = d.dias_alerta ?? catMap.get(d.categoria_id) ?? DIAS_ALERTA_PADRAO;
        if (dias <= limite) out.push({ id: d.id, titulo: d.titulo, vence, tipo: d.data_validade ? "Vencimento" : "Prazo", dias });
      }
      return out.sort((a, b) => a.dias - b.dias);
    },
  });

  const itens = q.data ?? [];
  const vencidos = useMemo(() => itens.filter((i) => i.dias < 0).length, [itens]);

  // Modal automático uma vez por dia
  useEffect(() => {
    if (!itens.length) return;
    const k = `${LS_KEY}:${user?.id}`;
    if (localStorage.getItem(k) === hojeISO()) return;
    localStorage.setItem(k, hojeISO());
    setOpen(true);
  }, [itens.length, user?.id]);

  if (!podeVer || !itens.length) return null;

  async function patch(id: string, p: any, msg: string) {
    const { error } = await supabase.from("controle_documentos").update(p).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["doc-prazo-alertas"] });
    qc.invalidateQueries({ queryKey: ["controle-documentos"] });
  }

  function adiar(id: string, dias: number) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    patch(id, { alerta_adiado_ate: d.toISOString().slice(0, 10) }, `Lembrete adiado por ${dias} dia(s)`);
  }

  function silenciar(id: string) {
    if (motivo.trim().length < 5) return toast.error("Informe o motivo (mín. 5 caracteres)");
    patch(id, {
      alerta_silenciado_em: new Date().toISOString(),
      alerta_silenciado_por: user?.id ?? null,
      alerta_silenciado_motivo: motivo.trim(),
    }, "Alarme silenciado");
    setSilenciando(null);
    setMotivo("");
  }

  function mudarData(it: Item) {
    const v = novaData[it.id];
    if (!v) return toast.error("Escolha a nova data");
    patch(it.id, {
      [it.tipo === "Vencimento" ? "data_validade" : "prazo"]: v,
      alerta_adiado_ate: null,
    }, "Data atualizada");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${itens.length} documento(s) com prazo próximo ou vencido`}
        className={`relative h-8 px-2 rounded-md flex items-center gap-1 text-white animate-pulse ${vencidos ? "bg-destructive" : "bg-amber-500"}`}
      >
        <BellRing className="h-4 w-4" />
        <span className="text-[11px] font-black">{itens.length}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Documentos com prazo próximo</DialogTitle>
            <DialogDescription>
              O aviso fica piscando no topo até você resolver, mudar a data, adiar ou silenciar com justificativa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {itens.map((it) => (
              <div key={it.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{it.titulo}</div>
                    <div className="text-xs text-muted-foreground">{it.tipo}: {formatDateBR(it.vence)}</div>
                  </div>
                  <Badge className={it.dias < 0 ? "bg-destructive text-destructive-foreground" : "bg-amber-500 text-white"}>
                    {it.dias < 0 ? `Vencido há ${-it.dias}d` : it.dias === 0 ? "Vence hoje" : `Vence em ${it.dias}d`}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => { setOpen(false); navigate({ to: "/app/controle-documentos", search: { doc: it.id } }); }}>Resolver →</Button>
                  <Input type="date" className="h-8 w-40" value={novaData[it.id] ?? ""} onChange={(e) => setNovaData((m) => ({ ...m, [it.id]: e.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => mudarData(it)}>Nova data</Button>
                  <Button size="sm" variant="outline" onClick={() => adiar(it.id, 1)}>Amanhã</Button>
                  <Button size="sm" variant="outline" onClick={() => adiar(it.id, 7)}>7 dias</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSilenciando(silenciando === it.id ? null : it.id)}>Silenciar</Button>
                </div>
                {silenciando === it.id && (
                  <div className="flex gap-2">
                    <Input placeholder="Motivo (fica registrado)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    <Button size="sm" variant="destructive" onClick={() => silenciar(it.id)}>Confirmar</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
