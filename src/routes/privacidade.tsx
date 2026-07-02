import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade · Estaleiro DMN" },
      { name: "description", content: "Política de Privacidade do SIGMO — Sistema Integrado de Gestão Modular (Estaleiro DMN), em conformidade com a LGPD." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-6">
          Política de Privacidade
        </h1>
        <p className="text-sm text-slate-500 mb-8">Última atualização: 14/05/2026</p>

        <section className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed">
          <div>
            <h2 className="text-xl font-bold text-slate-900">1. Controlador dos dados</h2>
            <p>O <strong>Estaleiro DMN</strong> é o controlador dos dados pessoais tratados neste sistema, conforme a Lei nº 13.709/2018 (LGPD).</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">2. Dados tratados</h2>
            <p>Este sistema trata dados pessoais e dados pessoais sensíveis de colaboradores próprios e terceirizados, incluindo:</p>
            <ul className="list-disc pl-6">
              <li>Identificação: nome, CPF, RG, matrícula, foto, contatos.</li>
              <li>Dados de saúde ocupacional: ASOs, exames médicos, vacinação, aptidão.</li>
              <li>Dados de segurança do trabalho: treinamentos, NRs, EPIs entregues, APRs, PTEs, DDS.</li>
              <li>Dados de produção: ordens, cascos, materiais, requisições.</li>
              <li>Dados de auditoria: logs de acesso e alterações.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">3. Bases legais</h2>
            <ul className="list-disc pl-6">
              <li><strong>Cumprimento de obrigação legal</strong> (art. 7º, II) — NRs do MTE, eSocial, normas da Marinha.</li>
              <li><strong>Execução de contrato de trabalho</strong> (art. 7º, V).</li>
              <li><strong>Tutela da saúde</strong> (art. 11, II, "f") — para dados de saúde ocupacional.</li>
              <li><strong>Legítimo interesse</strong> (art. 7º, IX) — para gestão de segurança e produção.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">4. Finalidade</h2>
            <p>Os dados são tratados exclusivamente para gestão de SST, controle de produção e cumprimento de obrigações legais e contratuais. Não há compartilhamento com terceiros para fins comerciais.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">5. Compartilhamento</h2>
            <p>Dados podem ser compartilhados com: órgãos fiscalizadores (MTE, Marinha, INSS), clínicas de medicina ocupacional contratadas, e operador de infraestrutura em nuvem (Supabase / Lovable Cloud), sob acordo de confidencialidade.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">6. Segurança</h2>
            <ul className="list-disc pl-6">
              <li>Acesso restrito por autenticação e papéis (RBAC).</li>
              <li>Autenticação em dois fatores (MFA) obrigatória para perfis com acesso a PII.</li>
              <li>Criptografia em trânsito (TLS) e em repouso.</li>
              <li>Logs de auditoria de todas as alterações.</li>
              <li>Row-Level Security (RLS) no banco de dados.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">7. Retenção</h2>
            <p>Dados de SST são retidos pelos prazos legais aplicáveis (mínimo 20 anos para ASO, conforme NR-7). Demais dados são mantidos enquanto durar a relação contratual e pelos prazos legais de prescrição.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">8. Direitos do titular (art. 18 LGPD)</h2>
            <p>O titular pode solicitar: confirmação, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamentos e revogação de consentimento, mediante requisição ao Encarregado (DPO) do Estaleiro DMN.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">9. Encarregado (DPO)</h2>
            <p>Para exercer seus direitos ou esclarecer dúvidas, contate o Encarregado de Proteção de Dados do Estaleiro DMN pelo canal interno de RH/SESMT.</p>
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