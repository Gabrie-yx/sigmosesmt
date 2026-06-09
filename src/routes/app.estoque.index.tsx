import { createFileRoute } from "@tanstack/react-router";
import EstoqueSesmtPage from "./app.estoque.sesmt";

export const Route = createFileRoute("/app/estoque/")({
  component: EstoqueSesmtPage,
});