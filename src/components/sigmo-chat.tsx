import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, Sparkles, User, HelpCircle, MapPin, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  {
    icon: HelpCircle,
    label: "O que é MFA e como ativo?",
    prompt: "Me explica o que é MFA, por que é obrigatório no SIGMO e como eu ativo passo a passo.",
  },
  {
    icon: MapPin,
    label: "Onde emito uma OSS?",
    prompt: "Onde no SIGMO eu emito uma OSS (Ordem de Serviço NR-01) e o que preciso ter pronto antes?",
  },
  {
    icon: BookOpen,
    label: "Diferença entre APR, PT e PGR",
    prompt: "Qual a diferença entre APR, PT (PTE) e PGR no dia-a-dia do SESMT? Quando uso cada um?",
  },
];

export function SigmoChat() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/sigmo-chat" }),
    onError: (err) => {
      console.error(err);
      toast.error("Assistente indisponível: " + err.message);
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
      <Card className="p-4 bg-card/40 backdrop-blur-xl border-border/60 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground">Assistente SIGMO</h3>
              <Badge variant="secondary" className="gap-1 bg-rose-100 text-rose-800 border-rose-200">
                <Sparkles className="h-3 w-3" /> IA
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conhece todos os tópicos da Central de Ajuda + o mapa de rotas do SIGMO.
              Pergunta em português mesmo, sem enrolação.
            </p>
          </div>
        </div>
      </Card>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 p-4 bg-card/30 backdrop-blur-xl rounded-lg border border-border/60"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-8">
            <Bot className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium text-foreground">Qual a sua dúvida no SIGMO?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Comece por uma sugestão ou escreva sua pergunta.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 w-full max-w-2xl">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => handleSend(a.prompt)}
                  className="p-3 text-left bg-card/40 backdrop-blur-md border border-border/60 rounded-lg hover:border-rose-400 hover:bg-card/60 hover:shadow-md transition group"
                >
                  <a.icon className="h-4 w-4 text-rose-700 mb-2" />
                  <p className="text-sm font-medium text-foreground group-hover:text-rose-800">
                    {a.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="shrink-0 p-1.5 rounded-md bg-rose-100 border border-rose-200 text-rose-800 h-fit">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isUser
                    ? "bg-rose-700 text-white"
                    : "bg-card/60 backdrop-blur border border-border/60 text-foreground"
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{text}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-table:text-xs">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                )}
              </div>
              {isUser && (
                <div className="shrink-0 p-1.5 rounded-md bg-muted/60 backdrop-blur border border-border/60 text-foreground h-fit">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2 items-center text-xs text-muted-foreground pl-9">
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
          placeholder="Ex.: como faço a integração de um funcionário novo? (Enter envia, Shift+Enter quebra linha)"
          className="flex-1 min-h-[60px] max-h-[200px] resize-none bg-card/40 backdrop-blur-xl border-border/60"
          disabled={isLoading}
        />
        <Button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
          className="h-[60px] px-4 bg-rose-700 hover:bg-rose-800"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}