import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X as XIcon, FileText, Clock, DollarSign, Lock, HandMetal } from "lucide-react";
import { getRcByToken, marcarRcCotada, decidirRc, pegarRcParaCotar } from "@/lib/rc-public.functions";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/rc/$token")({
  head: () => ({
    meta: [
      { title: "Status da Requisição — SIGMO" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RcStatusPage,
});

function fmtBR(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}
function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Aguardando cotação", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  EM_COTACAO: { label: "Em cotação", cls: "bg-violet-100 text-violet-800 border-violet-300" },
  COTADA: { label: "Cotada — aguardando aprovação", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  APROVADA: { label: "Deferida", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  INDEFERIDA: { label: "Indeferida", cls: "bg-rose-100 text-rose-800 border-rose-300" },
};

function RcStatusPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const fetchRc = useServerFn(getRcByToken);
  const pegarParaCotar = useServerFn(pegarRcParaCotar);
  const marcarCotada = useServerFn(marcarRcCotada);
  const decidir = useServerFn(decidirRc);
  const { user, isEditor, isAdmin, loading: authLoading } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["rc-public", token],
    queryFn: () => fetchRc({ data: { token } }),
    retry: false,
  });

  const cotarMut = useMutation({
    mutationFn: (p: { cotador_nome: string; fornecedor: string; valor: number }) =>
      marcarCotada({ data: { token, ...p } }),
    onSuccess: () => {
      toast.success("Cotação registrada!");
      qc.invalidateQueries({ queryKey: ["rc-public", token] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pegarMut = useMutation({
    mutationFn: () => pegarParaCotar({ data: { token } }),
    onSuccess: () => {
      toast.success("RC atribuída a você. Registre a cotação abaixo.");
      qc.invalidateQueries({ queryKey: ["rc-public", token] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const decidirMut = useMutation({
    mutationFn: (p: { decisao: "APROVADA" | "INDEFERIDA"; motivo?: string }) =>
      decidir({ data: { token, ...p } }),
    onSuccess: (_d, vars) => {
      toast.success(vars.decisao === "APROVADA" ? "RC deferida!" : "RC indeferida");
      qc.invalidateQueries({ queryKey: ["rc-public", token] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Carregando…</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <XIcon className="h-10 w-10 text-rose-500 mx-auto mb-3" />
            <h1 className="font-bold text-lg mb-1">Link inválido</h1>
            <p className="text-sm text-slate-600">
              {(error as any)?.message || "Requisição não encontrada."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rc = data.rc as any;
  const itens = data.itens as any[];
  const info = STATUS_INFO[rc.status] ?? STATUS_INFO.PENDENTE;

  const meuId = user?.id;
  const souOCotador = meuId && rc.pego_por_compras_id === meuId;
  // Supervisor Geral: por ora usamos admin como fallback client-side.
  // A server fn valida is_supervisor_geral definitivamente.
  const podeDecidir = isAdmin;

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center mb-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Estaleiro DMN — SIGMO
          </div>
          <h1 className="text-xl font-black text-slate-800">Status da Requisição</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-600" />
                  RC {rc.numero}
                </CardTitle>
                <div className="text-xs text-slate-500 mt-0.5">
                  Emitida em {fmtBR(rc.data_requisicao)} por <strong>{rc.solicitante}</strong>
                  {rc.setor ? ` · ${rc.setor}` : ""}
                </div>
              </div>
              <Badge variant="outline" className={info.cls + " text-xs"}>
                {info.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-600">
              <strong>Tipo:</strong> {rc.classificacao === "MATERIAL" ? "Material" : "Serviço"}
              {rc.fornecedor ? <> · <strong>Fornecedor sugerido:</strong> {rc.fornecedor}</> : null}
            </div>

            {itens.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-right p-2">Qtd</th>
                      <th className="text-left p-2">UN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it) => (
                      <tr key={it.item_numero} className="border-t">
                        <td className="p-2">{it.item_numero}</td>
                        <td className="p-2">{it.descricao}</td>
                        <td className="p-2 text-right">{it.quantidade ?? "—"}</td>
                        <td className="p-2">{it.unidade ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rc.observacoes && (
              <div className="text-xs text-slate-600 border-l-2 border-slate-300 pl-2">
                <strong>Observações:</strong> {rc.observacoes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linha do tempo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <TimelineStep done label="RC emitida" when={fmtDateTime(rc.created_at)} />
            <TimelineStep
              done={rc.status !== "PENDENTE" && rc.status !== "EM_COTACAO"}
              label={
                rc.status === "PENDENTE"
                  ? "Aguardando cotação"
                  : rc.status === "EM_COTACAO"
                  ? `Em cotação por ${rc.pego_por_compras_nome ?? "compras"}`
                  : `Cotada por ${rc.cotador_nome ?? "—"} · ${rc.cotacao_fornecedor ?? "—"} · ${fmtMoney(rc.cotacao_valor)}`
              }
              when={fmtDateTime(rc.cotacao_at ?? rc.pego_em)}
            />
            <TimelineStep
              done={rc.status === "APROVADA" || rc.status === "INDEFERIDA"}
              label={
                rc.status === "APROVADA"
                  ? `Deferida por ${rc.decidido_por_nome ?? "Supervisor Geral"}`
                  : rc.status === "INDEFERIDA"
                  ? `Indeferida — ${rc.motivo_indeferimento ?? ""}`
                  : "Aguardando aprovação do Supervisor Geral"
              }
              when={fmtDateTime(rc.decidido_em ?? rc.approved_at)}
            />
          </CardContent>
        </Card>

        {/* Ação: Pegar para cotar (PENDENTE + logado com role de editor) */}
        {rc.status === "PENDENTE" && user && isEditor && (
          <Card className="border-violet-300 bg-violet-50/50">
            <CardContent className="p-4 text-center space-y-3">
              <HandMetal className="h-6 w-6 text-violet-600 mx-auto" />
              <div className="text-sm text-slate-700">
                Nenhum comprador pegou esta RC ainda. Pegue para cotar e travar a fila.
              </div>
              <Button
                onClick={() => pegarMut.mutate()}
                disabled={pegarMut.isPending}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {pegarMut.isPending ? "Atribuindo…" : "Pegar para cotar"}
              </Button>
            </CardContent>
          </Card>
        )}

        {rc.status === "PENDENTE" && !user && (
          <CotarForm onSubmit={(p) => cotarMut.mutate(p)} loading={cotarMut.isPending} />
        )}

        {/* Ação: Registrar cotação (EM_COTACAO — dono ou admin) */}
        {rc.status === "EM_COTACAO" && (souOCotador || isAdmin) && (
          <CotarForm onSubmit={(p) => cotarMut.mutate(p)} loading={cotarMut.isPending} />
        )}

        {rc.status === "EM_COTACAO" && !souOCotador && !isAdmin && (
          <Card className="border-violet-300 bg-violet-50/50">
            <CardContent className="p-4 text-center text-sm text-slate-600">
              Esta RC está sendo cotada por <strong>{rc.pego_por_compras_nome ?? "outro comprador"}</strong>.
            </CardContent>
          </Card>
        )}

        {/* Ação: Decidir */}
        {rc.status === "COTADA" && podeDecidir && (
          <DecidirForm onSubmit={(p) => decidirMut.mutate(p)} loading={decidirMut.isPending} />
        )}

        {rc.status === "COTADA" && !podeDecidir && !authLoading && (
          <Card className="border-amber-300 bg-amber-50/50">
            <CardContent className="p-4 text-center space-y-3">
              <Lock className="h-6 w-6 text-amber-600 mx-auto" />
              <div className="text-sm text-slate-700">
                Somente o <strong>Supervisor Geral</strong> pode deferir ou indeferir esta requisição.
              </div>
              {!user && (
                <Button asChild className="bg-amber-600 hover:bg-amber-700">
                  <Link to="/login" search={{ redirect: `/rc/${token}` } as any}>
                    Fazer login
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {(rc.status === "APROVADA" || rc.status === "INDEFERIDA") && (
          <div className="text-center text-xs text-slate-500">
            Esta requisição já foi finalizada.
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineStep({ done, label, when }: { done: boolean; label: string; when: string }) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={
          "mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0 " +
          (done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400")
        }
      >
        {done ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      </div>
      <div className="flex-1">
        <div className={done ? "font-semibold text-slate-800" : "text-slate-500"}>{label}</div>
        {done && <div className="text-[10px] text-slate-400">{when}</div>}
      </div>
    </div>
  );
}

function CotarForm({
  onSubmit,
  loading,
}: {
  onSubmit: (p: { cotador_nome: string; fornecedor: string; valor: number }) => void;
  loading: boolean;
}) {
  const [nome, setNome] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");

  function submit() {
    const v = parseFloat(valor.replace(",", "."));
    if (!nome.trim() || !fornecedor.trim() || !v || isNaN(v)) {
      toast.error("Preencha todos os campos");
      return;
    }
    onSubmit({ cotador_nome: nome.trim(), fornecedor: fornecedor.trim(), valor: v });
  }

  return (
    <Card className="border-blue-300 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-blue-600" /> Registrar cotação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Seu nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Juce" />
        </div>
        <div>
          <Label className="text-xs">Fornecedor escolhido</Label>
          <Input
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            placeholder="Ex: Casa do Parafuso LTDA"
          />
        </div>
        <div>
          <Label className="text-xs">Valor total (R$)</Label>
          <Input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />
        </div>
        <Button onClick={submit} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
          {loading ? "Enviando…" : "Confirmar cotação"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DecidirForm({
  onSubmit,
  loading,
}: {
  onSubmit: (p: { decisao: "APROVADA" | "INDEFERIDA"; motivo?: string }) => void;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const [modo, setModo] = useState<"none" | "indef">("none");

  return (
    <Card className="border-emerald-300 bg-emerald-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" /> Decisão do gerente (autenticado)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {modo === "indef" && (
          <div>
            <Label className="text-xs">Motivo do indeferimento</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Por que está indeferindo?"
            />
          </div>
        )}

        <div className="flex gap-2">
          {modo === "none" ? (
            <>
              <Button
                onClick={() => {
                  onSubmit({ decisao: "APROVADA" });
                }}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="h-4 w-4 mr-1" /> Deferir
              </Button>
              <Button
                onClick={() => setModo("indef")}
                variant="outline"
                className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-50"
              >
                <XIcon className="h-4 w-4 mr-1" /> Indeferir
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  if (!motivo.trim()) return toast.error("Informe o motivo");
                  onSubmit({ decisao: "INDEFERIDA", motivo: motivo.trim() });
                }}
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                Confirmar indeferimento
              </Button>
              <Button onClick={() => setModo("none")} variant="ghost">
                Cancelar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}