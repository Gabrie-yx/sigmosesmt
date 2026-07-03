import { useLocation, Link } from "@tanstack/react-router";
import { useAuth, type AppModule, type AppRole } from "@/hooks/use-auth";
import { Lock } from "lucide-react";
import { menuKeyForPath, MENU_BY_KEY } from "@/lib/menu-catalog";

const PATH_TO_MODULE: { prefix: string; module: AppModule }[] = [
  { prefix: "/app/painel", module: "sesmt" },
  { prefix: "/app/companies", module: "sesmt" },
  { prefix: "/app/roles", module: "sesmt" },
  { prefix: "/app/employees", module: "sesmt" },
  { prefix: "/app/trainings", module: "sesmt" },
  { prefix: "/app/cascos", module: "sesmt" },
  { prefix: "/app/ptes", module: "sesmt" },
  { prefix: "/app/aprs", module: "sesmt" },
  { prefix: "/app/dds", module: "sesmt" },
  { prefix: "/app/sesmt", module: "sesmt" },
  { prefix: "/app/relatorios", module: "sesmt" },
  { prefix: "/app/estoque", module: "estoque" },
  { prefix: "/app/producao", module: "producao" },
  { prefix: "/app/compras", module: "compras" },
  { prefix: "/app/almoxarifado", module: "almoxarifado" },
  { prefix: "/app/users", module: "usuarios" },
  { prefix: "/app/audit", module: "usuarios" },
];

const MODULE_ROLE_BYPASS: Partial<Record<AppModule, AppRole[]>> = {
  compras: ["compras"],
};

export function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const { hasModule, hasMenu, isAdmin, roles, loading } = useAuth();
  const location = useLocation();

  // Always allow account/security and dashboard root
  const allowAlways = ["/app/conta", "/app"].some(
    (p) => location.pathname === p || location.pathname === "/app/"
  );

  if (loading || allowAlways || isAdmin) return <>{children}</>;

  const match = PATH_TO_MODULE.find((m) => location.pathname.startsWith(m.prefix));
  if (!match) return <>{children}</>;

  const hasRoleBypass = (MODULE_ROLE_BYPASS[match.module] ?? []).some((role) => roles.includes(role));

  if (!hasModule(match.module) && !hasRoleBypass) {
    return (
      <div className="max-w-xl mx-auto mt-16 rounded-lg border bg-white p-8 text-center shadow-sm">
        <Lock className="h-10 w-10 mx-auto text-amber-600 mb-3" />
        <h2 className="text-lg font-bold mb-2">Acesso negado a este módulo</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Você não tem permissão para acessar <span className="font-semibold">{match.module}</span>.
          Solicite acesso a um administrador.
        </p>
        <Link to="/app" className="text-sm font-bold text-red-700 underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  // Checagem fina por menu (sub-página)
  const menuKey = menuKeyForPath(location.pathname);
  if (menuKey && !hasMenu(menuKey)) {
    const label = MENU_BY_KEY[menuKey]?.label ?? menuKey;
    return (
      <div className="max-w-xl mx-auto mt-16 rounded-lg border bg-white p-8 text-center shadow-sm">
        <Lock className="h-10 w-10 mx-auto text-amber-600 mb-3" />
        <h2 className="text-lg font-bold mb-2">Acesso negado a este menu</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Você não tem permissão para acessar <span className="font-semibold">{label}</span>.
          Solicite a liberação a um administrador.
        </p>
        <Link to="/app" className="text-sm font-bold text-red-700 underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}