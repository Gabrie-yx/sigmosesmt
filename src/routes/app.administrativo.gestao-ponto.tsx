import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/administrativo/gestao-ponto")({
  component: GestaoPontoLayout,
});

function GestaoPontoLayout() {
  return <Outlet />;
}