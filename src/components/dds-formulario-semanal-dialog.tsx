import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { gerarFormularioSemanalDDS } from "@/lib/dds-formulario-semanal-pdf";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { ImagePlus, X } from "lucide-react";

function getMonday(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtBR(d: Date) { return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
function fmtBRFull(d: Date) { return d.toLocaleDateString("pt-BR"); }

export function DDSFormularioSemanalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [companyId, setCompanyId] = useState<string>("");
  const [setor, setSetor] = useState("");
  const [semanaSegunda, setSemanaSegunda] = useState<string>(() => getMonday(new Date()).toISOString().slice(0, 10));
  const [horaIni, setHoraIni] = useState("07:30");
  const [horaFim, setHoraFim] = useState("07:40");
  const [encarregado, setEncarregado] = useState("");
  const [sesmt, setSesmt] = useState("");
  const [temaIds, setTemaIds] = useState<string[]>([]);
  const [assuntosLivres, setAssuntosLivres] = useState("");
  const [matrizNome, setMatrizNome] = useState("J C S CONSTRUÇÃO NAVAL");
  const [matrizCnpj, setMatrizCnpj] = useState("54.761.547/0001-39");
  const [codigo, setCodigo] = useState("FOR-SEG 06");
  const [revisao, setRevisao] = useState("00");
  const [dataDoc, setDataDoc] = useState("30/08/2025");
  const [assinaturaUrl, setAssinaturaUrl] = useState<string>("");
  const [assinaturaEncUrl, setAssinaturaEncUrl] = useState<string>("");

  async function processarAssinatura(f: File, setter: (s: string) => void) {
    if (f.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
    try {
      const bitmap = await createImageBitmap(f, { imageOrientation: "from-image" } as any);
      const maxW = 800;
      const scale = Math.min(1, maxW / bitmap.width);
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, w, h);
      setter(canvas.toDataURL("image/png"));
    } catch {
      const reader = new FileReader();
      reader.onload = () => setter(String(reader.result || ""));
      reader.readAsDataURL(f);
    }
  }

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-for-dds"],
    queryFn: async () => (await supabase.from("companies").select("id,name,cnpj,encarregado1,encarregado2,matriz_nome,matriz_cnpj").order("name")).data ?? [],
  });
  const { data: temas = [] } = useQuery({
    queryKey: ["dds-temas-active"],
    queryFn: async () => (await supabase.from("dds_temas").select("id,codigo,titulo").eq("ativo", true).order("codigo")).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-by-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id,nome,roles(name)")
        .eq("status", "ATIVO")
        .eq("company_id", companyId)
        .order("nome");
      return data ?? [];
    },
  });

  const company = companies.find((c: any) => c.id === companyId);
  useEffect(() => {
    if (company) {
      setEncarregado(company.encarregado1 ?? "");
      // Se a empresa tiver matriz própria cadastrada, usar; caso contrário, usar o nome/CNPJ da própria empresa
      setMatrizNome(company.matriz_nome || company.name || "");
      setMatrizCnpj(company.matriz_cnpj || company.cnpj || "");
    }
  }, [companyId]); // eslint-disable-line

  const periodoTexto = useMemo(() => {
    if (!semanaSegunda) return "";
    const seg = new Date(semanaSegunda + "T00:00");
    const sex = new Date(seg); sex.setDate(sex.getDate() + 4);
    return `${fmtBR(seg)} à ${fmtBRFull(sex)}`;
  }, [semanaSegunda]);

  function gerar() {
    if (!companyId) return toast.error("Selecione a empresa");
    if (employees.length === 0) return toast.error("Empresa sem funcionários ativos");
    const temasSel = temaIds
      .map((id) => temas.find((t: any) => t.id === id))
      .filter(Boolean)
      .map((t: any) => `${t.codigo ? t.codigo + "- " : ""}${t.titulo}`)
      .join(" / ");
    const assuntos = [temasSel, assuntosLivres.trim()].filter(Boolean).join(" / ");
    const doc = gerarFormularioSemanalDDS({
      matrizNome, matrizCnpj, codigo, revisao, dataDocumento: dataDoc, pagina: "01/01",
      empresaNome: company?.name ?? "",
      empresaCnpj: company?.cnpj ?? "",
      localSetor: setor || "—",
      periodoTexto,
      horaTexto: `${horaIni.replace(":", "h")}min às ${horaFim.replace(":", "h")}min`,
      assuntos: assuntos || "—",
      funcionarios: employees.map((e: any) => ({ nome: e.nome, funcao: e.roles?.name ?? "" })),
      encarregado, responsavelSesmt: sesmt,
      assinaturaResponsavelDataUrl: assinaturaUrl || null,
      assinaturaEncarregadoDataUrl: assinaturaEncUrl || null,
    });
    const fname = `DDS_${(company?.name ?? "empresa").replace(/\s+/g, "_")}_${semanaSegunda}.pdf`;
    doc.save(fname);
    toast.success("Formulário gerado");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Gerar Formulário Semanal DDS (PDF)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Empresa *</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {companyId && <div className="text-xs text-muted-foreground mt-1">{employees.length} funcionário(s) ativo(s)</div>}
            </div>
            <div><Label>Local / Setor</Label><Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: PRODUÇÃO / PRÉ-FABRICAÇÃO" /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Segunda da semana *</Label><Input type="date" value={semanaSegunda} onChange={(e) => setSemanaSegunda(e.target.value)} /></div>
            <div><Label>Hora início</Label><Input type="time" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} /></div>
            <div><Label>Hora fim</Label><Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
            <div className="flex items-end text-xs text-muted-foreground">{periodoTexto}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Encarregado / Designado</Label><Input value={encarregado} onChange={(e) => setEncarregado(e.target.value)} /></div>
            <div><Label>Responsável SESMT</Label><Input value={sesmt} onChange={(e) => setSesmt(e.target.value)} /></div>
          </div>

          <div>
            <Label>Assinaturas (PNG, fundo transparente recomendado)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
              {([
                { label: "Encarregado / Designado", val: assinaturaEncUrl, set: setAssinaturaEncUrl },
                { label: "Responsável SESMT", val: assinaturaUrl, set: setAssinaturaUrl },
              ] as const).map((s) => (
                <div key={s.label} className="border rounded p-2">
                  <div className="text-[11px] font-bold uppercase text-slate-600 mb-1">{s.label}</div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg px-3 py-2">
                      <ImagePlus className="h-4 w-4" />
                      {s.val ? "Trocar" : "Assinar"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) await processarAssinatura(f, s.set);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {s.val && (
                      <>
                        <img src={s.val} alt="Assinatura" className="h-12 border rounded bg-white object-contain px-2" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => s.set("")}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Temas da semana</Label>
            <div className="border rounded max-h-40 overflow-auto divide-y mt-1">
              {temas.map((t: any) => {
                const checked = temaIds.includes(t.id);
                return (
                  <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => setTemaIds(checked ? temaIds.filter((x) => x !== t.id) : [...temaIds, t.id])} />
                    <span className="flex-1 truncate">{t.codigo ? `${t.codigo}. ` : ""}{t.titulo}</span>
                  </label>
                );
              })}
              {temas.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">Nenhum tema cadastrado</div>}
            </div>
            <Label className="mt-2 block">Assuntos adicionais (texto livre)</Label>
            <Textarea rows={2} value={assuntosLivres} onChange={(e) => setAssuntosLivres(e.target.value)} placeholder="Ex: 99- Outro assunto" />
          </div>

          <details className="border rounded p-2">
            <summary className="text-xs font-bold uppercase text-slate-500 cursor-pointer">Cabeçalho do documento (matriz / ISO)</summary>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              <div><Label className="text-xs">Empresa matriz</Label><Input value={matrizNome} onChange={(e) => setMatrizNome(e.target.value)} /></div>
              <div><Label className="text-xs">CNPJ matriz</Label><Input value={matrizCnpj} onChange={(e) => setMatrizCnpj(e.target.value)} /></div>
              <div><Label className="text-xs">Código</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
              <div><Label className="text-xs">Revisão</Label><Input value={revisao} onChange={(e) => setRevisao(e.target.value)} /></div>
              <div><Label className="text-xs">Data documento</Label><Input value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} /></div>
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={gerar}><FileDown className="h-4 w-4 mr-1" />Gerar PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}