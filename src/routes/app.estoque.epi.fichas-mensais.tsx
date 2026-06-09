import { createFileRoute } from "@tanstack/react-router";
import { FichasMensaisPanel } from "@/components/epi/fichas-mensais-panel";

export const Route = createFileRoute("/app/estoque/epi/fichas-mensais")({
  component: FichasMensaisPanel,
});