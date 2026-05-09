export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          data_entrada: string | null
          email: string | null
          encarregado1: string | null
          encarregado2: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          data_entrada?: string | null
          email?: string | null
          encarregado1?: string | null
          encarregado2?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          data_entrada?: string | null
          email?: string | null
          encarregado1?: string | null
          encarregado2?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_docs: {
        Row: {
          employee_id: string
          file_path: string
          id: string
          tipo: string
          uploaded_at: string
        }
        Insert: {
          employee_id: string
          file_path: string
          id?: string
          tipo: string
          uploaded_at?: string
        }
        Update: {
          employee_id?: string
          file_path?: string
          id?: string
          tipo?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_docs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_exams: {
        Row: {
          anexo_path: string | null
          aptidao: string
          created_at: string
          data_realizacao: string
          data_vencimento: string
          employee_id: string
          id: string
          natureza: string
          observacoes: string | null
          periodicidade_meses: number
          tipo_exame: string
        }
        Insert: {
          anexo_path?: string | null
          aptidao?: string
          created_at?: string
          data_realizacao: string
          data_vencimento: string
          employee_id: string
          id?: string
          natureza?: string
          observacoes?: string | null
          periodicidade_meses?: number
          tipo_exame: string
        }
        Update: {
          anexo_path?: string | null
          aptidao?: string
          created_at?: string
          data_realizacao?: string
          data_vencimento?: string
          employee_id?: string
          id?: string
          natureza?: string
          observacoes?: string | null
          periodicidade_meses?: number
          tipo_exame?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_exams_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admissao: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnh: string | null
          cnpj: string | null
          company_id: string | null
          cpf: string | null
          created_at: string
          data_aso: string | null
          data_integracao: string | null
          email: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          matricula: string | null
          nome: string
          nome_contato: string | null
          nrs: Json
          rg: string | null
          rg_orgao: string | null
          role_id: string | null
          status: string
          tipo_cadastro: string
          titulo: string | null
          uf: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_emergencia: string | null
        }
        Insert: {
          admissao?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnh?: string | null
          cnpj?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          data_aso?: string | null
          data_integracao?: string | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          matricula?: string | null
          nome: string
          nome_contato?: string | null
          nrs?: Json
          rg?: string | null
          rg_orgao?: string | null
          role_id?: string | null
          status?: string
          tipo_cadastro?: string
          titulo?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_emergencia?: string | null
        }
        Update: {
          admissao?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnh?: string | null
          cnpj?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          data_aso?: string | null
          data_integracao?: string | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          nome_contato?: string | null
          nrs?: Json
          rg?: string | null
          rg_orgao?: string | null
          role_id?: string | null
          status?: string
          tipo_cadastro?: string
          titulo?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_emergencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_deliveries: {
        Row: {
          ca: string | null
          created_at: string
          data_devolucao: string | null
          data_entrega: string
          employee_id: string
          id: string
          item: string
          observacoes: string | null
          qtd: number
          tamanho: string | null
        }
        Insert: {
          ca?: string | null
          created_at?: string
          data_devolucao?: string | null
          data_entrega?: string
          employee_id: string
          id?: string
          item: string
          observacoes?: string | null
          qtd?: number
          tamanho?: string | null
        }
        Update: {
          ca?: string | null
          created_at?: string
          data_devolucao?: string | null
          data_entrega?: string
          employee_id?: string
          id?: string
          item?: string
          observacoes?: string | null
          qtd?: number
          tamanho?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ptes: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          dados: Json
          data: string
          data_emissao: string
          employee_id: string | null
          employee_name: string | null
          id: string
          local: string | null
          numero: string | null
          pdf_path: string | null
          risco: string | null
          status: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          data?: string
          data_emissao?: string
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          local?: string | null
          numero?: string | null
          pdf_path?: string | null
          risco?: string | null
          status?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          data?: string
          data_emissao?: string
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          local?: string | null
          numero?: string | null
          pdf_path?: string | null
          risco?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          req_aso: boolean
          req_integra: boolean
          req_nrs: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          req_aso?: boolean
          req_integra?: boolean
          req_nrs?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          req_aso?: boolean
          req_integra?: boolean
          req_nrs?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_editor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "tst" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "tst", "viewer"],
    },
  },
} as const
