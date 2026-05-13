import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import dmnLogo from "@/assets/dmn-logo.png";

export const Route = createFileRoute("/app/producao/criar-ordem")({
  component: CriarOrdemPage,
});

type Embarcacao = { id: string; nome: string; numero_casco: string | null };

type ItemRow = {
  item: number;
  data_solicitacao: string;
  descricao_material: string;
  unidade_medida: string;
  grupo_compradores: string;
  ncm: string;
  centro: string;
  deposito: string;
  grupo_mercadorias: string;
  setor_atividade: string;
  grupo_categ_item_ger: string;
  classe_avaliacao: string;
  determ_preco: string;
  controle_preco: string;
  origem_material: string;
  utilizacao_material: string;
  codigo_sap: string;
  ocorrencia: string;
};

function blankRow(item: number, dataPadrao: string, tipo: "HALB" | "FERT" | "MISTA"): ItemRow {
  const isFert = tipo === "FERT";
  return {
    item,
    data_solicitacao: dataPadrao,
    descricao_material: "",
    unidade_medida: "UN",
    grupo_compradores: isFert ? "A03" : "não tem",
    ncm: "89079000",
    centro: "C020",
    deposito: isFert ? "DE01" : "DP01",
    grupo_mercadorias: "AT0024",
    setor_atividade: "20",
    grupo_categ_item_ger: "NORM",
    classe_avaliacao: isFert ? "20" : "7903",
    determ_preco: isFert ? "" : "3",
    controle_preco: "S",
    origem_material: "NACIONAL",
    utilizacao_material: "INDUSTRIALIZAÇÃO",
    codigo_sap: "",
    ocorrencia: "",
  };
}

function CriarOrdemPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const [numero, setNumero] = useState(`OP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`);
  const [dataSolicitacao, setDataSolicitacao] = useState(today);
  const [embarcacaoId, setEmbarcacaoId] = useState<string>("");
  const [tipoOrdem, setTipoOrdem] = useState<"HALB" | "FERT" | "MISTA">("HALB");
  const [revisao, setRevisao] = useState("00");
  const [pagina, setPagina] = useState("01/01");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemRow[]>([blankRow(1, today, "HALB")]);

  const { data: embarcacoes = [] } = useQuery({
    queryKey: ["producao_embarcacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_embarcacoes")
        .select("id, nome, numero_casco")
        .order("nome");
      if (error) throw error;
      return data as Embarcacao[];
    },
  });

  const codigoFormulario = tipoOrdem === "FERT" ? "FOR-PROD 02" : "FOR-PROD 01";

  function addRow() {
    setItens((rs) => [...rs, blankRow(rs.length + 1, dataSolicitacao, tipoOrdem)]);
  }
  function removeRow(idx: number) {
    setItens((rs) => rs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, item: i + 1 })));
  }
  function updateRow(idx: number, patch: Partial<ItemRow>) {
    setItens((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!numero.trim()) throw new Error("Informe o número da ordem");
      if (!embarcacaoId) throw new Error("Selecione uma embarcação");
      const validos = itens.filter((i) => i.descricao_material.trim());
      if (validos.length === 0) throw new Error("Adicione ao menos um item com descrição");

      const { data: ord, error: e1 } = await (supabase as any)
        .from("producao_ordens")
        .insert({
          numero,
          data_solicitacao: dataSolicitacao,
          embarcacao_id: embarcacaoId,
          tipo_ordem: tipoOrdem,
          codigo_formulario: codigoFormulario,
          revisao,
          pagina,
          observacoes: observacoes || null,
          status: "RASCUNHO",
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const linhas = validos.map((r) => ({
        ordem_id: ord.id,
        item: r.item,
        data_solicitacao: r.data_solicitacao || null,
        descricao_material: r.descricao_material,
        unidade_medida: r.unidade_medida || null,
        grupo_compradores: r.grupo_compradores || null,
        ncm: r.ncm || null,
        centro: r.centro || null,
        deposito: r.deposito || null,
        grupo_mercadorias: r.grupo_mercadorias || null,
        setor_atividade: r.setor_atividade || null,
        grupo_categ_item_ger: r.grupo_categ_item_ger || null,
        classe_avaliacao: r.classe_avaliacao || null,
        determ_preco: r.determ_preco || null,
        controle_preco: r.controle_preco || null,
        origem_material: r.origem_material || null,
        utilizacao_material: r.utilizacao_material || null,
        codigo_sap: r.codigo_sap || null,
        ocorrencia: r.ocorrencia || null,
      }));

      const { error: e2 } = await (supabase as any)
        .from("producao_ordem_itens")
        .insert(linhas);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producao_ordens"] });
      toast.success("Ordem de Produção criada com sucesso!");
      navigate({ to: "/app/producao/ordens" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const embarcacaoSel = useMemo(
    () => embarcacoes.find((e) => e.id === embarcacaoId),
    [embarcacoes, embarcacaoId],
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1400px] space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <ClipboardList className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Nova Ordem de Produção</h1>
          <p className="text-xs text-muted-foreground font-medium">
            Formulário conforme planilha {codigoFormulario} (Rev. {revisao})
          </p>
        </div>
      </div>

      {/* Cabeçalho da planilha */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="grid grid-cols-12 items-center gap-4 px-5 py-3 border-b bg-slate-50">
          <div className="col-span-2 flex items-center gap-2">
            <img src={dmnLogo} alt="DMN" className="h-10 w-auto" />
          </div>
          <div className="col-span-7 text-center">
            <h2 className="text-lg font-black tracking-wide text-slate-800">
              {tipoOrdem === "FERT"
                ? "MATERIAIS - FERT (PRODUTO ACABADO)"
                : tipoOrdem === "HALB"
                ? "MATERIAIS - HALB (PRODUTO SEMIACABADO)"
                : "ORDEM DE PRODUÇÃO - MATERIAIS"}
            </h2>
          </div>
          <div className="col-span-3 text-[10px] font-mono leading-tight text-right text-slate-700">
            <div>CÓD.: {codigoFormulario}</div>
            <div>REVISÃO: {revisao}</div>
            <div>DATA: {new Date(dataSolicitacao).toLocaleDateString("pt-BR")}</div>
            <div>PÁG. {pagina}</div>
          </div>
        </div>

        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-4 gap-3 border-b">
          <Field label="Nº da Ordem *">
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Data de Solicitação">
            <Input type="date" value={dataSolicitacao} onChange={(e) => setDataSolicitacao(e.target.value)} />
          </Field>
          <Field label="Tipo da Ordem">
            <Select value={tipoOrdem} onValueChange={(v) => setTipoOrdem(v as typeof tipoOrdem)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HALB">HALB — Semiacabado</SelectItem>
                <SelectItem value="FERT">FERT — Produto Acabado</SelectItem>
                <SelectItem value="MISTA">MISTA</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Embarcação / Casco *">
            <Select value={embarcacaoId} onValueChange={setEmbarcacaoId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {embarcacoes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.numero_casco ? `Casco ${e.numero_casco} · ` : ""}{e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Revisão">
            <Input value={revisao} onChange={(e) => setRevisao(e.target.value)} />
          </Field>
          <Field label="Página">
            <Input value={pagina} onChange={(e) => setPagina(e.target.value)} />
          </Field>
          <Field label="Embarcação Selecionada" className="md:col-span-2">
            <Input
              readOnly
              value={embarcacaoSel ? `${embarcacaoSel.nome}${embarcacaoSel.numero_casco ? ` · Casco ${embarcacaoSel.numero_casco}` : ""}` : ""}
              className="bg-slate-50"
              placeholder="—"
            />
          </Field>
        </div>

        {/* Faixa SOLICITAÇÃO + grid de itens */}
        <div className="bg-slate-100 px-5 py-2 border-b text-center text-xs font-black uppercase tracking-widest text-slate-700">
          Solicitação
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse min-w-[1600px]">
            <thead>
              <tr className="bg-amber-50 text-slate-800">
                <Th>ITEM</Th>
                <Th>DATA SOLIC.</Th>
                <Th className="min-w-[220px]">DESCRIÇÃO DO MATERIAL</Th>
                <Th>UMB</Th>
                <Th>GRUPO COMPRAD.</Th>
                <Th>NCM</Th>
                <Th>CENTRO</Th>
                <Th>DEPÓSITO</Th>
                <Th>GRUPO MERCAD.</Th>
                <Th>SETOR ATIV.</Th>
                <Th>GRUPO CATEG ITEM</Th>
                <Th>CLASSE AVAL.</Th>
                <Th>DETERM. PREÇO</Th>
                <Th>CONTR. PREÇO</Th>
                <Th>ORIGEM</Th>
                <Th>UTILIZAÇÃO</Th>
                <Th>CÓDIGO SAP</Th>
                <Th>OCORRÊNCIA</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {itens.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <Td className="text-center font-bold w-12 bg-slate-50">{row.item}</Td>
                  <Td><CellInput type="date" value={row.data_solicitacao} onChange={(v) => updateRow(idx, { data_solicitacao: v })} /></Td>
                  <Td><CellInput value={row.descricao_material} onChange={(v) => updateRow(idx, { descricao_material: v })} placeholder="ex: AMAZON AGRO 1 - CASCO 130" /></Td>
                  <Td><CellInput value={row.unidade_medida} onChange={(v) => updateRow(idx, { unidade_medida: v })} className="w-14" /></Td>
                  <Td><CellInput value={row.grupo_compradores} onChange={(v) => updateRow(idx, { grupo_compradores: v })} className="w-24" /></Td>
                  <Td><CellInput value={row.ncm} onChange={(v) => updateRow(idx, { ncm: v })} className="w-24" /></Td>
                  <Td><CellInput value={row.centro} onChange={(v) => updateRow(idx, { centro: v })} className="w-16" /></Td>
                  <Td><CellInput value={row.deposito} onChange={(v) => updateRow(idx, { deposito: v })} className="w-16" /></Td>
                  <Td><CellInput value={row.grupo_mercadorias} onChange={(v) => updateRow(idx, { grupo_mercadorias: v })} className="w-20" /></Td>
                  <Td><CellInput value={row.setor_atividade} onChange={(v) => updateRow(idx, { setor_atividade: v })} className="w-14" /></Td>
                  <Td><CellInput value={row.grupo_categ_item_ger} onChange={(v) => updateRow(idx, { grupo_categ_item_ger: v })} className="w-16" /></Td>
                  <Td><CellInput value={row.classe_avaliacao} onChange={(v) => updateRow(idx, { classe_avaliacao: v })} className="w-16" /></Td>
                  <Td><CellInput value={row.determ_preco} onChange={(v) => updateRow(idx, { determ_preco: v })} className="w-14" /></Td>
                  <Td><CellInput value={row.controle_preco} onChange={(v) => updateRow(idx, { controle_preco: v })} className="w-12" /></Td>
                  <Td>
                    <select
                      value={row.origem_material}
                      onChange={(e) => updateRow(idx, { origem_material: e.target.value })}
                      className="h-7 w-24 rounded border border-slate-300 bg-white px-1 text-[11px] text-red-600 font-bold"
                    >
                      <option value="NACIONAL">NACIONAL</option>
                      <option value="IMPORTADO">IMPORTADO</option>
                    </select>
                  </Td>
                  <Td><CellInput value={row.utilizacao_material} onChange={(v) => updateRow(idx, { utilizacao_material: v })} className="w-36" /></Td>
                  <Td><CellInput value={row.codigo_sap} onChange={(v) => updateRow(idx, { codigo_sap: v })} className="w-24 font-mono" /></Td>
                  <Td><CellInput value={row.ocorrencia} onChange={(v) => updateRow(idx, { ocorrencia: v })} className="w-32" /></Td>
                  <Td className="w-10">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={itens.length === 1}
                      className="text-red-600 hover:text-red-800 disabled:opacity-30"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t bg-slate-50 flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar Item
          </Button>
          <span className="text-xs text-muted-foreground">
            {itens.length} item(ns) na ordem
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-2">
        <Label className="text-xs font-semibold text-slate-700">Observações Gerais</Label>
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Notas, prazos, requisitos especiais…"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/app/producao/ordens" })}>
          Cancelar
        </Button>
        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="gap-2 bg-amber-600 hover:bg-amber-700"
        >
          <Save className="h-4 w-4" />
          {saveMut.isPending ? "Salvando…" : "Salvar Ordem"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label, children, className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`border border-slate-300 px-2 py-2 text-[10px] font-black uppercase tracking-wide ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`border border-slate-200 px-1 py-1 align-middle ${className ?? ""}`}>{children}</td>;
}

function CellInput({
  value, onChange, placeholder, className, type,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500 ${className ?? ""}`}
    />
  );
}
