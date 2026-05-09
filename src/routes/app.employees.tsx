import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/employees")({
  component: () => <Outlet />,
});
