import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Factory } from "lucide-react";
import { toast } from "sonner";

type Embarcacao = { id: string; nome: string };

export type MaterialFormValues = {
  tipo_material: "HALB" | "FERT";
  codigo_material: string;
  descricao: string;
  ncm: string | null;
  embarcacao_id: string | null;
  tipo_embarcacao: string | null;
  grupo_mercadorias: string | null;
  umb: string | null;
  grupo_compradores: string | null;
  classe_avaliacao: string | null;
  controle_preco: string | null;
  unidade_preco: number | null;
  centro: string | null;
  deposito: string | null;
  org_vendas: string | null;
  canal_distribuicao: string | null;
  setor_atividade: string | null;
  grupo_categ_item: string | null;
  determ_preco: string | null;
  data_solicitacao: string | null;
  item_solicitacao: number | null;
  observacoes: string | null;
};

function defaults(tipo: "HALB" | "FERT"): MaterialFormValues {
  return {
    tipo_material: tipo,
    codigo_material: "",
    descricao: "",
    ncm: "89079000",
    embarcacao_id: null,
    tipo_embarcacao: null,
    grupo_mercadorias: "AT0024",
    umb: "UN",
    grupo_compradores: tipo === "FERT" ? "A03" : "não tem",
    classe_avaliacao: tipo === "FERT" ? "20" : "3000",
    controle_preco: "S",
    unidade_preco: 1,
    centro: "C020",
    deposito: tipo === "FERT" ? "DE01" : "DP01",
    org_vendas: tipo === "FERT" ? "1002" : null,
    canal_distribuicao: tipo === "FERT" ? "10" : null,
    setor_atividade: "20",
    grupo_categ_item: "NORM",
    determ_preco: tipo === "HALB" ? "3" : null,
    data_solicitacao: new Date().toISOString().split("T")[0],
    item_solicitacao: 1,
    observacoes: null,
  };
}

