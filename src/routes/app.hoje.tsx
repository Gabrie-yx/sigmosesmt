import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { MinhasPendencias } from "@/components/minhas-pendencias";

export const Route = createFileRoute("/app/hoje")({
  component: HojePage,
});

function HojePage() {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-6 md:px-14 pt-8">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-[#7f1d1d] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o início
        </Link>
      </div>

      <MinhasPendencias />

      <div className="max-w-7xl mx-auto px-6 md:px-14 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">Como funciona este painel:</strong> o SIGMO verifica
              automaticamente as rotinas recorrentes (DDS, APR, exames, EPI, requisições) e
              destaca o que precisa de ação <em>hoje</em>. Quando tudo estiver verde, você sabe
              que o dia começou em ordem.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}