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
} from "lucide-react";
import { exportBackup, importBackup } from "@/lib/backup";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import dmnLogo from "@/assets/dmn-logo.png";

const SESMT_ITEMS = [
  { to: "/app/companies", label: "Empresas" },
  { to: "/app/roles", label: "Cargos / Riscos" },
  { to: "/app/employees", label: "Colaboradores" },
  { to: "/app/trainings", label: "Treinamentos" },
  { to: "/app/ptes", label: "Emitir PTE" },
] as const;

const SESMT_PATHS = SESMT_ITEMS.map((i) => i.to);

const OTHER_MODULES = [
  { key: "producao", label: "Produção", icon: Factory },
  { key: "manut-eletrica", label: "Manutenção Elétrica", icon: Zap },
  { key: "manut-mecanica", label: "Manutenção Mecânica", icon: Wrench },
  { key: "portaria", label: "Portaria", icon: DoorOpen },
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
  const { user, roles } = useAuth();
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

  const triggerCls = (active: boolean) =>
    `flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-bold uppercase tracking-wide transition-all ${
      active
        ? "bg-white/15 text-white shadow-md ring-1 ring-white/30"
        : "text-white/85 hover:bg-white/10 hover:text-white"
    }`;
  const disabledCls =
    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-bold uppercase tracking-wide text-white/40 cursor-not-allowed";

  const DesktopNav = () => (
    <>
      {/* SESMT — abre ao passar o mouse */}
      <div className="group relative">
        <button type="button" aria-haspopup="true" className={triggerCls(sesmtActive)}>
          <ShieldCheck className="h-4 w-4" /> SESMT
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
        <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="w-60 rounded-lg border border-red-100 bg-white shadow-xl py-1">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-700 border-b border-red-50">
              SESMT
            </div>
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
          </div>
        </div>
      </div>

      {/* Outros módulos — placeholder, mostram "em breve" no hover */}
      {/* Estoque — dropdown com submenus */}
      <div className="group relative">
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
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
              Estoque
            </div>
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
                      <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
                        {s.label}
                      </div>
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
      <div className="text-[10px] font-black uppercase tracking-widest text-white/60 px-2 mt-4 mb-1">
        Outros módulos
      </div>
      <div className="px-2 mt-1 mb-1 flex items-center gap-2 text-sm font-bold text-white/70">
        <Boxes className="h-4 w-4" /> Estoque
      </div>
      {ESTOQUE_SUBMENU.map((s) => (
        "to" in s && s.to ? (
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
    </div>
  );

  return (
    <header className="bg-header sticky top-0 z-30 shadow-md">
      <div className="flex h-16 items-center justify-between px-4 md:px-8">
        <Link to="/app" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 items-center justify-center rounded bg-white/95 px-2 py-1 shadow-sm">
            <img src={dmnLogo} alt="DMN Estaleiro" className="h-8 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight leading-none text-white">
              ESTALEIRO DMN
            </h1>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/60 mt-1">
              Auditoria ISO 9001 — Módulo GSI
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          <DesktopNav />
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 border-l border-white/10 pl-3">
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
          <div className="hidden md:flex items-center gap-2 border-l border-white/10 pl-3">
            <div className="text-right">
              <div className="text-xs font-bold text-header-foreground truncate max-w-[160px]">
                {user?.email}
              </div>
              <div className="flex gap-1 justify-end mt-0.5">
                {roles.length === 0 && (
                  <Badge
                    variant="outline"
                    className="text-[9px] border-white/20 text-header-foreground/70"
                  >
                    sem papel
                  </Badge>
                )}
                {roles.map((r) => (
                  <Badge key={r} className="text-[9px] bg-white/10 text-header-foreground border-0">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleLogout}
              className="text-header-foreground hover:bg-white/10"
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
