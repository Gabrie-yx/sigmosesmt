import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Printer, FileSignature } from "lucide-react";
import { gerarTermoConsentimentoPDF } from "@/lib/termo-consentimento-pdf";
import { fetchSignatureAsCleanDataUrl } from "@/lib/signature-utils";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";

function dataExtensoBR(iso: string) {
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2,"0")} de ${meses[(m ?? 1) - 1]} de ${y}`;
}

async function sha256Hex(text: string): Promise<string | null> {
  try {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function TermoConsentimentoDialog({
  open,
  onOpenChange,
  employeeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string | null | undefined;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [obs, setObs] = useState("");
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewName, setPreviewName] = useState<string>("termo-consentimento.pdf");

  const { data: emp, isLoading } = useQuery({
    queryKey: ["termo-emp", employeeId],
    enabled: open && !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, cpf, rg, assinatura_url, company_id, role_id, termo_consentimento_id, termo_consentimento_data, companies(name), roles(name)")
        .eq("id", employeeId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: termoExistente } = useQuery({
    queryKey: ["termo-existente", emp?.termo_consentimento_id],
    enabled: !!emp?.termo_consentimento_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("assinaturas_termos_consentimento")
        .select("id, data_assinatura, coletado_por_nome, hash_sha256, observacoes")
        .eq("id", emp!.termo_consentimento_id!)
        .maybeSingle();
      return data as any;
    },
  });

  const status = useMemo(() => {
    if (!emp) return "loading";
    if (!emp.assinatura_url) return "SEM_ASSINATURA";
    if (emp.termo_consentimento_id) return "BLINDADO";
    return "PENDENTE";
  }, [emp]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!emp) throw new Error("Funcionário não carregado");
      if (!emp.assinatura_url) throw new Error("Funcionário não tem assinatura cadastrada — cadastre primeiro na ficha.");

      const hoje = new Date().toISOString().slice(0, 10);
      const sigClean = await fetchSignatureAsCleanDataUrl(emp.assinatura_url);
      const pdfPayload = JSON.stringify({
        v: 1, employeeId: emp.id, nome: emp.nome, cpf: emp.cpf, rg: emp.rg,
        cargo: emp.roles?.name, empresa: emp.companies?.name, data: hoje,
      });
      const hash = await sha256Hex(pdfPayload);

      const { data: row, error } = await supabase
        .from("assinaturas_termos_consentimento")
        .insert({
          employee_id: emp.id,
          data_assinatura: hoje,
          assinatura_snapshot: emp.assinatura_url,
          hash_sha256: hash,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
          coletado_por: user?.id ?? null,
          coletado_por_nome: (user?.user_metadata as any)?.full_name ?? user?.email ?? null,
          observacoes: obs.trim() || null,
        })
        .select("id, data_assinatura")
        .single();
      if (error) throw error;

      // Gera o PDF e abre no visualizador interno
      const pdf = gerarTermoConsentimentoPDF({
        funcionarioNome: emp.nome,
        cpf: emp.cpf, rg: emp.rg,
        cargo: emp.roles?.name ?? null,
        empresa: emp.companies?.name ?? null,
        dataAssinatura: hoje.split("-").reverse().join("/"),
        dataExtenso: dataExtensoBR(hoje),
        cidade: "Manaus/AM",
        assinaturaDataUrl: sigClean,
        coletadoPorNome: (user?.user_metadata as any)?.full_name ?? user?.email ?? null,
      });
      setPreviewName(`termo-consentimento-${(emp.nome || "func").replace(/\s+/g, "-").toLowerCase()}.pdf`);
      setPreviewDoc(pdf);
      return row;
    },
    onSuccess: async () => {
      toast.success("Termo de Consentimento registrado — todas as assinaturas (passadas e futuras) estão blindadas.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["employee"] }),
        qc.invalidateQueries({ queryKey: ["termo-emp"] }),
        qc.invalidateQueries({ queryKey: ["termos-status"] }),
      ]);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar termo"),
  });

  const reimprimir = async () => {
    if (!emp || !termoExistente) return;
    const sigClean = await fetchSignatureAsCleanDataUrl(emp.assinatura_url);
    const iso = termoExistente.data_assinatura as string;
    const pdf = gerarTermoConsentimentoPDF({
      funcionarioNome: emp.nome,
      cpf: emp.cpf, rg: emp.rg,
      cargo: emp.roles?.name ?? null,
      empresa: emp.companies?.name ?? null,
      dataAssinatura: iso.split("-").reverse().join("/"),
      dataExtenso: dataExtensoBR(iso),
      cidade: "Manaus/AM",
      assinaturaDataUrl: sigClean,
      coletadoPorNome: termoExistente.coletado_por_nome,
    });
    setPreviewName(`termo-consentimento-${(emp.nome || "func").replace(/\s+/g, "-").toLowerCase()}.pdf`);
    setPreviewDoc(pdf);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#1a0a0e] border-rose-900/40 text-rose-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-50">
            <FileSignature className="h-5 w-5 text-emerald-400" />
            Termo de Consentimento — Assinatura Eletrônica
          </DialogTitle>
        </DialogHeader>

        {isLoading || !emp ? (
          <div className="py-8 text-center text-sm text-rose-200/60">Carregando…</div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            {status === "BLINDADO" && (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 flex items-start gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-300 shrink-0" />
                <div className="text-sm">
                  <div className="font-black text-emerald-200">Funcionário BLINDADO</div>
                  <div className="text-xs text-emerald-50/90 mt-1 leading-relaxed">
                    Termo assinado em <strong>{new Date(emp.termo_consentimento_data + "T00:00:00").toLocaleDateString("pt-BR")}</strong>.
                    Todas as assinaturas estampadas (passadas e futuras) estão validadas juridicamente pela Lei 14.063/2020.
                  </div>
                  {termoExistente?.hash_sha256 && (
                    <div className="text-[10px] font-mono text-emerald-300/80 mt-1 break-all">
                      Hash: {termoExistente.hash_sha256.slice(0, 32)}…
                    </div>
                  )}
                </div>
              </div>
            )}

            {status === "PENDENTE" && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 flex items-start gap-3">
                <ShieldAlert className="h-6 w-6 text-amber-300 shrink-0" />
                <div className="text-sm">
                  <div className="font-black text-amber-200">Pendente de blindagem</div>
                  <div className="text-xs text-amber-50/90 mt-1 leading-relaxed">
                    Funcionário tem assinatura cadastrada, mas <strong>nunca assinou o Termo de Consentimento</strong>.
                    Ao registrar agora, todas as estampagens já realizadas serão ratificadas retroativamente.
                  </div>
                </div>
              </div>
            )}

            {status === "SEM_ASSINATURA" && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 flex items-start gap-3">
                <ShieldAlert className="h-6 w-6 text-rose-300 shrink-0" />
                <div className="text-sm">
                  <div className="font-black text-rose-100">Sem assinatura cadastrada</div>
                  <div className="text-xs text-rose-50/85 mt-1 leading-relaxed">
                    Cadastre primeiro o PNG da assinatura na ficha do funcionário (campo "Assinatura"). Depois volte aqui pra gerar o termo.
                  </div>
                </div>
              </div>
            )}

            {/* Dados */}
            <div className="rounded-lg border border-rose-900/40 bg-rose-950/40 p-3 text-sm space-y-1 text-rose-50">
              <div><span className="text-rose-300/70 font-bold">Nome:</span> {emp.nome}</div>
              <div><span className="text-rose-300/70 font-bold">CPF:</span> {emp.cpf ?? "—"} · <span className="text-rose-300/70 font-bold">RG:</span> {emp.rg ?? "—"}</div>
              <div><span className="text-rose-300/70 font-bold">Cargo:</span> {emp.roles?.name ?? "—"}</div>
              <div><span className="text-rose-300/70 font-bold">Empresa:</span> {emp.companies?.name ?? "—"}</div>
              {emp.assinatura_url && (
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-rose-300/70 font-bold">Assinatura:</span>
                  <img src={emp.assinatura_url} alt="Assinatura" className="h-9 bg-white border rounded px-1 object-contain" />
                  <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-300 bg-emerald-500/10">OK</Badge>
                </div>
              )}
            </div>

            {status === "PENDENTE" && (
              <div>
                <Label className="text-[11px] font-black uppercase tracking-widest text-rose-200/80">Observações (opcional)</Label>
                <Textarea
                  rows={2}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Ex.: termo coletado durante DDS semanal."
                  className="mt-1 bg-rose-950/40 border-rose-900/50 text-rose-50 placeholder:text-rose-300/40 focus-visible:ring-emerald-400/40"
                />
              </div>
            )}

            <div className="text-[11px] text-emerald-50/85 leading-relaxed border-l-2 border-emerald-400/60 pl-3 bg-emerald-500/[0.06] p-2 rounded">
              <strong className="text-emerald-200">Base legal:</strong> Lei 14.063/2020 art. 4º I (assinatura eletrônica simples) · LGPD art. 7º II e V ·
              Código Civil arts. 219 e 225. O PDF gerado inclui cláusula de <strong className="text-emerald-200">ratificação retroativa</strong> de todas as
              estampagens anteriores.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-rose-900/30 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-rose-900/50 bg-transparent text-rose-100 hover:bg-rose-900/30 hover:text-white"
          >
            Fechar
          </Button>
          {status === "BLINDADO" && (
            <Button
              variant="outline"
              onClick={reimprimir}
              className="border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-white"
            >
              <Printer className="h-4 w-4 mr-1" /> Reimprimir
            </Button>
          )}
          {status === "PENDENTE" && (
            <Button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/40"
            >
              <ShieldCheck className="h-4 w-4 mr-1" />
              {salvar.isPending ? "Registrando…" : "Registrar e gerar PDF"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <PDFPreviewDialog
      open={!!previewDoc}
      onClose={() => setPreviewDoc(null)}
      doc={previewDoc}
      fileName={previewName}
      title="Termo de Consentimento"
    />
    </>
  );
}