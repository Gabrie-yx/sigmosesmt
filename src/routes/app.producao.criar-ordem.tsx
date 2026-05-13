import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { ClipboardList, Search, Anchor, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/producao/criar-ordem")({
  component: CriarOrdemPage,
});

type Embarcacao = { id: string; nome: string; numero_casco: string | null; tipo: string; ncm: string | null };
type Material = {
  id: string;
  codigo_material: string;
  tipo_material: "HALB" | "FERT";
  descricao: string;
  ncm: string | null;
  embarcacao_id: string | null;
};

function CriarOrdemPage() {
  const qc = useQueryClient();
  const [embarcacaoId, setEmbarcacaoId] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<"TODOS" | "HALB" | "FERT">("TODOS");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [observacoes, setObservacoes] = useState("");
  const [dataPrevista, setDataPrevista] = useState(new Date().toISOString().split("T")[0]);

  const { data: embarcacoes = [] } = useQuery({
    queryKey: ["producao_embarcacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_embarcacoes")
        .select("id, nome, numero_casco, tipo, ncm")
        .order("nome");
      if (error) throw error;
      return data as Embarcacao[];
    },
  });

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["producao_materiais"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_materiais")
        .select("id, codigo_material, tipo_material, descricao, ncm, embarcacao_id")
        .order("codigo_material");
      if (error) throw error;
      return data as Material[];
    },
  });

  const embarcacaoSel = embarcacoes.find((e) => e.id === embarcacaoId);

  const filtrados = useMemo(() => {
    const s = busca.toLowerCase().trim();
    return materiais
      .filter((m) => tipoFiltro === "TODOS" || m.tipo_material === tipoFiltro)
      .filter(
        (m) =>
          !s ||
          m.codigo_material.toLowerCase().includes(s) ||
          m.descricao.toLowerCase().includes(s),
      );
  }, [materiais, tipoFiltro, busca]);

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const vincularMut = useMutation({
    mutationFn: async () => {
      if (!embarcacaoId) throw new Error("Selecione uma embarcação");
      if (selecionados.size === 0) throw new Error("Selecione ao menos um material");
      const ids = Array.from(selecionados);
      const { error } = await (supabase as any)
        .from("producao_materiais")
        .update({ embarcacao_id: embarcacaoId })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producao_materiais"] });
      toast.success(
        `Ordem registrada: ${selecionados.size} material(is) vinculados a ${embarcacaoSel?.nome}.`,
      );
      setSelecionados(new Set());
      setObservacoes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <ClipboardList className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Criar Nova Ordem de Produção</h1>
          <p className="text-xs text-muted-foreground font-medium">
            Selecione a embarcação (casco) e vincule os materiais HALB/FERT que farão parte desta ordem.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
          1 · Dados da Ordem
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">Embarcação / Casco *</Label>
            <Select value={embarcacaoId} onValueChange={setEmbarcacaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar embarcação…" />
              </SelectTrigger>
              <SelectContent>
                {embarcacoes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.numero_casco ? `Casco ${e.numero_casco} · ` : ""}
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Data Prevista de Início</Label>
            <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
          </div>
        </div>
        {embarcacaoSel && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="bg-slate-100">
              <Anchor className="h-3 w-3 mr-1" /> {embarcacaoSel.tipo}
            </Badge>
            {embarcacaoSel.ncm && (
              <Badge variant="outline">NCM {embarcacaoSel.ncm}</Badge>
            )}
            {embarcacaoSel.numero_casco && (
              <Badge variant="outline">Casco {embarcacaoSel.numero_casco}</Badge>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            2 · Materiais da Ordem ({selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"})
          </div>
          <div className="flex items-center gap-2">
            <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as typeof tipoFiltro)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os tipos</SelectItem>
                <SelectItem value="FERT">FERT — Acabado</SelectItem>
                <SelectItem value="HALB">HALB — Semiacabado</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar código ou descrição…"
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 sticky top-0">
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead className="w-[80px]">Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[110px]">NCM</TableHead>
                <TableHead className="w-[80px]">Vinc.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum material. <Link to="/app/producao/criar-halb" className="text-amber-700 underline">Criar HALB</Link>
                    {" · "}
                    <Link to="/app/producao/criar-fert" className="text-amber-700 underline">Criar FERT</Link>
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((m) => {
                  const checked = selecionados.has(m.id);
                  const jaVinc = m.embarcacao_id === embarcacaoId && embarcacaoId;
                  return (
                    <TableRow key={m.id} className={checked ? "bg-amber-50/50" : ""}>
                      <TableCell>
                        <Checkbox checked={checked} onCheckedChange={() => toggle(m.id)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">{m.codigo_material}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          m.tipo_material === "FERT"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-blue-100 text-blue-800 border-blue-300"
                        }>
                          {m.tipo_material}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{m.descricao}</TableCell>
                      <TableCell className="font-mono text-xs">{m.ncm ?? "—"}</TableCell>
                      <TableCell>
                        {jaVinc ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[10px]">
                            JÁ NESTA
                          </Badge>
                        ) : m.embarcacao_id ? (
                          <Badge variant="outline" className="text-[10px]">OUTRA</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">livre</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
          3 · Observações
        </div>
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Notas, prioridades, requisitos especiais…"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Package className="h-4 w-4" />
          {selecionados.size} material(is) serão vinculados à embarcação selecionada.
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setSelecionados(new Set()); setObservacoes(""); }}>
            Limpar
          </Button>
          <Button
            onClick={() => vincularMut.mutate()}
            disabled={vincularMut.isPending || !embarcacaoId || selecionados.size === 0}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {vincularMut.isPending ? "Salvando…" : "Confirmar Ordem"}
          </Button>
        </div>
      </div>
    </div>
  );
}
