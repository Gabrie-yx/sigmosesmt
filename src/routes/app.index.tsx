import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Shield, FileText } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const [c, e, r, p] = await Promise.all([
        supabase.from("companies").select("*", { count: "exact", head: true }),
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("roles").select("*", { count: "exact", head: true }),
        supabase.from("ptes").select("*", { count: "exact", head: true }),
      ]);
      return { c: c.count ?? 0, e: e.count ?? 0, r: r.count ?? 0, p: p.count ?? 0 };
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-8">Visão geral do sistema</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Empresas" value={data?.c ?? "—"} icon={Building2} />
        <StatCard label="Funcionários" value={data?.e ?? "—"} icon={Users} />
        <StatCard label="Funções" value={data?.r ?? "—"} icon={Shield} />
        <StatCard label="PTEs" value={data?.p ?? "—"} icon={FileText} />
      </div>
    </div>
  );
}