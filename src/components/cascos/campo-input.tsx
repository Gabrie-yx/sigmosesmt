import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadArquivo } from "@/lib/upload-grande";
import { supabase } from "@/integrations/supabase/client";
import { mascarar, linkWhatsapp, type CampoDef } from "@/lib/campos-dinamicos";

type Props = {
  def: CampoDef;
  valor: unknown;
  onChange: (v: unknown) => void;
  employees?: { id: string; nome: string }[];
  erro?: string | null;
};

export function CampoInput({ def, valor, onChange, employees = [], erro }: Props) {
  const [enviando, setEnviando] = useState(false);
  const texto = valor === null || valor === undefined ? "" : String(valor);

  async function subirArquivo(file: File) {
    setEnviando(true);
    try {
      const path = `unidades/${def.chave}/${Date.now()}-${file.name}`;
      await uploadArquivo("sesmt-docs", path, file);
      onChange(path);
      toast.success("Arquivo enviado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar arquivo");
    } finally {
      setEnviando(false);
    }
  }

  async function abrirArquivo() {
    const { data, error } = await supabase.storage
      .from("sesmt-docs")
      .createSignedUrl(texto, 300);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.location.href = data.signedUrl;
  }

  function corpo() {
    switch (def.tipo) {
      case "texto_longo":
        return <Textarea rows={3} value={texto} onChange={(e) => onChange(e.target.value)} />;

      case "sim_nao":
        return (
          <div className="flex h-9 items-center gap-2">
            <Switch checked={valor === true || valor === "true"} onCheckedChange={onChange} />
            <span className="text-xs text-muted-foreground">
              {valor === true || valor === "true" ? "Sim" : "Não"}
            </span>
          </div>
        );

      case "lista":
        return (
          <Select value={texto} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {def.opcoes.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "pessoa":
        return (
          <Select value={texto} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "data":
        return <Input type="date" value={texto} onChange={(e) => onChange(e.target.value)} />;

      case "hora":
        return <Input type="time" value={texto} onChange={(e) => onChange(e.target.value)} />;

      case "numero":
        return (
          <Input
            inputMode="decimal"
            value={texto}
            onChange={(e) => onChange(mascarar("numero", e.target.value))}
          />
        );

      case "moeda":
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input
              inputMode="numeric"
              className="pl-9"
              value={texto}
              onChange={(e) => onChange(mascarar("moeda", e.target.value))}
              placeholder="0,00"
            />
          </div>
        );

      case "anexo":
        return (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enviando}
              onClick={() => document.getElementById(`file-${def.id}`)?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {enviando ? "Enviando…" : "Escolher arquivo"}
            </Button>
            <input
              id={`file-${def.id}`}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subirArquivo(f);
              }}
            />
            {texto && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void abrirArquivo()}>
                <Paperclip className="h-3.5 w-3.5 mr-1" /> Ver anexo
              </Button>
            )}
          </div>
        );

      case "email":
        return (
          <div className="flex items-center gap-1">
            <Input
              type="email"
              value={texto}
              onChange={(e) => onChange(e.target.value)}
              placeholder="nome@empresa.com.br"
            />
            {texto && (
              <a href={`mailto:${texto}`} className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        );

      case "telefone":
      case "whatsapp":
        return (
          <div className="flex items-center gap-1">
            <Input
              inputMode="tel"
              value={texto}
              onChange={(e) => onChange(mascarar(def.tipo, e.target.value))}
              placeholder="(00) 00000-0000"
            />
            {def.tipo === "whatsapp" && texto && (
              <a
                href={linkWhatsapp(texto)}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        );

      case "cpf":
      case "cnpj":
      case "cep":
        return (
          <Input
            inputMode="numeric"
            value={texto}
            onChange={(e) => onChange(mascarar(def.tipo, e.target.value))}
            placeholder={
              def.tipo === "cpf" ? "000.000.000-00"
                : def.tipo === "cnpj" ? "00.000.000/0000-00" : "00000-000"
            }
          />
        );

      default:
        return <Input value={texto} onChange={(e) => onChange(e.target.value)} />;
    }
  }

  return (
    <div>
      <Label className="text-[10px] font-black uppercase">
        {def.label} {def.obrigatorio && <span className="text-destructive">*</span>}
      </Label>
      {corpo()}
      {def.ajuda && <p className="text-[10px] text-muted-foreground mt-1">{def.ajuda}</p>}
      {erro && <p className="text-[10px] text-destructive mt-1">{erro}</p>}
    </div>
  );
}
