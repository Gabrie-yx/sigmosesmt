import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CHECKLIST_NC } from "./app.extintores";
import dmnLogo from "@/assets/dmn-logo.png";

export const Route = createFileRoute("/app/extintores_/imprimir")({
  component: ImprimirPlanilhaExtintores,
  head: () => ({ meta: [{ title: "Planilha de Inspeção de Extintores · FOR-SFG 08" }] }),
});

function fmtRecargaMesAno(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[dt.getMonth()]}/${String(dt.getFullYear()).slice(-2)}`;
}
function fmtBR(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function ImprimirPlanilhaExtintores() {
  const extintores = useQuery({
    queryKey: ["extintores-print"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extintores").select("*").neq("status", "BAIXADO").order("area").order("numero");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const inspecoes = useQuery({
    queryKey: ["extintor-inspecoes-print"],
    queryFn: async () => {
      const { data } = await supabase
        .from("extintor_inspecoes").select("*").order("data_inspecao", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // mapa: ultimíssima inspeção por extintor
  const ultInsp = useMemo(() => {
    const m = new Map<string, any>();
    (inspecoes.data ?? []).forEach((i) => { if (!m.has(i.extintor_id)) m.set(i.extintor_id, i); });
    return m;
  }, [inspecoes.data]);

  // dispara o diálogo de impressão automaticamente quando carregar
  useEffect(() => {
    if (extintores.isLoading) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [extintores.isLoading]);

  const hoje = new Date();
  const hojeBR = hoje.toLocaleDateString("pt-BR");

  return (
    <div className="planilha-extintores bg-white text-black">
      <style>{`
        @page { size: A4 landscape; margin: 6mm; }
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .planilha-extintores { font-family: Arial, sans-serif; font-size: 8.5pt; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
        .planilha-extintores { font-family: Arial, sans-serif; font-size: 8.5pt; padding: 4mm; }
        .pl-table { border-collapse: collapse; width: 100%; }
        .pl-table th, .pl-table td { border: 1px solid #000; padding: 1.5px 3px; vertical-align: middle; line-height: 1.05; }
        .pl-table th { background: #f3f4f6; font-weight: 700; text-align: center; font-size: 7.5pt; }
        .pl-table td.num { text-align: center; font-family: 'Courier New', monospace; }
        .pl-table td.c { text-align: center; }
        .pl-header { border: 1px solid #000; border-collapse: collapse; width: 100%; margin-bottom: 0; }
        .pl-header td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; }
        .pl-title { text-align: center; font-weight: 900; font-size: 12pt; }
        .pl-info td { font-size: 8pt; }
        .pl-info b { font-weight: 700; }
        .legenda { border: 1px solid #000; border-top: none; padding: 3px 5px; font-size: 7.5pt; }
        .assinaturas { display: grid; grid-template-columns: 1fr 1fr 1fr; margin-top: 18px; gap: 0; }
        .assinaturas > div { border-top: 1px solid #000; padding-top: 3px; text-align: center; font-size: 8pt; margin: 0 8mm; }
      `}</style>

      <div className="no-print" style={{ background: "#fef3c7", padding: 8, marginBottom: 8, fontSize: 12, borderRadius: 4 }}>
        <strong>Modo impressão.</strong> Use Ctrl/⌘+P se a janela de impressão não abrir automaticamente. Ajuste para <em>Paisagem</em> e <em>Sem margens</em> ou margens mínimas.
      </div>

      {/* CABEÇALHO — FOR-SFG 08 */}
      <table className="pl-header">
        <tbody>
          <tr>
            <td style={{ width: "12%", textAlign: "center" }} rowSpan={2}>
              <img src={dmnLogo} alt="DMN" style={{ height: 32 }} />
            </td>
            <td className="pl-title" style={{ width: "70%" }} rowSpan={2}>
              PLANILHA DE INSPEÇÃO DE EXTINTORES
            </td>
            <td style={{ width: "18%", fontSize: 7.5, lineHeight: 1.25 }}>
              <div><b>CÓD:</b> FOR-SFG 08</div>
              <div><b>REVISÃO:</b> 00</div>
              <div><b>DATA:</b> 30/08/2025</div>
              <div><b>PÁG:</b> 01/01</div>
            </td>
          </tr>
          <tr><td style={{ display: "none" }}></td></tr>
        </tbody>
      </table>
      <table className="pl-header pl-info" style={{ borderTop: "none" }}>
        <tbody>
          <tr>
            <td style={{ width: "30%" }}><b>EMPRESA:</b> DMN ESTALEIRO</td>
            <td style={{ width: "55%" }}><b>RESPONSÁVEL PELA INSPEÇÃO:</b> Téc. Segurança — Francisco Bandeira — CRP-0016640/AM-MTE</td>
            <td style={{ width: "15%" }}><b>DATA:</b> {hojeBR}</td>
          </tr>
        </tbody>
      </table>

      {/* TABELA PRINCIPAL */}
      <table className="pl-table">
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: 28 }}>Nº</th>
            <th rowSpan={2} style={{ width: 60 }}>Nº do<br />Extintor</th>
            <th rowSpan={2} style={{ width: 95 }}>ÁREA</th>
            <th rowSpan={2}>LOCALIZAÇÃO</th>
            <th rowSpan={2} style={{ width: 60 }}>TIPO<br />AGENTE</th>
            <th rowSpan={2} style={{ width: 50 }}>CARGA<br />NOMINAL<br />Kg/L</th>
            <th rowSpan={2} style={{ width: 75 }}>PESO -<br />Capac.<br />Extintora</th>
            <th rowSpan={2} style={{ width: 80 }}>Nº SELO<br />DO<br />INMETRO</th>
            <th colSpan={3} style={{ width: 200 }}>DATA</th>
            <th rowSpan={2} style={{ width: 130 }}>Não Conformidade</th>
            <th rowSpan={2} style={{ width: 130 }}>OBSERVAÇÕES</th>
          </tr>
          <tr>
            <th style={{ width: 70 }}>Recarga</th>
            <th style={{ width: 60 }}>Próx.<br />Recarga</th>
            <th style={{ width: 60 }}>Teste<br />Hidrostático</th>
          </tr>
        </thead>
        <tbody>
          {(extintores.data ?? []).map((e, idx) => {
            const insp = ultInsp.get(e.id);
            const ncs: number[] = insp?.nc_codigos ?? [];
            const ncStr = ncs.length ? ncs.join(", ") : "";
            return (
              <tr key={e.id}>
                <td className="c">{String(idx + 1).padStart(2, "0")}</td>
                <td className="num">{e.numero}</td>
                <td style={{ fontSize: 7.5 }}>{e.area}</td>
                <td style={{ fontSize: 7.5 }}>{e.localizacao}</td>
                <td className="c">{e.tipo_agente}</td>
                <td className="c">{e.carga_nominal ?? ""}</td>
                <td className="c">{e.capacidade_extintora ?? ""}</td>
                <td className="num">{e.numero_selo_inmetro ?? ""}</td>
                <td className="c">{fmtBR(e.data_ultima_recarga)}</td>
                <td className="c">{fmtRecargaMesAno(e.proxima_recarga)}</td>
                <td className="c">{e.proximo_teste_hidrostatico ?? ""}</td>
                <td className="c">{ncStr}</td>
                <td style={{ fontSize: 7.5 }}>{insp?.observacoes ?? ""}</td>
              </tr>
            );
          })}
          {/* Linhas em branco para preenchimento manual quando há poucos */}
          {Array.from({ length: Math.max(0, 5 - (extintores.data?.length ?? 0)) }).map((_, i) => (
            <tr key={`blank-${i}`}>
              {Array.from({ length: 13 }).map((_, j) => <td key={j}>&nbsp;</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {/* LEGENDA */}
      <div className="legenda">
        <b>LEGENDA:</b>{" "}
        {CHECKLIST_NC.map((it) => `${it.id}.${it.label}`).join("  ")}
      </div>

      {/* ASSINATURAS */}
      <div className="assinaturas">
        <div>Encarregado de Produção</div>
        <div>Técnico em Segurança do Trabalho</div>
        <div>Supervisor Administrativo</div>
      </div>
    </div>
  );
}