import { Link, useLocation } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  CalendarCheck2,
  ShieldCheck,
  Boxes,
  Factory,
  Wrench,
  Zap,
  DoorOpen,
  Lock,
  Users as UsersIcon,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  FileText,
  ShoppingCart,
  MessagesSquare,
  AlertTriangle,
  FileCheck2,
  HardHat,
  Recycle,
  History,
  AlertOctagon,
  Hammer,
  Building2,
  Briefcase,
  Anchor,
  ListChecks,
  BarChart3,
  FolderOpen,
  Flame,
  BookOpenCheck,
  FileSignature,
  ShieldAlert,
  Wind,
  Target,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type LeafItem = { to: string; label: string; icon?: typeof CalendarCheck2 };
type LockedItem = { key: string; label: string; icon?: typeof CalendarCheck2 };

const SESMT_GROUPS: { title: string; items: LeafItem[] }[] = [
  {
    title: "Visão Geral",
    items: [
      { to: "/app/painel", label: "Dashboard SESMT", icon: BarChart3 },
    ],
  },
  {
    title: "Planejar",
    items: [
      { to: "/app/sesmt/procedimentos", label: "Procedimentos / POPs", icon: ClipboardList },
      { to: "/app/matriz-treinamento", label: "Matriz de Treinamento", icon: GraduationCap },
      { to: "/app/pgr", label: "PGR — Programa de Riscos", icon: ShieldCheck },
      { to: "/app/sesmt/docs", label: "Documentos SESMT", icon: FileText },
      { to: "/app/sesmt/guia-documentos", label: "Guia: Onde encontrar laudos?", icon: BookOpenCheck },
      { to: "/app/controle-documentos", label: "Controle de Documentos", icon: FolderOpen },
      { to: "/app/extintores", label: "Controle de Extintores", icon: Flame },
      { to: "/app/sesmt/requisicoes", label: "Requisições de Compra", icon: ShoppingCart },
      { to: "/app/assinador", label: "Assinador de PDFs", icon: FileSignature },
    ],
  },
  {
    title: "Catálogos",
    items: [
      { to: "/app/sesmt/catalogos/gases", label: "Gases Atmosféricos (NR-33)", icon: Wind },
    ],
  },
  {
    title: "Executar",
    items: [
      { to: "/app/dds", label: "DDS — Diálogo de Segurança", icon: MessagesSquare },
      { to: "/app/aprs", label: "APRs — Análise de Risco", icon: AlertTriangle },
      { to: "/app/ptes", label: "Permissões de Trabalho", icon: FileCheck2 },
      { to: "/app/oss", label: "OSS — Ordens de Serviço (NR-01)", icon: FileSignature },
      { to: "/app/trainings", label: "Treinamentos & NRs", icon: HardHat },
      { to: "/app/sesmt/equipamentos-moveis", label: "Checklist de Equipamentos", icon: Wrench },
    ],
  },
  {
    title: "Verificar",
    items: [
      { to: "/app/sesmt/terceiros", label: "Painel de Terceiros", icon: Briefcase },
      { to: "/app/relatorios/reincidencia-epi", label: "Reincidência de EPI", icon: Recycle },
    ],
  },
  {
    title: "Agir",
    items: [
      { to: "/app/ncs", label: "Não Conformidades", icon: AlertOctagon },
      { to: "/app/incidentes", label: "Incidentes / Investigação", icon: AlertTriangle },
      { to: "/app/acidentes", label: "Acidentes de Trabalho", icon: ShieldAlert },
      { to: "/app/acoes", label: "Plano de Ações (5W2H)", icon: ListChecks },
    ],
  },
  {
    title: "Pessoas & Cadastros",
    items: [
      { to: "/app/employees", label: "Funcionários", icon: UsersIcon },
      { to: "/app/cascos", label: "Cascos / Embarcações", icon: Anchor },
      { to: "/app/companies", label: "Empresas / Contratadas", icon: Building2 },
      { to: "/app/roles", label: "Cargos & Matriz de Riscos", icon: ShieldCheck },
      { to: "/app/matriz-riscos", label: "Matriz de Riscos (PGR/LTCAT)", icon: ShieldCheck },
    ],
  },
];

