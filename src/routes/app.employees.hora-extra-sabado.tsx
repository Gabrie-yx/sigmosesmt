import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ArrowLeft, FileDown, Pencil, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { HoraExtraSabadoDialog } from "@/components/hora-extra-sabado-dialog";
import { gerarHoraExtraSabadoPDF } from "@/lib/hora-extra-sabado-pdf";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import dmnLogo from "@/assets/dmn-logo.png";

export const Route = createFileRoute("/app/employees/hora-extra-sabado")({
  component: HoraExtraSabadoPage,
});

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

async function imageToDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function HoraExtraSabadoPage() {
  const qc = useQueryClient();
  const { user, isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [sigOpen, setSigOpen] = useState(false);
  const [pendingPdfId, setPendingPdfId] = useState<string | null>(null);

  const { data: fichas, isLoading } = useQuery({
    queryKey: ["hora-extra-sabado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado")
        .select("*, companies(name), hora_extra_sabado_funcionarios(id)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hora_extra_sabado").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hora-extra-sabado"] });
      toast.success("Ficha excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function gerarPdf(
    id: string,
    assinatura?: { dataUrl: string; height: number } | null,
  ) {
    const { data: rec } = await supabase
      .from("hora_extra_sabado")
      .select("*, companies(name)")
      .eq("id", id)
      .maybeSingle();
    if (!rec) return toast.error("Registro não encontrado");
    const { data: list } = await supabase
      .from("hora_extra_sabado_funcionarios")
      .select("*")
      .eq("hora_extra_id", id)
      .order("ordem");

    // Busca empresas dos employees (sem FK no schema, precisa join manual)
    const employeeIds = Array.from(
      new Set((list ?? []).map((f: any) => f.employee_id).filter(Boolean)),
    );
    const empresaPorEmployee = new Map<string, string>();
    if (employeeIds.length > 0) {
      const { data: emps } = await supabase
        .from("employees")
        .select("id, company_id, companies(name)")
        .in("id", employeeIds);
      (emps ?? []).forEach((e: any) => {
        if (e.companies?.name) empresaPorEmployee.set(e.id, e.companies.name);
      });
    }

    const d = new Date(rec.data + "T12:00:00");
    const ddmmyyyy = d.toLocaleDateString("pt-BR");
    const dia = DIAS[d.getDay()];
    const horario = rec.horario_inicio && rec.horario_fim ? `${rec.horario_inicio} às ${rec.horario_fim}` : rec.horario_inicio || "—";

    const logo = await imageToDataUrl(dmnLogo);

    const empresaPadrao = (rec as any).companies?.name ?? "EXTERNOS";
    const grupos = new Map<string, any[]>();
    (list ?? []).forEach((f: any) => {
      const empNome =
        (f.employee_id && empresaPorEmployee.get(f.employee_id)) ??
        (f.externo ? "EXTERNOS" : empresaPadrao);
      if (!grupos.has(empNome)) grupos.set(empNome, []);
      grupos.get(empNome)!.push(f);
    });
    const paginas = Array.from(grupos.entries()).map(([empresaNome, fs]) => ({
      empresaNome,
      funcionarios: fs.map((f: any) => ({
        nome: f.nome,
        transporte: f.transporte,
        alimentacao: f.alimentacao,
        presenca: f.presenca,
      })),
    }));
    const empresasEnvolvidas = Array.from(grupos.keys());

    const doc = gerarHoraExtraSabadoPDF({
      data: ddmmyyyy,
      diaSemana: dia,
      turno: rec.turno,
      horario,
      setor: rec.setor,
      centroCusto: rec.centro_custo,
      tipoEfetivo: rec.tipo_efetivo as any,
      observacao: rec.observacao,
      logoDataUrl: logo,
      assinaturaDataUrl: assinatura?.dataUrl ?? null,
      assinaturaHeight: assinatura?.height,
      solicitanteNome:
        (user as any)?.user_metadata?.full_name ??
        (user as any)?.email?.split("@")[0] ??
        null,
      empresasEnvolvidas,
      paginas,
    });
    doc.save(`hora-extra-${rec.data}.pdf`);
  }

  function abrirAssinatura(id: string) {
    setPendingPdfId(id);
    setSigOpen(true);
  }

  const filtradas = (fichas ?? []).filter((f: any) => {
    if (!busca.trim()) return true;
    const s = busca.toLowerCase();
    return (
      (f.setor ?? "").toLowerCase().includes(s) ||
      (f.centro_custo ?? "").toLowerCase().includes(s) ||
      (f.companies?.name ?? "").toLowerCase().includes(s) ||
      f.data.includes(s)
    );
  });

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/employees" className="rounded-full p-2 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h2 className="heading-display text-3xl md:text-4xl text-brand">Hora extra — sábado</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
              Fichas de escala para o sábado
            </p>
          </div>
        </div>
        {isEditor && (
          <Button onClick={() => { setEditId(null); setOpen(true); }} className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg">
            <Plus className="h-4 w-4 mr-2" />Nova ficha
          </Button>
        )}
      </div>

      <Input
        className="mb-4 max-w-md"
        placeholder="Buscar por data, setor, empresa…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhuma ficha registrada</p>
          <p className="text-xs text-slate-400 mt-1">Crie a primeira clicando em "Nova ficha".</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtradas.map((f: any) => {
            const d = new Date(f.data + "T12:00:00");
            const dia = DIAS[d.getDay()];
            return (
              <div key={f.id} className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-lg font-black text-slate-900">{d.toLocaleDateString("pt-BR")}</p>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 px-2 py-0.5 rounded">{dia}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{f.tipo_efetivo}</span>
                      {f.companies?.name && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{f.companies.name}</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {f.turno && <span><b>Turno:</b> {f.turno}</span>}
                      {f.horario_inicio && <span><b>Horário:</b> {f.horario_inicio} às {f.horario_fim ?? ""}</span>}
                      {f.setor && <span><b>Setor:</b> {f.setor}</span>}
                      {f.centro_custo && <span><b>C.C.:</b> {f.centro_custo}</span>}
                      <span><b>Funcionários:</b> {f.hora_extra_sabado_funcionarios?.length ?? 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => gerarPdf(f.id)}>
                      <FileDown className="h-3.5 w-3.5 mr-1.5" />PDF
                    </Button>
                    <Button size="sm" onClick={() => abrirAssinatura(f.id)} className="bg-rose-700 hover:bg-rose-800 text-white">
                      <FileDown className="h-3.5 w-3.5 mr-1.5" />Assinar + PDF
                    </Button>
                    {isEditor && (
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(f.id); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir esta ficha?")) del.mutate(f.id); }}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <HoraExtraSabadoDialog open={open} onOpenChange={setOpen} editId={editId} />
      <SignaturePadDialog
        open={sigOpen}
        onClose={() => { setSigOpen(false); setPendingPdfId(null); }}
        onConfirm={async (r) => {
          const id = pendingPdfId;
          setSigOpen(false); setPendingPdfId(null);
          if (id) await gerarPdf(id, r);
        }}
        title="Assinatura do solicitante"
      />
    </div>
  );
}
