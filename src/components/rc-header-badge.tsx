import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Package } from "lucide-react";
import { contarRcsPendentes } from "@/lib/rc-public.functions";
import { useAuth } from "@/hooks/use-auth";

export function RcHeaderBadge() {
  const { user, isEditor } = useAuth();
  const fetchContagem = useServerFn(contarRcsPendentes);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["rc-header-badge", user?.id],
    queryFn: () => fetchContagem(),
    enabled: !!user && isEditor,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!user || !isEditor || !data) return null;

  // Compras vê recebidas (fila total pra cotar)
  // Supervisor vê COTADA (decisão dele)
  // Demais veem PENDENTE
  type Kind = "compras" | "supervisor" | "solicitante";
  const buttons: {
    kind: Kind;
    count: number;
    title: string;
    tab: string;
    to: "/app/compras/requisicoes-recebidas" | "/app/sesmt/requisicoes";
    Icon: typeof ShoppingCart;
  }[] = [];

  if ((data as any).isCompras && (data as any).recebidas) {
    buttons.push({
      kind: "compras",
      count: (data as any).recebidas,
      title: `${(data as any).recebidas} requisição(ões) na fila do Compras`,
      tab: "todas",
      to: "/app/compras/requisicoes-recebidas",
      Icon: Package,
    });
  }
  if (data.isSupervisor && data.cotadas) {
    buttons.push({
      kind: "supervisor",
      count: data.cotadas,
      title: `${data.cotadas} requisição(ões) cotada(s) aguardando sua decisão`,
      tab: "COTADA",
      to: "/app/sesmt/requisicoes",
      Icon: ShoppingCart,
    });
  }
  if (!data.isSupervisor && !(data as any).isCompras && data.pendentes) {
    buttons.push({
      kind: "solicitante",
      count: data.pendentes,
      title: `${data.pendentes} requisição(ões) aguardando cotação`,
      tab: "PENDENTE",
      to: "/app/sesmt/requisicoes",
      Icon: ShoppingCart,
    });
  }

  if (buttons.length === 0) return null;

  return (
    <>
      {buttons.map((b) => (
        <button
          key={b.kind}
          type="button"
          title={b.title}
          onClick={() => {
            if (b.to === "/app/compras/requisicoes-recebidas") {
              navigate({ to: b.to });
            } else {
              navigate({ to: b.to, search: { tab: b.tab } as any });
            }
            setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
          }}
          className="relative h-8 px-2 rounded-md text-white hover:bg-white/10 flex items-center gap-1.5"
        >
          <span className="relative">
            <b.Icon className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
          </span>
          <span className="text-[11px] font-black leading-none px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950">
            {b.count}
          </span>
        </button>
      ))}
    </>
  );
}