export function MaterialForm({ tipo }: { tipo: "HALB" | "FERT" }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<MaterialFormValues>(defaults(tipo));

  useEffect(() => setForm(defaults(tipo)), [tipo]);

  const { data: embarcacoes = [] } = useQuery({
    queryKey: ["producao_embarcacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_embarcacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data as Embarcacao[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (payload: MaterialFormValues) => {
      const { error } = await (supabase as any)
        .from("producao_materiais")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producao_materiais"] });
      toast.success(`Material ${tipo} cadastrado com sucesso`);
      navigate({ to: "/app/producao/materiais" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function update<K extends keyof MaterialFormValues>(k: K, v: MaterialFormValues[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.codigo_material || !form.descricao) {
      toast.error("Código e descrição são obrigatórios");
      return;
    }
    saveMut.mutate(form);
  }

  const isFert = tipo === "FERT";
  const cor = isFert ? "emerald" : "blue";
  const corClasses = isFert
    ? { bg: "from-emerald-500 to-green-600", btn: "bg-emerald-600 hover:bg-emerald-700", chip: "bg-emerald-100 text-emerald-800" }
    : { bg: "from-blue-500 to-indigo-600", btn: "bg-blue-600 hover:bg-blue-700", chip: "bg-blue-100 text-blue-800" };

  const tituloPlanilha = isFert ? "FOR-PROD-02" : "FOR-PROD-01";
  const subtitulo = isFert ? "Produto Acabado (FERT)" : "Produto Semiacabado (HALB)";

  const labelDescricaoExemplo = isFert
    ? "ex: AMAZON AGRO 5 - CASCO 134"
    : "ex: GRADIL DE PROTEÇÃO INFERIOR DE ESCADA";

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className={`h-11 w-11 rounded-lg bg-gradient-to-br ${corClasses.bg} flex items-center justify-center shadow-md`}>
          <Factory className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Criar {tipo} — {subtitulo}</h1>
          <p className="text-xs text-muted-foreground font-medium">
            Produção · Cadastro conforme planilha {tituloPlanilha} (Rev. 00)
          </p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-[11px] font-black ${corClasses.chip}`}>
          {tipo}
        </span>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Section title="Identificação">
          <Field label="Código do Material (SAP) *">
            <Input
              value={form.codigo_material}
              onChange={(e) => update("codigo_material", e.target.value)}
              placeholder={isFert ? "ex: 50000300" : "ex: 40000123"}
            />
          </Field>
          <Field label="Item da Solicitação">
            <Input
              type="number"
              value={form.item_solicitacao ?? ""}
              onChange={(e) => update("item_solicitacao", e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <Field label="Data da Solicitação">
            <Input
              type="date"
              value={form.data_solicitacao ?? ""}
              onChange={(e) => update("data_solicitacao", e.target.value || null)}
            />
          </Field>
          <Field label="UMB">
            <Input value={form.umb ?? ""} onChange={(e) => update("umb", e.target.value)} />
          </Field>
          <Field label="Descrição do Material *" className="col-span-2">
            <Input
              value={form.descricao}
              onChange={(e) => update("descricao", e.target.value)}
              placeholder={labelDescricaoExemplo}
            />
          </Field>
          <Field label="Embarcação Vinculada" className="col-span-2">
            <Select
              value={form.embarcacao_id ?? "__none__"}
              onValueChange={(v) => update("embarcacao_id", v === "__none__" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar embarcação…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {embarcacoes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Classificação Fiscal e Comercial">
          <Field label="NCM">
            <Input value={form.ncm ?? ""} onChange={(e) => update("ncm", e.target.value)} />
          </Field>
          <Field label="Tipo Embarcação">
            <Input
              value={form.tipo_embarcacao ?? ""}
              onChange={(e) => update("tipo_embarcacao", e.target.value)}
              placeholder="BALSA / EMPURRADOR"
            />
          </Field>
          <Field label="Grupo de Mercadorias">
            <Input value={form.grupo_mercadorias ?? ""} onChange={(e) => update("grupo_mercadorias", e.target.value)} />
          </Field>
          <Field label="Setor de Atividade">
            <Input value={form.setor_atividade ?? ""} onChange={(e) => update("setor_atividade", e.target.value)} />
          </Field>
          <Field label="Grupo de Compradores">
            <Input value={form.grupo_compradores ?? ""} onChange={(e) => update("grupo_compradores", e.target.value)} />
          </Field>
          <Field label="Grupo Categ. Item Ger.">
            <Input value={form.grupo_categ_item ?? ""} onChange={(e) => update("grupo_categ_item", e.target.value)} />
          </Field>
        </Section>

        <Section title="Logística & Estrutura SAP">
          <Field label="Centro">
            <Input value={form.centro ?? ""} onChange={(e) => update("centro", e.target.value)} />
          </Field>
          <Field label="Depósito">
            <Input value={form.deposito ?? ""} onChange={(e) => update("deposito", e.target.value)} />
          </Field>
          <Field label="Classe de Avaliação">
            <Input value={form.classe_avaliacao ?? ""} onChange={(e) => update("classe_avaliacao", e.target.value)} />
          </Field>
          <Field label="Controle de Preço">
            <Input value={form.controle_preco ?? ""} onChange={(e) => update("controle_preco", e.target.value)} />
          </Field>
          <Field label="Unidade de Preço">
            <Input
              type="number"
              value={form.unidade_preco ?? ""}
              onChange={(e) => update("unidade_preco", e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          {isFert ? (
            <>
              <Field label="Organização de Vendas">
                <Input value={form.org_vendas ?? ""} onChange={(e) => update("org_vendas", e.target.value)} />
              </Field>
              <Field label="Canal de Distribuição">
                <Input value={form.canal_distribuicao ?? ""} onChange={(e) => update("canal_distribuicao", e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label="Determ. Preço">
              <Input value={form.determ_preco ?? ""} onChange={(e) => update("determ_preco", e.target.value)} />
            </Field>
          )}
        </Section>

        <Field label="Observações">
          <Textarea
            value={form.observacoes ?? ""}
            onChange={(e) => update("observacoes", e.target.value)}
            rows={3}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/producao/materiais" })}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveMut.isPending} className={corClasses.btn}>
            {saveMut.isPending ? "Salvando…" : `Cadastrar ${tipo}`}
          </Button>
        </div>
      </form>
      <p className="sr-only">{cor}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label, children, className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
