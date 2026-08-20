// Leitor de PGR / LTCAT / PCMSO — lê o PDF já anexado em Documentos do SESMT,
// interpreta por regras fixas (sem IA) e alimenta o cadastro do sistema
// (riscos quantitativos por cargo + medições + GHEs), sempre com conferência.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ScanText, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  lerDocumentoSST,
  melhorCorrespondencia,
  type ResultadoLeitura,
} from "@/lib/pgr-ltcat-parser";

type Doc = {
  id: string;
  tipo: string;
  titulo?: string | null;
  file_path: string;
  data_emissao?: string | null;
};

type Linha = {
  id: string;
  usar: boolean;
  agente: string;
  contexto: string | null;
  linha: string;
  page: number;
  roleId: string | "";
  riscoId: string | "";
  intensidade: string;
  unidade: string;
  tecnica: string;
};

export function LeitorDocSSTDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: Doc | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLeitura | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [ghesSel, setGhesSel] = useState<Record<string, boolean>>({});
  const [aplicando, setAplicando] = useState(false);

  const { data: roles = [] } = useQuery({
    queryKey: ["leitor-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, setor, ghe")
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["leitor-catalogo-riscos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_riscos")
        .select("id, nome, categoria")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const { data: ghesExistentes = [] } = useQuery({
    queryKey: ["leitor-ghes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pgr_ghe").select("id, numero, setor");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setResultado(null);
      setLinhas([]);
      setStatus(null);
      setGhesSel({});
    }
  }, [open]);

  async function processar() {
    if (!doc) return;
    setLendo(true);
    setStatus("Baixando documento...");
    try {
      const { data, error } = await supabase.storage.from("sesmt-docs").download(doc.file_path);
      if (error || !data) throw error ?? new Error("Arquivo não encontrado no armazenamento.");
      const bytes = new Uint8Array(await data.arrayBuffer());
      const res = await lerDocumentoSST(bytes, setStatus);
      setResultado(res);

      const novas: Linha[] = res.medicoes.map((m) => {
        const risco = melhorCorrespondencia(m.agente, catalogo, (c: any) => c.nome);
        const cargo = m.contexto
          ? melhorCorrespondencia(m.contexto, roles, (r: any) =>
              `${r.name ?? ""} ${r.setor ?? ""} ${r.ghe ?? ""}`,
            )
          : null;
        return {
          id: m.id,
          usar: Boolean(risco && cargo && m.intensidade !== null),
          agente: m.agente,
          contexto: m.contexto,
          linha: m.linha,
          page: m.page,
          riscoId: (risco?.item as any)?.id ?? "",
          roleId: (cargo?.item as any)?.id ?? "",
          intensidade: m.intensidade !== null ? String(m.intensidade) : "",
          unidade: m.unidade ?? "",
          tecnica: m.tecnica ?? "",
        };
      });
      setLinhas(novas);

      const sel: Record<string, boolean> = {};
      for (const g of res.ghes) {
        const existe = ghesExistentes.some(
          (e: any) => Number(e.numero) === Number(g.numero),
        );
        sel[g.id] = !existe;
      }
      setGhesSel(sel);
      setStatus(null);

      if (!res.temCamadaTexto) {
        toast.warning(
          "Este PDF parece ser digitalizado (sem camada de texto). O leitor precisa de PDF gerado digitalmente.",
        );
      } else {
        toast.success(`${res.medicoes.length} medição(ões) encontradas em ${res.paginas} páginas.`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler o documento.");
      setStatus(null);
    } finally {
      setLendo(false);
    }
  }

  const prontas = useMemo(
    () => linhas.filter((l) => l.usar && l.roleId && l.riscoId && l.intensidade),
    [linhas],
  );

  function patch(id: string, p: Partial<Linha>) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));
  }

  async function aplicar() {
    if (!doc) return;
    setAplicando(true);
    let atualizados = 0;
    let criados = 0;
    let ghesCriados = 0;
    try {
      // 1) GHEs novos
      const novosGhes = (resultado?.ghes ?? []).filter((g) => ghesSel[g.id]);
      for (const g of novosGhes) {
        const { error } = await (supabase as any).from("pgr_ghe").insert({
          numero: g.numero,
          setor: g.setor,
          descricao_ambiente: g.descricao,
          ativo: true,
        });
        if (!error) ghesCriados++;
      }

      // 2) Riscos quantitativos por cargo + histórico de medição
      for (const l of prontas) {
        const valor = Number(l.intensidade.replace(",", "."));
        const payload: any = {
          intensidade: Number.isFinite(valor) ? valor : null,
          unidade: l.unidade || null,
          tecnica_medicao: l.tecnica || null,
          status_avaliacao: "QUANTITATIVA",
          data_avaliacao: doc.data_emissao ?? new Date().toISOString().slice(0, 10),
          responsavel_avaliacao: `Importado de ${doc.tipo}${doc.titulo ? ` — ${doc.titulo}` : ""}`,
          ativo: true,
        };

        const { data: existente } = await (supabase as any)
          .from("cargo_riscos")
          .select("id")
          .eq("role_id", l.roleId)
          .eq("risco_id", l.riscoId)
          .maybeSingle();

        let cargoRiscoId = existente?.id as string | undefined;
        if (cargoRiscoId) {
          const { error } = await (supabase as any)
            .from("cargo_riscos")
            .update(payload)
            .eq("id", cargoRiscoId);
          if (error) throw error;
          atualizados++;
        } else {
          const { data: ins, error } = await (supabase as any)
            .from("cargo_riscos")
            .insert({ ...payload, role_id: l.roleId, risco_id: l.riscoId })
            .select("id")
            .single();
          if (error) throw error;
          cargoRiscoId = ins.id;
          criados++;
        }

        if (cargoRiscoId) {
          await (supabase as any).from("cargo_riscos_medicoes").insert({
            cargo_risco_id: cargoRiscoId,
            data_medicao: payload.data_avaliacao,
            valor_medido: payload.intensidade,
            unidade: payload.unidade,
            tecnica: payload.tecnica_medicao,
            observacao: `Extraído automaticamente do ${doc.tipo} (pág. ${l.page}).`,
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["cargo-riscos"] });
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["leitor-ghes"] });
      toast.success(
        `Sistema alimentado: ${criados} risco(s) criado(s), ${atualizados} atualizado(s), ${ghesCriados} GHE(s) novo(s).`,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao aplicar no cadastro.");
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanText className="h-5 w-5" />
            Ler documento e alimentar o sistema
          </DialogTitle>
          <p className="text-sm text-slate-600">
            {doc?.tipo} — {doc?.titulo ?? "sem título"}. Leitura por regras técnicas (sem IA):
            agentes, intensidade, unidade e técnica de medição são extraídos do próprio PDF e
            gravados nos <strong>riscos quantitativos do cargo</strong> (campos 15.4 e 15.5 do PPP).
          </p>
        </DialogHeader>

        {!resultado ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
            <Button onClick={processar} disabled={lendo} size="lg">
              {lendo ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {status ?? "Lendo..."}
                </>
              ) : (
                <>
                  <ScanText className="h-4 w-4 mr-2" /> Ler documento
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500 max-w-md text-center">
              Nada é gravado automaticamente — você confere e confirma cada linha antes de aplicar.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="medicoes" className="flex-1 min-h-0 flex flex-col">
            <TabsList>
              <TabsTrigger value="medicoes">
                Medições ({linhas.length})
              </TabsTrigger>
              <TabsTrigger value="ghes">GHEs ({resultado.ghes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="medicoes" className="flex-1 min-h-0">
              <ScrollArea className="h-[52vh] pr-3">
                {linhas.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                    Nenhuma medição reconhecida. Verifique se o PDF tem camada de texto (não
                    digitalizado) e se as tabelas trazem agente + valor + unidade.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linhas.map((l) => (
                      <div
                        key={l.id}
                        className="border rounded-lg p-3 grid grid-cols-1 lg:grid-cols-12 gap-2 items-center"
                      >
                        <div className="lg:col-span-1 flex items-center gap-2">
                          <Checkbox
                            checked={l.usar}
                            onCheckedChange={(v) => patch(l.id, { usar: Boolean(v) })}
                          />
                          <Badge variant="outline">p.{l.page}</Badge>
                        </div>
                        <div className="lg:col-span-3">
                          <Select
                            value={l.roleId}
                            onValueChange={(v) => patch(l.id, { roleId: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Cargo destino" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((r: any) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                  {r.setor ? ` — ${r.setor}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-slate-500 mt-1 truncate">
                            Contexto no PDF: {l.contexto ?? "—"}
                          </p>
                        </div>
                        <div className="lg:col-span-3">
                          <Select
                            value={l.riscoId}
                            onValueChange={(v) => patch(l.id, { riscoId: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Risco do catálogo" />
                            </SelectTrigger>
                            <SelectContent>
                              {catalogo.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.categoria} — {c.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-slate-500 mt-1">Detectado: {l.agente}</p>
                        </div>
                        <div className="lg:col-span-1">
                          <Input
                            value={l.intensidade}
                            onChange={(e) => patch(l.id, { intensidade: e.target.value })}
                            placeholder="15.4"
                          />
                        </div>
                        <div className="lg:col-span-1">
                          <Input
                            value={l.unidade}
                            onChange={(e) => patch(l.id, { unidade: e.target.value })}
                            placeholder="un."
                          />
                        </div>
                        <div className="lg:col-span-3">
                          <Input
                            value={l.tecnica}
                            onChange={(e) => patch(l.id, { tecnica: e.target.value })}
                            placeholder="Técnica (15.5)"
                          />
                          <p className="text-[11px] text-slate-400 mt-1 truncate" title={l.linha}>
                            {l.linha}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="ghes" className="flex-1 min-h-0">
              <ScrollArea className="h-[52vh] pr-3">
                <div className="space-y-2">
                  {resultado.ghes.length === 0 && (
                    <p className="text-sm text-slate-500 p-4">Nenhum GHE identificado no PDF.</p>
                  )}
                  {resultado.ghes.map((g) => {
                    const existe = ghesExistentes.some(
                      (e: any) => Number(e.numero) === Number(g.numero),
                    );
                    return (
                      <div key={g.id} className="border rounded-lg p-3 flex items-center gap-3">
                        <Checkbox
                          checked={Boolean(ghesSel[g.id])}
                          onCheckedChange={(v) =>
                            setGhesSel((s) => ({ ...s, [g.id]: Boolean(v) }))
                          }
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            GHE {g.numero} — {g.setor}
                          </p>
                        </div>
                        {existe ? (
                          <Badge variant="outline" className="text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> já cadastrado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700">
                            novo
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="border-t pt-3">
          <div className="mr-auto text-xs text-slate-600">
            {resultado
              ? `${prontas.length} linha(s) prontas para aplicar de ${linhas.length} lidas.`
              : ""}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {resultado && (
            <Button onClick={aplicar} disabled={aplicando || prontas.length === 0}>
              {aplicando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Aplicar no sistema
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
