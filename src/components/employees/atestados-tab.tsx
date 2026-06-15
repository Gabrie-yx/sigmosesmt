import { useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, FileText, CheckCircle2, XCircle, Trash2, Download, Eye, ShieldOff, Pencil } from "lucide-react";

type Props = {
  empId: string;
  canEdit: boolean;
  canDelete: boolean;
  qc: QueryClient;
};

const TIPO_LABEL: Record<string, string> = {
  ATESTADO: "Atestado",
  DECLARACAO_COMPARECIMENTO: "Declaração de Comparecimento",
  LICENCA_INSS: "Licença INSS",
  CAT: "CAT",
};

const STATUS_VARIANT: Record<string, { cls: string; label: string }> = {
  PENDENTE: { cls: "bg-amber-100 text-amber-800 border-amber-200", label: "🟡 Pendente" },
  HOMOLOGADO: { cls: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "🟢 Homologado" },
  RECUSADO: { cls: "bg-red-100 text-red-800 border-red-200", label: "🔴 Recusado" },
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function AtestadosTab({ empId, canEdit, canDelete, qc }: Props) {
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);

  const { data: atestados = [], isLoading } = useQuery({
    queryKey: ["employee-atestados", empId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employee_atestados")
        .select("*")
        .eq("employee_id", empId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["employee-atestados", empId] });
  }

  async function homologar(at: any) {
    // Determina se o atestado é totalmente retroativo (período já encerrado)
    const hojeISO = new Date().toISOString().slice(0, 10);
    const retorno: string | null = at.data_retorno ?? null;
    const inicio: string | null = at.data_inicio ?? null;
    const isRetroativo = !!retorno && retorno < hojeISO;
    const inicioFuturo = !!inicio && inicio > hojeISO;
    const dias = at.dias_afastamento ?? 0;

    let msg =
      "Confirmar homologação?\n\n" +
      "• O atestado foi assinado/validado pelo Supervisor Geral (Anderson)?\n" +
      "• Os dados (CID, CRM, datas) foram conferidos?\n\n";

    if (dias <= 0) {
      msg +=
        "Este registro não gera afastamento (0 dias). Apenas arquivamento no histórico — " +
        "nenhum bloqueio na portaria será criado.";
    } else if (isRetroativo) {
      msg +=
        `ATESTADO RETROATIVO: o período (${fmt(inicio)} → ${fmt(retorno)}) já se encerrou. ` +
        "Apenas arquivamento no histórico — nenhum bloqueio na portaria será criado.";
    } else if (inicioFuturo) {
      msg +=
        `Bloqueio programado: vigorará de ${fmt(inicio)} até ${fmt(retorno)} (${dias} dia(s)).`;
    } else {
      msg +=
        `Bloqueio ativo de hoje até ${fmt(retorno)} (${dias} dia(s) de afastamento). ` +
        "O período já iniciado anteriormente não retroage.";
    }

    const ok = window.confirm(msg);
    if (!ok) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("employee_atestados")
      .update({
        status: "HOMOLOGADO",
        homologado_em: new Date().toISOString(),
        homologado_por: u.user?.id,
        motivo_recusa: null,
      })
      .eq("id", at.id);
    if (error) return toast.error(error.message);
    toast.success("Atestado homologado");
    refresh();
  }

  async function recusar(at: any) {
    const motivo = window.prompt("Motivo da recusa:");
    if (!motivo) return;
    const { error } = await (supabase as any)
      .from("employee_atestados")
      .update({ status: "RECUSADO", motivo_recusa: motivo })
      .eq("id", at.id);
    if (error) return toast.error(error.message);
    toast.success("Atestado recusado");
    refresh();
  }

  async function revogarBloqueio(at: any) {
    if (!at.override_id) return toast.info("Este atestado não tem bloqueio ativo");
    const motivo = window.prompt("Motivo da liberação manual na portaria:");
    if (!motivo) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("safety_overrides")
      .update({
        ativo: false,
        revogado_em: new Date().toISOString(),
        revogado_por: u.user?.id,
        motivo_revogacao: motivo,
      })
      .eq("id", at.override_id);
    if (error) return toast.error(error.message);
    toast.success("Bloqueio revogado — funcionário liberado na portaria");
    refresh();
  }

  async function excluir(at: any) {
    if (!confirm("Excluir este atestado? Esta ação não pode ser desfeita.")) return;
    if (at.arquivo_path) {
      await supabase.storage.from("employee-docs").remove([at.arquivo_path]);
    }
    const { error } = await (supabase as any).from("employee_atestados").delete().eq("id", at.id);
    if (error) return toast.error(error.message);
    toast.success("Atestado excluído");
    refresh();
  }

  async function baixar(path: string) {
    const { data, error } = await supabase.storage.from("employee-docs").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error("Falha ao gerar link");
    window.open(data.signedUrl, "_blank");
  }

  async function visualizar(path: string) {
    const { data, error } = await supabase.storage.from("employee-docs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Falha ao gerar link");
    const isPdf = path.toLowerCase().endsWith(".pdf");
    setViewing({ url: data.signedUrl, name: path.split("/").pop() || "Arquivo", isPdf });
  }

  const ativo = atestados.find(
    (a: any) =>
      a.status === "HOMOLOGADO" &&
      a.override_id &&
      a.data_retorno &&
      new Date(a.data_retorno) >= new Date(new Date().toDateString()),
  );

  return (
    <div className="space-y-4">
      {ativo && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold text-amber-900">🟡 Funcionário afastado</span>{" "}
              <span className="text-amber-800">
                até {fmt(ativo.data_retorno)} ({ativo.dias_afastamento} dias
                {ativo.cid ? ` · CID ${ativo.cid}` : ""})
              </span>
            </div>
            <Badge variant="outline" className="bg-white">Bloqueio ativo na portaria</Badge>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Atestados Médicos
          </h3>
          <p className="text-xs text-muted-foreground">
            Recebimento, homologação e arquivamento dos atestados digitalizados.
          </p>
        </div>
        {canEdit && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo atestado</Button>
            </DialogTrigger>
            {openNew && <AtestadoFormDialog empId={empId} onSaved={() => { setOpenNew(false); refresh(); }} />}
          </Dialog>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <AtestadoFormDialog
            empId={empId}
            atestado={editing}
            onSaved={() => { setEditing(null); refresh(); }}
          />
        )}
      </Dialog>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Retorno</TableHead>
              <TableHead>CID</TableHead>
              <TableHead>Médico</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && atestados.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Nenhum atestado registrado.</TableCell></TableRow>
            )}
            {atestados.map((a: any) => {
              const st = STATUS_VARIANT[a.status] ?? STATUS_VARIANT.PENDENTE;
              return (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{TIPO_LABEL[a.tipo] ?? a.tipo}</TableCell>
                  <TableCell className="text-xs">{fmt(a.data_inicio)}</TableCell>
                  <TableCell className="text-xs">{a.dias_afastamento}</TableCell>
                  <TableCell className="text-xs">{fmt(a.data_retorno)}</TableCell>
                  <TableCell className="text-xs">{a.cid || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {a.medico_nome ? `${a.medico_nome}${a.medico_crm ? ` (CRM ${a.medico_crm})` : ""}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                    {a.status === "RECUSADO" && a.motivo_recusa && (
                      <div className="text-[10px] text-red-700 mt-1 max-w-[180px] truncate" title={a.motivo_recusa}>
                        {a.motivo_recusa}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {a.arquivo_path && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => visualizar(a.arquivo_path)} title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => baixar(a.arquivo_path)} title="Baixar arquivo">
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {canEdit && (
                        <Button size="icon" variant="ghost" onClick={() => setEditing(a)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && a.status === "PENDENTE" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => homologar(a)} title="Homologar">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => recusar(a)} title="Recusar">
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {canEdit && a.status === "HOMOLOGADO" && a.override_id && (
                        <Button size="icon" variant="ghost" onClick={() => revogarBloqueio(a)} title="Revogar bloqueio na portaria">
                          <ShieldOff className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="icon" variant="ghost" onClick={() => excluir(a)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm flex items-center justify-between gap-3">
              <span className="truncate">{viewing?.name}</span>
              {viewing && (
                <a href={viewing.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline shrink-0">
                  Abrir em nova aba
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/30">
            {viewing && (
              viewing.isPdf ? (
                <iframe src={viewing.url} title={viewing.name} className="w-full h-full border-0" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img src={viewing.url} alt={viewing.name} className="max-w-full max-h-full object-contain" />
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AtestadoFormDialog({
  empId,
  atestado,
  onSaved,
}: {
  empId: string;
  atestado?: any;
  onSaved: () => void;
}) {
  const isEdit = !!atestado;
  const [tipo, setTipo] = useState<string>(atestado?.tipo ?? "ATESTADO");
  const [dataInicio, setDataInicio] = useState<string>(
    atestado?.data_inicio ?? new Date().toISOString().slice(0, 10),
  );
  const [dias, setDias] = useState<number>(atestado?.dias_afastamento ?? 1);
  const [cid, setCid] = useState<string>(atestado?.cid ?? "");
  const [medico, setMedico] = useState<string>(atestado?.medico_nome ?? "");
  const [crm, setCrm] = useState<string>(atestado?.medico_crm ?? "");
  const [obs, setObs] = useState<string>(atestado?.observacao ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!dataInicio) return toast.error("Informe a data de início");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      let arquivo_path: string | null | undefined = isEdit ? atestado.arquivo_path : null;
      if (arquivo) {
        const ext = arquivo.name.split(".").pop();
        const newPath = `atestados/${empId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("employee-docs")
          .upload(newPath, arquivo, { upsert: false });
        if (upErr) throw upErr;
        if (isEdit && atestado.arquivo_path) {
          await supabase.storage.from("employee-docs").remove([atestado.arquivo_path]);
        }
        arquivo_path = newPath;
      }
      const payload: any = {
        tipo,
        data_inicio: dataInicio,
        dias_afastamento: dias,
        cid: cid || null,
        medico_nome: medico || null,
        medico_crm: crm || null,
        observacao: obs || null,
        arquivo_path,
      };
      if (isEdit) {
        const { error } = await (supabase as any)
          .from("employee_atestados")
          .update(payload)
          .eq("id", atestado.id);
        if (error) throw error;
        toast.success("Atestado atualizado");
      } else {
        const { error } = await (supabase as any)
          .from("employee_atestados")
          .insert({ ...payload, employee_id: empId, created_by: u.user?.id });
        if (error) throw error;
        toast.success("Atestado registrado");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar Atestado" : "Novo Atestado"}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data de início</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div>
          <Label>Dias de afastamento</Label>
          <Input type="number" min={0} value={dias} onChange={(e) => setDias(Number(e.target.value || 0))} />
        </div>
        <div>
          <Label>CID</Label>
          <Input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Ex: M54.5" />
        </div>
        <div>
          <Label>CRM</Label>
          <Input value={crm} onChange={(e) => setCrm(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Nome do médico</Label>
          <Input value={medico} onChange={(e) => setMedico(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>
            Arquivo digitalizado (PDF/imagem)
            {isEdit && atestado.arquivo_path && (
              <span className="text-xs text-muted-foreground ml-2">
                (deixe em branco para manter o atual)
              </span>
            )}
          </Label>
          <Input type="file" accept="application/pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </div>
        <div className="col-span-2">
          <Label>Observação</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}