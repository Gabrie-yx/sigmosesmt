import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Settings2, Tags, LayoutGrid, Sparkles, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useConfigSistema } from "@/hooks/use-config-sistema";
import {
  MODULOS_CONFIGURAVEIS,
  PACOTES_RAMO,
  ROTULOS_PADRAO,
  type ModulosMap,
  type RotulosMap,
} from "@/lib/config-sistema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/configuracoes/sistema")({
  component: CentroConfiguracao,
  head: () => ({
    meta: [
      { title: "Centro de Configuração — SIGMO" },
      {
        name: "description",
        content:
          "Configure rótulos, módulos e ramo de atuação do SIGMO sem depender de programação.",
      },
      { property: "og:title", content: "Centro de Configuração — SIGMO" },
      {
        property: "og:description",
        content: "Adapte o SIGMO a qualquer segmento: vocabulário, módulos e pacotes de ramo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CentroConfiguracao() {
  const { isAdmin } = useAuth();
  const { config, carregando, salvar } = useConfigSistema();

  const [rotulos, setRotulos] = useState<RotulosMap>({});
  const [modulos, setModulos] = useState<ModulosMap>({});
  const [ramo, setRamo] = useState<string | null>(null);

  useEffect(() => {
    if (carregando) return;
    setRotulos(config.rotulos ?? {});
    setModulos(config.modulos ?? {});
    setRamo(config.ramo ?? null);
  }, [carregando, config.rotulos, config.modulos, config.ramo]);

  const pacote = useMemo(() => PACOTES_RAMO.find((p) => p.key === ramo) ?? null, [ramo]);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto mt-16 rounded-lg border bg-card p-8 text-center">
        <Lock className="h-10 w-10 mx-auto text-amber-500 mb-3" />
        <h2 className="text-lg font-bold mb-2">Área restrita</h2>
        <p className="text-sm text-muted-foreground">
          Só administradores podem alterar a configuração do sistema.
        </p>
      </div>
    );
  }

  const gravar = (patch: Parameters<typeof salvar.mutate>[0], msg: string) => {
    salvar.mutate(patch, {
      onSuccess: () => toast.success(msg),
      onError: (e: unknown) =>
        toast.error(`Não foi possível salvar: ${(e as Error)?.message ?? "erro desconhecido"}`),
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3">
          <Settings2 className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Centro de Configuração</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Aqui você adapta o SIGMO ao seu segmento sem depender de programação: muda o
            vocabulário, liga e desliga módulos e aplica um pacote pronto do seu ramo. O núcleo
            legal (NR, cálculos, assinaturas e auditoria) continua fixo.
          </p>
        </div>
      </header>

      <Tabs defaultValue="vocabulario">
        <TabsList>
          <TabsTrigger value="vocabulario" className="gap-2">
            <Tags className="h-4 w-4" /> Vocabulário
          </TabsTrigger>
          <TabsTrigger value="modulos" className="gap-2">
            <LayoutGrid className="h-4 w-4" /> Módulos
          </TabsTrigger>
          <TabsTrigger value="ramo" className="gap-2">
            <Sparkles className="h-4 w-4" /> Ramo
          </TabsTrigger>
        </TabsList>

        {/* ----------------- VOCABULÁRIO ----------------- */}
        <TabsContent value="vocabulario" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como sua empresa chama cada coisa</CardTitle>
              <CardDescription>
                O dado guardado é sempre o mesmo — muda só o nome que aparece nas telas e nos
                documentos novos. Documentos já assinados mantêm o texto original.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {ROTULOS_PADRAO.map((r) => (
                <div key={r.key} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr] md:items-end">
                  <div>
                    <p className="text-sm font-bold">{r.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      Padrão: {r.singular} · Ex.: {r.exemplos}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Singular</Label>
                    <Input
                      value={rotulos[r.key]?.singular ?? ""}
                      placeholder={r.singular}
                      onChange={(e) =>
                        setRotulos((p) => ({
                          ...p,
                          [r.key]: { ...p[r.key], singular: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Plural</Label>
                    <Input
                      value={rotulos[r.key]?.plural ?? ""}
                      placeholder={r.plural}
                      onChange={(e) =>
                        setRotulos((p) => ({
                          ...p,
                          [r.key]: { ...p[r.key], plural: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  disabled={salvar.isPending}
                  onClick={() => gravar({ rotulos }, "Vocabulário salvo.")}
                >
                  Salvar vocabulário
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRotulos({})}
                  disabled={salvar.isPending}
                >
                  Voltar ao padrão
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- MÓDULOS ----------------- */}
        <TabsContent value="modulos" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Módulos ligados</CardTitle>
              <CardDescription>
                Desligar esconde o módulo do menu e bloqueia a entrada pela rota. Nada é apagado —
                é só desligar de novo para tudo voltar. SESMT e Usuários são núcleo e não desligam.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MODULOS_CONFIGURAVEIS.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-bold">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.descricao}</p>
                  </div>
                  <Switch
                    checked={modulos[m.key] === true}
                    onCheckedChange={(v) => setModulos((p) => ({ ...p, [m.key]: v }))}
                  />
                </div>
              ))}
              <Button
                disabled={salvar.isPending}
                onClick={() => gravar({ modulos }, "Módulos atualizados.")}
              >
                Salvar módulos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- RAMO ----------------- */}
        <TabsContent value="ramo" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ramo de atuação</CardTitle>
              <CardDescription>
                O pacote é só uma semente: ele preenche uma sugestão de vocabulário e de módulos.
                Depois de aplicar, você continua editando tudo à vontade — nada é sobrescrito
                sozinho.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                {PACOTES_RAMO.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setRamo(p.key)}
                    className={`rounded-lg border p-4 text-left transition ${
                      ramo === p.key ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-bold text-sm">{p.nome}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.nrs.map((nr) => (
                        <Badge key={nr} variant="secondary" className="text-[10px]">
                          {nr}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              {pacote && (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
                  <p className="font-bold">Prévia do pacote {pacote.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Vocabulário sugerido:{" "}
                    {Object.entries(pacote.rotulos)
                      .map(([k, v]) => `${k} → ${v?.singular ?? ""}`)
                      .join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Módulos sugeridos: {Object.keys(pacote.modulos).join(", ") || "nenhum"}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!pacote || salvar.isPending}
                  onClick={() => {
                    if (!pacote) return;
                    // Idempotente: só preenche o que ainda está vazio.
                    const novosRotulos: RotulosMap = { ...rotulos };
                    let novosCampos = 0;
                    for (const [k, v] of Object.entries(pacote.rotulos)) {
                      const key = k as keyof RotulosMap;
                      const atual = novosRotulos[key];
                      if (!atual?.singular && !atual?.plural) {
                        novosRotulos[key] = v;
                        novosCampos++;
                      }
                    }
                    const novosModulos: ModulosMap = { ...modulos };
                    let novosMod = 0;
                    for (const [k, v] of Object.entries(pacote.modulos)) {
                      const key = k as keyof ModulosMap;
                      if (novosModulos[key] === undefined) {
                        novosModulos[key] = v;
                        novosMod++;
                      }
                    }
                    setRotulos(novosRotulos);
                    setModulos(novosModulos);
                    gravar(
                      { ramo: pacote.key, rotulos: novosRotulos, modulos: novosModulos },
                      `Pacote aplicado: ${novosCampos} rótulo(s) e ${novosMod} módulo(s) novos; o resto já estava configurado.`,
                    );
                  }}
                >
                  Aplicar pacote
                </Button>
                <Button
                  variant="outline"
                  disabled={salvar.isPending}
                  onClick={() => gravar({ ramo }, "Ramo salvo.")}
                >
                  Salvar só o ramo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