const DDS_SUBMENU: LeafItem[] = [
  { to: "/app/dds", label: "DDS" },
  { to: "/app/dds/historico", label: "Histórico Mensal" },
  { to: "/app/dds/painel", label: "Painel de Qualidade" },
];

const ESTOQUE_ITEMS: LeafItem[] = [
  { to: "/app/estoque", label: "Estoque de EPIs" },
];
const ESTOQUE_LOCKED: LockedItem[] = [
  { key: "estoque-eletrica", label: "Elétrica" },
  { key: "estoque-mecanica", label: "Mecânica" },
];

const PRODUCAO_SUBMENU: LeafItem[] = [
  { to: "/app/producao/painel-lista-tecnica", label: "Dashboard Dinâmico" },
  { to: "/app/producao/criar-ordem", label: "Criar Nova Ordem" },
  { to: "/app/producao/ordens", label: "Ordens de Produção" },
  { to: "/app/producao/base-materia-prima", label: "Base Matéria-Prima" },
  { to: "/app/producao/tipos-produto", label: "Tipos de Produto" },
  { to: "/app/producao/lista-tecnica", label: "Lista Técnica" },
  { to: "/app/producao/expedicao", label: "Expedição" },
];

const MANUTENCAO_LOCKED: LockedItem[] = [
  { key: "manut-eletrica", label: "Elétrica", icon: Zap },
  { key: "manut-mecanica", label: "Mecânica", icon: Hammer },
];

