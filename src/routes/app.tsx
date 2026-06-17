import { createFileRoute, Outlet, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/app-header";
import { ModuleRouteGuard } from "@/components/module-guard";
import { CommandPalette } from "@/components/command-palette";
import { AppSidebar } from "@/components/app-sidebar";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, requiresMfa, mfaSatisfied } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="app-glass-scope min-h-screen flex w-full bg-[radial-gradient(ellipse_at_top,_#5a0f22_0%,_#3a0a18_40%,_#1f0610_100%)]">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <QuickActionsBar />
          {requiresMfa && !mfaSatisfied && !location.pathname.startsWith("/app/conta/seguranca") && (
            <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                <span>Seu papel exige MFA. Ative agora para acessar áreas sensíveis.</span>
              </div>
              <Link to="/app/conta/seguranca" className="font-bold underline">Configurar MFA</Link>
            </div>
          )}
          <main className="flex-1">
            <ModuleRouteGuard>
              <Outlet />
            </ModuleRouteGuard>
          </main>
          <footer className="border-t bg-white/60 backdrop-blur py-3 px-4 text-center text-[11px] text-muted-foreground">
            Copyright© 2026. Todos os Direitos Reservados para Francisco Bandeira (fbandeira.br@gmail.com) — SIGMO - Sistema de Gerenciamento de SST.
          </footer>
          <CommandPalette />
        </div>
      </div>
    </SidebarProvider>
  );
}