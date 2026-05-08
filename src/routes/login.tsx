import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/app" });
    });
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        // Tenta atribuir admin se for o primeiro usuário (RLS permite via policy bootstrap)
        try {
          const { data: signed } = await supabase.auth.signInWithPassword({ email, password });
          if (signed.user) {
            await supabase.from("user_roles").insert({ user_id: signed.user.id, role: "admin" });
          }
        } catch {
          /* ignora — confirmação de email pode estar ativa */
        }
        toast.success("Conta criada! Se a confirmação de email estiver ativa, verifique sua caixa de entrada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            throw new Error("Email não confirmado. Desative a confirmação de email no Supabase ou confirme pelo link enviado.");
          }
          if (error.message.toLowerCase().includes("invalid login")) {
            throw new Error("Email ou senha incorretos.");
          }
          throw error;
        }
        toast.success("Bem-vindo!");
      }
      nav({ to: "/app" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "signin" ? "Entrar" : "Criar conta"}</CardTitle>
          <CardDescription>EnviCorp · Gestão de Fardamento e SST</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "Não tem conta? Criar" : "Já tem conta? Entrar"}
            </button>
            <div className="text-center text-xs text-muted-foreground">
              <Link to="/">← Voltar</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}