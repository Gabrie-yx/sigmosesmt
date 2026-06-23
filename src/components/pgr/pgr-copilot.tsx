import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, Sparkles, FileSearch, Wrench, PlusCircle, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  {
    icon: PlusCircle,
    label: "Criar PGR do zero",
    prompt:
      "Quero criar um PGR novo do zero. Pode conduzir o wizard comigo? Comece perguntando sobre a empresa.",
  },
  {
    icon: FileSearch,
    label: "Auditar PGR existente",
    prompt:
      "Vou colar trechos de um PGR já existente e quero que você aponte não conformidades vs NR-01 e Manual GRO.",
  },
  {
    icon: Wrench,
    label: "Corrigir GHE/risco",
    prompt:
      "Preciso melhorar a descrição de um GHE e seus riscos. Pode me ajudar a reescrever de forma técnica e conforme?",
  },
];

export function PgrCopilot() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/pgr-chat" }),
    onError: (err) => {
      console.error(err);
      toast.error("Erro no copiloto: " + err.message);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    setInput("");
    await sendMessage({ text: content });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] min-h-[500px] gap-3">
      <Card className="p-4 bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-rose-600 to-[#7f1212] text-white shadow">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">Copiloto PGR</h3>
              <Badge variant="secondary" className="gap-1 bg-rose-100 text-rose-800 border-rose-200">
                <Sparkles className="h-3 w-3" /> IA
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Crie, audite ou corrija um PGR conforme NR-01, Manual GRO e demais NRs. Funciona para qualquer empresa/segmento.
            </p>
          </div>
        </div>
      </Card>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 p-4 bg-slate-50/50 rounded-lg border border-slate-200"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-8">
            <Bot className="h-12 w-12 text-slate-300" />
            <div>
              <p className="font-medium text-slate-700">Como posso ajudar com o PGR?</p>
              <p className="text-xs text-slate-500 mt-1">
                Escolha uma ação rápida ou descreva o que precisa.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 w-full max-w-2xl">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => handleSend(a.prompt)}
                  className="p-3 text-left bg-white border border-slate-200 rounded-lg hover:border-rose-400 hover:shadow-sm transition group"
                >
                  <a.icon className="h-4 w-4 text-rose-600 mb-2" />
                  <p className="text-sm font-medium text-slate-900 group-hover:text-rose-700">
                    {a.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="shrink-0 p-1.5 rounded-md bg-gradient-to-br from-rose-600 to-[#7f1212] text-white h-fit">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isUser
                    ? "bg-rose-600 text-white"
                    : "bg-white border border-slate-200 text-slate-800"
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{text}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-table:text-xs">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                )}
              </div>
              {isUser && (
                <div className="shrink-0 p-1.5 rounded-md bg-slate-700 text-white h-fit">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2 items-center text-xs text-slate-500 pl-9">
            <Loader2 className="h-3 w-3 animate-spin" /> pensando...
          </div>
        )}
      </div>

      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Descreva o que precisa, cole trechos do PGR, ou peça uma matriz de risco... (Enter para enviar, Shift+Enter para quebrar linha)"
          className="flex-1 min-h-[60px] max-h-[200px] resize-none"
          disabled={isLoading}
        />
        <Button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
          className="bg-rose-600 hover:bg-rose-700 h-[60px] px-4"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}