import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5min — evita refetch a cada troca de aba
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Pré-carrega o chunk da rota no hover/focus do <Link>.
    // Reduz drasticamente o "tempo branco" entre clique e renderização.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
  });

  return router;
};
