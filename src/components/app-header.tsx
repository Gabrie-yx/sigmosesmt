import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, Download, Upload, Menu } from "lucide-react";
import { exportBackup, importBackup } from "@/lib/backup";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/app", label: "Painel TST", exact: true },
  { to: "/app/companies", label: "Empresas" },
  { to: "/app/roles", label: "Cargos/Riscos" },
  { to: "/app/employees", label: "Colaboradores" },
];

export function AppHeader() {
  const { user, roles, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  async function handleImport(file: File) {
    if (!confirm("Isso vai SOBRESCREVER os dados atuais com o arquivo de backup. Continuar?")) return;
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

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const NavLinks = () => (
    <>
      {NAV.map((item) => {
        const active = isActive(item.to, item.exact);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              active ? "bg-[#0369a1] text-white shadow-md" : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        to="/app/ptes"
        className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
          isActive("/app/ptes")
            ? "bg-orange-500 text-white shadow-md"
            : "text-orange-300 hover:bg-white/10"
        }`}
      >
        Emitir PTE
      </Link>
      {isAdmin && (
        <Link
          to="/app/users"
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
            isActive("/app/users") ? "bg-[#0369a1] text-white shadow-md" : "text-white/90 hover:bg-white/10"
          }`}
        >
          Usuários
        </Link>
      )}
    </>
  );

  return (
    <header className="bg-header sticky top-0 z-30 shadow-md">
      <div className="flex h-16 items-center justify-between px-4 md:px-8">
        <Link to="/app" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10 border border-white/20" />
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
          <NavLinks />
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
              <div className="text-xs font-bold text-header-foreground truncate max-w-[160px]">{user?.email}</div>
              <div className="flex gap-1 justify-end mt-0.5">
                {roles.length === 0 && <Badge variant="outline" className="text-[9px] border-white/20 text-header-foreground/70">sem papel</Badge>}
                {roles.map((r) => (
                  <Badge key={r} className="text-[9px] bg-white/10 text-header-foreground border-0">{r}</Badge>
                ))}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={handleLogout} className="text-header-foreground hover:bg-white/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="lg:hidden text-header-foreground hover:bg-white/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-header border-white/10 text-header-foreground">
              <div className="flex flex-col gap-2 mt-8">
                <NavLinks />
                <Button variant="outline" onClick={handleLogout} className="mt-4">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}