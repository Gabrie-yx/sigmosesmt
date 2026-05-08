import { createFileRoute, Outlet, Link, useNavigate, useLocation, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Users, Shield, FileText, LayoutDashboard, LogOut, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/companies", label: "Empresas", icon: Building2 },
  { to: "/app/employees", label: "Funcionários", icon: Users },
  { to: "/app/roles", label: "Funções", icon: Shield },
  { to: "/app/ptes", label: "PTEs", icon: FileText },
];

function AppLayout() {
  const { user, roles, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="p-6 border-b">
          <h1 className="text-lg font-bold tracking-tight">EnviCorp</h1>
          <p className="text-xs text-muted-foreground">Fardamento & SST</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/app/users"
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                location.pathname.startsWith("/app/users") ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              Usuários
            </Link>
          )}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="px-2 text-xs">
            <p className="font-medium truncate">{user?.email}</p>
            <div className="flex gap-1 mt-1 flex-wrap">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
              ))}
              {roles.length === 0 && <Badge variant="outline" className="text-[10px]">sem papel</Badge>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}