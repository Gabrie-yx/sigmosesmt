import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CampoInput } from "@/components/cascos/campo-input";
import { useUnidadeCampos } from "@/hooks/use-unidade-campos";
import {
  ABA_IDENTIFICACAO,
  agruparPorAba,
  validarCampo,
} from "@/lib/campos-dinamicos";

export interface CascoRecord {
  id: string;
  numero: string;
  nome: string | null;
  empresa_responsavel_id: string | null;
  encarregado_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  observacoes: string | null;
  campos_extras?: Record<string, unknown> | null;
}

interface Props {
  initial: CascoRecord | null;
  companies: { id: string; name: string }[];
  employees: { id: string; nome: string }[];
  rotuloSingular: string;
  onDone: () => void;
}

export function CascoForm({ initial, companies, employees, rotuloSingular, onDone }: Props) {
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [empresaId, setEmpresaId] = useState(initial?.empresa_responsavel_id ?? "");
  const [dataInicio, setDataInicio] = useState(initial?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(initial?.data_fim ?? "");
  const [status, setStatus] = useState(initial?.status ?? "ATIVO");
  const [obs, setObs] = useState(initial?.observacoes ?? "");
  const [extras, setExtras] = useState<Record<string, unknown>>(
    (initial?.campos_extras as Record<string, unknown>) ?? {},
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { campos } = useUnidadeCampos(empresaId || null);
  const grupos = useMemo(() => agruparPorAba(campos), [campos]);
  const [aba, setAba] = useState(ABA_IDENTIFICACAO);

  async function save() {
    if (!numero.trim()) {
      setAba(ABA_IDENTIFICACAO);
      toast.error("A identificação é obrigatória");
      return;
    }

    const novosErros: Record<string, string> = {};
    let abaComErro: string | null = null;
    for (const g of grupos) {
      for (const def of g.campos) {
        const msg = validarCampo(def, extras[def.chave]);
        if (msg) {
          novosErros[def.chave] = msg;
          abaComErro = abaComErro ?? g.aba;
        }
      }
    }
    setErros(novosErros);
    if (abaComErro) {
      setAba(abaComErro);
      toast.error("Existem campos obrigatórios ou inválidos");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        numero: numero.trim(),
        nome: nome.trim() || null,
        empresa_responsavel_id: empresaId || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        status,
        observacoes: obs.trim() || null,
        campos_extras: extras,
      };
      if (initial) {
        const { error } = await supabase.from("cascos").update(payload).eq("id", initial.id);
        if (error) throw error;
        toast.success(`${rotuloSingular} atualizado`);
      } else {
        const { error } = await supabase.from("cascos").insert(payload);
        if (error) throw error;
        toast.success(`${rotuloSingular} cadastrado`);
      }
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value={ABA_IDENTIFICACAO}>{ABA_IDENTIFICACAO}</TabsTrigger>
          {grupos.map((g) => (
            <TabsTrigger key={g.aba} value={g.aba}>{g.aba}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={ABA_IDENTIFICACAO} className="space-y-3 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] font-black uppercase">
                Identificação <span className="text-destructive">*</span>
              </Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 2026-001" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[10px] font-black uppercase">Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={`Nome ${rotuloSingular.toLowerCase()}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] font-black uppercase">Empresa Responsável</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase">Data Fim Previsto</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] font-black uppercase">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativa</SelectItem>
                  <SelectItem value="PAUSADO">Pausada</SelectItem>
                  <SelectItem value="CONCLUIDO">Encerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-[10px] font-black uppercase">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>
        </TabsContent>

        {grupos.map((g) => (
          <TabsContent key={g.aba} value={g.aba} className="pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {g.campos.map((def) => (
                <div key={def.id} className={def.tipo === "texto_longo" ? "md:col-span-2" : ""}>
                  <CampoInput
                    def={def}
                    valor={extras[def.chave]}
                    employees={employees}
                    erro={erros[def.chave] ?? null}
                    onChange={(v) => setExtras((p) => ({ ...p, [def.chave]: v }))}
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {grupos.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nenhum campo personalizado ainda. Crie os seus em Configurações → Centro de Configuração →
          Campos das Unidades.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone} disabled={saving}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  );
}
