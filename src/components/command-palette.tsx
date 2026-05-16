import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  FileText,
  ShoppingCart,
  LayoutDashboard,
  Calendar,
  GraduationCap,
  ClipboardList,
  AlertTriangle,
  Building2,
  Boxes,
  Plus,
  Compass,
} from "lucide-react";

type NavItem = { to: string; label: string; group: string; icon?: any };

const NAV_ITEMS: NavItem[] = [
  { to: "/app/hoje", label: "Hoje — Minhas pendências", group: "Navegar", icon: Calendar },
  { to: "/app/painel", label: "Painel de Indicadores", group: "Navegar", icon: LayoutDashboard },
  { to: "/app/employees", label: "Funcionários", group: "Navegar", icon: Users },
  { to: "/app/aprs", label: "APRs — Análise de Risco", group: "Navegar", icon: FileText },
  { to: "/app/ptes", label: "PTEs — Permissão de Trabalho", group: "Navegar", icon: FileText },
  { to: "/app/dds", label: "DDS — Diálogo de Segurança", group: "Navegar", icon: ClipboardList },
  { to: "/app/dds/historico", label: "DDS — Histórico Mensal", group: "Navegar", icon: ClipboardList },
  { to: "/app/dds/painel", label: "DDS — Painel de Qualidade", group: "Navegar", icon: ClipboardList },
  { to: "/app/trainings", label: "Treinamentos & NRs", group: "Navegar", icon: GraduationCap },
  { to: "/app/matriz-treinamento", label: "Matriz de Treinamento", group: "Navegar", icon: GraduationCap },
  { to: "/app/sesmt/procedimentos", label: "Procedimentos / POPs", group: "Navegar", icon: FileText },
  { to: "/app/sesmt/docs", label: "Documentos SESMT", group: "Navegar", icon: FileText },
  { to: "/app/sesmt/requisicoes", label: "Requisições de Compra", group: "Navegar", icon: ShoppingCart },
  { to: "/app/sesmt/terceiros", label: "Painel de Terceiros", group: "Navegar", icon: Users },
  { to: "/app/ncs", label: "Não Conformidades", group: "Navegar", icon: AlertTriangle },
  { to: "/app/incidentes", label: "Incidentes / Investigação", group: "Navegar", icon: AlertTriangle },
  { to: "/app/acoes", label: "Plano de Ações (5W2H)", group: "Navegar", icon: ClipboardList },
  { to: "/app/audit", label: "Auditoria do Sistema", group: "Navegar", icon: FileText },
  { to: "/app/relatorios/reincidencia-epi", label: "Reincidência de EPI", group: "Navegar", icon: AlertTriangle },
  { to: "/app/cascos", label: "Cascos / Embarcações", group: "Navegar", icon: Compass },
  { to: "/app/companies", label: "Empresas / Contratadas", group: "Navegar", icon: Building2 },
  { to: "/app/roles", label: "Cargos & Matriz de Riscos", group: "Navegar", icon: Users },
  { to: "/app/estoque/sesmt", label: "Estoque SESMT", group: "Navegar", icon: Boxes },
  { to: "/app/estoque/epi", label: "Estoque EPI (Cards)", group: "Navegar", icon: Boxes },
];

const QUICK_ACTIONS: NavItem[] = [
  { to: "/app/aprs", label: "Nova APR", group: "Ações", icon: Plus },
  { to: "/app/sesmt/requisicoes", label: "Nova Requisição de Compra", group: "Ações", icon: Plus },
  { to: "/app/employees", label: "Novo Funcionário", group: "Ações", icon: Plus },
  { to: "/app/dds", label: "Novo DDS", group: "Ações", icon: Plus },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["cmdk-employees"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nome, funcao, status")
        .order("nome")
        .limit(500);
      return data ?? [];
    },
  });

  const { data: aprs = [] } = useQuery({
    queryKey: ["cmdk-aprs"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("aprs")
        .select("id, numero, atividade_descricao, local")
        .order("data_emissao", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: reqs = [] } = useQuery({
    queryKey: ["cmdk-reqs"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_requisitions")
        .select("id, numero, solicitante, setor, status")
        .order("data_requisicao", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const go = (to: string, params?: any) => {
    setOpen(false);
    setQuery("");
    if (params) navigate({ to, params } as any);
    else navigate({ to } as any);
  };

  const q = query.trim().toLowerCase();
  const filteredEmployees = useMemo(() => {
    if (!q) return employees.slice(0, 8);
    return employees
      .filter((e: any) =>
        `${e.nome ?? ""} ${e.funcao ?? ""}`.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [employees, q]);

  const filteredAprs = useMemo(() => {
    if (!q) return aprs.slice(0, 6);
    return aprs
      .filter((a: any) =>
        `${a.numero ?? ""} ${a.atividade_descricao ?? ""} ${a.local ?? ""}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 10);
  }, [aprs, q]);

  const filteredReqs = useMemo(() => {
    if (!q) return reqs.slice(0, 6);
    return reqs
      .filter((r: any) =>
        `${r.numero ?? ""} ${r.solicitante ?? ""} ${r.setor ?? ""}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 10);
  }, [reqs, q]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar funcionários, APRs, requisições, páginas… (⌘K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {filteredEmployees.length > 0 && (
          <CommandGroup heading="Funcionários">
            {filteredEmployees.map((e: any) => (
              <CommandItem
                key={`emp-${e.id}`}
                value={`funcionario ${e.nome} ${e.funcao ?? ""}`}
                onSelect={() => go("/app/employees/$id", { id: e.id })}
              >
                <Users className="text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-medium">{e.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.funcao ?? "—"} {e.status ? `· ${e.status}` : ""}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredAprs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="APRs">
              {filteredAprs.map((a: any) => (
                <CommandItem
                  key={`apr-${a.id}`}
                  value={`apr ${a.numero} ${a.atividade_descricao ?? ""} ${a.local ?? ""}`}
                  onSelect={() => go("/app/aprs")}
                >
                  <FileText className="text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">APR {a.numero}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {a.atividade_descricao ?? "—"}
                      {a.local ? ` · ${a.local}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredReqs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Requisições de Compra">
              {filteredReqs.map((r: any) => (
                <CommandItem
                  key={`req-${r.id}`}
                  value={`requisicao ${r.numero} ${r.solicitante ?? ""} ${r.setor ?? ""}`}
                  onSelect={() => go("/app/sesmt/requisicoes")}
                >
                  <ShoppingCart className="text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">Req {r.numero}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.solicitante ?? "—"}
                      {r.setor ? ` · ${r.setor}` : ""}
                      {r.status ? ` · ${r.status}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Ações rápidas">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon ?? Plus;
            return (
              <CommandItem
                key={`act-${a.label}`}
                value={`acao ${a.label}`}
                onSelect={() => go(a.to)}
              >
                <Icon className="text-muted-foreground" />
                <span>{a.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Navegar">
          {NAV_ITEMS.map((n) => {
            const Icon = n.icon ?? Compass;
            return (
              <CommandItem
                key={`nav-${n.to}-${n.label}`}
                value={`navegar ${n.label} ${n.to}`}
                onSelect={() => go(n.to)}
              >
                <Icon className="text-muted-foreground" />
                <span>{n.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{n.to}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
