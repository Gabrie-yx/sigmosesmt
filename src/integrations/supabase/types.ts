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
      apr_assinaturas: {
        Row: {
          apr_id: string
          assinatura_imagem_path: string | null
          assinou_em: string | null
          confirmado_por: string | null
          cpf: string | null
          created_at: string
          employee_id: string | null
          funcao: string | null
          id: string
          nome: string
          ordem: number
          papel: string
        }
        Insert: {
          apr_id: string
          assinatura_imagem_path?: string | null
          assinou_em?: string | null
          confirmado_por?: string | null
          cpf?: string | null
          created_at?: string
          employee_id?: string | null
          funcao?: string | null
          id?: string
          nome: string
          ordem?: number
          papel: string
        }
        Update: {
          apr_id?: string
          assinatura_imagem_path?: string | null
          assinou_em?: string | null
          confirmado_por?: string | null
          cpf?: string | null
          created_at?: string
          employee_id?: string | null
          funcao?: string | null
          id?: string
          nome?: string
          ordem?: number
          papel?: string
        }
        Relationships: [
          {
            foreignKeyName: "apr_assinaturas_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "aprs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apr_assinaturas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      apr_riscos: {
        Row: {
          acoes_preventivas: string | null
          apr_id: string
          catalogo_risco_id: string | null
          created_at: string
          efeitos_danos: string | null
          epis: string[]
          id: string
          nivel_risco: number | null
          nrs: string[]
          ordem: number
          passo_a_passo: string | null
          probabilidade: number
          responsavel_acoes: string | null
          risco_categoria: string | null
          risco_nome: string
          severidade: number
        }
        Insert: {
          acoes_preventivas?: string | null
          apr_id: string
          catalogo_risco_id?: string | null
          created_at?: string
          efeitos_danos?: string | null
          epis?: string[]
          id?: string
          nivel_risco?: number | null
          nrs?: string[]
          ordem?: number
          passo_a_passo?: string | null
          probabilidade?: number
          responsavel_acoes?: string | null
          risco_categoria?: string | null
          risco_nome: string
          severidade?: number
        }
        Update: {
          acoes_preventivas?: string | null
          apr_id?: string
          catalogo_risco_id?: string | null
          created_at?: string
          efeitos_danos?: string | null
          epis?: string[]
          id?: string
          nivel_risco?: number | null
          nrs?: string[]
          ordem?: number
          passo_a_passo?: string | null
          probabilidade?: number
          responsavel_acoes?: string | null
          risco_categoria?: string | null
          risco_nome?: string
          severidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "apr_riscos_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "aprs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apr_riscos_catalogo_risco_id_fkey"
            columns: ["catalogo_risco_id"]
            isOneToOne: false
            referencedRelation: "catalogo_riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      aprs: {
        Row: {
          atividade_descricao: string
          casco_id: string | null
          condicoes_climaticas: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          data_validade: string | null
          dias_semana: string[] | null
          empresa_id: string | null
          encarregado_id: string | null
          exige_pte: boolean
          hora_fim: string | null
          hora_fim_sexta: string | null
          hora_inicio: string | null
          hora_inicio_sexta: string | null
          id: string
          local: string | null
          numero: string
          observacoes_gerais: string | null
          pdf_path: string | null
          pte_id: string | null
          setor: string | null
          status: string
          texto_gerais: string | null
          tst_id: string | null
          updated_at: string
          validade_dias: number
        }
        Insert: {
          atividade_descricao: string
          casco_id?: string | null
          condicoes_climaticas?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_validade?: string | null
          dias_semana?: string[] | null
          empresa_id?: string | null
          encarregado_id?: string | null
          exige_pte?: boolean
          hora_fim?: string | null
          hora_fim_sexta?: string | null
          hora_inicio?: string | null
          hora_inicio_sexta?: string | null
          id?: string
          local?: string | null
          numero: string
          observacoes_gerais?: string | null
          pdf_path?: string | null
          pte_id?: string | null
          setor?: string | null
          status?: string
          texto_gerais?: string | null
          tst_id?: string | null
          updated_at?: string
          validade_dias?: number
        }
        Update: {
          atividade_descricao?: string
          casco_id?: string | null
          condicoes_climaticas?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_validade?: string | null
          dias_semana?: string[] | null
          empresa_id?: string | null
          encarregado_id?: string | null
          exige_pte?: boolean
          hora_fim?: string | null
          hora_fim_sexta?: string | null
          hora_inicio?: string | null
          hora_inicio_sexta?: string | null
          id?: string
          local?: string | null
          numero?: string
          observacoes_gerais?: string | null
          pdf_path?: string | null
          pte_id?: string | null
          setor?: string | null
          status?: string
          texto_gerais?: string | null
          tst_id?: string | null
          updated_at?: string
          validade_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "aprs_casco_id_fkey"
            columns: ["casco_id"]
            isOneToOne: false
            referencedRelation: "cascos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprs_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprs_pte_id_fkey"
            columns: ["pte_id"]
            isOneToOne: false
            referencedRelation: "ptes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprs_tst_id_fkey"
            columns: ["tst_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cascos: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_responsavel_id: string | null
          encarregado_id: string | null
          id: string
          nome: string | null
          numero: string
          observacoes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_responsavel_id?: string | null
          encarregado_id?: string | null
          id?: string
          nome?: string | null
          numero: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_responsavel_id?: string | null
          encarregado_id?: string | null
          id?: string
          nome?: string | null
          numero?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cascos_empresa_responsavel_id_fkey"
            columns: ["empresa_responsavel_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cascos_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_nrs: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      catalogo_riscos: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          efeitos_tipicos: string[]
          epis_sugeridos: string[]
          id: string
          medidas_controle_padrao: string[]
          nome: string
          nrs_aplicaveis: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          efeitos_tipicos?: string[]
          epis_sugeridos?: string[]
          id?: string
          medidas_controle_padrao?: string[]
          nome: string
          nrs_aplicaveis?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          efeitos_tipicos?: string[]
          epis_sugeridos?: string[]
          id?: string
          medidas_controle_padrao?: string[]
          nome?: string
          nrs_aplicaveis?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          data_entrada: string | null
          email: string | null
          encarregado1: string | null
          encarregado2: string | null
          id: string
          matriz_cnpj: string | null
          matriz_nome: string | null
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
          matriz_cnpj?: string | null
          matriz_nome?: string | null
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
          matriz_cnpj?: string | null
          matriz_nome?: string | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      dds: {
        Row: {
          aderencia: number | null
          conteudo: string | null
          created_at: string
          created_by: string | null
          data: string
          duracao_min: number
          gestor_id: string | null
          hora: string | null
          id: string
          incident_id: string | null
          observacoes: string | null
          participantes_esperados: number
          participantes_presentes: number
          setor: string | null
          status: string
          tema_id: string | null
          tema_livre: string | null
          temas_ids: string[]
          temas_livres: string[]
          updated_at: string
        }
        Insert: {
          aderencia?: number | null
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          duracao_min?: number
          gestor_id?: string | null
          hora?: string | null
          id?: string
          incident_id?: string | null
          observacoes?: string | null
          participantes_esperados?: number
          participantes_presentes?: number
          setor?: string | null
          status?: string
          tema_id?: string | null
          tema_livre?: string | null
          temas_ids?: string[]
          temas_livres?: string[]
          updated_at?: string
        }
        Update: {
          aderencia?: number | null
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          duracao_min?: number
          gestor_id?: string | null
          hora?: string | null
          id?: string
          incident_id?: string | null
          observacoes?: string | null
          participantes_esperados?: number
          participantes_presentes?: number
          setor?: string | null
          status?: string
          tema_id?: string | null
          tema_livre?: string | null
          temas_ids?: string[]
          temas_livres?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dds_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "dds_gestores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dds_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "dds_temas"
            referencedColumns: ["id"]
          },
        ]
      }
      dds_attendees: {
        Row: {
          created_at: string
          dds_id: string
          employee_id: string
          id: string
          observacao: string | null
          status: string
        }
        Insert: {
          created_at?: string
          dds_id: string
          employee_id: string
          id?: string
          observacao?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          dds_id?: string
          employee_id?: string
          id?: string
          observacao?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dds_attendees_dds_id_fkey"
            columns: ["dds_id"]
            isOneToOne: false
            referencedRelation: "dds"
            referencedColumns: ["id"]
          },
        ]
      }
      dds_evidencias: {
        Row: {
          dds_id: string
          descricao: string | null
          file_path: string
          id: string
          tipo: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          dds_id: string
          descricao?: string | null
          file_path: string
          id?: string
          tipo?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          dds_id?: string
          descricao?: string | null
          file_path?: string
          id?: string
          tipo?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dds_evidencias_dds_id_fkey"
            columns: ["dds_id"]
            isOneToOne: false
            referencedRelation: "dds"
            referencedColumns: ["id"]
          },
        ]
      }
      dds_gestores: {
        Row: {
          ativo: boolean
          created_at: string
          employee_id: string | null
          id: string
          nome: string
          setor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          employee_id?: string | null
          id?: string
          nome: string
          setor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          employee_id?: string | null
          id?: string
          nome?: string
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dds_temas: {
        Row: {
          ativo: boolean
          categoria: string
          codigo: number | null
          created_at: string
          criticidade: string
          id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          codigo?: number | null
          created_at?: string
          criticidade?: string
          id?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo?: number | null
          created_at?: string
          criticidade?: string
          id?: string
          titulo?: string
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
      employee_vaccinations: {
        Row: {
          anexo_path: string | null
          created_at: string
          data_aplicacao: string
          data_proxima_dose: string | null
          dose: string | null
          employee_id: string
          fabricante: string | null
          id: string
          lote: string | null
          observacoes: string | null
          tipo_vacina: string
        }
        Insert: {
          anexo_path?: string | null
          created_at?: string
          data_aplicacao: string
          data_proxima_dose?: string | null
          dose?: string | null
          employee_id: string
          fabricante?: string | null
          id?: string
          lote?: string | null
          observacoes?: string | null
          tipo_vacina: string
        }
        Update: {
          anexo_path?: string | null
          created_at?: string
          data_aplicacao?: string
          data_proxima_dose?: string | null
          dose?: string | null
          employee_id?: string
          fabricante?: string | null
          id?: string
          lote?: string | null
          observacoes?: string | null
          tipo_vacina?: string
        }
        Relationships: []
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
          data_devolucao_prevista: string | null
          data_entrega: string
          employee_id: string
          id: string
          item: string
          motivo_entrega: string
          observacoes: string | null
          qtd: number
          tamanho: string | null
          valor_unitario: number | null
        }
        Insert: {
          ca?: string | null
          created_at?: string
          data_devolucao?: string | null
          data_devolucao_prevista?: string | null
          data_entrega?: string
          employee_id: string
          id?: string
          item: string
          motivo_entrega?: string
          observacoes?: string | null
          qtd?: number
          tamanho?: string | null
          valor_unitario?: number | null
        }
        Update: {
          ca?: string | null
          created_at?: string
          data_devolucao?: string | null
          data_devolucao_prevista?: string | null
          data_entrega?: string
          employee_id?: string
          id?: string
          item?: string
          motivo_entrega?: string
          observacoes?: string | null
          qtd?: number
          tamanho?: string | null
          valor_unitario?: number | null
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
      estoque_epi: {
        Row: {
          ca: string | null
          ca_validade: string | null
          codigo_material: string
          created_at: string
          estoque_minimo: number
          id: string
          imagem_url: string | null
          nome_material: string
          numero_pedido: string | null
          quantidade_atual: number
          ultimo_fornecedor: string | null
          updated_at: string
        }
        Insert: {
          ca?: string | null
          ca_validade?: string | null
          codigo_material: string
          created_at?: string
          estoque_minimo?: number
          id?: string
          imagem_url?: string | null
          nome_material: string
          numero_pedido?: string | null
          quantidade_atual?: number
          ultimo_fornecedor?: string | null
          updated_at?: string
        }
        Update: {
          ca?: string | null
          ca_validade?: string | null
          codigo_material?: string
          created_at?: string
          estoque_minimo?: number
          id?: string
          imagem_url?: string | null
          nome_material?: string
          numero_pedido?: string | null
          quantidade_atual?: number
          ultimo_fornecedor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estoque_epi_monthly_snapshots: {
        Row: {
          created_at: string
          epi_id: string
          estoque_inicial: number
          month: number
          year: number
        }
        Insert: {
          created_at?: string
          epi_id: string
          estoque_inicial?: number
          month: number
          year: number
        }
        Update: {
          created_at?: string
          epi_id?: string
          estoque_inicial?: number
          month?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "estoque_epi_monthly_snapshots_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "estoque_epi"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_catalog: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          procedimento: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          procedimento: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          procedimento?: string
          updated_at?: string
        }
        Relationships: []
      }
      historico_entregas: {
        Row: {
          cpf_colaborador: string
          created_by: string | null
          data_entrega: string
          epi_id: string
          id: string
          nome_colaborador: string
          quantidade_entregue: number
          tipo_movimentacao: Database["public"]["Enums"]["tipo_movimentacao_epi"]
        }
        Insert: {
          cpf_colaborador: string
          created_by?: string | null
          data_entrega?: string
          epi_id: string
          id?: string
          nome_colaborador: string
          quantidade_entregue: number
          tipo_movimentacao?: Database["public"]["Enums"]["tipo_movimentacao_epi"]
        }
        Update: {
          cpf_colaborador?: string
          created_by?: string | null
          data_entrega?: string
          epi_id?: string
          id?: string
          nome_colaborador?: string
          quantidade_entregue?: number
          tipo_movimentacao?: Database["public"]["Enums"]["tipo_movimentacao_epi"]
        }
        Relationships: [
          {
            foreignKeyName: "historico_entregas_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "estoque_epi"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_embarcacoes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ncm: string | null
          nome: string
          numero_casco: string | null
          observacoes: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ncm?: string | null
          nome: string
          numero_casco?: string | null
          observacoes?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ncm?: string | null
          nome?: string
          numero_casco?: string | null
          observacoes?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      producao_materiais: {
        Row: {
          canal_distribuicao: string | null
          centro: string | null
          classe_avaliacao: string | null
          codigo_material: string
          controle_preco: string | null
          created_at: string
          created_by: string | null
          data_solicitacao: string | null
          deposito: string | null
          descricao: string
          determ_preco: string | null
          embarcacao_id: string | null
          grupo_categ_item: string | null
          grupo_compradores: string | null
          grupo_mercadorias: string | null
          id: string
          item_solicitacao: number | null
          ncm: string | null
          observacoes: string | null
          org_vendas: string | null
          setor_atividade: string | null
          tipo_embarcacao: string | null
          tipo_material: string
          umb: string | null
          unidade_preco: number | null
          updated_at: string
        }
        Insert: {
          canal_distribuicao?: string | null
          centro?: string | null
          classe_avaliacao?: string | null
          codigo_material: string
          controle_preco?: string | null
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string | null
          deposito?: string | null
          descricao: string
          determ_preco?: string | null
          embarcacao_id?: string | null
          grupo_categ_item?: string | null
          grupo_compradores?: string | null
          grupo_mercadorias?: string | null
          id?: string
          item_solicitacao?: number | null
          ncm?: string | null
          observacoes?: string | null
          org_vendas?: string | null
          setor_atividade?: string | null
          tipo_embarcacao?: string | null
          tipo_material: string
          umb?: string | null
          unidade_preco?: number | null
          updated_at?: string
        }
        Update: {
          canal_distribuicao?: string | null
          centro?: string | null
          classe_avaliacao?: string | null
          codigo_material?: string
          controle_preco?: string | null
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string | null
          deposito?: string | null
          descricao?: string
          determ_preco?: string | null
          embarcacao_id?: string | null
          grupo_categ_item?: string | null
          grupo_compradores?: string | null
          grupo_mercadorias?: string | null
          id?: string
          item_solicitacao?: number | null
          ncm?: string | null
          observacoes?: string | null
          org_vendas?: string | null
          setor_atividade?: string | null
          tipo_embarcacao?: string | null
          tipo_material?: string
          umb?: string | null
          unidade_preco?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_materiais_embarcacao_id_fkey"
            columns: ["embarcacao_id"]
            isOneToOne: false
            referencedRelation: "producao_embarcacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_ordem_itens: {
        Row: {
          centro: string | null
          classe_avaliacao: string | null
          codigo_sap: string | null
          controle_preco: string | null
          created_at: string
          data_solicitacao: string | null
          deposito: string | null
          descricao_material: string
          determ_preco: string | null
          grupo_categ_item_ger: string | null
          grupo_compradores: string | null
          grupo_mercadorias: string | null
          id: string
          item: number
          material_id: string | null
          ncm: string | null
          ocorrencia: string | null
          ordem_id: string
          origem_material: string | null
          setor_atividade: string | null
          unidade_medida: string | null
          updated_at: string
          utilizacao_material: string | null
        }
        Insert: {
          centro?: string | null
          classe_avaliacao?: string | null
          codigo_sap?: string | null
          controle_preco?: string | null
          created_at?: string
          data_solicitacao?: string | null
          deposito?: string | null
          descricao_material: string
          determ_preco?: string | null
          grupo_categ_item_ger?: string | null
          grupo_compradores?: string | null
          grupo_mercadorias?: string | null
          id?: string
          item: number
          material_id?: string | null
          ncm?: string | null
          ocorrencia?: string | null
          ordem_id: string
          origem_material?: string | null
          setor_atividade?: string | null
          unidade_medida?: string | null
          updated_at?: string
          utilizacao_material?: string | null
        }
        Update: {
          centro?: string | null
          classe_avaliacao?: string | null
          codigo_sap?: string | null
          controle_preco?: string | null
          created_at?: string
          data_solicitacao?: string | null
          deposito?: string | null
          descricao_material?: string
          determ_preco?: string | null
          grupo_categ_item_ger?: string | null
          grupo_compradores?: string | null
          grupo_mercadorias?: string | null
          id?: string
          item?: number
          material_id?: string | null
          ncm?: string | null
          ocorrencia?: string | null
          ordem_id?: string
          origem_material?: string | null
          setor_atividade?: string | null
          unidade_medida?: string | null
          updated_at?: string
          utilizacao_material?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_ordem_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "producao_materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordem_itens_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_ordens: {
        Row: {
          codigo_formulario: string
          created_at: string
          created_by: string | null
          data_solicitacao: string
          embarcacao_id: string | null
          id: string
          numero: string
          observacoes: string | null
          pagina: string
          revisao: string
          status: string
          tipo_ordem: string
          updated_at: string
        }
        Insert: {
          codigo_formulario?: string
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          embarcacao_id?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          pagina?: string
          revisao?: string
          status?: string
          tipo_ordem?: string
          updated_at?: string
        }
        Update: {
          codigo_formulario?: string
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          embarcacao_id?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          pagina?: string
          revisao?: string
          status?: string
          tipo_ordem?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_ordens_embarcacao_id_fkey"
            columns: ["embarcacao_id"]
            isOneToOne: false
            referencedRelation: "producao_embarcacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_tipos_produto: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      producao_unidades_medida: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          sigla: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          sigla: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          sigla?: string
        }
        Relationships: []
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
          apr_id: string | null
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
          apr_id?: string | null
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
          apr_id?: string | null
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
      purchase_requisition_items: {
        Row: {
          created_at: string
          descricao: string
          id: string
          item_numero: number
          observacao: string | null
          quantidade: number | null
          requisition_id: string
          unidade: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          item_numero: number
          observacao?: string | null
          quantidade?: number | null
          requisition_id: string
          unidade?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          item_numero?: number
          observacao?: string | null
          quantidade?: number | null
          requisition_id?: string
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          classificacao: Database["public"]["Enums"]["purchase_req_class"]
          codigo_formulario: string | null
          created_at: string
          created_by: string | null
          data_requisicao: string
          data_revisao: string | null
          fornecedor: string | null
          id: string
          motivo_indeferimento: string | null
          numero: string
          obra_construcao: string | null
          obra_manutencao: string | null
          observacoes: string | null
          pagina: string | null
          revisao: string | null
          setor: string | null
          solicitante: string
          status: Database["public"]["Enums"]["purchase_req_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          classificacao?: Database["public"]["Enums"]["purchase_req_class"]
          codigo_formulario?: string | null
          created_at?: string
          created_by?: string | null
          data_requisicao?: string
          data_revisao?: string | null
          fornecedor?: string | null
          id?: string
          motivo_indeferimento?: string | null
          numero: string
          obra_construcao?: string | null
          obra_manutencao?: string | null
          observacoes?: string | null
          pagina?: string | null
          revisao?: string | null
          setor?: string | null
          solicitante: string
          status?: Database["public"]["Enums"]["purchase_req_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          classificacao?: Database["public"]["Enums"]["purchase_req_class"]
          codigo_formulario?: string | null
          created_at?: string
          created_by?: string | null
          data_requisicao?: string
          data_revisao?: string | null
          fornecedor?: string | null
          id?: string
          motivo_indeferimento?: string | null
          numero?: string
          obra_construcao?: string | null
          obra_manutencao?: string | null
          observacoes?: string | null
          pagina?: string | null
          revisao?: string | null
          setor?: string | null
          solicitante?: string
          status?: Database["public"]["Enums"]["purchase_req_status"]
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          ativo: boolean
          cbo: string | null
          created_at: string
          exames_por_natureza: Json
          ghe: string | null
          id: string
          name: string
          req_aso: boolean
          req_exames: string[]
          req_integra: boolean
          req_nrs: string[]
          req_vacinas: string[]
          risco_biologico: boolean
          riscos: Json
          setor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cbo?: string | null
          created_at?: string
          exames_por_natureza?: Json
          ghe?: string | null
          id?: string
          name: string
          req_aso?: boolean
          req_exames?: string[]
          req_integra?: boolean
          req_nrs?: string[]
          req_vacinas?: string[]
          risco_biologico?: boolean
          riscos?: Json
          setor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cbo?: string | null
          created_at?: string
          exames_por_natureza?: Json
          ghe?: string | null
          id?: string
          name?: string
          req_aso?: boolean
          req_exames?: string[]
          req_integra?: boolean
          req_nrs?: string[]
          req_vacinas?: string[]
          risco_biologico?: boolean
          riscos?: Json
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      safety_overrides: {
        Row: {
          ativo: boolean
          created_at: string
          employee_id: string
          expira_em: string | null
          id: string
          item_key: string | null
          justificativa: string
          liberado_em: string
          liberado_por: string
          liberado_por_email: string | null
          motivo_revogacao: string | null
          revogado_em: string | null
          revogado_por: string | null
          scope: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          employee_id: string
          expira_em?: string | null
          id?: string
          item_key?: string | null
          justificativa: string
          liberado_em?: string
          liberado_por: string
          liberado_por_email?: string | null
          motivo_revogacao?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          scope: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          employee_id?: string
          expira_em?: string | null
          id?: string
          item_key?: string | null
          justificativa?: string
          liberado_em?: string
          liberado_por?: string
          liberado_por_email?: string | null
          motivo_revogacao?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          scope?: string
        }
        Relationships: []
      }
      sesmt_document_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          data_revisao: string
          descricao: string
          document_id: string
          id: string
          motivo: string | null
          numero_revisao: string
          responsavel: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_revisao: string
          descricao: string
          document_id: string
          id?: string
          motivo?: string | null
          numero_revisao: string
          responsavel: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_revisao?: string
          descricao?: string
          document_id?: string
          id?: string
          motivo?: string | null
          numero_revisao?: string
          responsavel?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesmt_document_revisions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sesmt_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sesmt_documents: {
        Row: {
          company_id: string | null
          data_emissao: string | null
          data_validade: string | null
          descricao: string | null
          file_path: string
          id: string
          tipo: string
          titulo: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          file_path: string
          id?: string
          tipo: string
          titulo?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          file_path?: string
          id?: string
          tipo?: string
          titulo?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      temp_admins: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      training_attendees: {
        Row: {
          certificado_path: string | null
          created_at: string
          data_vencimento: string | null
          employee_id: string
          id: string
          nota: number | null
          observacoes: string | null
          situacao: string
          training_id: string
        }
        Insert: {
          certificado_path?: string | null
          created_at?: string
          data_vencimento?: string | null
          employee_id: string
          id?: string
          nota?: number | null
          observacoes?: string | null
          situacao?: string
          training_id: string
        }
        Update: {
          certificado_path?: string | null
          created_at?: string
          data_vencimento?: string | null
          employee_id?: string
          id?: string
          nota?: number | null
          observacoes?: string | null
          situacao?: string
          training_id?: string
        }
        Relationships: []
      }
      trainings: {
        Row: {
          anexo_path: string | null
          carga_horaria_h: number
          created_at: string
          created_by: string | null
          data_realizacao: string
          id: string
          instituicao: string | null
          instrutor: string | null
          observacoes: string | null
          tipo: string
          titulo: string | null
          updated_at: string
          validade_meses: number
        }
        Insert: {
          anexo_path?: string | null
          carga_horaria_h?: number
          created_at?: string
          created_by?: string | null
          data_realizacao: string
          id?: string
          instituicao?: string | null
          instrutor?: string | null
          observacoes?: string | null
          tipo: string
          titulo?: string | null
          updated_at?: string
          validade_meses?: number
        }
        Update: {
          anexo_path?: string | null
          carga_horaria_h?: number
          created_at?: string
          created_by?: string | null
          data_realizacao?: string
          id?: string
          instituicao?: string | null
          instrutor?: string | null
          observacoes?: string | null
          tipo?: string
          titulo?: string | null
          updated_at?: string
          validade_meses?: number
        }
        Relationships: []
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          modules: Database["public"]["Enums"]["app_module"][]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by?: string | null
          modules?: Database["public"]["Enums"]["app_module"][]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          modules?: Database["public"]["Enums"]["app_module"][]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_module_access: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id?: string
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
      ajustar_saldo_epi: {
        Args: { _epi_id: string; _novo_saldo: number }
        Returns: undefined
      }
      current_aal: { Args: never; Returns: string }
      gerar_numero_apr: { Args: never; Returns: string }
      has_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_editor: { Args: { _user_id: string }; Returns: boolean }
      is_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_viewer_or_above: { Args: { _user_id: string }; Returns: boolean }
      mfa_ok: { Args: never; Returns: boolean }
      peek_proximo_numero_apr: { Args: never; Returns: string }
      registrar_entrega_epi: {
        Args: { _cpf: string; _epi_id: string; _nome: string; _qtd: number }
        Returns: string
      }
      registrar_movimentacao_epi: {
        Args: {
          _cpf?: string
          _epi_id: string
          _fornecedor?: string
          _nome?: string
          _qtd: number
          _tipo: Database["public"]["Enums"]["tipo_movimentacao_epi"]
        }
        Returns: string
      }
      requires_mfa: { Args: { _user_id: string }; Returns: boolean }
      snapshot_estoque_epi_monthly: { Args: never; Returns: undefined }
    }
    Enums: {
      app_module:
        | "sesmt"
        | "estoque"
        | "producao"
        | "manutencao"
        | "portaria"
        | "usuarios"
      app_role: "admin" | "tst" | "viewer" | "moderador" | "editor"
      purchase_req_class: "MATERIAL" | "SERVICO"
      purchase_req_status: "PENDENTE" | "APROVADA" | "INDEFERIDA"
      tipo_movimentacao_epi: "SAIDA_ENTREGA" | "ENTRADA_REPOSICAO" | "DEVOLUCAO"
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
      app_module: [
        "sesmt",
        "estoque",
        "producao",
        "manutencao",
        "portaria",
        "usuarios",
      ],
      app_role: ["admin", "tst", "viewer", "moderador", "editor"],
      purchase_req_class: ["MATERIAL", "SERVICO"],
      purchase_req_status: ["PENDENTE", "APROVADA", "INDEFERIDA"],
      tipo_movimentacao_epi: [
        "SAIDA_ENTREGA",
        "ENTRADA_REPOSICAO",
        "DEVOLUCAO",
      ],
    },
  },
} as const
