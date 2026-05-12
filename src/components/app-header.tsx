import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Download,
  Upload,
  Menu,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Boxes,
  Factory,
  Zap,
  Wrench,
  DoorOpen,
  Lock,
  Users as UsersIcon,
} from "lucide-react";
import { exportBackup, importBackup } from "@/lib/backup";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import dmnLogo from "@/assets/dmn-logo.png";

const SESMT_ITEMS = [
  { to: "/app/painel", label: "Painel SESMT" },
  { to: "/app/companies", label: "Empresas" },
  { to: "/app/roles", label: "Cargos / Riscos" },
  { to: "/app/employees", label: "Colaboradores" },
  { to: "/app/trainings", label: "Treinamentos" },
  { to: "/app/cascos", label: "Cascos / Embarcações" },
  { to: "/app/ptes", label: "Emitir PTE" },
  { to: "/app/aprs", label: "Emitir APR" },
  { to: "/app/relatorios/reincidencia-epi", label: "Reincidência EPI" },
] as const;

const DDS_SUBMENU = [
  { to: "/app/dds", label: "DDS" },
  { to: "/app/dds/historico", label: "Histórico Mensal" },
  { to: "/app/dds/painel", label: "Painel de Qualidade" },
] as const;

const DOCUMENTOS_SUBMENU = [
  { to: "/app/sesmt/docs", label: "Documentos SESMT" },
  { to: "/app/sesmt/requisicoes", label: "Requisições de Compra" },
] as const;

const SESMT_PATHS = [
  ...SESMT_ITEMS.map((i) => i.to),
  ...DDS_SUBMENU.map((i) => i.to),
  ...DOCUMENTOS_SUBMENU.map((i) => i.to),
];

const OTHER_MODULES = [
  { key: "portaria", label: "Portaria", icon: DoorOpen },
] as const;

const PRODUCAO_SUBMENU = [
  { to: "/app/producao/ordens", label: "Ordens de Produção" },
] as const;

const MANUTENCAO_SUBMENU = [
  { key: "manut-eletrica", label: "Elétrica", icon: Zap },
  { key: "manut-mecanica", label: "Mecânica", icon: Wrench },
] as const;

const ESTOQUE_SUBMENU = [
  {
    key: "estoque-sesmt",
    label: "SESMT",
    to: "/app/estoque/sesmt" as const,
    children: [
      { key: "estoque-sesmt-epi", label: "EPIs (Cards)", to: "/app/estoque/epi" as const },
    ],
  },
  { key: "estoque-eletrica", label: "Elétrica" },
  { key: "estoque-mecanica", label: "Mecânica" },
] as const;

