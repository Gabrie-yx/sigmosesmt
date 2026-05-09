import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

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
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t bg-white/60 backdrop-blur py-3 px-4 text-center text-[11px] text-muted-foreground">
        Copyright© 2026. Todos os Direitos Reservados. Desenvolvido por Francisco Bandeira e Anderson Soares — Sistema de Gerenciamento de SST.
      </footer>
    </div>
  );
}