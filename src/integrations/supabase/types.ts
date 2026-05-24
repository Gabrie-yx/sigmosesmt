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
      apr_modelos: {
        Row: {
          atividade_descricao: string
          ativo: boolean
          categoria: string
          codigo: string
          condicoes_climaticas: string | null
          created_at: string
          descricao_curta: string | null
          exige_pte: boolean
          id: string
          local_padrao: string | null
          nome: string
          observacoes_gerais: string | null
          ordem: number
          ptes_sugeridas: string[]
          riscos: Json
          setor_padrao: string | null
          updated_at: string
        }
        Insert: {
          atividade_descricao: string
          ativo?: boolean
          categoria: string
          codigo: string
          condicoes_climaticas?: string | null
          created_at?: string
          descricao_curta?: string | null
          exige_pte?: boolean
          id?: string
          local_padrao?: string | null
          nome: string
          observacoes_gerais?: string | null
          ordem?: number
          ptes_sugeridas?: string[]
          riscos?: Json
          setor_padrao?: string | null
          updated_at?: string
        }
        Update: {
          atividade_descricao?: string
          ativo?: boolean
          categoria?: string
          codigo?: string
          condicoes_climaticas?: string | null
          created_at?: string
          descricao_curta?: string | null
          exige_pte?: boolean
          id?: string
          local_padrao?: string | null
          nome?: string
          observacoes_gerais?: string | null
          ordem?: number
          ptes_sugeridas?: string[]
          riscos?: Json
          setor_padrao?: string | null
          updated_at?: string
        }
        Relationships: []
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
          armador: string | null
          comprimento_total: number | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_responsavel_id: string | null
          encarregado_id: string | null
          id: string
          inicio_obra: string | null
          licenca_provisoria: string | null
          nome: string | null
          numero: string
          observacoes: string | null
          prazo_dias: number | null
          status: string
          tipo_embarcacao: string | null
          updated_at: string
        }
        Insert: {
          armador?: string | null
          comprimento_total?: number | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_responsavel_id?: string | null
          encarregado_id?: string | null
          id?: string
          inicio_obra?: string | null
          licenca_provisoria?: string | null
          nome?: string | null
          numero: string
          observacoes?: string | null
          prazo_dias?: number | null
          status?: string
          tipo_embarcacao?: string | null
          updated_at?: string
        }
        Update: {
          armador?: string | null
          comprimento_total?: number | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_responsavel_id?: string | null
          encarregado_id?: string | null
          id?: string
          inicio_obra?: string | null
          licenca_provisoria?: string | null
          nome?: string | null
          numero?: string
          observacoes?: string | null
          prazo_dias?: number | null
          status?: string
          tipo_embarcacao?: string | null
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
      checklist_arquivos_legados: {
        Row: {
          ano: number
          equipamento_id: string
          id: string
          mes: number
          observacao: string | null
          pdf_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          ano: number
          equipamento_id: string
          id?: string
          mes: number
          observacao?: string | null
          pdf_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          ano?: number
          equipamento_id?: string
          id?: string
          mes?: number
          observacao?: string | null
          pdf_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_arquivos_legados_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_moveis"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_execucoes: {
        Row: {
          assinatura_path: string | null
          created_at: string
          created_by: string | null
          data: string
          encarregado_id: string | null
          encarregado_nome: string | null
          equipamento_id: string
          horimetro_final: number | null
          horimetro_inicial: number | null
          id: string
          mecanico_id: string | null
          mecanico_nome: string | null
          modelo_id: string
          observacoes: string | null
          operador_id: string | null
          operador_nome: string | null
          status: string
          total_itens: number | null
          total_na: number | null
          total_nc: number | null
          total_ok: number | null
          updated_at: string
        }
        Insert: {
          assinatura_path?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          encarregado_id?: string | null
          encarregado_nome?: string | null
          equipamento_id: string
          horimetro_final?: number | null
          horimetro_inicial?: number | null
          id?: string
          mecanico_id?: string | null
          mecanico_nome?: string | null
          modelo_id: string
          observacoes?: string | null
          operador_id?: string | null
          operador_nome?: string | null
          status?: string
          total_itens?: number | null
          total_na?: number | null
          total_nc?: number | null
          total_ok?: number | null
          updated_at?: string
        }
        Update: {
          assinatura_path?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          encarregado_id?: string | null
          encarregado_nome?: string | null
          equipamento_id?: string
          horimetro_final?: number | null
          horimetro_inicial?: number | null
          id?: string
          mecanico_id?: string | null
          mecanico_nome?: string | null
          modelo_id?: string
          observacoes?: string | null
          operador_id?: string | null
          operador_nome?: string | null
          status?: string
          total_itens?: number | null
          total_na?: number | null
          total_nc?: number | null
          total_ok?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_execucoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_moveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_modelo_itens: {
        Row: {
          ativo: boolean
          created_at: string
          criticidade: string
          descricao: string
          id: string
          numero: string
          ordem: number
          secao_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criticidade?: string
          descricao: string
          id?: string
          numero: string
          ordem?: number
          secao_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criticidade?: string
          descricao?: string
          id?: string
          numero?: string
          ordem?: number
          secao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_modelo_itens_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelo_secoes"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_modelo_secoes: {
        Row: {
          created_at: string
          id: string
          modelo_id: string
          numero: number
          ordem: number
          subgrupo: string | null
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          modelo_id: string
          numero: number
          ordem?: number
          subgrupo?: string | null
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          modelo_id?: string
          numero?: number
          ordem?: number
          subgrupo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_modelo_secoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_modelos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          data_revisao: string | null
          id: string
          nome: string
          revisao: string | null
          tipo_equipamento: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          data_revisao?: string | null
          id?: string
          nome: string
          revisao?: string | null
          tipo_equipamento: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          data_revisao?: string | null
          id?: string
          nome?: string
          revisao?: string | null
          tipo_equipamento?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklist_respostas: {
        Row: {
          created_at: string
          execucao_id: string
          foto_path: string | null
          id: string
          item_id: string
          observacao: string | null
          os_numero: string | null
          resposta: string
        }
        Insert: {
          created_at?: string
          execucao_id: string
          foto_path?: string | null
          id?: string
          item_id: string
          observacao?: string | null
          os_numero?: string | null
          resposta: string
        }
        Update: {
          created_at?: string
          execucao_id?: string
          foto_path?: string | null
          id?: string
          item_id?: string
          observacao?: string | null
          os_numero?: string | null
          resposta?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_respostas_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "checklist_execucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelo_itens"
            referencedColumns: ["id"]
          },
        ]
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
      controle_doc_anexos: {
        Row: {
          descricao: string | null
          documento_id: string
          file_path: string
          id: string
          nome_original: string | null
          tipo: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          descricao?: string | null
          documento_id: string
          file_path: string
          id?: string
          nome_original?: string | null
          tipo?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          descricao?: string | null
          documento_id?: string
          file_path?: string
          id?: string
          nome_original?: string | null
          tipo?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controle_doc_anexos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "controle_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_doc_categorias: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          criticidade_sugerida: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          criticidade_sugerida?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          criticidade_sugerida?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      controle_doc_historico: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          alterado_por_email: string | null
          campo: string
          documento_id: string
          id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          alterado_por_email?: string | null
          campo: string
          documento_id: string
          id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          alterado_por_email?: string | null
          campo?: string
          documento_id?: string
          id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controle_doc_historico_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "controle_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_doc_recorrentes: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          created_by: string | null
          criticidade: string
          dias_aviso_previo: number
          id: string
          nome: string
          observacoes: string | null
          periodicidade_meses: number
          proxima_validade: string | null
          responsavel_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          criticidade?: string
          dias_aviso_previo?: number
          id?: string
          nome: string
          observacoes?: string | null
          periodicidade_meses?: number
          proxima_validade?: string | null
          responsavel_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          criticidade?: string
          dias_aviso_previo?: number
          id?: string
          nome?: string
          observacoes?: string | null
          periodicidade_meses?: number
          proxima_validade?: string | null
          responsavel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controle_doc_recorrentes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "controle_doc_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_doc_recorrentes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_documentos: {
        Row: {
          categoria_id: string | null
          created_at: string
          created_by: string | null
          criticidade: string
          data_recebimento: string
          data_resolucao: string | null
          descricao: string | null
          id: string
          numero: string
          observacao_fechamento: string | null
          origem: string
          prazo: string | null
          recorrente_id: string | null
          remetente_contato: string | null
          remetente_nome: string | null
          responsavel_id: string | null
          status: string
          tags: string[]
          terceiro_followup_em: string | null
          terceiro_nome: string | null
          titulo: string
          tratativa: string | null
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          criticidade?: string
          data_recebimento?: string
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          numero: string
          observacao_fechamento?: string | null
          origem?: string
          prazo?: string | null
          recorrente_id?: string | null
          remetente_contato?: string | null
          remetente_nome?: string | null
          responsavel_id?: string | null
          status?: string
          tags?: string[]
          terceiro_followup_em?: string | null
          terceiro_nome?: string | null
          titulo: string
          tratativa?: string | null
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          criticidade?: string
          data_recebimento?: string
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          numero?: string
          observacao_fechamento?: string | null
          origem?: string
          prazo?: string | null
          recorrente_id?: string | null
          remetente_contato?: string | null
          remetente_nome?: string | null
          responsavel_id?: string | null
          status?: string
          tags?: string[]
          terceiro_followup_em?: string | null
          terceiro_nome?: string | null
          titulo?: string
          tratativa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controle_documentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "controle_doc_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_documentos_recorrente_id_fkey"
            columns: ["recorrente_id"]
            isOneToOne: false
            referencedRelation: "controle_doc_recorrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_documentos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      dds: {
        Row: {
          aderencia: number | null
          company_id: string | null
          conteudo: string | null
          created_at: string
          created_by: string | null
          data: string
          duracao_min: number
          encarregado: string | null
          gestor_id: string | null
          hora: string | null
          hora_fim: string | null
          id: string
          incident_id: string | null
          observacoes: string | null
          participantes_esperados: number
          participantes_presentes: number
          responsavel_sesmt: string | null
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
          company_id?: string | null
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          duracao_min?: number
          encarregado?: string | null
          gestor_id?: string | null
          hora?: string | null
          hora_fim?: string | null
          id?: string
          incident_id?: string | null
          observacoes?: string | null
          participantes_esperados?: number
          participantes_presentes?: number
          responsavel_sesmt?: string | null
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
          company_id?: string | null
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          duracao_min?: number
          encarregado?: string | null
          gestor_id?: string | null
          hora?: string | null
          hora_fim?: string | null
          id?: string
          incident_id?: string | null
          observacoes?: string | null
          participantes_esperados?: number
          participantes_presentes?: number
          responsavel_sesmt?: string | null
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
          setor: string | null
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
          setor?: string | null
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
          setor?: string | null
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
      equipamentos_moveis: {
        Row: {
          ano: number | null
          created_at: string
          created_by: string | null
          empresa_responsavel_id: string | null
          fabricante: string | null
          foto_path: string | null
          horimetro_atual: number | null
          id: string
          modelo: string | null
          modelo_checklist_id: string | null
          nome: string
          numero_patrimonio: string | null
          numero_serie: string | null
          observacoes: string | null
          status: string
          tag: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          created_at?: string
          created_by?: string | null
          empresa_responsavel_id?: string | null
          fabricante?: string | null
          foto_path?: string | null
          horimetro_atual?: number | null
          id?: string
          modelo?: string | null
          modelo_checklist_id?: string | null
          nome: string
          numero_patrimonio?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          status?: string
          tag: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          created_at?: string
          created_by?: string | null
          empresa_responsavel_id?: string | null
          fabricante?: string | null
          foto_path?: string | null
          horimetro_atual?: number | null
          id?: string
          modelo?: string | null
          modelo_checklist_id?: string | null
          nome?: string
          numero_patrimonio?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          status?: string
          tag?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
      extintor_inspecoes: {
        Row: {
          conforme: boolean
          created_at: string
          created_by: string | null
          data_inspecao: string
          extintor_id: string
          foto_path: string | null
          id: string
          nao_conformidade: string | null
          nc_codigos: number[]
          observacoes: string | null
          responsavel_nome: string
          responsavel_registro: string | null
        }
        Insert: {
          conforme?: boolean
          created_at?: string
          created_by?: string | null
          data_inspecao?: string
          extintor_id: string
          foto_path?: string | null
          id?: string
          nao_conformidade?: string | null
          nc_codigos?: number[]
          observacoes?: string | null
          responsavel_nome: string
          responsavel_registro?: string | null
        }
        Update: {
          conforme?: boolean
          created_at?: string
          created_by?: string | null
          data_inspecao?: string
          extintor_id?: string
          foto_path?: string | null
          id?: string
          nao_conformidade?: string | null
          nc_codigos?: number[]
          observacoes?: string | null
          responsavel_nome?: string
          responsavel_registro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extintor_inspecoes_extintor_id_fkey"
            columns: ["extintor_id"]
            isOneToOne: false
            referencedRelation: "extintores"
            referencedColumns: ["id"]
          },
        ]
      }
      extintores: {
        Row: {
          ano_teste_hidrostatico: number | null
          area: string
          capacidade_extintora: string | null
          carga_nominal: number | null
          carga_unidade: string | null
          created_at: string
          created_by: string | null
          data_fabricacao: string | null
          data_ultima_recarga: string | null
          empresa_responsavel: string | null
          fabricante: string | null
          foto_path: string | null
          id: string
          localizacao: string
          numero: string
          numero_selo_inmetro: string | null
          observacoes: string | null
          proxima_recarga: string | null
          proximo_teste_hidrostatico: number | null
          status: Database["public"]["Enums"]["extintor_status"]
          tipo_agente: Database["public"]["Enums"]["extintor_tipo_agente"]
          updated_at: string
        }
        Insert: {
          ano_teste_hidrostatico?: number | null
          area: string
          capacidade_extintora?: string | null
          carga_nominal?: number | null
          carga_unidade?: string | null
          created_at?: string
          created_by?: string | null
          data_fabricacao?: string | null
          data_ultima_recarga?: string | null
          empresa_responsavel?: string | null
          fabricante?: string | null
          foto_path?: string | null
          id?: string
          localizacao: string
          numero: string
          numero_selo_inmetro?: string | null
          observacoes?: string | null
          proxima_recarga?: string | null
          proximo_teste_hidrostatico?: number | null
          status?: Database["public"]["Enums"]["extintor_status"]
          tipo_agente: Database["public"]["Enums"]["extintor_tipo_agente"]
          updated_at?: string
        }
        Update: {
          ano_teste_hidrostatico?: number | null
          area?: string
          capacidade_extintora?: string | null
          carga_nominal?: number | null
          carga_unidade?: string | null
          created_at?: string
          created_by?: string | null
          data_fabricacao?: string | null
          data_ultima_recarga?: string | null
          empresa_responsavel?: string | null
          fabricante?: string | null
          foto_path?: string | null
          id?: string
          localizacao?: string
          numero?: string
          numero_selo_inmetro?: string | null
          observacoes?: string | null
          proxima_recarga?: string | null
          proximo_teste_hidrostatico?: number | null
          status?: Database["public"]["Enums"]["extintor_status"]
          tipo_agente?: Database["public"]["Enums"]["extintor_tipo_agente"]
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
      hora_extra_sabado: {
        Row: {
          centro_custo: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          data: string
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          observacao: string | null
          setor: string | null
          tipo_efetivo: string
          turno: string | null
          updated_at: string
        }
        Insert: {
          centro_custo?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          observacao?: string | null
          setor?: string | null
          tipo_efetivo?: string
          turno?: string | null
          updated_at?: string
        }
        Update: {
          centro_custo?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          observacao?: string | null
          setor?: string | null
          tipo_efetivo?: string
          turno?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hora_extra_sabado_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hora_extra_sabado_funcionarios: {
        Row: {
          alimentacao: boolean
          created_at: string
          employee_id: string | null
          externo: boolean
          funcao: string | null
          hora_extra_id: string
          id: string
          nome: string
          ordem: number
          presenca: string | null
          transporte: boolean
        }
        Insert: {
          alimentacao?: boolean
          created_at?: string
          employee_id?: string | null
          externo?: boolean
          funcao?: string | null
          hora_extra_id: string
          id?: string
          nome: string
          ordem?: number
          presenca?: string | null
          transporte?: boolean
        }
        Update: {
          alimentacao?: boolean
          created_at?: string
          employee_id?: string | null
          externo?: boolean
          funcao?: string | null
          hora_extra_id?: string
          id?: string
          nome?: string
          ordem?: number
          presenca?: string | null
          transporte?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hora_extra_sabado_funcionarios_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hora_extra_sabado_funcionarios_hora_extra_id_fkey"
            columns: ["hora_extra_id"]
            isOneToOne: false
            referencedRelation: "hora_extra_sabado"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes: {
        Row: {
          acoes_corretivas: string | null
          cat_emitida: boolean | null
          cat_numero: string | null
          causa_raiz: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          data_investigacao: string | null
          data_ocorrencia: string
          descricao: string
          envolvidos: Json | null
          gravidade: string
          id: string
          investigador_id: string | null
          local: string | null
          numero: string | null
          status: string
          testemunhas: Json | null
          tipo: string
          updated_at: string
        }
        Insert: {
          acoes_corretivas?: string | null
          cat_emitida?: boolean | null
          cat_numero?: string | null
          causa_raiz?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_investigacao?: string | null
          data_ocorrencia?: string
          descricao: string
          envolvidos?: Json | null
          gravidade?: string
          id?: string
          investigador_id?: string | null
          local?: string | null
          numero?: string | null
          status?: string
          testemunhas?: Json | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          acoes_corretivas?: string | null
          cat_emitida?: boolean | null
          cat_numero?: string | null
          causa_raiz?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_investigacao?: string | null
          data_ocorrencia?: string
          descricao?: string
          envolvidos?: Json | null
          gravidade?: string
          id?: string
          investigador_id?: string | null
          local?: string | null
          numero?: string | null
          status?: string
          testemunhas?: Json | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      nao_conformidades: {
        Row: {
          abrangencia: string | null
          acao_imediata: string | null
          acoes_corretivas_lista: Json | null
          acoes_imediatas_lista: Json | null
          acoes_implementadas: boolean | null
          analise_causa: string | null
          causa_raiz: string | null
          classificacao: string | null
          comentarios_eficacia: string | null
          comentarios_implementacao: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          data_fechamento: string | null
          data_identificacao: string
          data_implementacao: string | null
          data_limite: string | null
          departamento: string | null
          descricao: string | null
          eficaz: boolean | null
          emitente: string | null
          enviado_para: string | null
          id: string
          norma: string | null
          novo_prazo: string | null
          numero: string | null
          origem: string | null
          pendencia_origem: string | null
          porques: Json | null
          prazo_verificacao_eficacia: string | null
          reincidente: boolean | null
          requisito: string | null
          responsavel_fechamento: string | null
          responsavel_id: string | null
          severidade: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          abrangencia?: string | null
          acao_imediata?: string | null
          acoes_corretivas_lista?: Json | null
          acoes_imediatas_lista?: Json | null
          acoes_implementadas?: boolean | null
          analise_causa?: string | null
          causa_raiz?: string | null
          classificacao?: string | null
          comentarios_eficacia?: string | null
          comentarios_implementacao?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_fechamento?: string | null
          data_identificacao?: string
          data_implementacao?: string | null
          data_limite?: string | null
          departamento?: string | null
          descricao?: string | null
          eficaz?: boolean | null
          emitente?: string | null
          enviado_para?: string | null
          id?: string
          norma?: string | null
          novo_prazo?: string | null
          numero?: string | null
          origem?: string | null
          pendencia_origem?: string | null
          porques?: Json | null
          prazo_verificacao_eficacia?: string | null
          reincidente?: boolean | null
          requisito?: string | null
          responsavel_fechamento?: string | null
          responsavel_id?: string | null
          severidade?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          abrangencia?: string | null
          acao_imediata?: string | null
          acoes_corretivas_lista?: Json | null
          acoes_imediatas_lista?: Json | null
          acoes_implementadas?: boolean | null
          analise_causa?: string | null
          causa_raiz?: string | null
          classificacao?: string | null
          comentarios_eficacia?: string | null
          comentarios_implementacao?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_fechamento?: string | null
          data_identificacao?: string
          data_implementacao?: string | null
          data_limite?: string | null
          departamento?: string | null
          descricao?: string | null
          eficaz?: boolean | null
          emitente?: string | null
          enviado_para?: string | null
          id?: string
          norma?: string | null
          novo_prazo?: string | null
          numero?: string | null
          origem?: string | null
          pendencia_origem?: string | null
          porques?: Json | null
          prazo_verificacao_eficacia?: string | null
          reincidente?: boolean | null
          requisito?: string | null
          responsavel_fechamento?: string | null
          responsavel_id?: string | null
          severidade?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nao_conformidades_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_acoes: {
        Row: {
          como: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          custo: number | null
          data_conclusao: string | null
          data_verificacao_eficacia: string | null
          descricao: string | null
          eficacia_observacao: string | null
          eficacia_validada_em: string | null
          eficacia_validada_por: string | null
          evidencias: Json | null
          id: string
          incidente_id: string | null
          nc_id: string | null
          observacoes: string | null
          onde: string | null
          origem_acao: string | null
          prioridade: string
          quando: string | null
          responsavel_execucao: string | null
          responsavel_id: string | null
          responsavel_validacao_id: string | null
          status: string
          status_eficacia: string | null
          tipo_registro: string
          titulo: string
          updated_at: string
        }
        Insert: {
          como?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          custo?: number | null
          data_conclusao?: string | null
          data_verificacao_eficacia?: string | null
          descricao?: string | null
          eficacia_observacao?: string | null
          eficacia_validada_em?: string | null
          eficacia_validada_por?: string | null
          evidencias?: Json | null
          id?: string
          incidente_id?: string | null
          nc_id?: string | null
          observacoes?: string | null
          onde?: string | null
          origem_acao?: string | null
          prioridade?: string
          quando?: string | null
          responsavel_execucao?: string | null
          responsavel_id?: string | null
          responsavel_validacao_id?: string | null
          status?: string
          status_eficacia?: string | null
          tipo_registro?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          como?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          custo?: number | null
          data_conclusao?: string | null
          data_verificacao_eficacia?: string | null
          descricao?: string | null
          eficacia_observacao?: string | null
          eficacia_validada_em?: string | null
          eficacia_validada_por?: string | null
          evidencias?: Json | null
          id?: string
          incidente_id?: string | null
          nc_id?: string | null
          observacoes?: string | null
          onde?: string | null
          origem_acao?: string | null
          prioridade?: string
          quando?: string | null
          responsavel_execucao?: string | null
          responsavel_id?: string | null
          responsavel_validacao_id?: string | null
          status?: string
          status_eficacia?: string | null
          tipo_registro?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_acoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_acoes_eficacia_validada_por_fkey"
            columns: ["eficacia_validada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_acoes_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "incidentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_acoes_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_acoes_responsavel_validacao_id_fkey"
            columns: ["responsavel_validacao_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedimento_cientes: {
        Row: {
          created_at: string
          data_ciencia: string
          dds_id: string | null
          employee_id: string
          evidencia_path: string | null
          id: string
          observacao: string | null
          origem: string
          procedimento_id: string
          registrado_por: string | null
          revisao_id: string | null
          versao: string
        }
        Insert: {
          created_at?: string
          data_ciencia?: string
          dds_id?: string | null
          employee_id: string
          evidencia_path?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          procedimento_id: string
          registrado_por?: string | null
          revisao_id?: string | null
          versao: string
        }
        Update: {
          created_at?: string
          data_ciencia?: string
          dds_id?: string | null
          employee_id?: string
          evidencia_path?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          procedimento_id?: string
          registrado_por?: string | null
          revisao_id?: string | null
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedimento_cientes_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedimento_cientes_revisao_id_fkey"
            columns: ["revisao_id"]
            isOneToOne: false
            referencedRelation: "procedimento_revisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      procedimento_revisoes: {
        Row: {
          created_at: string
          created_by: string | null
          data_emissao: string
          data_homologacao: string | null
          homologado_por: string | null
          id: string
          motivo_revisao: string | null
          pdf_path: string | null
          procedimento_id: string
          responsavel: string | null
          status: string
          updated_at: string
          versao: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_homologacao?: string | null
          homologado_por?: string | null
          id?: string
          motivo_revisao?: string | null
          pdf_path?: string | null
          procedimento_id: string
          responsavel?: string | null
          status?: string
          updated_at?: string
          versao: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_homologacao?: string | null
          homologado_por?: string | null
          id?: string
          motivo_revisao?: string | null
          pdf_path?: string | null
          procedimento_id?: string
          responsavel?: string | null
          status?: string
          updated_at?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedimento_revisoes_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      procedimentos: {
        Row: {
          area: string
          codigo: string
          created_at: string
          created_by: string | null
          criticidade: string
          escopo: string
          id: string
          objetivo: string | null
          observacoes: string | null
          periodicidade_revisao_meses: number
          proxima_revisao: string | null
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string
          versao_atual: string
        }
        Insert: {
          area?: string
          codigo: string
          created_at?: string
          created_by?: string | null
          criticidade?: string
          escopo?: string
          id?: string
          objetivo?: string | null
          observacoes?: string | null
          periodicidade_revisao_meses?: number
          proxima_revisao?: string | null
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string
          versao_atual?: string
        }
        Update: {
          area?: string
          codigo?: string
          created_at?: string
          created_by?: string | null
          criticidade?: string
          escopo?: string
          id?: string
          objetivo?: string | null
          observacoes?: string | null
          periodicidade_revisao_meses?: number
          proxima_revisao?: string | null
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          versao_atual?: string
        }
        Relationships: []
      }
      producao_base_materia_prima: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      producao_classes_avaliacao: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      producao_grupo_mercadorias: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
        }
        Relationships: []
      }
      producao_lista_tecnica: {
        Row: {
          arquivo_nome: string | null
          casco_id: string
          created_at: string
          id: string
          importado_por: string | null
          observacoes: string | null
          origem: string
          peso_total_estimado: number | null
          peso_total_real: number | null
          qtd_codigos_distintos: number
          qtd_itens: number
          qtd_pecas_total: number
          tipo_embarcacao: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          arquivo_nome?: string | null
          casco_id: string
          created_at?: string
          id?: string
          importado_por?: string | null
          observacoes?: string | null
          origem?: string
          peso_total_estimado?: number | null
          peso_total_real?: number | null
          qtd_codigos_distintos?: number
          qtd_itens?: number
          qtd_pecas_total?: number
          tipo_embarcacao?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          arquivo_nome?: string | null
          casco_id?: string
          created_at?: string
          id?: string
          importado_por?: string | null
          observacoes?: string | null
          origem?: string
          peso_total_estimado?: number | null
          peso_total_real?: number | null
          qtd_codigos_distintos?: number
          qtd_itens?: number
          qtd_pecas_total?: number
          tipo_embarcacao?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      producao_lista_tecnica_itens: {
        Row: {
          codigo_sap: string
          comprimento_m: number | null
          comprimento_txt: string | null
          created_at: string
          descricao_sap: string | null
          elemento: string | null
          espessura_mm: number | null
          id: string
          largura_m: number | null
          largura_txt: string | null
          linha: number
          lista_id: string
          medida: string | null
          obs_dobra: string | null
          peso_chapa: number | null
          peso_real: number | null
          peso_total_estimado: number | null
          peso_unit_real: number | null
          peso_unit_ref: number | null
          qtd_pecas: number | null
          quantidade: number | null
          unidade: string | null
        }
        Insert: {
          codigo_sap: string
          comprimento_m?: number | null
          comprimento_txt?: string | null
          created_at?: string
          descricao_sap?: string | null
          elemento?: string | null
          espessura_mm?: number | null
          id?: string
          largura_m?: number | null
          largura_txt?: string | null
          linha: number
          lista_id: string
          medida?: string | null
          obs_dobra?: string | null
          peso_chapa?: number | null
          peso_real?: number | null
          peso_total_estimado?: number | null
          peso_unit_real?: number | null
          peso_unit_ref?: number | null
          qtd_pecas?: number | null
          quantidade?: number | null
          unidade?: string | null
        }
        Update: {
          codigo_sap?: string
          comprimento_m?: number | null
          comprimento_txt?: string | null
          created_at?: string
          descricao_sap?: string | null
          elemento?: string | null
          espessura_mm?: number | null
          id?: string
          largura_m?: number | null
          largura_txt?: string | null
          linha?: number
          lista_id?: string
          medida?: string | null
          obs_dobra?: string | null
          peso_chapa?: number | null
          peso_real?: number | null
          peso_total_estimado?: number | null
          peso_unit_real?: number | null
          peso_unit_ref?: number | null
          qtd_pecas?: number | null
          quantidade?: number | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_lista_tecnica_itens_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "producao_lista_tecnica"
            referencedColumns: ["id"]
          },
        ]
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
      producao_mb51_movimentos: {
        Row: {
          classificacao_mb51: string | null
          created_at: string
          data_lancamento: string | null
          descricao: string | null
          id: string
          material: string
          numero_sap: string
          ordem_id: string
          quantidade: number
          tipo_movimento: string | null
          tipo_resolvido: string
          unidade: string | null
        }
        Insert: {
          classificacao_mb51?: string | null
          created_at?: string
          data_lancamento?: string | null
          descricao?: string | null
          id?: string
          material: string
          numero_sap: string
          ordem_id: string
          quantidade?: number
          tipo_movimento?: string | null
          tipo_resolvido?: string
          unidade?: string | null
        }
        Update: {
          classificacao_mb51?: string | null
          created_at?: string
          data_lancamento?: string | null
          descricao?: string | null
          id?: string
          material?: string
          numero_sap?: string
          ordem_id?: string
          quantidade?: number
          tipo_movimento?: string | null
          tipo_resolvido?: string
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_mb51_movimentos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "producao_mb51_ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_mb51_ordens: {
        Row: {
          arquivo_nome: string | null
          casco_id: string | null
          created_at: string
          data_primeiro_movimento: string | null
          data_ultimo_movimento: string | null
          id: string
          importado_por: string | null
          numero_sap: string
          qtd_consumo_liquido: number
          qtd_movimentos: number
          texto_documento: string | null
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          casco_id?: string | null
          created_at?: string
          data_primeiro_movimento?: string | null
          data_ultimo_movimento?: string | null
          id?: string
          importado_por?: string | null
          numero_sap: string
          qtd_consumo_liquido?: number
          qtd_movimentos?: number
          texto_documento?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          casco_id?: string | null
          created_at?: string
          data_primeiro_movimento?: string | null
          data_ultimo_movimento?: string | null
          id?: string
          importado_por?: string | null
          numero_sap?: string
          qtd_consumo_liquido?: number
          qtd_movimentos?: number
          texto_documento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_mb51_ordens_casco_id_fkey"
            columns: ["casco_id"]
            isOneToOne: false
            referencedRelation: "cascos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_ordem_itens: {
        Row: {
          canal_distribuicao: string | null
          centro: string | null
          classe_avaliacao: string | null
          classificacao_fiscal: string | null
          codigo_sap: string | null
          controle_preco: string | null
          created_at: string
          data_solicitacao: string | null
          deposito: string | null
          descricao_material: string
          determ_preco: string | null
          grupo_categ_item_ger: string | null
          grupo_classif_contabil: string | null
          grupo_compradores: string | null
          grupo_mercadorias: string | null
          id: string
          item: number
          material_id: string | null
          ncm: string | null
          ocorrencia: string | null
          ordem_id: string
          org_vendas: string | null
          origem_material: string | null
          setor_atividade: string | null
          unidade_medida: string | null
          updated_at: string
          utilizacao_material: string | null
        }
        Insert: {
          canal_distribuicao?: string | null
          centro?: string | null
          classe_avaliacao?: string | null
          classificacao_fiscal?: string | null
          codigo_sap?: string | null
          controle_preco?: string | null
          created_at?: string
          data_solicitacao?: string | null
          deposito?: string | null
          descricao_material: string
          determ_preco?: string | null
          grupo_categ_item_ger?: string | null
          grupo_classif_contabil?: string | null
          grupo_compradores?: string | null
          grupo_mercadorias?: string | null
          id?: string
          item: number
          material_id?: string | null
          ncm?: string | null
          ocorrencia?: string | null
          ordem_id: string
          org_vendas?: string | null
          origem_material?: string | null
          setor_atividade?: string | null
          unidade_medida?: string | null
          updated_at?: string
          utilizacao_material?: string | null
        }
        Update: {
          canal_distribuicao?: string | null
          centro?: string | null
          classe_avaliacao?: string | null
          classificacao_fiscal?: string | null
          codigo_sap?: string | null
          controle_preco?: string | null
          created_at?: string
          data_solicitacao?: string | null
          deposito?: string | null
          descricao_material?: string
          determ_preco?: string | null
          grupo_categ_item_ger?: string | null
          grupo_classif_contabil?: string | null
          grupo_compradores?: string | null
          grupo_mercadorias?: string | null
          id?: string
          item?: number
          material_id?: string | null
          ncm?: string | null
          ocorrencia?: string | null
          ordem_id?: string
          org_vendas?: string | null
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
          casco: string | null
          codigo_formulario: string
          codigo_sap: string | null
          created_at: string
          created_by: string | null
          data_solicitacao: string
          embarcacao_id: string | null
          id: string
          mtart: string | null
          numero: string
          observacoes: string | null
          pagina: string
          qtde_itens: number | null
          revisao: string
          solicitante: string | null
          status: string
          tipo_ordem: string
          tipo_produto: string | null
          updated_at: string
        }
        Insert: {
          casco?: string | null
          codigo_formulario?: string
          codigo_sap?: string | null
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          embarcacao_id?: string | null
          id?: string
          mtart?: string | null
          numero: string
          observacoes?: string | null
          pagina?: string
          qtde_itens?: number | null
          revisao?: string
          solicitante?: string | null
          status?: string
          tipo_ordem?: string
          tipo_produto?: string | null
          updated_at?: string
        }
        Update: {
          casco?: string | null
          codigo_formulario?: string
          codigo_sap?: string | null
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          embarcacao_id?: string | null
          id?: string
          mtart?: string | null
          numero?: string
          observacoes?: string | null
          pagina?: string
          qtde_itens?: number | null
          revisao?: string
          solicitante?: string | null
          status?: string
          tipo_ordem?: string
          tipo_produto?: string | null
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
          classe_avaliacao: string | null
          created_at: string
          grupo_mercadorias: string | null
          id: string
          mtart: string | null
          ncm: string | null
          nome: string
          tipo_embarcacao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          classe_avaliacao?: string | null
          created_at?: string
          grupo_mercadorias?: string | null
          id?: string
          mtart?: string | null
          ncm?: string | null
          nome: string
          tipo_embarcacao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          classe_avaliacao?: string | null
          created_at?: string
          grupo_mercadorias?: string | null
          id?: string
          mtart?: string | null
          ncm?: string | null
          nome?: string
          tipo_embarcacao?: string | null
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
          cotacao_at: string | null
          cotacao_fornecedor: string | null
          cotacao_valor: number | null
          cotador_nome: string | null
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
          signature_solicitante: string | null
          signature_solicitante_height: number | null
          solicitante: string
          status: Database["public"]["Enums"]["purchase_req_status"]
          status_token: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          classificacao?: Database["public"]["Enums"]["purchase_req_class"]
          codigo_formulario?: string | null
          cotacao_at?: string | null
          cotacao_fornecedor?: string | null
          cotacao_valor?: number | null
          cotador_nome?: string | null
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
          signature_solicitante?: string | null
          signature_solicitante_height?: number | null
          solicitante: string
          status?: Database["public"]["Enums"]["purchase_req_status"]
          status_token?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          classificacao?: Database["public"]["Enums"]["purchase_req_class"]
          codigo_formulario?: string | null
          cotacao_at?: string | null
          cotacao_fornecedor?: string | null
          cotacao_valor?: number | null
          cotador_nome?: string | null
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
          signature_solicitante?: string | null
          signature_solicitante_height?: number | null
          solicitante?: string
          status?: Database["public"]["Enums"]["purchase_req_status"]
          status_token?: string
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
      temp_investors: {
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
      training_anexos: {
        Row: {
          descricao: string | null
          file_path: string
          id: string
          tipo: string
          training_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          descricao?: string | null
          file_path: string
          id?: string
          tipo: string
          training_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          descricao?: string | null
          file_path?: string
          id?: string
          tipo?: string
          training_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_anexos_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
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
      training_matrix_courses: {
        Row: {
          ativo: boolean
          carga_horaria_h: number | null
          categoria: string
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          periodicidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          carga_horaria_h?: number | null
          categoria?: string
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          periodicidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          carga_horaria_h?: number | null
          categoria?: string
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          periodicidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_matrix_entries: {
        Row: {
          anexo_path: string | null
          course_id: string
          created_at: string
          created_by: string | null
          data_realizacao: string | null
          employee_id: string
          id: string
          observacao: string | null
          status_override: string | null
          updated_at: string
        }
        Insert: {
          anexo_path?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          data_realizacao?: string | null
          employee_id: string
          id?: string
          observacao?: string | null
          status_override?: string | null
          updated_at?: string
        }
        Update: {
          anexo_path?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          data_realizacao?: string | null
          employee_id?: string
          id?: string
          observacao?: string | null
          status_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_matrix_entries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_matrix_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_matrix_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      training_matrix_role_courses: {
        Row: {
          course_id: string
          created_at: string
          role_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          role_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_matrix_role_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_matrix_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      training_matrix_sector_courses: {
        Row: {
          course_id: string
          created_at: string
          setor: string
        }
        Insert: {
          course_id: string
          created_at?: string
          setor: string
        }
        Update: {
          course_id?: string
          created_at?: string
          setor?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_matrix_sector_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_matrix_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          anexo_path: string | null
          assinatura_path: string | null
          carga_horaria_h: number
          course_id: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_realizacao: string
          id: string
          instituicao: string | null
          instrutor: string | null
          local: string | null
          modalidade: string | null
          observacoes: string | null
          tipo: string
          tipo_realizacao: string | null
          titulo: string | null
          updated_at: string
          validade_meses: number
        }
        Insert: {
          anexo_path?: string | null
          assinatura_path?: string | null
          carga_horaria_h?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_realizacao: string
          id?: string
          instituicao?: string | null
          instrutor?: string | null
          local?: string | null
          modalidade?: string | null
          observacoes?: string | null
          tipo: string
          tipo_realizacao?: string | null
          titulo?: string | null
          updated_at?: string
          validade_meses?: number
        }
        Update: {
          anexo_path?: string | null
          assinatura_path?: string | null
          carga_horaria_h?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_realizacao?: string
          id?: string
          instituicao?: string | null
          instrutor?: string | null
          local?: string | null
          modalidade?: string | null
          observacoes?: string | null
          tipo?: string
          tipo_realizacao?: string | null
          titulo?: string | null
          updated_at?: string
          validade_meses?: number
        }
        Relationships: [
          {
            foreignKeyName: "trainings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_matrix_courses"
            referencedColumns: ["id"]
          },
        ]
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
      gerar_numero_controle_doc: { Args: never; Returns: string }
      gerar_numero_extintor: { Args: never; Returns: string }
      gerar_numero_ordem_producao: { Args: never; Returns: string }
      gerar_numero_tnc: { Args: never; Returns: string }
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
      pt_title_case: { Args: { s: string }; Returns: string }
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
      validar_eficacia_acao: {
        Args: { _eficaz: boolean; _id: string; _obs?: string }
        Returns: undefined
      }
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
      extintor_status: "ATIVO" | "EM_MANUTENCAO" | "BAIXADO" | "VENCIDO"
      extintor_tipo_agente:
        | "ABC"
        | "BC"
        | "A"
        | "AP"
        | "CO2"
        | "PQS"
        | "PQS_K"
        | "OUTRO"
      purchase_req_class: "MATERIAL" | "SERVICO"
      purchase_req_status: "PENDENTE" | "COTADA" | "APROVADA" | "INDEFERIDA"
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
      extintor_status: ["ATIVO", "EM_MANUTENCAO", "BAIXADO", "VENCIDO"],
      extintor_tipo_agente: [
        "ABC",
        "BC",
        "A",
        "AP",
        "CO2",
        "PQS",
        "PQS_K",
        "OUTRO",
      ],
      purchase_req_class: ["MATERIAL", "SERVICO"],
      purchase_req_status: ["PENDENTE", "COTADA", "APROVADA", "INDEFERIDA"],
      tipo_movimentacao_epi: [
        "SAIDA_ENTREGA",
        "ENTRADA_REPOSICAO",
        "DEVOLUCAO",
      ],
    },
  },
} as const
