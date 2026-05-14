import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso · Estaleiro DMN" },
      { name: "description", content: "Termos de Uso do Sistema de Gestão Estaleiro DMN." },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-6">
          Termos de Uso
        </h1>
        <p className="text-sm text-slate-500 mb-8">Última atualização: 14/05/2026</p>

        <section className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed">
          <div>
            <h2 className="text-xl font-bold text-slate-900">1. Aceitação</h2>
            <p>Ao acessar este sistema, o usuário declara que leu, entendeu e concorda integralmente com estes Termos de Uso e com a <Link to="/privacidade" className="text-red-600 hover:underline">Política de Privacidade</Link>.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">2. Acesso autorizado</h2>
            <p>O sistema é de uso restrito a colaboradores e prestadores autorizados pelo Estaleiro DMN. Credenciais são pessoais, intransferíveis e o usuário é responsável por toda atividade realizada com sua conta.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">3. Uso permitido</h2>
            <ul className="list-disc pl-6">
              <li>Operar funções de SST, produção e compras conforme atribuição funcional.</li>
              <li>Inserir, consultar e atualizar dados estritamente relacionados às suas responsabilidades.</li>
              <li>Reportar incidentes de segurança ao SESMT/TI imediatamente.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">4. Condutas vedadas</h2>
            <ul className="list-disc pl-6">
              <li>Compartilhar credenciais ou permitir acesso de terceiros.</li>
              <li>Extrair, copiar ou divulgar dados pessoais para fora do sistema sem autorização formal.</li>
              <li>Tentar burlar controles de acesso, RLS ou MFA.</li>
              <li>Usar os dados para finalidades alheias às atividades do Estaleiro.</li>
            </ul>
            <p className="text-sm text-red-700 font-semibold">Violações configuram falta grave (CLT, art. 482) e podem caracterizar infração à LGPD, sujeita a sanções administrativas e cíveis.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">5. Auditoria e monitoramento</h2>
            <p>Toda ação no sistema (acesso, criação, alteração, exclusão) é registrada em log de auditoria, com identificação do usuário, data/hora e dados afetados. O monitoramento ocorre para fins de segurança e conformidade.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">6. Propriedade dos dados</h2>
            <p>Todos os dados inseridos são de propriedade do Estaleiro DMN. O sistema e seu código são protegidos por direitos autorais e licenciados para uso interno.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">7. Disponibilidade</h2>
            <p>O sistema é fornecido "como está", podendo sofrer interrupções para manutenção. O Estaleiro não garante disponibilidade ininterrupta, mas envida melhores esforços.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">8. Alterações</h2>
            <p>Estes Termos podem ser revisados a qualquer tempo. Alterações relevantes serão comunicadas no próprio sistema.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">9. Foro</h2>
            <p>Fica eleito o foro da comarca de domicílio do Estaleiro DMN para dirimir questões oriundas destes Termos.</p>
          </div>
        </section>

        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <Link to="/login" className="text-sm font-semibold text-red-600 hover:text-red-700">
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}