export function AppHeader() {
  const { user, roles, hasModule } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  async function handleImport(file: File) {
    if (!confirm("Isso vai SOBRESCREVER os dados atuais com o arquivo de backup. Continuar?"))
      return;
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importBackup(json);
      toast.success("Backup importado com sucesso!");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setImporting(false);
    }
  }

  const isActive = (to: string) => location.pathname.startsWith(to);
  const sesmtActive = SESMT_PATHS.some((p) => location.pathname.startsWith(p));
  const isAdmin = roles.includes("admin");
  const canSesmt = isAdmin || hasModule("sesmt");
  const canEstoque = isAdmin || hasModule("estoque");
  const canProducao = isAdmin || hasModule("producao");
  const canUsuarios = isAdmin || hasModule("usuarios");

  const triggerCls = (active: boolean) =>
    `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
      active
        ? "bg-white/15 text-white shadow-md ring-1 ring-white/30"
        : "text-white/85 hover:bg-white/10 hover:text-white"
    }`;
  const disabledCls =
    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap text-white/40 cursor-not-allowed";

  const DesktopNav = () => (
    <>
      {/* SESMT — abre ao passar o mouse */}
      {canSesmt && (<div className="group relative">
        <button type="button" aria-haspopup="true" className={triggerCls(sesmtActive)}>
          <ShieldCheck className="h-4 w-4" /> SESMT
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
        <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="w-60 rounded-lg border border-red-100 bg-white shadow-xl py-1">
            {SESMT_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive(item.to)
                    ? "bg-red-50 text-red-800"
                    : "text-slate-700 hover:bg-red-50 hover:text-red-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="group/sub relative">
              <div
                className={`flex w-full items-center justify-between px-3 py-2 text-sm font-semibold cursor-default transition-colors ${
                  DDS_SUBMENU.some((s) => isActive(s.to))
                    ? "bg-red-50 text-red-800"
                    : "text-slate-700 hover:bg-red-50 hover:text-red-800"
                }`}
              >
                DDS
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </div>
              <div className="invisible absolute left-full top-0 z-50 pl-1 opacity-0 transition-all duration-150 group-hover/sub:visible group-hover/sub:opacity-100 group-focus-within/sub:visible group-focus-within/sub:opacity-100">
                <div className="w-60 rounded-lg border border-red-100 bg-white shadow-xl py-1">
                  {DDS_SUBMENU.map((s) => (
                    <Link
                      key={s.to}
                      to={s.to}
                      className={`block px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive(s.to)
                          ? "bg-red-50 text-red-800"
                          : "text-slate-700 hover:bg-red-50 hover:text-red-800"
                      }`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="group/sub relative">
              <div
                className={`flex w-full items-center justify-between px-3 py-2 text-sm font-semibold cursor-default transition-colors ${
                  DOCUMENTOS_SUBMENU.some((s) => isActive(s.to))
                    ? "bg-red-50 text-red-800"
                    : "text-slate-700 hover:bg-red-50 hover:text-red-800"
                }`}
              >
                Documentos
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </div>
              <div className="invisible absolute left-full top-0 z-50 pl-1 opacity-0 transition-all duration-150 group-hover/sub:visible group-hover/sub:opacity-100 group-focus-within/sub:visible group-focus-within/sub:opacity-100">
                <div className="w-60 rounded-lg border border-red-100 bg-white shadow-xl py-1">
                  {DOCUMENTOS_SUBMENU.map((s) => (
                    <Link
                      key={s.to}
                      to={s.to}
                      className={`block px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive(s.to)
                          ? "bg-red-50 text-red-800"
                          : "text-slate-700 hover:bg-red-50 hover:text-red-800"
                      }`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Outros módulos — placeholder, mostram "em breve" no hover */}
      {/* Estoque — dropdown com submenus */}
      )}
      {canEstoque && (<div className="group relative">
        <button
          type="button"
          aria-haspopup="true"
          onClick={() => navigate({ to: "/app/estoque/sesmt" })}
          className={triggerCls(isActive("/app/estoque"))}
        >
          <Boxes className="h-4 w-4" /> Estoque
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
        <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="w-56 rounded-lg border border-slate-200 bg-white shadow-xl py-1">
            {ESTOQUE_SUBMENU.map((s) => (
              "children" in s && s.children ? (
                <div key={s.key} className="group/sub relative">
                  <Link
                    to={s.to}
                    className={`flex w-full items-center justify-between px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive(s.to)
                        ? "bg-red-50 text-red-800"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {s.label}
                    <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                  </Link>
                  <div className="invisible absolute left-full top-0 z-50 pl-1 opacity-0 transition-all duration-150 group-hover/sub:visible group-hover/sub:opacity-100 group-focus-within/sub:visible group-focus-within/sub:opacity-100">
                    <div className="w-56 rounded-lg border border-slate-200 bg-white shadow-xl py-1">
                      {s.children.map((c) => (
                        <Link
                          key={c.key}
                          to={c.to}
                          className={`block px-3 py-2 text-sm font-semibold transition-colors ${
                            isActive(c.to)
                              ? "bg-red-50 text-red-800"
                              : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : "to" in s && s.to ? (
                <Link
                  key={s.key}
                  to={s.to}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive(s.to)
                      ? "bg-red-50 text-red-800"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {s.label}
                </Link>
              ) : (
                <button
                  key={s.key}
                  onClick={() => toast.info(`Estoque · ${s.label}: módulo em desenvolvimento`)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  {s.label}
                  <Lock className="h-3 w-3 opacity-60" />
                </button>
              )
            ))}
          </div>
        </div>
      </div>

      {OTHER_MODULES.map((m) => (
        <div key={m.key} className="group relative">
          <button
            type="button"
            onClick={() => toast.info(`${m.label}: módulo em desenvolvimento`)}
            className={disabledCls}
          >
            <m.icon className="h-4 w-4" /> {m.label}
            <Lock className="h-3 w-3 opacity-60" />
          </button>
          <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="w-56 rounded-lg border border-slate-200 bg-white shadow-xl py-2 px-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {m.label}
              </div>
              <div className="text-xs text-slate-600 mt-1">Módulo em desenvolvimento.</div>
            </div>
          </div>
        </div>
      ))}
      {/* Manutenção — dropdown agrupando Elétrica e Mecânica */}
      <div className="group relative">
        <button type="button" aria-haspopup="true" className={disabledCls}>
          <Wrench className="h-4 w-4" /> Manutenção
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
        <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="w-56 rounded-lg border border-slate-200 bg-white shadow-xl py-1">
            {MANUTENCAO_SUBMENU.map((s) => (
              <button
                key={s.key}
                onClick={() => toast.info(`Manutenção · ${s.label}: módulo em desenvolvimento`)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                <span className="flex items-center gap-2">
                  <s.icon className="h-4 w-4" /> {s.label}
                </span>
                <Lock className="h-3 w-3 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Produção — dropdown ativo */}
      {canProducao && (<div className="group relative">
        <button
          type="button"
          aria-haspopup="true"
          onClick={() => navigate({ to: "/app/producao/ordens" })}
          className={triggerCls(isActive("/app/producao"))}
        >
          <Factory className="h-4 w-4" /> Produção
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
        <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="w-60 rounded-lg border border-amber-100 bg-white shadow-xl py-1">
            {PRODUCAO_SUBMENU.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className={`block px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive(s.to)
                    ? "bg-amber-50 text-amber-800"
                    : "text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>)}
      {(isAdmin || canUsuarios) && (
        <Link to="/app/users" className={triggerCls(isActive("/app/users"))}>
          <UsersIcon className="h-4 w-4" /> Usuários
        </Link>
      )}
    </>
  );

  const MobileNav = () => (
    <div className="flex flex-col gap-1 mt-8">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/60 px-2 mb-1">
        SESMT
      </div>
      {SESMT_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${
            isActive(item.to) ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
          }`}
        >
          {item.label}
        </Link>
      ))}
      <div className="text-xs font-bold text-white/70 px-2 mt-2">DDS</div>
      {DDS_SUBMENU.map((s) => (
        <Link
          key={s.to}
          to={s.to}
          className={`rounded-md px-6 py-2 text-sm font-semibold ${
            isActive(s.to) ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
          }`}
        >
          ↳ {s.label}
        </Link>
      ))}
      <div className="text-xs font-bold text-white/70 px-2 mt-2">Documentos</div>
      {DOCUMENTOS_SUBMENU.map((s) => (
        <Link
          key={s.to}
          to={s.to}
          className={`rounded-md px-6 py-2 text-sm font-semibold ${
            isActive(s.to) ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
          }`}
        >
          ↳ {s.label}
        </Link>
      ))}
      <div className="text-[10px] font-black uppercase tracking-widest text-white/60 px-2 mt-4 mb-1">
        Outros módulos
      </div>
      <div className="px-2 mt-1 mb-1 flex items-center gap-2 text-sm font-bold text-white/70">
        <Boxes className="h-4 w-4" /> Estoque
      </div>
      {ESTOQUE_SUBMENU.map((s) => (
        "children" in s && s.children ? (
          <div key={s.key}>
            <Link
              to={s.to}
              className={`flex items-center gap-2 rounded-md px-6 py-2 text-sm font-semibold text-left ${
                isActive(s.to) ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
              }`}
            >
              {s.label}
            </Link>
            {s.children.map((c) => (
              <Link
                key={c.key}
                to={c.to}
                className={`flex items-center gap-2 rounded-md px-10 py-2 text-xs font-semibold text-left ${
                  isActive(c.to) ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                }`}
              >
                ↳ {c.label}
              </Link>
            ))}
          </div>
        ) : "to" in s && s.to ? (
          <Link
            key={s.key}
            to={s.to}
            className={`flex items-center gap-2 rounded-md px-6 py-2 text-sm font-semibold text-left ${
              isActive(s.to) ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
            }`}
          >
            {s.label}
          </Link>
        ) : (
          <button
            key={s.key}
            onClick={() => toast.info(`Estoque · ${s.label}: módulo em desenvolvimento`)}
            className="flex items-center gap-2 rounded-md px-6 py-2 text-sm font-semibold text-white/50 text-left"
          >
            {s.label}
            <Lock className="h-3 w-3 ml-auto" />
          </button>
        )
      ))}
      {OTHER_MODULES.map((m) => (
        <button
          key={m.key}
          onClick={() => toast.info(`${m.label}: módulo em desenvolvimento`)}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white/40 text-left"
        >
          <m.icon className="h-4 w-4" /> {m.label}
          <Lock className="h-3 w-3 ml-auto" />
        </button>
      ))}
      <div className="text-xs font-bold text-white/70 px-2 mt-2 flex items-center gap-2">
        <Wrench className="h-4 w-4" /> Manutenção
      </div>
      {MANUTENCAO_SUBMENU.map((s) => (
        <button
          key={s.key}
          onClick={() => toast.info(`Manutenção · ${s.label}: módulo em desenvolvimento`)}
          className="flex items-center gap-2 rounded-md px-6 py-2 text-sm font-semibold text-white/50 text-left"
        >
          <s.icon className="h-4 w-4" /> {s.label}
          <Lock className="h-3 w-3 ml-auto" />
        </button>
      ))}
      <div className="text-xs font-bold text-white/70 px-2 mt-2 flex items-center gap-2">
        <Factory className="h-4 w-4" /> Produção
      </div>
      {PRODUCAO_SUBMENU.map((s) => (
        <Link
          key={s.to}
          to={s.to}
          className={`rounded-md px-6 py-2 text-sm font-semibold ${
            isActive(s.to) ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
          }`}
        >
          ↳ {s.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          to="/app/users"
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ${
            isActive("/app/users") ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
          }`}
        >
          <UsersIcon className="h-4 w-4" /> Usuários
        </Link>
      )}
    </div>
  );

  return (
    <header className="bg-header sticky top-0 z-30 shadow-md bg-gradient-to-b from-[#a01818] to-[#7f1212]">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link to="/app" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity shrink-0">
          <div className="flex h-9 items-center justify-center rounded bg-white/95 px-1.5 py-1 shadow-sm">
            <img src={dmnLogo} alt="DMN Estaleiro" className="h-7 w-auto object-contain" />
          </div>
          <div className="whitespace-nowrap leading-none">
            <h1 className="text-[15px] font-black uppercase tracking-tight text-white">
              ESTALEIRO DMN
            </h1>
          </div>
        </Link>

        <nav className="hidden lg:flex flex-1 items-center justify-center gap-0.5 min-w-0">
          <DesktopNav />
        </nav>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto lg:ml-0">
          <div className="hidden md:flex items-center gap-0.5 border-l border-white/10 pl-2">
            <button
              title="Exportar backup"
              onClick={() => exportBackup()}
              className="h-8 w-8 rounded-md text-header-foreground/70 hover:bg-white/10 hover:text-header-foreground flex items-center justify-center"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              title="Importar backup"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              className="h-8 w-8 rounded-md text-header-foreground/70 hover:bg-white/10 hover:text-header-foreground flex items-center justify-center disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
          </div>
          <div className="hidden md:flex items-center gap-2 border-l border-white/10 pl-2">
            <div className="text-right leading-tight">
              <div className="text-[11px] font-bold text-header-foreground truncate max-w-[180px]">
                {user?.email}
              </div>
              <div className="flex gap-1 justify-end mt-0.5">
                {roles.length === 0 && (
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 px-1.5 border-white/20 text-header-foreground/70"
                  >
                    sem papel
                  </Badge>
                )}
                {roles.map((r) => (
                  <Badge key={r} className="text-[9px] py-0 px-1.5 bg-white/10 text-header-foreground border-0">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleLogout}
              className="h-8 w-8 text-header-foreground hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="lg:hidden text-header-foreground hover:bg-white/10"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-header border-white/10 text-header-foreground">
              <MobileNav />
              <Button variant="outline" onClick={handleLogout} className="mt-6 w-full">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
