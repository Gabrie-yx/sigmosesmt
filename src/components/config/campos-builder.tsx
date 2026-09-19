import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GripVertical, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUnidadeCampos, useUnidadeCamposAdmin } from "@/hooks/use-unidade-campos";
import {
  TIPOS_CAMPO, chaveDe, type CampoDef, type CampoTipo,
} from "@/lib/campos-dinamicos";

const vazio = {
  label: "",
  aba: "Dados",
  tipo: "texto" as CampoTipo,
  obrigatorio: false,
  mostrar_lista: false,
  opcoesTexto: "",
  ajuda: "",
};

export function CamposBuilder({ rotuloPlural }: { rotuloPlural: string }) {
  const { salvar, remover, reativar, reordenar } = useUnidadeCampos(null);
  const { campos, carregando } = useUnidadeCamposAdmin();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<CampoDef | null>(null);
  const [form, setForm] = useState({ ...vazio });
  const [arrastando, setArrastando] = useState<string | null>(null);

  const abas = useMemo(() => {
    const m = new Map<string, CampoDef[]>();
    for (const c of campos) {
      if (!m.has(c.aba)) m.set(c.aba, []);
      m.get(c.aba)!.push(c);
    }
    return [...m.entries()].map(([aba, cs]) => ({
      aba,
      campos: cs.sort((a, b) => a.ordem - b.ordem),
    }));
  }, [campos]);

  const nomesAbas = useMemo(
    () => [...new Set(["Dados", ...campos.map((c) => c.aba)])],
    [campos],
  );

  function abrirNovo() {
    setEditando(null);
    setForm({ ...vazio });
    setOpen(true);
  }

  function abrirEdicao(c: CampoDef) {
    setEditando(c);
    setForm({
      label: c.label,
      aba: c.aba,
      tipo: c.tipo,
      obrigatorio: c.obrigatorio,
      mostrar_lista: c.mostrar_lista,
      opcoesTexto: c.opcoes.join("\n"),
      ajuda: c.ajuda ?? "",
    });
    setOpen(true);
  }

  async function gravar() {
    const label = form.label.trim();
    if (!label) return toast.error("Dê um nome ao campo");
    if (form.tipo === "lista" && !form.opcoesTexto.trim()) {
      return toast.error("Cadastre as opções da lista");
    }
    const naLista = campos.filter((c) => c.mostrar_lista && c.id !== editando?.id).length;
    if (form.mostrar_lista && naLista >= 4) {
      return toast.error("Máximo de 4 campos na listagem");
    }
    const chave = editando?.chave ?? chaveDe(label);
    if (!chave) return toast.error("Nome de campo inválido");
    if (!editando && campos.some((c) => c.chave === chave)) {
      return toast.error("Já existe um campo com esse nome");
    }
    const abaAtual = form.aba.trim() || "Dados";
    const irmaos = campos.filter((c) => c.aba === abaAtual);
    const abaOrdem = irmaos[0]?.aba_ordem ?? abas.length;

    try {
      await salvar.mutateAsync({
        id: editando?.id,
        company_id: null,
        aba: abaAtual,
        aba_ordem: abaOrdem,
        chave,
        label,
        tipo: form.tipo,
        obrigatorio: form.obrigatorio,
        mostrar_lista: form.mostrar_lista,
        ordem: editando?.ordem ?? irmaos.length,
        opcoes: form.tipo === "lista"
          ? form.opcoesTexto.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
        ajuda: form.ajuda.trim() || null,
        ativo: editando?.ativo ?? true,
      });
      toast.success(editando ? "Campo atualizado" : "Campo criado");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar campo");
    }
  }

  async function soltarEm(destino: CampoDef) {
    if (!arrastando || arrastando === destino.id) return;
    const origem = campos.find((c) => c.id === arrastando);
    if (!origem) return;
    const lista = campos
      .filter((c) => c.aba === destino.aba && c.id !== origem.id)
      .sort((a, b) => a.ordem - b.ordem);
    const idx = lista.findIndex((c) => c.id === destino.id);
    lista.splice(idx, 0, origem);
    await reordenar.mutateAsync(
      lista.map((c, i) => ({ id: c.id, ordem: i, aba: destino.aba, aba_ordem: destino.aba_ordem })),
    );
    setArrastando(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black uppercase">Campos de {rotuloPlural}</h3>
          <p className="text-xs text-muted-foreground">
            Crie os campos do formulário, organize em abas e arraste para reordenar.
          </p>
        </div>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-1" /> Novo campo
        </Button>
      </div>

      {carregando && <p className="text-xs text-muted-foreground">Carregando…</p>}
      {!carregando && campos.length === 0 && (
        <Card className="p-6 text-center text-xs text-muted-foreground rounded-2xl">
          Nenhum campo criado ainda. Comece pelo botão "Novo campo".
        </Card>
      )}

      {abas.map((g) => (
        <Card key={g.aba} className="p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-black">{g.aba}</Badge>
            <span className="text-[11px] text-muted-foreground">{g.campos.length} campo(s)</span>
          </div>
          {g.campos.map((c) => (
            <div
              key={c.id}
              draggable
              onDragStart={() => setArrastando(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void soltarEm(c)}
              className={`flex items-center gap-2 rounded-lg border p-2 ${
                c.ativo ? "" : "opacity-50"
              } ${arrastando === c.id ? "ring-2 ring-primary" : ""}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {c.label}{c.obrigatorio && <span className="text-destructive"> *</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {TIPOS_CAMPO.find((t) => t.key === c.tipo)?.label ?? c.tipo}
                  {c.mostrar_lista && " · na listagem"}
                  {!c.ativo && " · desativado"}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEdicao(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {c.ativo ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    if (confirm(`Remover o campo "${c.label}"? Os valores já preenchidos ficam guardados.`)) {
                      remover.mutate(c.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => reativar.mutate(c.id)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar campo" : "Novo campo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] font-black uppercase">Nome do campo *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Ex: CNPJ da Empresa"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-black uppercase">Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm({ ...form, tipo: v as CampoTipo })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CAMPO.map((t) => (
                      <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {TIPOS_CAMPO.find((t) => t.key === form.tipo)?.descricao}
                </p>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase">Aba</Label>
                <Input
                  list="abas-existentes"
                  value={form.aba}
                  onChange={(e) => setForm({ ...form, aba: e.target.value })}
                  placeholder="Ex: Contatos"
                />
                <datalist id="abas-existentes">
                  {nomesAbas.map((a) => <option key={a} value={a} />)}
                </datalist>
              </div>
            </div>

            {form.tipo === "lista" && (
              <div>
                <Label className="text-[10px] font-black uppercase">Opções (uma por linha)</Label>
                <Textarea
                  rows={4}
                  value={form.opcoesTexto}
                  onChange={(e) => setForm({ ...form, opcoesTexto: e.target.value })}
                  placeholder={"Em andamento\nParalisada\nConcluída"}
                />
              </div>
            )}

            <div>
              <Label className="text-[10px] font-black uppercase">Texto de ajuda (opcional)</Label>
              <Input value={form.ajuda} onChange={(e) => setForm({ ...form, ajuda: e.target.value })} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-bold">Preenchimento obrigatório</p>
                <p className="text-[10px] text-muted-foreground">Bloqueia o salvamento se ficar vazio</p>
              </div>
              <Switch
                checked={form.obrigatorio}
                onCheckedChange={(v) => setForm({ ...form, obrigatorio: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-bold">Mostrar na listagem</p>
                <p className="text-[10px] text-muted-foreground">Vira coluna da tabela (até 4 campos)</p>
              </div>
              <Switch
                checked={form.mostrar_lista}
                onCheckedChange={(v) => setForm({ ...form, mostrar_lista: v })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => void gravar()} disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando…" : "Salvar campo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
