import { createFileRoute } from "@tanstack/react-router";
import { MaterialForm } from "@/components/producao/material-form";

export const Route = createFileRoute("/app/producao/criar-halb")({
  component: () => <MaterialForm tipo="HALB" />,
});
