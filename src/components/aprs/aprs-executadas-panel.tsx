import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight, Eye, Printer, Download, CheckCircle2 } from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  aprs: any[];
  cascoMap: Map<string, any>;
  companyMap: Map<string, string>;
  onView: (a: any) => void;
  onPrint: (a: any) => void;
  onDownload: (a: any) => void;
};

const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

function dataEnc(a: any): string {
  return (a.encerrada_em ?? a.updated_at ?? a.data_emissao ?? "").slice(0, 10);
}

export function AprsExecutadasPanel({ open, onOpenChange, aprs, cascoMap, companyMap, onView, onPrint, onDownload }: Props) {
  const [busca, setBusca] = useState("");
  const [mesSel, setMesSel] = useState<string | null>(null);

  const encerradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return aprs
      .filter((a) => a.status === "ENCERRADA")
      .filter((a) => {
        if (!q) return true;
        const c = a.casco_id ? cascoMap.get(a.casco_id) : null;
        const txt = `${a.numero ?? ""} ${a.atividade_descricao ?? ""} ${a.local ?? ""} ${c?.numero ?? ""} ${c?.nome ?? ""} ${formatDateBR(dataEnc(a))}`.toLowerCase();
        return txt.includes(q);
      })
      .sort((x, y) => dataEnc(y).localeCompare(dataEnc(x)));
  }, [aprs, busca, cascoMap]);

  const meses = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of encerradas) {
      const k = dataEnc(a).slice(0, 7) || "sem-data";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return [...m.entries()];
  }, [encerradas]);

  const mesLabel = (k: string) => {
    if (k === "sem-data") return "SEM DATA";
    const [y, mm] = k.split("-");
    return `${MESES[Number(mm) - 1]} DE ${y}`;
  };

  const itensMes = mesSel ? meses.find(([k]) => k === mesSel)?.[1] ?? [] : [];
  const porDia = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of itensMes) {
      const d = dataEnc(a);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(a);
    }
    return [...m.entries()];
  }, [itensMes]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-primary">APRs Executadas</DialogTitle>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              APRs encerradas — visualizar, imprimir ou baixar
            </p>
          </DialogHeader>
          <Input placeholder="Buscar por número, local, atividade ou data…" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md" />
          {meses.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma APR encerrada ainda.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {meses.map(([k, lista]) => {
                const cascosQtd = new Set(lista.map((a) => a.casco_id ?? "-")).size;
                return (
                  <button
                    key={k}
                    onClick={() => setMesSel(k)}
                    className="group text-left rounded-2xl border border-primary/40 bg-gradient-to-br from-card via-background to-primary/10 p-5 shadow-lg hover:border-primary transition"
                  >
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-primary">
                      <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Mensal</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <div className="mt-2 text-xl font-black text-foreground">{mesLabel(k)}</div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-5xl font-black leading-none text-primary">{lista.length}</span>
                      <span className="pb-1 text-[11px] font-black uppercase tracking-widest text-foreground">
                        {lista.length === 1 ? "APR executada" : "APRs executadas"}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-between border-t border-border pt-3 text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-foreground">{cascosQtd} {cascosQtd > 1 ? "locais" : "local"}</span>
                      <span className="text-primary">Ver detalhes</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!mesSel} onOpenChange={(o) => !o && setMesSel(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-foreground">
              APRs executadas — {mesSel ? mesLabel(mesSel) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {porDia.map(([dia, lista]) => (
              <div key={dia}>
                <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-primary">{formatDateBR(dia)}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {lista.map((a) => {
                    const c = a.casco_id ? cascoMap.get(a.casco_id) : null;
                    return (
                      <div key={a.id} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-primary">{a.numero}</span>
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" /> Encerrada
                          </span>
                        </div>
                        <div className="text-xs text-foreground line-clamp-2">{a.atividade_descricao}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {c ? `${c.numero}${c.nome ? ` — ${c.nome}` : ""}` : "Sem local cadastrado"}
                          {a.empresa_id ? ` · ${companyMap.get(a.empresa_id) ?? ""}` : ""}
                          {` · emitida ${formatDateBR(a.data_emissao)}`}
                        </div>
                        {a.encerrada_obs && <div className="text-[11px] italic text-muted-foreground">"{a.encerrada_obs}"</div>}
                        <div className="flex gap-1 pt-1">
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onView(a)}><Eye className="h-3.5 w-3.5 mr-1" /> Ver</Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onPrint(a)}><Printer className="h-3.5 w-3.5 mr-1" /> Imprimir</Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onDownload(a)}><Download className="h-3.5 w-3.5 mr-1" /> Baixar</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
