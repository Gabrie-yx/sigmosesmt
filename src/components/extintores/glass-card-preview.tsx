import { Flame, ClipboardCheck, Camera, ClipboardEdit, Ban, AlertTriangle, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ExtintorInspecaoFotoDialog } from "@/components/extintores/inspecao-foto-dialog";
import {
  InspecaoManualDialog,
  type ResultadoInspecaoManual,
} from "@/components/extintores/inspecao-manual-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PREVIEW_EXTINTOR = {
  id: "preview-005974",
  numero: "005974",
  tipo_agente: "ABC 6KG",
  localizacao: "Galpão 2 · Pilar B3",
};

/**
 * Preview de card "vidro escuro" para os extintores.
 * Painel de vidro fumê com borda cromada brilhante e reflexo diagonal.
 */
export function ExtintorGlassCardPreview() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [fotoOpen, setFotoOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [resultado, setResultado] = useState<ResultadoInspecaoManual | null>(null);
  const [planoOpen, setPlanoOpen] = useState(false);

  const indisponivel = resultado?.indisponivel ?? false;

  return (
    <>
      <div className="bg-black p-10 rounded-3xl flex flex-col items-center gap-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpen(true);
          }}
          aria-label="Abrir extintor 005974"
          className="relative w-[360px] aspect-[3/2] group cursor-pointer focus:outline-none"
        >
          {/* Halo externo — cromado padrão OU vermelho pulsante quando bloqueado */}
          <div
            className={`pointer-events-none absolute -inset-3 rounded-[34px] blur-xl ${
              indisponivel ? "animate-pulse opacity-100" : "opacity-90"
            }`}
            style={{
              background: indisponivel
                ? "radial-gradient(60% 50% at 50% 50%, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.35) 40%, transparent 75%)"
                : "radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, transparent 70%)",
            }}
          />

          {/* Borda — cromada OU vermelha quando bloqueado */}
          <div
            className="absolute inset-0 rounded-[26px] p-[1.5px]"
            style={{
              background: indisponivel
                ? "linear-gradient(135deg, #ff6b6b 0%, #ef4444 25%, #b91c1c 50%, #ef4444 75%, #ff6b6b 100%)"
                : "linear-gradient(135deg, #ffffff 0%, #b8b8b8 25%, #5a5a5a 50%, #d8d8d8 75%, #ffffff 100%)",
              boxShadow: indisponivel
                ? "0 0 32px rgba(239,68,68,0.7), 0 0 80px rgba(239,68,68,0.4)"
                : "0 0 24px rgba(255,255,255,0.35), 0 0 60px rgba(255,255,255,0.15)",
            }}
          >
            {/* Vidro escuro */}
            <div
              className="relative w-full h-full rounded-[24px] overflow-hidden"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 0%, #2a2a2a 0%, #161616 40%, #050505 100%)",
              }}
            >
              {/* Highlight superior (curva de luz) */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(140% 55% at 50% -25%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 35%, transparent 60%)",
                }}
              />
              {/* Vinheta inferior */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(90% 70% at 50% 120%, rgba(0,0,0,0.85) 0%, transparent 60%)",
                }}
              />

              {/* Banner pulsante INDISPONÍVEL */}
              {indisponivel && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 animate-pulse">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-red-400 bg-red-600/90 shadow-[0_0_18px_rgba(239,68,68,0.9)]">
                    <Ban className="h-3 w-3 text-white" />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">
                      Indisponível para Uso
                    </span>
                  </div>
                </div>
              )}

              {/* Conteúdo */}
              <div className="relative z-10 h-full p-5 flex flex-col justify-between text-white text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                      Extintor
                    </div>
                    <div className="font-mono text-3xl font-black tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      005974
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/25 bg-white/5 backdrop-blur-sm">
                    <Flame className="h-3 w-3 text-red-400" />
                    <span className="text-[10px] font-bold tracking-wider text-white/85">
                      ABC 6KG
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">
                        Local no Pátio
                      </div>
                      <div className="text-sm font-semibold text-white/90 truncate">
                        Galpão 2 · Pilar B3
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">
                        Próx. recarga
                      </div>
                      <div className="text-sm font-bold tabular-nums text-emerald-300/90">
                        30/04/2027
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] backdrop-blur-sm py-2 text-xs font-semibold tracking-wide text-white/90 transition"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Inspeção
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      onClick={(e) => e.stopPropagation()}
                      className="w-56"
                    >
                      <DropdownMenuLabel className="text-xs">
                        Escolha o tipo
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setFotoOpen(true)}>
                        <Camera className="h-4 w-4 mr-2 text-red-500" />
                        <div className="flex flex-col">
                          <span className="text-sm">Inspeção por Foto</span>
                          <span className="text-[10px] text-muted-foreground">
                            IA analisa + cruza com cadastro
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setManualOpen(true)}>
                        <ClipboardEdit className="h-4 w-4 mr-2 text-blue-500" />
                        <div className="flex flex-col">
                          <span className="text-sm">Inspeção Manual</span>
                          <span className="text-[10px] text-muted-foreground">
                            Checklist preenchido em tela
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo do último resultado + acesso ao 5W2H */}
        {resultado && (
          <div className="w-[360px] flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
            <div className="flex items-center gap-2">
              {resultado.conforme ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Última inspeção: <strong>conforme</strong></span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>
                    {resultado.planos5w2h.length} NC ·{" "}
                    {resultado.indisponivel ? (
                      <strong className="text-red-300">bloqueado</strong>
                    ) : (
                      <strong className="text-amber-300">em uso</strong>
                    )}
                  </span>
                </>
              )}
            </div>
            {resultado.planos5w2h.length > 0 && (
              <button
                type="button"
                onClick={() => setPlanoOpen(true)}
                className="text-[11px] underline text-cyan-300 hover:text-cyan-200"
              >
                Ver 5W2H ({resultado.planos5w2h.length})
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              Extintor 005974
              {indisponivel && (
                <Badge className="ml-2 bg-red-600 text-white animate-pulse">
                  <Ban className="h-3 w-3 mr-1" /> Indisponível
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Preview — todos os campos serão editáveis na versão final.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Nº Cilindro" value="005974" />
            <Field label="Selo INMETRO" value="—" />
            <Field label="Tipo / Capacidade" value="ABC 6KG" />
            <Field label="Última recarga" value="30/04/2026" />
            <Field label="Próxima recarga" value="30/04/2027" />
            <Field label="Teste hidrostático" value="30/04/2028" />
            <Field label="Empresa" value="Norte Extintores / Rimatec" />
            <Field label="Local no Pátio" value="Galpão 2 · Pilar B3" />
          </div>
          <DialogFooter className="gap-2 sm:justify-between border-t pt-3 mt-2">
            <div className="text-[10px] text-muted-foreground italic">
              Preview — os botões abaixo já existem nos cards reais abaixo desta seção.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" disabled title="Disponível nos cards reais">
                <Pencil className="h-3.5 w-3.5" /> Editar cadastro
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" disabled title="Disponível para admin/moderador nos cards reais">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExtintorInspecaoFotoDialog
        extintor={PREVIEW_EXTINTOR}
        open={fotoOpen}
        onOpenChange={setFotoOpen}
      />
      <InspecaoManualDialog
        extintor={PREVIEW_EXTINTOR}
        open={manualOpen}
        onOpenChange={setManualOpen}
        userId={user?.id}
        userNome={user?.user_metadata?.full_name ?? user?.email ?? ""}
        previewMode
        onResultado={(r) => setResultado(r)}
      />

      {/* Modal de 5W2H gerado */}
      <Dialog open={planoOpen} onOpenChange={setPlanoOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Plano de Ação 5W2H — Extintor 005974
            </DialogTitle>
            <DialogDescription>
              Gerado automaticamente a partir das NC da última inspeção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {resultado?.planos5w2h.map((p, i) => (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 text-sm ${
                  p.severidade === "critica"
                    ? "border-red-500/60 bg-red-500/10"
                    : p.severidade === "maior"
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "border-slate-600 bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold">{p.what}</div>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {p.severidade}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <div><strong className="text-foreground">Why:</strong> {p.why}</div>
                  <div><strong className="text-foreground">Where:</strong> {p.where}</div>
                  <div><strong className="text-foreground">Who:</strong> {p.who}</div>
                  <div><strong className="text-foreground">When:</strong> {p.when}</div>
                  <div className="md:col-span-2"><strong className="text-foreground">How:</strong> {p.how}</div>
                  <div className="md:col-span-2"><strong className="text-foreground">How much:</strong> {p.howMuch}</div>
                  <div className="md:col-span-2 text-[10px] italic">Base: {p.norma}</div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
