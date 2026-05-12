import { useLocation, Link } from "@tanstack/react-router";
import { useAuth, type AppModule } from "@/hooks/use-auth";
import { Lock } from "lucide-react";

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
  { prefix: "/app/users", module: "usuarios" },
  { prefix: "/app/audit", module: "usuarios" },
];

export function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const { hasModule, isAdmin, loading } = useAuth();
  const location = useLocation();

  // Always allow account/security and dashboard root
  const allowAlways = ["/app/conta", "/app"].some(
    (p) => location.pathname === p || location.pathname === "/app/"
  );

  if (loading || allowAlways || isAdmin) return <>{children}</>;

  const match = PATH_TO_MODULE.find((m) => location.pathname.startsWith(m.prefix));
  if (!match) return <>{children}</>;

  if (!hasModule(match.module)) {
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

  return <>{children}</>;
}