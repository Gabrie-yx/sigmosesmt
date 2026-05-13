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
import { ClipboardList, Plus, Trash2, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import dmnLogo from "@/assets/dmn-logo.png";

export const Route = createFileRoute("/app/producao/criar-ordem")({
  component: CriarOrdemPage,
});

type TipoEmb = "BALSA" | "EMBARCAÇÃO" | "EMPURRADOR" | "ESTRUTURA FLUTUANTE";

const TIPOS_EMB: TipoEmb[] = ["BALSA", "EMBARCAÇÃO", "EMPURRADOR", "ESTRUTURA FLUTUANTE"];

// Mapeamento NCM por tipo extraído da planilha HALB e FERT Geral
const NCM_POR_TIPO: Record<TipoEmb, string> = {
  "BALSA": "89079000",
  "EMBARCAÇÃO": "89011000",
  "EMPURRADOR": "89040000",
  "ESTRUTURA FLUTUANTE": "89079000",
};

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

function blankRow(
  item: number,
  dataPadrao: string,
  tipo: "HALB" | "FERT" | "MISTA",
  descricao = "",
  ncm = "89079000",
): ItemRow {
  const isFert = tipo === "FERT";
  return {
    item,
    data_solicitacao: dataPadrao,
    descricao_material: descricao,
    unidade_medida: "UN",
    grupo_compradores: isFert ? "A03" : "não tem",
    ncm,
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
  const [tipoOrdem, setTipoOrdem] = useState<"HALB" | "FERT" | "MISTA">("HALB");
  const [revisao, setRevisao] = useState("00");
  const [pagina, setPagina] = useState("01/01");
  const [observacoes, setObservacoes] = useState("");

  // Gerador de cascos (cabeçalho da ordem)
  const [nomeEmbarcacao, setNomeEmbarcacao] = useState("");
  const [tipoEmbarcacao, setTipoEmbarcacao] = useState<TipoEmb>("BALSA");
  const [cascoInicial, setCascoInicial] = useState<number>(1);
  const [qtdCascos, setQtdCascos] = useState<number>(1);

  const [itens, setItens] = useState<ItemRow[]>([]);

  // Sugere o próximo número de casco com base no maior já registrado
  const { data: ultimoCasco } = useQuery({
    queryKey: ["ultimo_casco_global"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_embarcacoes")
        .select("numero_casco")
        .not("numero_casco", "is", null)
        .order("numero_casco", { ascending: false })
        .limit(1);
      if (error) throw error;
      const v = data?.[0]?.numero_casco;
      return v ? Number(v) : 0;
    },
  });

  // Quando o último casco é carregado, ajusta o sugerido (apenas 1ª vez)
  useMemo(() => {
    if (ultimoCasco && cascoInicial === 1) setCascoInicial(ultimoCasco + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoCasco]);

  const codigoFormulario = tipoOrdem === "FERT" ? "FOR-PROD 02" : "FOR-PROD 01";
  const ncmAtual = NCM_POR_TIPO[tipoEmbarcacao];

  function gerarCascos() {
    const nome = nomeEmbarcacao.trim().toUpperCase();
    if (!nome) {
      toast.error("Informe o nome da embarcação");
      return;
    }
    if (!cascoInicial || cascoInicial < 1) {
      toast.error("Informe o casco inicial");
      return;
    }
    if (!qtdCascos || qtdCascos < 1) {
      toast.error("Informe a quantidade de cascos");
      return;
    }
    const novos: ItemRow[] = Array.from({ length: qtdCascos }, (_, i) => {
      const casco = String(cascoInicial + i).padStart(3, "0");
      return blankRow(
        itens.length + i + 1,
        dataSolicitacao,
        tipoOrdem,
        `${nome} - CASCO ${casco}`,
        ncmAtual,
      );
    });
    setItens((rs) => [...rs, ...novos].map((r, i) => ({ ...r, item: i + 1 })));
    toast.success(`${qtdCascos} casco(s) adicionado(s)`);
  }

  function addRow() {
    setItens((rs) => [...rs, blankRow(rs.length + 1, dataSolicitacao, tipoOrdem, "", ncmAtual)]);
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
      if (!nomeEmbarcacao.trim()) throw new Error("Informe o nome da embarcação");
      const validos = itens.filter((i) => i.descricao_material.trim());
      if (validos.length === 0) throw new Error("Adicione ao menos um item com descrição");

      const { data: ord, error: e1 } = await (supabase as any)
        .from("producao_ordens")
        .insert({
          numero,
          data_solicitacao: dataSolicitacao,
          embarcacao_id: null,
          tipo_ordem: tipoOrdem,
          codigo_formulario: codigoFormulario,
          revisao,
          pagina,
          observacoes: [
            `Embarcação: ${nomeEmbarcacao.trim().toUpperCase()} (${tipoEmbarcacao})`,
            `Cascos: ${cascoInicial} a ${cascoInicial + qtdCascos - 1}`,
            observacoes,
          ].filter(Boolean).join("\n"),
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
          <Field label="Revisão">
            <Input value={revisao} onChange={(e) => setRevisao(e.target.value)} />
          </Field>
          <Field label="Página">
            <Input value={pagina} onChange={(e) => setPagina(e.target.value)} />
          </Field>
        </div>

        {/* Gerador de cascos — alimenta itens automaticamente da planilha HALB/FERT Geral */}
        <div className="bg-amber-50/50 px-5 py-4 border-b">
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-800 mb-3">
            Gerador de Itens (planilha HALB/FERT Geral)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <Field label="Nome da Embarcação *" className="md:col-span-4">
              <Input
                value={nomeEmbarcacao}
                onChange={(e) => setNomeEmbarcacao(e.target.value)}
                placeholder="ex: AMAZON AGRO"
                className="uppercase font-semibold"
              />
            </Field>
            <Field label="Tipo de Embarcação *" className="md:col-span-3">
              <Select value={tipoEmbarcacao} onValueChange={(v) => setTipoEmbarcacao(v as TipoEmb)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_EMB.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t} · NCM {NCM_POR_TIPO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Casco Inicial *" className="md:col-span-2">
              <Input
                type="number"
                min={1}
                value={cascoInicial}
                onChange={(e) => setCascoInicial(Number(e.target.value))}
              />
            </Field>
            <Field label="Qtd. de Cascos *" className="md:col-span-1">
              <Input
                type="number"
                min={1}
                value={qtdCascos}
                onChange={(e) => setQtdCascos(Number(e.target.value))}
              />
            </Field>
            <div className="md:col-span-2">
              <Button
                type="button"
                onClick={gerarCascos}
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
              >
                <Wand2 className="h-4 w-4" /> Gerar
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-amber-900/70 mt-2 font-medium">
            Próximo casco sugerido: <span className="font-mono font-bold">{(ultimoCasco ?? 0) + 1}</span> ·
            NCM aplicado a esse tipo: <span className="font-mono font-bold">{ncmAtual}</span> ·
            Descrição gerada: <span className="font-mono">{nomeEmbarcacao.toUpperCase() || "{NOME}"} - CASCO {String(cascoInicial).padStart(3, "0")}</span>
          </p>
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