export function AppSidebar() {
  const location = useLocation();
  const { roles, hasModule, hasMenu } = useAuth();
  const { state, setOpen, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const hoverTimer = (typeof window !== "undefined") ? (window as any) : null;
  const handleMouseEnter = () => {
    if (isMobile) return;
    if ((globalThis as any).__sbLeaveTimer) {
      clearTimeout((globalThis as any).__sbLeaveTimer);
      (globalThis as any).__sbLeaveTimer = null;
    }
    setOpen(true);
  };
  const handleMouseLeave = () => {
    if (isMobile) return;
    (globalThis as any).__sbLeaveTimer = setTimeout(() => setOpen(false), 200);
  };

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/");
  const anyActive = (items: LeafItem[]) => items.some((i) => isActive(i.to));

  const isAdmin = roles.includes("admin");
  const canSesmt = isAdmin || hasModule("sesmt");
  const canEstoque = isAdmin || hasModule("estoque");
  const canProducao = isAdmin || hasModule("producao");
  const canUsuarios = isAdmin || hasModule("usuarios");

  // Filtra grupos/itens pelo controle granular de menus
  const visibleSesmtGroups = SESMT_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => hasMenu(i.to)) }))
    .filter((g) => g.items.length > 0);
  const visibleDDSSubmenu = DDS_SUBMENU.filter((i) => hasMenu(i.to) || i.to.startsWith("/app/dds"));
  const visibleEstoque = ESTOQUE_ITEMS.filter((i) => hasMenu(i.to));
  const visibleProducao = PRODUCAO_SUBMENU.filter((i) => hasMenu(i.to));

  const sesmtAllItems = visibleSesmtGroups.flatMap((g) => g.items).concat(visibleDDSSubmenu);
  const sesmtOpen = anyActive(sesmtAllItems);
  const estoqueOpen = anyActive(visibleEstoque);
  const producaoOpen = anyActive(visibleProducao);

  // Quando a sidebar está colapsada (icon mode), o label clicável some, então
  // forçamos o conteúdo a aparecer sempre — assim os ícones de cada item ficam
  // visíveis e acessíveis. No modo expandido, mantém o Collapsible normal.
  const Body = ({ children }: { children: React.ReactNode }) =>
    collapsed ? <>{children}</> : <CollapsibleContent>{children}</CollapsibleContent>;

  return (
    <Sidebar
      collapsible="icon"
      overlay
      className="border-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarContent className="scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* HOJE */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/app/hoje")}
                  tooltip="O que fazer hoje"
                  className="data-[active=true]:bg-amber-100 data-[active=true]:text-red-900 font-bold"
                >
                  <Link to="/app/hoje">
                    <CalendarCheck2 />
                    <span>Hoje</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SESMT */}
        {canSesmt && visibleSesmtGroups.length > 0 && (
          <Collapsible defaultOpen={sesmtOpen} className="group/sesmt">
            <SidebarGroup>
              <SidebarGroupLabel asChild className="h-9 text-sm font-bold text-slate-700">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-red-700" /> SESMT
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/sesmt:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Body>
                {visibleSesmtGroups.map((group) => (
                  <SidebarGroup key={group.title} className="py-0">
                    <SidebarGroupLabel className="text-[9px] tracking-widest">
                      {group.title}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => {
                          const Icon = item.icon ?? ShieldCheck;
                          return (
                            <SidebarMenuItem key={item.to}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive(item.to)}
                                tooltip={item.label}
                              >
                                <Link to={item.to}>
                                  <Icon />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuButton>
                              {group.title === "Executar" && item.to === "/app/dds" && (
                                <SidebarMenuSub>
                                  {DDS_SUBMENU.slice(1).map((s) => (
                                    <SidebarMenuSubItem key={s.to}>
                                      <SidebarMenuSubButton asChild isActive={isActive(s.to)}>
                                        <Link to={s.to}>{s.label}</Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              )}
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                ))}
              </Body>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* ESTOQUE */}
        {canEstoque && visibleEstoque.length > 0 && (
          <Collapsible defaultOpen={estoqueOpen} className="group/estoque">
            <SidebarGroup>
              <SidebarGroupLabel asChild className="h-9 text-sm font-bold text-slate-700">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-red-700" /> Estoque
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/estoque:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Body>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleEstoque.map((s) => (
                      <SidebarMenuItem key={s.to}>
                        <SidebarMenuButton asChild isActive={isActive(s.to)} tooltip={`Estoque · ${s.label}`}>
                          <Link to={s.to}>
                            <Boxes />
                            <span>{s.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                    {ESTOQUE_LOCKED.map((s) => (
                      <SidebarMenuItem key={s.key}>
                        <SidebarMenuButton
                          tooltip={`Estoque · ${s.label} (em desenvolvimento)`}
                          onClick={() => toast.info(`Estoque · ${s.label}: módulo em desenvolvimento`)}
                          className="opacity-60"
                        >
                          <Boxes />
                          <span>{s.label}</span>
                          <Lock className="ml-auto h-3 w-3" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </Body>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* PRODUÇÃO */}
        {canProducao && visibleProducao.length > 0 && (
          <Collapsible defaultOpen={producaoOpen} className="group/producao">
            <SidebarGroup>
              <SidebarGroupLabel asChild className="h-9 text-sm font-bold text-slate-700">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Factory className="h-5 w-5 text-red-700" /> Produção
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/producao:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Body>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleProducao.map((s) => (
                      <SidebarMenuItem key={s.to}>
                        <SidebarMenuButton asChild isActive={isActive(s.to)} tooltip={s.label}>
                          <Link to={s.to}>
                            <Factory />
                            <span>{s.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </Body>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* MANUTENÇÃO (locked) */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 h-9 text-sm font-bold text-slate-700">
            <Wrench className="h-5 w-5 text-red-700" /> Manutenção
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MANUTENCAO_LOCKED.map((s) => {
                const Icon = s.icon ?? Wrench;
                return (
                  <SidebarMenuItem key={s.key}>
                    <SidebarMenuButton
                      tooltip={`Manutenção · ${s.label} (em desenvolvimento)`}
                      onClick={() => toast.info(`Manutenção · ${s.label}: módulo em desenvolvimento`)}
                      className="opacity-60"
                    >
                      <Icon />
                      <span>{s.label}</span>
                      <Lock className="ml-auto h-3 w-3" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* PORTARIA (locked) */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Portaria (em desenvolvimento)"
                  onClick={() => toast.info("Portaria: módulo em desenvolvimento")}
                  className="opacity-60"
                >
                  <DoorOpen />
                  <span>Portaria</span>
                  <Lock className="ml-auto h-3 w-3" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* USUÁRIOS no rodapé */}
      {(isAdmin || canUsuarios) && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/app/users")} tooltip="Usuários">
                <Link to="/app/users">
                  <UsersIcon />
                  <span>Usuários</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}