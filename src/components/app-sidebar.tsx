import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNovasDecisoesCompras } from "@/hooks/use-compras-novas-decisoes";
import { useMinhasRcsDecididas } from "@/hooks/use-minhas-rcs-decididas";
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
  Stethoscope,
  ShieldAlert,
  Wind,
  Target,
  Settings,
  Warehouse,
  DoorOpen,
  Clock,
  Scale,
  CalendarClock,
  Library,
  Sparkles,
  Syringe,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type LeafItem = { to: string; label: string; icon?: typeof CalendarCheck2; children?: LeafItem[] };
type LockedItem = { key: string; label: string; icon?: typeof CalendarCheck2 };

function ChildrenCollapsible({
  parentTo,
  items,
  isActive,
}: {
  parentTo: string;
  items: LeafItem[];
  isActive: (p: string) => boolean;
}) {
  const hasActiveChild = items.some((c) => isActive(c.to)) || isActive(parentTo);
  const [open, setOpen] = useState(hasActiveChild);
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="ml-auto mr-1 -mt-7 h-5 w-5 inline-flex items-center justify-center rounded hover:bg-sidebar-accent text-sidebar-foreground/60 relative z-10"
          aria-label={open ? "Recolher" : "Expandir"}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:hidden">
        <SidebarMenuSub>
          {items.map((c) => {
            const CIcon = c.icon ?? ShieldCheck;
            return (
              <SidebarMenuSubItem key={c.to}>
                <SidebarMenuSubButton asChild isActive={isActive(c.to)}>
                  <Link to={c.to} className="flex items-center gap-2">
                    <CIcon className="h-4 w-4" />
                    <span>{c.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

const SESMT_GROUPS: { title: string; items: LeafItem[] }[] = [
  {
    title: "Visão Geral",
    items: [
      { to: "/app/painel", label: "Dashboard SESMT", icon: BarChart3 },
      { to: "/app/sesmt/organograma", label: "Organograma Vivo", icon: Building2 },
    ],
  },
  {
    title: "Planejar",
    items: [
      { to: "/app/sesmt/procedimentos", label: "Procedimentos / POPs", icon: ClipboardList },
      { to: "/app/matriz-treinamento", label: "Matriz de Treinamento", icon: GraduationCap },
      { to: "/app/pgr", label: "PGR — Programa de Riscos", icon: ShieldCheck },
      { to: "/app/sesmt/docs", label: "Documentos SESMT", icon: FileText },
      { to: "/app/sesmt/templates-documentos", label: "Templates FOR-SEG", icon: FileCheck2 },
      { to: "/app/sesmt/guia-documentos", label: "Guia: Onde encontrar laudos?", icon: BookOpenCheck },
      { to: "/app/controle-documentos", label: "Controle de Documentos", icon: FolderOpen },
      { to: "/app/cal/planos", label: "Planos de Ação (CAL)", icon: Scale },
      { to: "/app/cal", label: "Requisitos Legais (CAL)", icon: Scale },
      { to: "/app/extintores", label: "Controle de Extintores", icon: Flame },
      { to: "/app/sesmt/requisicoes", label: "Requisições de Compra", icon: ShoppingCart },
      { to: "/app/assinador", label: "Assinador de PDFs", icon: FileSignature },
    ],
  },
  {
    title: "Catálogos",
    items: [
      {
        to: "/app/sesmt/catalogos",
        label: "Hub de Catálogos SST",
        icon: Library,
        children: [
          { to: "/app/sesmt/catalogos", label: "Visão Geral (Hub)", icon: Library },
          { to: "/app/sesmt/catalogos/cruzamentos", label: "Cruzamentos Inteligentes", icon: Sparkles },
          { to: "/app/sesmt/catalogos/riscos", label: "Riscos Ocupacionais", icon: ShieldAlert },
          { to: "/app/sesmt/catalogos/nrs", label: "Normas Regulamentadoras", icon: BookOpenCheck },
          { to: "/app/sesmt/catalogos/exames", label: "Exames (eSocial)", icon: Stethoscope },
          { to: "/app/sesmt/catalogos/gases", label: "Gases Atmosféricos (NR-33)", icon: Wind },
          { to: "/app/sesmt/catalogos/vacinas", label: "Vacinas Ocupacionais", icon: Syringe },
          { to: "/app/sesmt/catalogos/epis", label: "EPIs (CA)", icon: HardHat },
        ],
      },
      { to: "/app/sesmt/prestadores", label: "Prestadores de Saúde", icon: Stethoscope },
      { to: "/app/sesmt/agenda", label: "Agenda Inteligente", icon: CalendarCheck2 },
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
      { to: "/app/sesmt/integracoes", label: "Integrações NR-01", icon: GraduationCap },
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
      { to: "/app/employees/relatorio-admissoes", label: "Relatório de Admissões", icon: UsersIcon },
      { to: "/app/cascos", label: "Cascos / Embarcações", icon: Anchor },
      { to: "/app/companies", label: "Empresas / Contratadas", icon: Building2 },
      { to: "/app/roles", label: "Cargos & Matriz de Riscos", icon: ShieldCheck },
      { to: "/app/matriz-riscos", label: "Matriz de Riscos (PGR/LTCAT)", icon: ShieldCheck },
    ],
  },
];

const DDS_SUBMENU: LeafItem[] = [
  { to: "/app/dds", label: "DDS" },
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
  { to: "/app/producao/fatores-consumo", label: "Fatores de Consumo" },
  { to: "/app/producao/expedicao", label: "Expedição" },
  { to: "/app/producao/requisicao-compras", label: "Requisição de Compras", icon: ShoppingCart },
  { to: "/app/modulo/producao/hora-extra", label: "Hora Extra", icon: CalendarCheck2 },
];

const COMPRAS_ITEMS: LeafItem[] = [
  { to: "/app/compras/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/app/compras/requisicoes-recebidas", label: "RC Recebidas", icon: ShoppingCart },
  { to: "/app/compras/fornecedores", label: "Fornecedores", icon: UsersIcon },
  { to: "/app/modulo/compras/hora-extra", label: "Hora Extra", icon: CalendarCheck2 },
];

const ADMINISTRATIVO_ITEMS: LeafItem[] = [
  { to: "/app/administrativo/requisicoes-recebidas", label: "Requisições Recebidas", icon: ClipboardList },
  { to: "/app/administrativo/hora-extra-recebida", label: "H. Extra Recebida", icon: CalendarCheck2 },
  { to: "/app/administrativo/gestao-ponto", label: "Gestão de Ponto", icon: Clock },
];

const ALMOXARIFADO_ITEMS: LeafItem[] = [
  { to: "/app/almoxarifado/requisicao-compras", label: "Requisição de Compras", icon: ShoppingCart },
  { to: "/app/modulo/almoxarifado/hora-extra", label: "Hora Extra", icon: CalendarCheck2 },
];

const MANUTENCAO_ITEMS: LeafItem[] = [
  { to: "/app/modulo/eletrica/requisicao-compras", label: "Elétrica — Requisição de Compras", icon: ShoppingCart },
  { to: "/app/modulo/eletrica/hora-extra", label: "Elétrica — Hora Extra", icon: Zap },
  { to: "/app/modulo/mecanica/hora-extra", label: "Mecânica — Hora Extra", icon: Hammer },
  { to: "/app/modulo/mecanica/requisicao-compras", label: "Mecânica — Requisição de Compras", icon: ShoppingCart },
];

const PORTARIA_ITEMS: LeafItem[] = [
  { to: "/app/portaria/controle-entrada", label: "Controle de Entrada", icon: DoorOpen },
  { to: "/app/portaria/controle", label: "Painel SESMT", icon: BarChart3 },
];

export function AppSidebar() {
  const location = useLocation();
  const { roles, hasModule, hasMenu, isExtraSabadoMarcador } = useAuth();
  const { state, setOpen, isMobile, openMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  // Fecha o drawer mobile automaticamente ao navegar
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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
  const isModerator = isAdmin || roles.includes("moderador");
  const esconderHoraExtraDuplicada = isExtraSabadoMarcador && !isAdmin;
  const semHoraExtraDuplicada = (item: LeafItem) =>
    !esconderHoraExtraDuplicada || !item.to.includes("/hora-extra");
  const canSesmt = isAdmin || hasModule("sesmt");
  const canEstoque = isAdmin || hasModule("estoque");
  const canProducao = isAdmin || hasModule("producao");
  const canCompras = isAdmin || hasModule("compras") || roles.includes("compras");
  const canUsuarios = isAdmin || hasModule("usuarios");
  const canAdministrativo = isAdmin || hasModule("administrativo" as any);
  const canAlmoxarifado = isAdmin || hasModule("almoxarifado" as any);
  const canPortaria = isAdmin || hasModule("portaria" as any);

  // Filtra grupos/itens pelo controle granular de menus
  const visibleSesmtGroups = SESMT_GROUPS
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => hasMenu(i.to))
        .map((i) => ({
          ...i,
          children: i.children?.filter((c) => hasMenu(c.to)),
        })),
    }))
    .filter((g) => g.items.length > 0);
  const visibleDDSSubmenu = DDS_SUBMENU.filter((i) => hasMenu(i.to) || i.to.startsWith("/app/dds"));
  const visibleEstoque = ESTOQUE_ITEMS.filter((i) => hasMenu(i.to));
  const visibleProducao = PRODUCAO_SUBMENU.filter((i) => hasMenu(i.to) && semHoraExtraDuplicada(i));
  const visibleCompras = COMPRAS_ITEMS.filter((i) => hasMenu(i.to) && semHoraExtraDuplicada(i));
  const visibleAdministrativo = ADMINISTRATIVO_ITEMS.filter((i) => hasMenu(i.to));
  const visibleAlmoxarifado = ALMOXARIFADO_ITEMS.filter((i) => hasMenu(i.to) && semHoraExtraDuplicada(i));
  const visibleManutencao = MANUTENCAO_ITEMS.filter((i) => hasMenu(i.to) && semHoraExtraDuplicada(i));
  const visiblePortaria = PORTARIA_ITEMS.filter((i) => hasMenu(i.to));

  // Todos os grupos iniciam RECOLHIDOS e abrem apenas ao passar o mouse
  // (ou clique no cabeçalho). Ao sair, fecham automaticamente.
  const sesmtHover = useHoverOpen();
  const estoqueHover = useHoverOpen();
  const producaoHover = useHoverOpen();
  const comprasHover = useHoverOpen();
  const administrativoHover = useHoverOpen();
  const almoxarifadoHover = useHoverOpen();
  const manutencaoHover = useHoverOpen();
  const portariaHover = useHoverOpen();

  // No mobile o drawer deve voltar sempre com os módulos recolhidos.
  useEffect(() => {
    if (!isMobile || openMobile) return;
    sesmtHover.setOpen(false);
    estoqueHover.setOpen(false);
    producaoHover.setOpen(false);
    comprasHover.setOpen(false);
    administrativoHover.setOpen(false);
    almoxarifadoHover.setOpen(false);
    manutencaoHover.setOpen(false);
    portariaHover.setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, openMobile]);

  // Conteúdo dos módulos SEMPRE fica dentro do CollapsibleContent.
  // Antes, quando a sidebar estava "collapsed", os filhos eram renderizados
  // direto e por isso todos os menus ficavam aparecendo no drawer/tablet.
  const Body = ({ children }: { children: React.ReactNode }) => (
    <CollapsibleContent className="data-[state=closed]:hidden">
      {children}
    </CollapsibleContent>
  );

  return (
    <Sidebar
      collapsible="icon"
      overlay
      className="border-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarContent className="scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* HOJE — visível apenas para admin/moderador */}
        {isModerator && (
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
        )}

        {/* HORA EXTRA — atalho pinado pra qualquer marcador/líder,
            independente de módulo. Garante um ponto de entrada visível
            no mobile (drawer) e no desktop. */}
        {isExtraSabadoMarcador && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/app/modulo/terceirizadas/hora-extra")}
                    tooltip="Convocar Hora Extra"
                    className="data-[active=true]:bg-amber-100 data-[active=true]:text-red-900 font-bold"
                  >
                    <Link
                      to="/app/modulo/$modulo/hora-extra"
                      params={{ modulo: "terceirizadas" }}
                    >
                      <CalendarClock />
                      <span>Hora Extra</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* SESMT */}
        {canSesmt && visibleSesmtGroups.length > 0 && (
          <Collapsible open={sesmtHover.open} onOpenChange={sesmtHover.setOpen} className="group/sesmt">
            <SidebarGroup {...sesmtHover.bind}>
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
                                  {item.to === "/app/sesmt/requisicoes" && (
                                    <MinhasRcsBadge />
                                  )}
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
                              {item.children && item.children.length > 0 && (
                                <ChildrenCollapsible
                                  parentTo={item.to}
                                  items={item.children}
                                  isActive={isActive}
                                />
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
          <Collapsible open={estoqueHover.open} onOpenChange={estoqueHover.setOpen} className="group/estoque">
            <SidebarGroup {...estoqueHover.bind}>
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
          <Collapsible open={producaoHover.open} onOpenChange={producaoHover.setOpen} className="group/producao">
            <SidebarGroup {...producaoHover.bind}>
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

        {/* COMPRAS */}
        {canCompras && visibleCompras.length > 0 && (
          <Collapsible open={comprasHover.open} onOpenChange={comprasHover.setOpen} className="group/compras">
            <SidebarGroup {...comprasHover.bind}>
              <SidebarGroupLabel asChild className="h-9 text-sm font-bold text-slate-700">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-red-700" /> Compras
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/compras:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Body>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleCompras.map((s) => {
                      const Icon = s.icon ?? ShoppingCart;
                      return (
                        <SidebarMenuItem key={s.to}>
                          <SidebarMenuButton asChild isActive={isActive(s.to)} tooltip={s.label}>
                            <Link to={s.to}>
                              <Icon />
                              <span className="flex-1">{s.label}</span>
                              {s.to === "/app/compras/requisicoes-recebidas" && (
                                <ComprasNovasBadge />
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </Body>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* ADMINISTRATIVO */}
        {canAdministrativo && visibleAdministrativo.length > 0 && (
          <Collapsible open={administrativoHover.open} onOpenChange={administrativoHover.setOpen} className="group/administrativo">
            <SidebarGroup {...administrativoHover.bind}>
              <SidebarGroupLabel asChild className="h-9 text-sm font-bold text-slate-700">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-red-700" /> Administrativo
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/administrativo:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Body>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleAdministrativo.map((s) => {
                      const Icon = s.icon ?? Briefcase;
                      return (
                        <SidebarMenuItem key={s.to}>
                          <SidebarMenuButton asChild isActive={isActive(s.to)} tooltip={s.label}>
                            <Link to={s.to}>
                              <Icon />
                              <span>{s.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </Body>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* MANUTENÇÃO (locked) */}
        {canAlmoxarifado && visibleAlmoxarifado.length > 0 && (
          <Collapsible open={almoxarifadoHover.open} onOpenChange={almoxarifadoHover.setOpen} className="group/almoxarifado">
            <SidebarGroup {...almoxarifadoHover.bind}>
              <SidebarGroupLabel asChild className="h-9 text-sm font-bold text-slate-700">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5 text-red-700" /> Almoxarifado
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/almoxarifado:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Body>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleAlmoxarifado.map((s) => {
                      const Icon = s.icon ?? Warehouse;
                      return (
                        <SidebarMenuItem key={s.to}>
                          <SidebarMenuButton asChild isActive={isActive(s.to)} tooltip={s.label}>
                            <Link to={s.to}>
                              <Icon />
                              <span>{s.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </Body>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* MANUTENÇÃO (agrupa Elétrica + Mecânica) */}
        {visibleManutencao.length > 0 && (
          <Collapsible open={manutencaoHover.open} onOpenChange={manutencaoHover.setOpen} className="group/manutencao">
            <SidebarGroup {...manutencaoHover.bind}>
              <SidebarGroupLabel asChild className="h-9 text-sm font-bold text-slate-700">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-red-700" /> Manutenção
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/manutencao:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Body>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleManutencao.map((s) => {
                      const Icon = s.icon ?? Wrench;
                      return (
                        <SidebarMenuItem key={s.to}>
                          <SidebarMenuButton asChild isActive={isActive(s.to)} tooltip={s.label}>
                            <Link to={s.to}>
                              <Icon />
                              <span>{s.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </Body>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* PORTARIA */}
        {canPortaria && visiblePortaria.length > 0 && (
          <Collapsible open={portariaHover.open} onOpenChange={portariaHover.setOpen} className="group/portaria">
            <SidebarGroup {...portariaHover.bind}>
              <SidebarGroupLabel asChild className="h-9 text-sm font-bold text-slate-700">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DoorOpen className="h-5 w-5 text-red-700" /> Portaria
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/portaria:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Body>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visiblePortaria.map((s) => {
                      const Icon = s.icon ?? DoorOpen;
                      return (
                        <SidebarMenuItem key={s.to}>
                          <SidebarMenuButton asChild isActive={isActive(s.to)} tooltip={s.label}>
                            <Link to={s.to}>
                              <Icon />
                              <span>{s.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </Body>
            </SidebarGroup>
          </Collapsible>
        )}

      </SidebarContent>

      {/* CONFIGURAÇÕES (hover no rodapé) — só aparece se há pelo menos 1 item acessível */}
      {(() => {
        const showUsers = isAdmin || canUsuarios;
        const showAudit = hasMenu("/app/audit");
        const showIndic = hasMenu("/app/configuracoes-indicadores");
        const showExtra = hasMenu("/app/extra-sabado-aprovacoes");
        const showMarc  = hasMenu("/app/administrativo/marcadores-hora-extra");
        const anyConfig = showUsers || showAudit || showIndic || showExtra || showMarc;
        if (!anyConfig) return null;
        return (
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <HoverCard openDelay={80} closeDelay={150}>
              <HoverCardTrigger asChild>
                <SidebarMenuButton
                  tooltip="Configurações"
                  isActive={
                    isActive("/app/users") ||
                    isActive("/app/audit") ||
                    isActive("/app/configuracoes-indicadores") ||
                    isActive("/app/extra-sabado-aprovacoes") ||
                    isActive("/app/administrativo/marcadores-hora-extra")
                  }
                  className="font-bold"
                >
                  <Settings className="text-red-700" />
                  <span>Configurações</span>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </HoverCardTrigger>
              <HoverCardContent
                side="right"
                align="end"
                sideOffset={8}
                className="w-60 p-2"
              >
                <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Configurações
                </div>
                <nav className="flex flex-col gap-0.5">
                  {showUsers && (
                    <Link
                      to="/app/users"
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted data-[active=true]:bg-amber-100 data-[active=true]:text-red-900"
                      data-active={isActive("/app/users") || undefined}
                    >
                      <UsersIcon className="h-4 w-4 text-red-700" />
                      <span>Usuários</span>
                    </Link>
                  )}
                  {showAudit && (
                    <Link
                      to="/app/audit"
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted data-[active=true]:bg-amber-100 data-[active=true]:text-red-900"
                      data-active={isActive("/app/audit") || undefined}
                    >
                      <History className="h-4 w-4 text-red-700" />
                      <span>Log de Auditoria</span>
                    </Link>
                  )}
                  {showIndic && (
                    <Link
                      to="/app/configuracoes-indicadores"
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted data-[active=true]:bg-amber-100 data-[active=true]:text-red-900"
                      data-active={isActive("/app/configuracoes-indicadores") || undefined}
                    >
                      <Target className="h-4 w-4 text-red-700" />
                      <span>Metas dos Indicadores</span>
                    </Link>
                  )}
                  {showExtra && (
                    <Link
                      to="/app/extra-sabado-aprovacoes"
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted data-[active=true]:bg-amber-100 data-[active=true]:text-red-900"
                      data-active={isActive("/app/extra-sabado-aprovacoes") || undefined}
                    >
                      <CalendarCheck2 className="h-4 w-4 text-red-700" />
                      <span>Aprovações — Extra (Sáb/Dia Útil)</span>
                    </Link>
                  )}
                  {showMarc && (
                    <Link
                      to="/app/administrativo/marcadores-hora-extra"
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted data-[active=true]:bg-amber-100 data-[active=true]:text-red-900"
                      data-active={isActive("/app/administrativo/marcadores-hora-extra") || undefined}
                    >
                      <UsersIcon className="h-4 w-4 text-red-700" />
                      <span>Marcadores H. Extra — Escopo</span>
                    </Link>
                  )}
                </nav>
              </HoverCardContent>
            </HoverCard>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
        );
      })()}
    </Sidebar>
  );
}

function ComprasNovasBadge() {
  const { count } = useNovasDecisoesCompras();
  if (!count) return null;
  return (
    <span
      className="ml-auto inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white shadow-sm"
      title={`${count} decisão(ões) nova(s) do supervisor`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MinhasRcsBadge() {
  const { count } = useMinhasRcsDecididas();
  if (!count) return null;
  return (
    <span
      className="ml-auto inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-sm"
      title={`${count} atualização(ões) nas suas requisições`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function useHoverOpen() {
  const [open, setOpen] = useState(false);
  // Comportamento: grupo abre/fecha SOMENTE via clique no cabeçalho.
  // O hover atua apenas no drawer (abre/recolhe a sidebar inteira),
  // preservando o estado expandido/recolhido de cada módulo.
  const bind = {};
  return { open, setOpen, bind };
}