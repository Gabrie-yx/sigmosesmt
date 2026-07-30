import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldAlert, FileSignature, Eye, RefreshCw,
  Printer, Upload, PenLine, Smartphone, FileWarning, Check,
} from "lucide-react";
import {
  gerarTermoConsentimentoPDF,
  TERMO_VERSAO_ATUAL,
  type TermoModalidade,
} from "@/lib/termo-consentimento-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
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

const BUCKET_TERMOS = "termos-consentimento";

/** Upload resiliente: tenta 3x (falhas de rede em HTTP/servidor local são comuns). */
async function uploadComRetry(path: string, body: Blob | File, contentType: string) {
  let ultimo = "";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_TERMOS)
        .upload(path, body, { contentType, upsert: true });
      if (!error) return;
      ultimo = error.message;
      if (/bucket not found/i.test(error.message)) {
        throw new Error(
          `O repositório de arquivos "${BUCKET_TERMOS}" não existe neste servidor. Crie o bucket antes de anexar termos.`,
        );
      }
    } catch (e: any) {
      if (/repositório de arquivos/.test(e?.message ?? "")) throw e;
      ultimo = e?.message ?? String(e);
    }
    await new Promise((r) => setTimeout(r, 600 * tentativa));
  }
  throw new Error(
    /failed to fetch/i.test(ultimo)
      ? "Sem conexão com o servidor de arquivos. Verifique a rede/VPN e tente novamente (o arquivo pode ser grande demais)."
      : `Falha ao anexar o digitalizado: ${ultimo}`,
  );
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
  const [modalidade, setModalidade] = useState<TermoModalidade>("PAPEL_DIGITALIZADO");
  const [consenteImagem, setConsenteImagem] = useState<boolean | null>(null);
  const [assinaturaAto, setAssinaturaAto] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewName, setPreviewName] = useState<string>("termo-consentimento.pdf");
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [scanPreviewName, setScanPreviewName] = useState<string>("termo-digitalizado.pdf");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setObs(""); setConsenteImagem(null); setAssinaturaAto(null); setScanFile(null);
    }
  }, [open]);

  const { data: emp, isLoading } = useQuery({
    queryKey: ["termo-emp", employeeId],
    enabled: open && !!employeeId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data } = await supabase
        .from("assinaturas_termos_consentimento")
        .select("id, data_assinatura, coletado_por_nome, hash_sha256, observacoes, pdf_url, pdf_path, scan_path, scan_url, modalidade, versao_termo, consente_imagem, assinatura_snapshot")
        .eq("id", emp!.termo_consentimento_id!)
        .maybeSingle();
      return data as any;
    },
  });

  const versaoAtual = (termoExistente?.versao_termo ?? 1) >= TERMO_VERSAO_ATUAL;

  const status = useMemo(() => {
    if (!emp) return "loading";
    if (emp.termo_consentimento_id) return versaoAtual ? "BLINDADO" : "DESATUALIZADO";
    return "PENDENTE";
  }, [emp, versaoAtual]);

  const dadosBase = (iso: string) => ({
    funcionarioNome: emp.nome,
    cpf: emp.cpf, rg: emp.rg,
    cargo: emp.roles?.name ?? null,
    empresa: emp.companies?.name ?? null,
    dataAssinatura: iso.split("-").reverse().join("/"),
    dataExtenso: dataExtensoBR(iso),
    cidade: "Manaus/AM",
    coletadoPorNome: (user?.user_metadata as any)?.full_name ?? user?.email ?? null,
  });

  /** Gera a via em branco para impressão (papel) — sem assinatura, quadros vazios. */
  const gerarViaImpressao = () => {
    if (!emp) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const pdf = gerarTermoConsentimentoPDF({
      ...dadosBase(hoje),
      modalidade: "PAPEL_DIGITALIZADO",
      consenteImagem: null,
      viaParaAssinatura: true,
    });
    setPreviewName(`termo-via-assinatura-${(emp.nome || "func").replace(/\s+/g, "-").toLowerCase()}.pdf`);
    setPreviewDoc(pdf);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!emp) throw new Error("Funcionário não carregado");
      if (consenteImagem === null) throw new Error("Registre a resposta do colaborador sobre o uso da foto (SIM ou NÃO).");
      if (modalidade === "ELETRONICA" && !assinaturaAto) {
        throw new Error("Colete a assinatura do colaborador em tela antes de registrar.");
      }
      if (modalidade === "PAPEL_DIGITALIZADO" && !scanFile) {
        throw new Error("Anexe o termo assinado digitalizado (PDF ou imagem).");
      }

      const hoje = new Date().toISOString().slice(0, 10);
      const agora = new Date().toISOString();
      const payload = JSON.stringify({
        v: TERMO_VERSAO_ATUAL, employeeId: emp.id, nome: emp.nome, cpf: emp.cpf, rg: emp.rg,
        cargo: emp.roles?.name, empresa: emp.companies?.name, data: hoje,
        modalidade, consenteImagem,
      });
      const hash = await sha256Hex(payload);

      // 1) Sobe o digitalizado ANTES de gravar o registro, para não deixar registro órfão.
      let scanPathPronto: string | null = null;
      if (modalidade === "PAPEL_DIGITALIZADO" && scanFile) {
        if (scanFile.size > 25 * 1024 * 1024) {
          throw new Error("Arquivo muito grande (máx. 25 MB). Digitalize em resolução menor ou compacte o PDF.");
        }
        const ext = (scanFile.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
        scanPathPronto = `${emp.id}/scan-${Date.now()}.${ext || "pdf"}`;
        await uploadComRetry(scanPathPronto, scanFile, scanFile.type || "application/pdf");
      }

      const { data: row, error } = await supabase
        .from("assinaturas_termos_consentimento")
        .insert({
          employee_id: emp.id,
          data_assinatura: hoje,
          assinado_em: agora,
          assinatura_snapshot: modalidade === "ELETRONICA" ? assinaturaAto : null,
          hash_sha256: hash,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
          dispositivo: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
          coletado_por: user?.id ?? null,
          coletado_por_nome: (user?.user_metadata as any)?.full_name ?? user?.email ?? null,
          observacoes: obs.trim() || null,
          consente_imagem: consenteImagem,
          modalidade,
          versao_termo: TERMO_VERSAO_ATUAL,
        })
        .select("id, data_assinatura")
        .single();
      if (error) {
        if (scanPathPronto) {
          try { await supabase.storage.from(BUCKET_TERMOS).remove([scanPathPronto]); } catch { /* ignore */ }
        }
        throw error;
      }

      // Vincula o digitalizado ao registro criado
      if (scanPathPronto) {
        const { data: signed } = await supabase.storage
          .from(BUCKET_TERMOS)
          .createSignedUrl(scanPathPronto, 60 * 60 * 24 * 365 * 10);
        await supabase
          .from("assinaturas_termos_consentimento")
          .update({ scan_path: scanPathPronto, scan_url: signed?.signedUrl ?? null })
          .eq("id", row.id);
      }

      // PDF gerado pelo sistema (na modalidade eletrônica é o documento assinado;
      // no papel, é a cópia de referência do texto aceito)
      const pdf = gerarTermoConsentimentoPDF({
        ...dadosBase(hoje),
        modalidade,
        consenteImagem,
        assinaturaDataUrl: assinaturaAto,
        codigoVerificacao: hash?.slice(0, 16) ?? null,
      });
      const fileName = `termo-consentimento-${(emp.nome || "func").replace(/\s+/g, "-").toLowerCase()}.pdf`;

      try {
        const blob = pdf.output("blob") as Blob;
        const path = `${emp.id}/${row.id}.pdf`;
        await uploadComRetry(path, blob, "application/pdf");
        const { data: signed } = await supabase.storage
          .from(BUCKET_TERMOS)
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        await supabase
          .from("assinaturas_termos_consentimento")
          .update({ pdf_path: path, pdf_url: signed?.signedUrl ?? null })
          .eq("id", row.id);
      } catch (e) {
        console.warn("Falha ao arquivar PDF no Storage:", e);
      }

      if (modalidade === "PAPEL_DIGITALIZADO" && scanPathPronto) {
        // O documento oficial é o digitalizado assinado — abre ele, não a via do sistema.
        const { data: signedScan } = await supabase.storage
          .from(BUCKET_TERMOS)
          .createSignedUrl(scanPathPronto, 60 * 60);
        if (signedScan?.signedUrl) {
          const ext = (scanPathPronto.split(".").pop() || "pdf").toLowerCase();
          setScanPreviewName(
            `termo-digitalizado-${(emp.nome || "func").replace(/\s+/g, "-").toLowerCase()}.${ext}`,
          );
          setScanPreviewUrl(signedScan.signedUrl);
        }
      } else {
        setPreviewName(fileName);
        setPreviewDoc(pdf);
      }
      return row;
    },
    onSuccess: async () => {
      toast.success(`Termo v${TERMO_VERSAO_ATUAL} registrado com sucesso.`);
      setAssinaturaAto(null); setScanFile(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["employee"] }),
        qc.invalidateQueries({ queryKey: ["termo-emp"] }),
        qc.invalidateQueries({ queryKey: ["termo-existente"] }),
        qc.invalidateQueries({ queryKey: ["termos-status"] }),
      ]);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar termo"),
  });

  const reemitir = useMutation({
    mutationFn: async () => {
      if (!emp || !termoExistente) throw new Error("Nada a reemitir");
      const paths = [termoExistente.pdf_path, termoExistente.scan_path].filter(Boolean) as string[];
      if (paths.length) {
        try { await supabase.storage.from("termos-consentimento").remove(paths); } catch {}
      }
      const { error: upErr } = await supabase
        .from("employees")
        .update({ termo_consentimento_id: null, termo_consentimento_data: null })
        .eq("id", emp.id);
      if (upErr) throw upErr;
      const { error: delErr } = await supabase
        .from("assinaturas_termos_consentimento")
        .delete()
        .eq("id", termoExistente.id);
      if (delErr) throw delErr;
    },
    onSuccess: async () => {
      toast.success("Termo anterior invalidado. Colete o novo termo (v2) abaixo.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["employee"] }),
        qc.invalidateQueries({ queryKey: ["termo-emp"] }),
        qc.invalidateQueries({ queryKey: ["termo-existente"] }),
        qc.invalidateQueries({ queryKey: ["termos-status"] }),
      ]);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao reemitir termo"),
  });

  const visualizar = async () => {
    if (!emp || !termoExistente) return;
    const iso = termoExistente.data_assinatura as string;
    const pdf = gerarTermoConsentimentoPDF({
      ...dadosBase(iso),
      coletadoPorNome: termoExistente.coletado_por_nome,
      modalidade: (termoExistente.modalidade as TermoModalidade) ?? "ELETRONICA",
      consenteImagem:
        termoExistente.consente_imagem ??
        (/\[IMAGEM:NAO\]/.test(termoExistente.observacoes ?? "") ? false : true),
      assinaturaDataUrl: termoExistente.assinatura_snapshot ?? null,
      codigoVerificacao: termoExistente.hash_sha256?.slice(0, 16) ?? null,
    });
    setPreviewName(`termo-consentimento-${(emp.nome || "func").replace(/\s+/g, "-").toLowerCase()}.pdf`);
    setPreviewDoc(pdf);
  };

  /** Abre o digitalizado (PDF/imagem) DENTRO do sistema, com URL assinada fresca. */
  const verDigitalizado = async () => {
    if (!termoExistente?.scan_path && !termoExistente?.scan_url) return;
    let url = termoExistente.scan_url as string | null;
    if (termoExistente.scan_path) {
      const { data } = await supabase.storage
        .from(BUCKET_TERMOS)
        .createSignedUrl(termoExistente.scan_path, 60 * 60);
      url = data?.signedUrl ?? url;
    }
    if (!url) {
      toast.error("Não foi possível localizar o arquivo digitalizado.");
      return;
    }
    const ext = (termoExistente.scan_path?.split(".").pop() || "pdf").toLowerCase();
    setScanPreviewName(`termo-digitalizado-${(emp?.nome || "func").replace(/\s+/g, "-").toLowerCase()}.${ext}`);
    setScanPreviewUrl(url);
  };

  const podeRegistrar =
    consenteImagem !== null &&
    (modalidade === "ELETRONICA" ? !!assinaturaAto : !!scanFile);

  const coletando = status === "PENDENTE" || status === "DESATUALIZADO";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-[#1a0a0e] border-rose-900/40 text-rose-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-50">
            <FileSignature className="h-5 w-5 text-emerald-400" />
            Termo de Consentimento LGPD — v{TERMO_VERSAO_ATUAL}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !emp ? (
          <div className="py-8 text-center text-sm text-rose-200/60">Carregando…</div>
        ) : (
          <div className="space-y-4">
            {status === "BLINDADO" && (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 flex items-start gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-300 shrink-0" />
                <div className="text-sm">
                  <div className="font-black text-emerald-200">Termo v{termoExistente?.versao_termo} válido</div>
                  <div className="text-xs text-emerald-50/90 mt-1 leading-relaxed">
                    Assinado em <strong>{new Date(emp.termo_consentimento_data + "T00:00:00").toLocaleDateString("pt-BR")}</strong>
                    {" "}·{" "}
                    {termoExistente?.modalidade === "PAPEL_DIGITALIZADO"
                      ? "assinatura manuscrita digitalizada"
                      : "assinatura eletrônica em tela"}
                    {" "}· foto:{" "}
                    <strong>{termoExistente?.consente_imagem === false ? "NÃO autorizada" : "autorizada"}</strong>
                  </div>
                  {termoExistente?.hash_sha256 && (
                    <div className="text-[10px] font-mono text-emerald-300/80 mt-1 break-all">
                      Verificação: {termoExistente.hash_sha256.slice(0, 32)}…
                    </div>
                  )}
                </div>
              </div>
            )}

            {status === "DESATUALIZADO" && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 flex items-start gap-3">
                <FileWarning className="h-6 w-6 text-amber-300 shrink-0" />
                <div className="text-sm">
                  <div className="font-black text-amber-200">Termo antigo (v1) — recoleta necessária</div>
                  <div className="text-xs text-amber-50/90 mt-1 leading-relaxed">
                    Este colaborador assinou o modelo antigo, que continha cláusula de ratificação retroativa e
                    não segregava as bases legais. Colete o novo termo abaixo — o antigo será substituído.
                  </div>
                </div>
              </div>
            )}

            {status === "PENDENTE" && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 flex items-start gap-3">
                <ShieldAlert className="h-6 w-6 text-rose-300 shrink-0" />
                <div className="text-sm">
                  <div className="font-black text-rose-100">Sem termo registrado</div>
                  <div className="text-xs text-rose-50/85 mt-1 leading-relaxed">
                    Colete o termo por um dos dois fluxos abaixo. O colaborador deve ler o texto ANTES de assinar.
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
            </div>

            {coletando && (
              <>
                {/* Modalidade */}
                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-rose-200/80">
                    Como o colaborador vai assinar?
                  </Label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalidade("PAPEL_DIGITALIZADO")}
                      className={`rounded-lg border p-3 text-left transition ${
                        modalidade === "PAPEL_DIGITALIZADO"
                          ? "border-emerald-400/60 bg-emerald-500/10"
                          : "border-rose-900/50 bg-rose-950/40 hover:bg-rose-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm text-rose-50">
                        <Printer className="h-4 w-4" /> Papel digitalizado
                      </div>
                      <div className="text-[11px] text-rose-200/70 mt-1 leading-snug">
                        Imprime a via, ele assina de próprio punho sobre o texto e você anexa o digitalizado.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalidade("ELETRONICA")}
                      className={`rounded-lg border p-3 text-left transition ${
                        modalidade === "ELETRONICA"
                          ? "border-emerald-400/60 bg-emerald-500/10"
                          : "border-rose-900/50 bg-rose-950/40 hover:bg-rose-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm text-rose-50">
                        <Smartphone className="h-4 w-4" /> Assinatura em tela
                      </div>
                      <div className="text-[11px] text-rose-200/70 mt-1 leading-snug">
                        Ele lê no celular/tablet e assina ali na hora, com registro de data, hora e dispositivo.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Bloco 2 — opt-in obrigatório */}
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/[0.06] p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-emerald-200">
                    Bloco 2 — uso da foto no sistema
                  </div>
                  <div className="text-[11px] text-emerald-50/85 mt-1 leading-relaxed">
                    Pergunte ao colaborador e registre a resposta dele. Sem escolha, o termo não é gerado.
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConsenteImagem(true)}
                      className={`flex-1 ${consenteImagem === true
                        ? "border-emerald-400 bg-emerald-500/25 text-white"
                        : "border-rose-900/50 bg-transparent text-rose-100 hover:bg-rose-900/30"}`}
                    >
                      SIM, autoriza
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConsenteImagem(false)}
                      className={`flex-1 ${consenteImagem === false
                        ? "border-amber-400 bg-amber-500/25 text-white"
                        : "border-rose-900/50 bg-transparent text-rose-100 hover:bg-rose-900/30"}`}
                    >
                      NÃO autoriza
                    </Button>
                  </div>
                </div>

                {/* Fluxo papel */}
                {modalidade === "PAPEL_DIGITALIZADO" && (
                  <div className="rounded-lg border border-rose-900/40 bg-rose-950/40 p-3 space-y-3">
                    <div className="text-xs font-black uppercase tracking-wide text-rose-200/80">
                      Passo a passo
                    </div>
                    <ol className="text-[11px] text-rose-100/85 space-y-1 list-decimal pl-4 leading-relaxed">
                      <li>Gere e imprima a via em branco (os quadros SIM/NÃO saem vazios para ele marcar).</li>
                      <li>O colaborador lê, marca a escolha e assina de próprio punho sobre o texto impresso.</li>
                      <li>Digitalize o termo <strong>inteiro</strong> (todas as páginas) e anexe abaixo.</li>
                    </ol>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={gerarViaImpressao}
                      className="border-rose-900/50 bg-transparent text-rose-100 hover:bg-rose-900/30 hover:text-white"
                    >
                      <Printer className="h-4 w-4 mr-1" /> Gerar via para impressão
                    </Button>

                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-rose-200/80">
                        Termo assinado digitalizado (PDF ou imagem)
                      </Label>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => setScanFile(e.target.files?.[0] ?? null)}
                      />
                      <div className="mt-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileRef.current?.click()}
                          className="border-rose-900/50 bg-transparent text-rose-100 hover:bg-rose-900/30 hover:text-white"
                        >
                          <Upload className="h-4 w-4 mr-1" /> Anexar digitalizado
                        </Button>
                        {scanFile && (
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-300 bg-emerald-500/10 max-w-[220px] truncate">
                            <Check className="h-3 w-3 mr-1" /> {scanFile.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fluxo eletrônico */}
                {modalidade === "ELETRONICA" && (
                  <div className="rounded-lg border border-rose-900/40 bg-rose-950/40 p-3 space-y-3">
                    <div className="text-[11px] text-rose-100/85 leading-relaxed">
                      Entregue o aparelho ao colaborador para ele <strong>ler o termo</strong> e assinar.
                      A assinatura é capturada no ato — não é reaproveitada da ficha.
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPadOpen(true)}
                        className="border-rose-900/50 bg-transparent text-rose-100 hover:bg-rose-900/30 hover:text-white"
                      >
                        <PenLine className="h-4 w-4 mr-1" /> Coletar assinatura em tela
                      </Button>
                      {assinaturaAto && (
                        <img src={assinaturaAto} alt="Assinatura coletada" className="h-9 bg-white border rounded px-1 object-contain" />
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-rose-200/80">Observações (opcional)</Label>
                  <Textarea
                    rows={2}
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex.: termo coletado durante DDS semanal, com testemunha."
                    className="mt-1 bg-rose-950/40 border-rose-900/50 text-rose-50 placeholder:text-rose-300/40 focus-visible:ring-emerald-400/40"
                  />
                </div>
              </>
            )}

            <div className="text-[11px] text-emerald-50/85 leading-relaxed border-l-2 border-emerald-400/60 pl-3 bg-emerald-500/[0.06] p-2 rounded">
              <strong className="text-emerald-200">Estrutura v2:</strong> Bloco 1 assinatura eletrônica (consentimento, sem efeito retroativo) ·
              Bloco 2 imagem/foto (consentimento específico, opt-in) · Bloco 3 saúde ocupacional (obrigação legal,
              LGPD art. 11 §2º "a"). Inclui direitos do titular (art. 18), canal de revogação e prazo de guarda.
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
          {(termoExistente?.scan_path || termoExistente?.scan_url) ? (
            <>
              <Button
                variant="outline"
                onClick={verDigitalizado}
                className="border-emerald-400/60 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 hover:text-white"
              >
                <FileSignature className="h-4 w-4 mr-1" /> Ver termo assinado
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={visualizar}
                title="Via gerada pelo sistema, sem as assinaturas de próprio punho"
                className="text-rose-200/70 hover:bg-rose-900/30 hover:text-white"
              >
                <Eye className="h-4 w-4 mr-1" /> Via em branco
              </Button>
            </>
          ) : (
            (status === "BLINDADO" || status === "DESATUALIZADO") && (
              <Button
                variant="outline"
                onClick={visualizar}
                className="border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-white"
              >
                <Eye className="h-4 w-4 mr-1" /> Visualizar termo
              </Button>
            )
          )}
          {status === "BLINDADO" && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Reemitir invalida o termo atual (PDF e digitalizado serão apagados) e permite coletar um novo. Prosseguir?")) {
                  reemitir.mutate();
                }
              }}
              disabled={reemitir.isPending}
              className="border-amber-400/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-1" /> {reemitir.isPending ? "Invalidando…" : "Reemitir termo"}
            </Button>
          )}
          {status === "DESATUALIZADO" && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Substituir o termo v1 por um novo termo v2? O registro antigo será removido.")) {
                  reemitir.mutate();
                }
              }}
              disabled={reemitir.isPending}
              className="border-amber-400/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-1" /> {reemitir.isPending ? "Substituindo…" : "Substituir por v2"}
            </Button>
          )}
          {status === "PENDENTE" && (
            <Button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending || !podeRegistrar}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/40 disabled:opacity-40"
            >
              <ShieldCheck className="h-4 w-4 mr-1" />
              {salvar.isPending ? "Registrando…" : "Registrar termo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SignaturePadDialog
      open={padOpen}
      onClose={() => setPadOpen(false)}
      title="Assinatura do colaborador — leitura do termo"
      onConfirm={(r) => { setAssinaturaAto(r.dataUrl); setPadOpen(false); }}
    />

    <PDFPreviewDialog
      open={!!previewDoc}
      onClose={() => setPreviewDoc(null)}
      doc={previewDoc}
      fileName={previewName}
      title="Termo de Consentimento"
    />

    <FilePreviewDialog
      open={!!scanPreviewUrl}
      onClose={() => setScanPreviewUrl(null)}
      url={scanPreviewUrl}
      fileName={scanPreviewName}
      title="Termo assinado digitalizado"
    />
    </>
  );
}
