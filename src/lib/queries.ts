import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ["employee", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useExams(empId: string | null) {
  return useQuery({
    queryKey: ["exams", empId],
    enabled: !!empId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_exams")
        .select("*")
        .eq("employee_id", empId!)
        .order("data_realizacao", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDocs(empId: string | null) {
  return useQuery({
    queryKey: ["docs", empId],
    enabled: !!empId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_docs")
        .select("*")
        .eq("employee_id", empId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useEpis(empId: string | null) {
  return useQuery({
    queryKey: ["epis", empId],
    enabled: !!empId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_deliveries")
        .select("*")
        .eq("employee_id", empId!)
        .order("data_entrega", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePtes() {
  return useQuery({
    queryKey: ["ptes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ptes")
        .select("*")
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function showError(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro desconhecido";
  toast.error(msg);
}

export { useMutation, useQueryClient };