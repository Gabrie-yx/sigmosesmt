import { createFileRoute } from "@tanstack/react-router";
import { MaterialForm } from "@/components/producao/material-form";

export const Route = createFileRoute("/app/producao/criar-fert")({
  component: () => <MaterialForm tipo="FERT" />,
});
