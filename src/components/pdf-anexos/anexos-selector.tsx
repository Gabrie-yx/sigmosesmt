// AnexosSelector — bloco "Anexos padrão" no diálogo de emissão de PDF.
// Uso:
//   const [selecionados, setSelecionados] = useState<string[]>([]);
//   <AnexosSelector escopo="oss" value={selecionados} onChange={setSelecionados} />
// Os anexos com `obrigatorio=true` vêm marcados e não podem ser desmarcados.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarAnexosPorEscopo } from "@/lib/pdf-anexos.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Lock } from "lucide-react";

type Escopo = "apr" | "oss" | "pte" | "dds" | "os" | "rc";

interface Props {
  escopo: Escopo;
  value: string[]; // ids selecionados
  onChange: (ids: string[]) => void;
  className?: string;
}

export function AnexosSelector({ escopo, value, onChange, className }: Props) {
  const listar = useServerFn(listarAnexosPorEscopo);
  const { data = [], isLoading } = useQuery({
    queryKey: ["pdf-anexos-padrao", escopo],
    queryFn: () => listar({ data: { escopo } }),
    staleTime: 60_000,
  });

  // Ao carregar: garante que obrigatórios + opcionais entrem marcados por padrão.
  useEffect(() => {
    if (isLoading) return;
    if (!data.length) return;
    const inicial = data.map((a) => a.id);
    // Só inicializa se ainda não tem seleção manual (value vazio).
    if (value.length === 0) onChange(inicial);
    else {
      // Garante que obrigatórios estão sempre presentes.
      const obrigatorios = data.filter((a) => a.obrigatorio).map((a) => a.id);
      const faltando = obrigatorios.filter((id) => !value.includes(id));
      if (faltando.length) onChange([...value, ...faltando]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data.length]);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando anexos padrão…</p>;
  }
  if (data.length === 0) return null;

  function toggle(id: string, obrig: boolean) {
    if (obrig) return; // não pode desmarcar obrigatório
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Paperclip className="h-3.5 w-3.5 opacity-70" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Anexos padrão
        </span>
      </div>
      <div className="space-y-1.5">
        {data.map((a) => {
          const on = value.includes(a.id);
          return (
            <label
              key={a.id}
              className={`flex items-start gap-2 p-2 rounded border text-xs transition-colors ${
                a.obrigatorio ? "bg-amber-500/5 border-amber-500/30 cursor-not-allowed" : "hover:bg-accent/40 cursor-pointer"
              }`}
            >
              <Checkbox
                checked={on}
                disabled={a.obrigatorio}
                onCheckedChange={() => toggle(a.id, a.obrigatorio)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.titulo}</span>
                  {a.obrigatorio && (
                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-300">
                      <Lock className="h-2.5 w-2.5 mr-0.5" /> OBRIGATÓRIO
                    </Badge>
                  )}
                </div>
                {a.descricao && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                    {a.descricao}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}