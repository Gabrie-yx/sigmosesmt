import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { contarRcsPendentes } from "@/lib/rc-public.functions";
import { useAuth } from "@/hooks/use-auth";

export function RcHeaderBadge() {
  const { user, isEditor } = useAuth();
  const fetchContagem = useServerFn(contarRcsPendentes);

  const { data } = useQuery({
    queryKey: ["rc-header-badge", user?.id],
    queryFn: () => fetchContagem(),
    enabled: !!user && isEditor,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!user || !isEditor || !data) return null;

  // Supervisor prioriza COTADA (decisão dele); demais veem PENDENTE (fila)
  const count = data.isSupervisor ? data.cotadas : data.pendentes;
  if (!count) return null;

  const title = data.isSupervisor
    ? `${count} requisição(ões) cotada(s) aguardando sua decisão`
    : `${count} requisição(ões) aguardando cotação`;

  const targetTab = data.isSupervisor ? "COTADA" : "PENDENTE";
  const navigate = useNavigate();

  return (
    <button
      type="button"
      title={title}
      onClick={() => {
        navigate({ to: "/app/sesmt/requisicoes", search: { tab: targetTab } as any });
        // garante scroll ao topo se já estiver na página
        setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
      }}
      className="relative h-8 px-2 rounded-md text-white hover:bg-white/10 flex items-center gap-1.5"
    >
      <span className="relative">
        <ShoppingCart className="h-4 w-4" />
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </span>
      </span>
      <span className="text-[11px] font-black leading-none px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950">
        {count}
      </span>
    </button>
  );
}