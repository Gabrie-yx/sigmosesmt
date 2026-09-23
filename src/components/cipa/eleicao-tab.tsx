import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CipaEmployeePicker, useCipaEmployees } from "@/components/cipa/employee-picker";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, CircleDashed, Plus, Trash2, Trophy } from "lucide-react";
import {
  type Candidato, type EleicaoDados, checarEleicao, prazosEleicao, avaliarParticipacao, classificar, fmt, addDays,
} from "@/lib/cipa-eleicao";

type Props = {
  gestao: {
    id: string; data_inicio: string; data_fim: string;
    efetivos_empregados: number | null; suplentes_empregados: number | null;
    eleicao?: unknown;
  };
};

export function EleicaoTab({ gestao }: Props) {
  const qc = useQueryClient();
  const [e, setE] = useState<EleicaoDados>(() => ((gestao.eleicao as EleicaoDados) ?? {}));
  useEffect(() => { setE((gestao.eleicao as EleicaoDados) ?? {}); }, [gestao.id, gestao.eleicao]);
  const set = <K extends keyof EleicaoDados>(k: K, v: EleicaoDados[K]) => setE((p) => ({ ...p, [k]: v }));

  const { data: funcs } = useCipaEmployees();

  const prazos = prazosEleicao(gestao.data_fim, !!e.extraordinaria);
  const checks = useMemo(() => checarEleicao(gestao.data_fim, e), [gestao.data_fim, e]);
  const part = avaliarParticipacao(e);
  const cands = e.candidatos ?? [];
  const ef = gestao.efetivos_empregados ?? 0;
  const su = gestao.suplentes_empregados ?? 0;
  const resultado = classificar(cands, ef, su);

  const salvar = useMutation({
    mutationFn: async (dados: EleicaoDados) => {
      const { error } = await supabase.from("cipa_gestoes").update({ eleicao: dados as any }).eq("id", gestao.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Processo eleitoral salvo"); qc.invalidateQueries({ queryKey: ["cipa", "gestoes"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const gerarComposicao = useMutation({
    mutationFn: async () => {
      if (part.valida !== true) throw new Error("A participação mínima (5.5.4) ainda não foi atingida — não é permitido apurar.");
      if (!e.apuracao_acompanhantes?.trim()) throw new Error("Registre os acompanhantes da apuração (5.5.3 i).");
      if (resultado.titulares.length < ef) throw new Error(`Votados insuficientes para os ${ef} titulares exigidos pelo Quadro I.`);
      const rows = [
        ...resultado.titulares.map((c) => ({ c, papel: "EFETIVO" as const, ordem: null as number | null })),
        ...resultado.suplentes.map((c, i) => ({ c, papel: "SUPLENTE" as const, ordem: i + 1 })),
      ].map(({ c, papel, ordem }) => ({
        gestao_id: gestao.id, employee_id: c.employee_id, representacao: "EMPREGADOS", papel,
        votos: c.votos, inscricao_em: c.inscricao_em || null, ordem_suplencia: ordem,
        posse_em: e.posse_data || prazos.posse, status: "ATIVO",
      }));
      const { error } = await supabase.from("cipa_membros").upsert(rows as any, { onConflict: "gestao_id,employee_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Eleitos lançados na aba Membros"); qc.invalidateQueries({ queryKey: ["cipa", "membros", gestao.id] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  function addCandidato(id: string) {
    const f = (funcs ?? []).find((x: any) => x.id === id) as any;
    if (!f || cands.some((c) => c.employee_id === id)) return;
    set("candidatos", [...cands, { employee_id: id, nome: f.nome, admissao: f.admissao, inscricao_em: new Date().toISOString().slice(0, 10), comprovante: false, votos: null }]);
  }
  function updCand(i: number, patch: Partial<Candidato>) {
    set("candidatos", cands.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  const Ok = ({ ok }: { ok: boolean | null }) =>
    ok === true ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> :
    ok === false ? <XCircle className="h-4 w-4 text-destructive shrink-0" /> :
    <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />;

  const D = ({ k, label, hint }: { k: keyof EleicaoDados; label: string; hint?: string }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="date" value={(e[k] as string) ?? ""} onChange={(ev) => set(k, ev.target.value as any)} />
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
  const N = ({ k, label }: { k: keyof EleicaoDados; label: string }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={(e[k] as number | null | undefined) ?? ""} onChange={(ev) => set(k, ev.target.value === "" ? null : Number(ev.target.value) as any)} />
    </div>
  );

  const pendentes = checks.filter((c) => c.ok === false).length;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-bold">Conformidade do processo eleitoral — NR-05</h3>
            <p className="text-[10px] text-muted-foreground">Fim do mandato em curso: {fmt(gestao.data_fim)} · posse da nova gestão: {fmt(prazos.posse)}</p>
          </div>
          <Badge variant={pendentes ? "destructive" : "secondary"}>{pendentes ? `${pendentes} não conformidade(s)` : "Sem não conformidades"}</Badge>
        </div>
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.item} className="flex items-start gap-2 text-sm">
              <Ok ok={c.ok} /><span className="text-muted-foreground w-16 shrink-0 text-xs pt-0.5">{c.item}</span><span>{c.texto}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox id="extra" checked={!!e.extraordinaria} onCheckedChange={(v) => set("extraordinaria", !!v)} />
          <Label htmlFor="extra" className="text-sm">Eleição extraordinária (vacância sem suplentes nos 6 primeiros meses — prazos reduzidos pela metade, item 5.4.11)</Label>
        </div>

        <section>
          <h4 className="font-semibold text-sm mb-2">1. Convocação</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <Label className="text-xs">Comissão eleitoral (Presidente e Vice da CIPA em curso)</Label>
              <Input value={e.comissao_eleitoral ?? ""} onChange={(ev) => set("comissao_eleitoral", ev.target.value)} placeholder="Nomes dos integrantes" />
            </div>
            <D k="sindicato_comunicado_em" label="Comunicação ao sindicato" hint="Antes ou no dia do edital" />
            <div className="md:col-span-2">
              <Label className="text-xs">Comprovante de entrega ao sindicato</Label>
              <Input value={e.sindicato_comprovante ?? ""} onChange={(ev) => set("sindicato_comprovante", ev.target.value)} placeholder="Protocolo / e-mail com confirmação de leitura" />
            </div>
            <D k="edital_publicado_em" label="Publicação do edital" hint={`Limite: ${fmt(prazos.editalAte)}`} />
            <div className="md:col-span-2">
              <Label className="text-xs">Local de divulgação do edital</Label>
              <Input value={e.edital_local ?? ""} onChange={(ev) => set("edital_local", ev.target.value)} placeholder="Quadro de avisos, intranet, e-mail…" />
            </div>
          </div>
        </section>

        <section>
          <h4 className="font-semibold text-sm mb-2">2. Inscrições</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <D k="inscricao_inicio" label="Início das inscrições" />
            <D k="inscricao_fim" label="Fim das inscrições" hint={e.inscricao_inicio ? `Mínimo até ${fmt(addDays(e.inscricao_inicio, prazos.inscricaoMinDias - 1))}` : `Mínimo ${prazos.inscricaoMinDias} dias corridos`} />
            <D k="inscritos_publicados_em" label="Publicação da relação de inscritos" />
          </div>
          <div className="mt-3 space-y-2">
            <CipaEmployeePicker
              funcs={funcs}
              value=""
              onChange={addCandidato}
              excludeIds={cands.map((c) => c.employee_id)}
              placeholder="+ Registrar candidato inscrito…"
              label={null}
              triggerClassName="md:w-96"
            />
            {cands.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground"><tr>
                    <th className="text-left p-1.5">Candidato</th><th className="text-left p-1.5">Inscrição</th>
                    <th className="p-1.5">Comprovante</th><th className="text-left p-1.5">Votos</th><th />
                  </tr></thead>
                  <tbody>
                    {cands.map((c, i) => (
                      <tr key={c.employee_id} className="border-t border-border">
                        <td className="p-1.5">{c.nome}</td>
                        <td className="p-1.5"><Input type="date" className="h-8" value={c.inscricao_em} onChange={(ev) => updCand(i, { inscricao_em: ev.target.value })} /></td>
                        <td className="p-1.5 text-center"><Checkbox checked={c.comprovante} onCheckedChange={(v) => updCand(i, { comprovante: !!v })} /></td>
                        <td className="p-1.5"><Input type="number" min={0} className="h-8 w-24" value={c.votos ?? ""} onChange={(ev) => updCand(i, { votos: ev.target.value === "" ? null : Number(ev.target.value) })} /></td>
                        <td className="p-1.5 text-right"><Button size="icon" variant="ghost" onClick={() => set("candidatos", cands.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-muted-foreground mt-1">Candidatos inscritos têm garantia de emprego desde o registro da candidatura (CLT art. 165 / ADCT art. 10, II, a).</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h4 className="font-semibold text-sm mb-2">3. Votação</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <D k="votacao_data" label="Data da votação" hint={`Limite: ${fmt(prazos.votacaoAte)} · dia útil`} />
            <div>
              <Label className="text-xs">Meio de votação</Label>
              <Select value={e.votacao_meio ?? ""} onValueChange={(v) => set("votacao_meio", v as any)}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="URNA">Cédula em urna lacrada</SelectItem>
                  <SelectItem value="ELETRONICO">Sistema eletrônico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 justify-end">
              <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!e.sigilo_garantido} onCheckedChange={(v) => set("sigilo_garantido", !!v)} />Voto secreto, seguro e com registro preciso</label>
              <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!e.turnos_contemplados} onCheckedChange={(v) => set("turnos_contemplados", !!v)} />Todos os turnos puderam votar</label>
            </div>
            <N k="eleitores_aptos" label="Empregados aptos a votar" />
            <N k="votantes_dia1" label="Votantes — 1º dia" />
            {(part.acao === "PRORROGAR_1" || e.votantes_dia2 != null) && <N k="votantes_dia2" label="Votantes acumulados — 2º dia" />}
            {(part.acao === "PRORROGAR_2" || e.votantes_dia3 != null) && <N k="votantes_dia3" label="Votantes acumulados — 3º dia" />}
          </div>
          <p className={`text-xs mt-2 ${part.valida === false ? "text-destructive" : "text-muted-foreground"}`}>{part.texto}</p>
        </section>

        <section>
          <h4 className="font-semibold text-sm mb-2">4. Apuração, ata e posse</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <D k="apuracao_data" label="Data da apuração" hint="Horário normal de trabalho" />
            <div className="md:col-span-2">
              <Label className="text-xs">Acompanhantes da apuração</Label>
              <Input value={e.apuracao_acompanhantes ?? ""} onChange={(ev) => set("apuracao_acompanhantes", ev.target.value)} placeholder="Representante(s) da organização e dos empregados" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Ata de eleição (link do documento)</Label>
              <Input value={e.ata_eleicao_url ?? ""} onChange={(ev) => set("ata_eleicao_url", ev.target.value)} placeholder="https://…" />
            </div>
            <D k="posse_data" label="Data da posse" hint={`1º dia após o fim do mandato: ${fmt(prazos.posse)}`} />
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={() => salvar.mutate(e)} disabled={salvar.isPending}>{salvar.isPending ? "Salvando…" : "Salvar processo eleitoral"}</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold flex items-center gap-2"><Trophy className="h-4 w-4" /> Resultado</h3>
          <Button size="sm" onClick={() => gerarComposicao.mutate()} disabled={gerarComposicao.isPending || part.valida !== true}>
            <Plus className="h-4 w-4 mr-1" /> Lançar eleitos em Membros
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">
          Quadro I: {ef} titular(es) e {su} suplente(s) dos empregados. Empate: vence o maior tempo de serviço no estabelecimento (5.5.7). Demais votados ficam como suplentes em ordem decrescente de votos.
        </p>
        {resultado.titulares.length === 0 ? <p className="text-sm text-muted-foreground">Informe os votos dos candidatos.</p> : (
          <ol className="text-sm space-y-1">
            {resultado.titulares.map((c) => <li key={c.employee_id}><Badge className="mr-2">Titular</Badge>{c.nome} · {c.votos} votos</li>)}
            {resultado.suplentes.map((c, i) => <li key={c.employee_id}><Badge variant="secondary" className="mr-2">{i + 1}º suplente</Badge>{c.nome} · {c.votos} votos</li>)}
          </ol>
        )}
        {resultado.empates && <p className="text-xs text-amber-500 mt-2">Há empate de votos: desempate aplicado pela data de admissão mais antiga.</p>}
      </Card>
    </div>
  );
}
