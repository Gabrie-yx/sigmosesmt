import { createFileRoute, Outlet, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/app-header";
import { ModuleRouteGuard } from "@/components/module-guard";
import { CommandPalette } from "@/components/command-palette";
import { AppSidebar } from "@/components/app-sidebar";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import { SmartBreadcrumb } from "@/components/smart-breadcrumb";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ShieldAlert } from "lucide-react";
import { HelpHint } from "@/components/help-hint";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, requiresMfa, mfaSatisfied, graceActive, graceDaysLeft, aal, isMarcadorPuro } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  // Marcador puro (Extra de Sábado) só pode ver o painel mobile — nunca /app/*
  useEffect(() => {
    if (!loading && session && isMarcadorPuro) {
      navigate({ to: "/extra-sabado", replace: true });
    }
  }, [loading, session, isMarcadorPuro, navigate]);

  if (loading || !session) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-rose-100/80"
        style={{
          background:
            "linear-gradient(180deg, #5a0f22 0%, #3a0a18 45%, #1f0610 100%)",
        }}
      >
        Carregando…
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="app-glass-scope relative min-h-screen flex w-full bg-[radial-gradient(ellipse_at_top,_#5a0f22_0%,_#3a0a18_40%,_#1f0610_100%)] before:pointer-events-none before:fixed before:inset-x-0 before:top-0 before:z-20 before:h-14 before:bg-gradient-to-b before:from-[#a01818] before:to-[#7f1212] before:content-['']">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <QuickActionsBar />
          <SmartBreadcrumb />
          {requiresMfa && !mfaSatisfied && !location.pathname.startsWith("/app/conta/seguranca") && (
            <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-3 py-2 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2 min-w-0">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                <span className="min-w-0">
                  MFA obrigatório para todos os usuários. Ative agora para acessar áreas sensíveis.
                </span>
                <HelpHint topic="mfa" />
              </div>
              <Link to="/app/conta/seguranca" className="font-bold underline whitespace-nowrap self-end sm:self-auto">Configurar MFA</Link>
            </div>
          )}
          {requiresMfa && graceActive && aal !== "aal2" && !location.pathname.startsWith("/app/conta/seguranca") && (
            <div className="bg-blue-50 border-b border-blue-300 text-blue-900 px-3 py-2 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2 min-w-0">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                <span className="min-w-0">
                  MFA obrigatório em <b>{graceDaysLeft} dia{graceDaysLeft === 1 ? "" : "s"}</b>. Ative agora e não seja pego de surpresa.
                </span>
                <HelpHint topic="mfa" />
              </div>
              <Link to="/app/conta/seguranca" className="font-bold underline whitespace-nowrap self-end sm:self-auto">Ativar MFA</Link>
            </div>
          )}
          <main className="flex-1">
            <ModuleRouteGuard>
              <Outlet />
            </ModuleRouteGuard>
          </main>
          <footer className="border-t bg-white/60 backdrop-blur py-2 px-3 text-center text-[10px] sm:text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">
              Copyright© 2026. Todos os Direitos Reservados para{" "}
              <span className="font-semibold text-foreground/80">Francisco Bandeira Almeida</span>{" "}
              (fbandeira.br@gmail.com) e Anderson Soares — SIGMO - Sistema Integrado de Gestão Modular.
            </span>
            <span className="sm:hidden">© 2026 SIGMO · <span className="font-semibold">F. Bandeira Almeida</span> & A. Soares</span>
          </footer>
          <CommandPalette />
        </div>
      </div>
    </SidebarProvider>
  );
}