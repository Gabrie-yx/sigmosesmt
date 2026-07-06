import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { parsePontoPdf, diaEmConformidade, motivoFlag, type ParsedFolha } from "@/lib/ponto-parser";

export const Route = createFileRoute("/app/administrativo/gestao-ponto/$cicloId")({
  component: CicloDetalhePage,
});

type Ciclo = {
  id: string;
  competencia: string;
  status: string;
  pdf_original_url: string | null;
  pdf_original_nome: string | null;
  total_paginas: number | null;
  total_funcionarios: number | null;
};

type Folha = {
  id: string;
  ciclo_id: string;
  pagina_pdf: number | null;
  matricula: string | null;
  nome: string | null;
  cargo: string | null;
  local_trabalho: string | null;
  status: string;
  employee_id: string | null;
};

type Dia = {
  id: string;
  folha_id: string;
  data: string;
  marcacoes: string[] | null;
  status_sistema: string | null;
  motivo_flag: string | null;
  precisa_tratativa: boolean;
};

function CicloDetalhePage() {
  const { cicloId } = Route.useParams();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [tratarDia, setTratarDia] = useState<Dia | null>(null);

  const { data: ciclo } = useQuery({
    queryKey: ["ponto_ciclo", cicloId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ponto_ciclos" as any).select("*").eq("id", cicloId).maybeSingle();
      if (error) throw error;
      return data as unknown as Ciclo | null;
    },
  });

  const { data: folhas = [] } = useQuery({
    queryKey: ["ponto_folhas", cicloId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ponto_folhas" as any).select("*").eq("ciclo_id", cicloId).order("pagina_pdf");
      if (error) throw error;
      return (data ?? []) as unknown as Folha[];
    },
  });

  const { data: dias = [] } = useQuery({
    queryKey: ["ponto_dias", cicloId],
    enabled: folhas.length > 0,
    queryFn: async () => {
      const ids = folhas.map(f => f.id);
      const { data, error } = await supabase.from("ponto_dias" as any).select("*").in("folha_id", ids).eq("precisa_tratativa", true).order("data");
      if (error) throw error;
      return (data ?? []) as unknown as Dia[];
    },
  });

  async function handleUpload(file: File) {
    if (!ciclo) return;
    setUploading(true);
    try {
      // 1) sobe pro storage
      const path = `${cicloId}/original-${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("ponto-pdfs").upload(path, file, { upsert: false });
      if (up.error) throw up.error;

      // 2) parseia no browser
      toast.info("Extraindo dados do PDF…");
      const parsed = await parsePontoPdf(file);

      // 3) atualiza ciclo
      await supabase.from("ponto_ciclos" as any).update({
        pdf_original_url: path,
        pdf_original_nome: file.name,
        total_paginas: parsed.length,
        total_funcionarios: parsed.filter(p => p.matricula || p.nome).length,
        status: "em_tratamento",
      }).eq("id", cicloId);

      // 4) insere folhas + dias (só flagged)
      await insertParsed(cicloId, parsed);

      toast.success(`PDF processado: ${parsed.length} páginas`);
      qc.invalidateQueries({ queryKey: ["ponto_ciclo", cicloId] });
      qc.invalidateQueries({ queryKey: ["ponto_folhas", cicloId] });
      qc.invalidateQueries({ queryKey: ["ponto_dias", cicloId] });
      qc.invalidateQueries({ queryKey: ["ponto_ciclos"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload/parser");
    } finally {
      setUploading(false);
    }
  }

  const totalTratativas = dias.length;
  const conformesEstim = folhas.length * 30 - totalTratativas;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/administrativo/gestao-ponto"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Ciclo · {ciclo?.competencia ?? "…"}</h1>
          <p className="text-sm text-muted-foreground">Upload da folha do mês, tratativas e aprovação.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> PDF do mês</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ciclo?.pdf_original_url ? (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{ciclo.pdf_original_nome}</span>
              <Badge variant="outline">{ciclo.total_paginas ?? 0} páginas</Badge>
              <Badge variant="outline">{ciclo.total_funcionarios ?? 0} funcionários</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum PDF enviado ainda.</p>
          )}
          <label className="inline-flex">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }}
              disabled={uploading}
            />
            <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {ciclo?.pdf_original_url ? "Substituir PDF" : "Enviar PDF"}
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Folhas processadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{folhas.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Dias com tratativa pendente</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{totalTratativas}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Em conformidade (estimado)</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Math.max(conformesEstim, 0)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dias pra tratar</CardTitle></CardHeader>
        <CardContent>
          {dias.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {folhas.length === 0 ? "Envie o PDF pra iniciar." : "Nada pendente. Tudo em conformidade 🎯"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-xs">
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">Data</th>
                    <th className="text-left py-2 pr-2">Funcionário</th>
                    <th className="text-left py-2 pr-2">Marcações</th>
                    <th className="text-left py-2 pr-2">Motivo</th>
                    <th className="text-right py-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map(d => {
                    const f = folhas.find(x => x.id === d.folha_id);
                    return (
                      <tr key={d.id} className="border-b hover:bg-muted/20">
                        <td className="py-2 pr-2 font-mono">{formatDate(d.data)}</td>
                        <td className="py-2 pr-2">{f?.nome ?? f?.matricula ?? "—"}</td>
                        <td className="py-2 pr-2 font-mono text-xs">{(d.marcacoes ?? []).join("  ") || "—"}</td>
                        <td className="py-2 pr-2"><Badge variant="outline">{d.motivo_flag ?? "REVISAR"}</Badge></td>
                        <td className="py-2 text-right"><Button size="sm" variant="outline" onClick={() => setTratarDia(d)}>Tratar</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {tratarDia && (
        <TratativaDialog
          dia={tratarDia}
          folha={folhas.find(f => f.id === tratarDia.folha_id) ?? null}
          onClose={() => setTratarDia(null)}
          onSaved={() => {
            setTratarDia(null);
            qc.invalidateQueries({ queryKey: ["ponto_dias", cicloId] });
          }}
        />
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function insertParsed(cicloId: string, parsed: ParsedFolha[]) {
  for (const p of parsed) {
    if (!p.matricula && !p.nome) continue; // pula páginas sem cabeçalho identificável
    const { data: folha, error } = await supabase.from("ponto_folhas" as any).insert({
      ciclo_id: cicloId,
      matricula: p.matricula ?? null,
      nome: p.nome ?? null,
      cargo: p.cargo ?? null,
      local_trabalho: p.local ?? null,
      pagina_pdf: p.pagina,
      status: "pendente",
    }).select("id").single();
    if (error) throw error;

    const diasParaInserir = p.dias
      .filter(d => !diaEmConformidade(d))
      .map(d => ({
        folha_id: (folha as any).id,
        data: d.data,
        marcacoes: d.marcacoes,
        motivo_flag: motivoFlag(d),
        precisa_tratativa: true,
        raw_json: d as any,
      }));
    if (diasParaInserir.length > 0) {
      const { error: e2 } = await supabase.from("ponto_dias" as any).insert(diasParaInserir);
      if (e2) throw e2;
    }
  }
}

function TratativaDialog({ dia, folha, onClose, onSaved }: { dia: Dia; folha: Folha | null; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<string>("ATESTADO");
  const [descricao, setDescricao] = useState("");
  const [cid, setCid] = useState("");
  const [dataInicio, setDataInicio] = useState(dia.data);
  const [dataFim, setDataFim] = useState(dia.data);
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [saving, setSaving] = useState(false);

  const tipos = useMemo(() => [
    "ATESTADO", "FALTA_JUSTIFICADA", "FALTA_INJUSTIFICADA", "HE_AUTORIZADA",
    "AJUSTE_MARCACAO", "FOLGA_COMPENSADA", "OUTRO",
  ], []);

  async function salvar() {
    if (descricao.trim().length < 5) { toast.error("Descreva a tratativa (≥ 5 caracteres)."); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("ponto_tratativas" as any).insert({
        dia_id: dia.id,
        folha_id: dia.folha_id,
        tipo,
        descricao,
        cid: cid || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        autorizado_por: autorizadoPor || null,
        criado_por: userRes.user?.id,
      } as any);
      if (error) throw error;
      await supabase.from("ponto_dias" as any).update({
        precisa_tratativa: false,
        status_sistema: "tratado",
      }).eq("id", dia.id);
      toast.success("Tratativa registrada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tratar dia · {formatDate(dia.data)}</DialogTitle>
          <DialogDescription>
            {folha?.nome ?? folha?.matricula ?? "Funcionário"} · marcações: {(dia.marcacoes ?? []).join(" ") || "sem marcação"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
              {tipos.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Início</label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Fim</label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
          </div>
          {tipo === "ATESTADO" && (
            <div><label className="text-xs text-muted-foreground">CID</label><Input value={cid} onChange={e => setCid(e.target.value)} placeholder="Ex.: J06.9" /></div>
          )}
          <div><label className="text-xs text-muted-foreground">Autorizado por</label><Input value={autorizadoPor} onChange={e => setAutorizadoPor(e.target.value)} placeholder="Nome do líder/gestor" /></div>
          <div><label className="text-xs text-muted-foreground">Descrição *</label><Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} placeholder="O que aconteceu / providência tomada" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar tratativa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}