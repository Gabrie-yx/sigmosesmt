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
import { SignedAvatarImg } from "@/components/signed-avatar-img";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const RECENT_EMP_KEY = "cmdk:recent-employees";
const INCLUDE_INACTIVE_KEY = "cmdk:include-inactive";

function pushRecentEmployee(emp: { id: string; nome: string }) {
  try {
    const raw = localStorage.getItem(RECENT_EMP_KEY);
    const arr: { id: string; nome: string }[] = raw ? JSON.parse(raw) : [];
    const filtered = arr.filter((e) => e.id !== emp.id);
    const next = [{ id: emp.id, nome: emp.nome }, ...filtered].slice(0, 5);
    localStorage.setItem(RECENT_EMP_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

function readRecentEmployees(): { id: string; nome: string }[] {
  try {
    const raw = localStorage.getItem(RECENT_EMP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

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
  { to: "/app/sesmt/templates-documentos", label: "Templates FOR-SEG — Upload", group: "Navegar", icon: FileText },
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
  { to: "/app/estoque", label: "Estoque de EPIs", group: "Navegar", icon: Boxes },
];

const QUICK_ACTIONS: NavItem[] = [
  { to: "/app/sesmt/templates-documentos", label: "Upload de Template FOR-SEG", group: "Ações", icon: Plus },
  { to: "/app/aprs", label: "Nova APR", group: "Ações", icon: Plus },
  { to: "/app/sesmt/requisicoes", label: "Nova Requisição de Compra", group: "Ações", icon: Plus },
  { to: "/app/employees", label: "Novo Funcionário", group: "Ações", icon: Plus },
  { to: "/app/dds", label: "Novo DDS", group: "Ações", icon: Plus },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(INCLUDE_INACTIVE_KEY) === "1";
  });
  const [recentIds, setRecentIds] = useState<{ id: string; nome: string }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cmdk:open", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cmdk:open", onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) setRecentIds(readRecentEmployees());
  }, [open]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(INCLUDE_INACTIVE_KEY, includeInactive ? "1" : "0");
    }
  }, [includeInactive]);

  const { data: employees = [] } = useQuery({
    queryKey: ["cmdk-employees", includeInactive],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("employees")
        .select("id, nome, status, matricula, cpf, foto_url, company_id, companies(name), roles(name)")
        .order("nome")
        .limit(800);
      if (!includeInactive) q = q.neq("status", "DESLIGADO");
      const { data } = await q;
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

  const goEmployee = (e: { id: string; nome: string }) => {
    pushRecentEmployee(e);
    go("/app/employees/$id", { id: e.id });
  };

  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const filteredEmployees = useMemo(() => {
    if (!q) {
      // Sem busca: mostra recentes primeiro
      if (recentIds.length > 0) {
        const map = new Map(employees.map((e: any) => [e.id, e]));
        const recentes = recentIds.map((r) => map.get(r.id)).filter(Boolean);
        const outros = employees.filter((e: any) => !recentIds.some((r) => r.id === e.id));
        return [...recentes, ...outros].slice(0, 8);
      }
      return employees.slice(0, 8);
    }
    return employees
      .filter((e: any) => {
        const empresa = (e.companies?.name ?? "").toLowerCase();
        const cargo = (e.roles?.name ?? "").toLowerCase();
        const haystack = `${e.nome ?? ""} ${cargo} ${e.matricula ?? ""} ${empresa}`.toLowerCase();
        if (haystack.includes(q)) return true;
        if (qDigits.length >= 3) {
          const cpfDigits = String(e.cpf ?? "").replace(/\D/g, "");
          if (cpfDigits.includes(qDigits)) return true;
          const matDigits = String(e.matricula ?? "").replace(/\D/g, "");
          if (matDigits.includes(qDigits)) return true;
        }
        return false;
      })
      .slice(0, 15);
  }, [employees, q, qDigits, recentIds]);

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
        placeholder="Buscar por nome, matrícula, CPF, empresa, APR, página… (⌘K)"
        value={query}
        onValueChange={setQuery}
      />
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-[11px]">
        <span className="font-black uppercase tracking-widest text-muted-foreground">
          Funcionários {includeInactive ? "· todos" : "· só ativos"}
        </span>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-muted-foreground">Incluir desligados</span>
          <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
        </label>
      </div>
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {filteredEmployees.length > 0 && (
          <CommandGroup heading={!q && recentIds.length > 0 ? "Funcionários — Recentes primeiro" : "Funcionários"}>
            {filteredEmployees.map((e: any) => (
              <CommandItem
                key={`emp-${e.id}`}
                value={`funcionario ${e.nome} ${e.roles?.name ?? ""} ${e.matricula ?? ""} ${e.companies?.name ?? ""}`}
                onSelect={() => goEmployee({ id: e.id, nome: e.nome })}
              >
                <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden border border-border/60 bg-muted flex items-center justify-center">
                  {e.foto_url ? (
                    <SignedAvatarImg src={e.foto_url} alt={e.nome} className="h-full w-full object-cover" />
                  ) : (
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium truncate">{e.nome}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {e.roles?.name ?? "—"}
                    {e.matricula ? ` · Mat. ${e.matricula}` : ""}
                    {e.companies?.name ? ` · ${e.companies.name}` : ""}
                  </span>
                </div>
                {e.status && e.status !== "ATIVO" && (
                  <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    {e.status}
                  </span>
                )}
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
