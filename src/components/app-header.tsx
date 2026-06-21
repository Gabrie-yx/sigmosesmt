import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, Download, Upload, Menu, MoreVertical } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { exportBackup, importBackup } from "@/lib/backup";
import { toast } from "sonner";
import { useRef, useState } from "react";
import dmnLogo from "@/assets/dmn-logo.png";
import { PendenciasBadge } from "@/components/pendencias-badge";
import { useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const { toggleSidebar, isMobile } = useSidebar();

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

  return (
    <header className="bg-header sticky top-0 z-30 shadow-md bg-gradient-to-b from-[#a01818] to-[#7f1212] relative overflow-visible before:absolute before:inset-y-0 before:right-full before:w-[var(--sidebar-width-icon,3rem)] before:bg-gradient-to-b before:from-[#a01818] before:to-[#7f1212] before:content-['']">
      <div className="flex h-14 items-center gap-2 px-2 md:gap-3 md:px-4">
        {/* Hambúrguer mobile — abre a sidebar como drawer */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-white hover:bg-white/10 shrink-0"
          aria-label="Abrir menu"
          title="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/app" className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0 min-w-0">
          <div className="flex h-9 items-center justify-center rounded bg-white/95 px-1.5 py-1 shadow-sm shrink-0">
            <img src={dmnLogo} alt="DMN Estaleiro" className="h-7 w-auto object-contain" />
          </div>
          <div className="whitespace-nowrap leading-tight hidden sm:block">
            <h1 className="text-[15px] font-black uppercase tracking-tight text-white">
              ESTALEIRO DMN — SIGMO
            </h1>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70 mt-0.5">
              (Sistema Integrado de Gestão Modular)
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1 md:gap-1.5 shrink-0 ml-auto">
          <PendenciasBadge />
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
            <Link
              to="/app/conta/seguranca"
              title="Minha conta / Segurança (senha, MFA, sessões)"
              className="text-right leading-tight hover:opacity-90"
            >
              <div className="text-[11px] font-bold text-header-foreground truncate max-w-[180px] underline-offset-2 hover:underline">
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
            </Link>
            <Link
              to="/app/conta/seguranca"
              title="Segurança da conta"
              className="h-8 w-8 rounded-md text-header-foreground hover:bg-white/10 flex items-center justify-center"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleLogout}
              className="h-8 w-8 text-header-foreground hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Menu compacto mobile (conta, backup, sair) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-white hover:bg-white/10 shrink-0"
                aria-label="Mais opções"
                title="Mais"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="truncate">
                <div className="text-[11px] font-bold truncate">{user?.email}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {roles.length === 0 && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">sem papel</Badge>
                  )}
                  {roles.map((r) => (
                    <Badge key={r} className="text-[9px] py-0 px-1.5">{r}</Badge>
                  ))}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/app/conta/seguranca" })}>
                <ShieldCheck className="h-4 w-4 mr-2" /> Minha conta / Segurança
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportBackup()}>
                <Download className="h-4 w-4 mr-2" /> Exportar backup
              </DropdownMenuItem>
              <DropdownMenuItem disabled={importing} onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Importar backup
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-rose-600 focus:text-rose-600">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
        </div>
      </div>
    </header>
  );
}
