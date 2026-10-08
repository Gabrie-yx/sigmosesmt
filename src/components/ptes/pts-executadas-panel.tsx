import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight, FileSearch, CheckCircle2 } from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";
import { PT_TIPOS } from "@/lib/constants";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ptes: any[];
  cascosMap: Map<string, any>;
  companies: any[];
  onView: (p: any) => void;
};

const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const ORDEM_TIPOS = PT_TIPOS.map((t) => t.value as string);
const tipoLabel = (v: string) => PT_TIPOS.find((t) => t.value === v)?.label ?? v;

function dataEnc(p: any): string {
  return (p.encerrada_em ?? p.data ?? p.data_emissao ?? p.created_at ?? "").slice(0, 10);
}

export function PtsExecutadasPanel({ open, onOpenChange, ptes, cascosMap, companies, onView }: Props) {
  const [busca, setBusca] = useState("");
  const [mesSel, setMesSel] = useState<string | null>(null);
  const compName = (id?: string | null) => (id ? companies.find((c: any) => c.id === id)?.name : null);

  const encerradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return ptes
      .filter((p) => p.status === "ENCERRADA")
      .filter((p) => {
        if (!q) return true;
        const c = p.casco_id ? cascosMap.get(p.casco_id) : null;
        const txt = `${p.numero ?? ""} ${p.tipo_pt ?? ""} ${p.local ?? ""} ${p.employee_name ?? ""} ${c?.numero ?? ""} ${formatDateBR(dataEnc(p))}`.toLowerCase();
        return txt.includes(q);
      })
      .sort((x, y) => dataEnc(y).localeCompare(dataEnc(x)));
  }, [ptes, busca, cascosMap]);

  const meses = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of encerradas) {
      const k = dataEnc(p).slice(0, 7) || "sem-data";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
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
    const m = new Map<string, Map<string, any[]>>();
    for (const p of itensMes) {
      const d = dataEnc(p);
      const t = p.tipo_pt ?? "PTE";
      if (!m.has(d)) m.set(d, new Map());
      const dm = m.get(d)!;
      if (!dm.has(t)) dm.set(t, []);
      dm.get(t)!.push(p);
    }
    return [...m.entries()].map(([d, tm]) => [
      d,
      [...tm.entries()].sort((a, b) => ORDEM_TIPOS.indexOf(a[0]) - ORDEM_TIPOS.indexOf(b[0])),
    ] as const);
  }, [itensMes]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-primary">Permissões de Trabalho Executadas</DialogTitle>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              PTs encerradas — por mês, dia e tipo
            </p>
          </DialogHeader>
          <Input placeholder="Buscar por número, tipo, local ou data…" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md" />
          {meses.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma PT encerrada ainda.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {meses.map(([k, lista]) => {
                const tipos = new Set(lista.map((p) => p.tipo_pt ?? "PTE"));
                return (
                  <button
                    key={k}
                    onClick={() => setMesSel(k)}
                    className="text-left rounded-2xl border border-primary/40 bg-gradient-to-br from-card via-background to-primary/10 p-5 shadow-lg hover:border-primary transition"
                  >
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-primary">
                      <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Mensal</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <div className="mt-2 text-xl font-black text-foreground">{mesLabel(k)}</div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-5xl font-black leading-none text-primary">{lista.length}</span>
                      <span className="pb-1 text-[11px] font-black uppercase tracking-widest text-foreground">
                        {lista.length === 1 ? "PT executada" : "PTs executadas"}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-between border-t border-border pt-3 text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-foreground">{[...tipos].join(" · ")}</span>
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
              PTs executadas — {mesSel ? mesLabel(mesSel) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {porDia.map(([dia, tipos]) => (
              <div key={dia} className="rounded-xl border border-border p-3">
                <div className="mb-2 text-sm font-black uppercase tracking-widest text-primary">{formatDateBR(dia)}</div>
                <div className="space-y-3">
                  {tipos.map(([tipo, lista]) => (
                    <div key={tipo}>
                      <div className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                        {tipoLabel(tipo)} ({lista.length})
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {lista.map((p) => {
                          const c = p.casco_id ? cascosMap.get(p.casco_id) : null;
                          return (
                            <div key={p.id} className="rounded-lg border border-border bg-card p-3 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-primary">{p.numero}</span>
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-muted-foreground">
                                  <CheckCircle2 className="h-3 w-3" /> Encerrada
                                </span>
                              </div>
                              <div className="text-xs text-foreground">{p.local}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {c ? `${c.numero}` : "Sem local cadastrado"}
                                {compName(p.company_id) ? ` · ${compName(p.company_id)}` : ""}
                                {p.employee_name ? ` · ${p.employee_name}` : ""}
                              </div>
                              {p.encerrada_obs && <div className="text-[11px] italic text-muted-foreground">"{p.encerrada_obs}"</div>}
                              <Button size="sm" variant="outline" className="mt-1 h-7 text-[11px]" onClick={() => onView(p)}>
                                <FileSearch className="h-3.5 w-3.5 mr-1" /> Ver / Imprimir / Baixar
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
