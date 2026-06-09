import { createFileRoute } from "@tanstack/react-router";
import { EstoqueEpiPage } from "./app.estoque.epi";

export const Route = createFileRoute("/app/estoque/")({
  component: EstoqueEpiPage,
});