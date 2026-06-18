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
      acidentes_trabalho: {
        Row: {
          agente_causador: string | null
          atestado_data: string | null
          atestado_hora: string | null
          atestado_medico_crm: string | null
          atestado_medico_nome: string | null
          atestado_medico_uf: string | null
          atestado_observacoes: string | null
          atestado_unidade: string | null
          cat_data_emissao: string | null
          causa_basica: string | null
          causa_imediata: string | null
          cid: string | null
          cnpj_prestadora: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          data_acidente: string
          data_obito: string | null
          data_retorno: string | null
          descricao: string
          dias_debitados: number
          dias_perdidos: number
          duracao_tratamento_dias: number | null
          emitente_email: string | null
          employee_id: string | null
          evidencias_urls: string[]
          hora_acidente: string | null
          horas_trabalhadas_antes: number | null
          houve_afastamento: boolean | null
          houve_internacao: boolean | null
          houve_obito: boolean | null
          id: string
          iniciativa_cat: string | null
          investigado: boolean
          lateralidade: string | null
          local_acidente: string | null
          local_cep: string | null
          local_municipio: string | null
          local_tipo: string | null
          local_uf: string | null
          natureza_lesao: string | null
          numero_bo: string | null
          numero_cat: string | null
          observacoes: string | null
          parte_corpo_atingida: string | null
          registro_policial: boolean | null
          sera_afastado: boolean | null
          situacao_geradora: string | null
          testemunhas: string | null
          tipo: Database["public"]["Enums"]["tipo_acidente"]
          tipo_cat: string | null
          turno: Database["public"]["Enums"]["turno_acidente"] | null
          ultima_refeicao_hora: string | null
          ultimo_dia_trabalhado: string | null
          updated_at: string
          vitima_aposentado: boolean | null
          vitima_area: string | null
          vitima_cargo: string | null
          vitima_cbo: string | null
          vitima_ctps: string | null
          vitima_data_nascimento: string | null
          vitima_estado_civil: string | null
          vitima_filiacao: string | null
          vitima_grau_instrucao: string | null
          vitima_matricula: string | null
          vitima_nome: string
          vitima_nome_mae: string | null
          vitima_pis: string | null
          vitima_remuneracao: number | null
          vitima_rg: string | null
          vitima_setor: string | null
          vitima_sexo: string | null
          vitima_telefone: string | null
        }
        Insert: {
          agente_causador?: string | null
          atestado_data?: string | null
          atestado_hora?: string | null
          atestado_medico_crm?: string | null
          atestado_medico_nome?: string | null
          atestado_medico_uf?: string | null
          atestado_observacoes?: string | null
          atestado_unidade?: string | null
          cat_data_emissao?: string | null
          causa_basica?: string | null
          causa_imediata?: string | null
          cid?: string | null
          cnpj_prestadora?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_acidente: string
          data_obito?: string | null
          data_retorno?: string | null
          descricao: string
          dias_debitados?: number
          dias_perdidos?: number
          duracao_tratamento_dias?: number | null
          emitente_email?: string | null
          employee_id?: string | null
          evidencias_urls?: string[]
          hora_acidente?: string | null
          horas_trabalhadas_antes?: number | null
          houve_afastamento?: boolean | null
          houve_internacao?: boolean | null
          houve_obito?: boolean | null
          id?: string
          iniciativa_cat?: string | null
          investigado?: boolean
          lateralidade?: string | null
          local_acidente?: string | null
          local_cep?: string | null
          local_municipio?: string | null
          local_tipo?: string | null
          local_uf?: string | null
          natureza_lesao?: string | null
          numero_bo?: string | null
          numero_cat?: string | null
          observacoes?: string | null
          parte_corpo_atingida?: string | null
          registro_policial?: boolean | null
          sera_afastado?: boolean | null
          situacao_geradora?: string | null
          testemunhas?: string | null
          tipo?: Database["public"]["Enums"]["tipo_acidente"]
          tipo_cat?: string | null
          turno?: Database["public"]["Enums"]["turno_acidente"] | null
          ultima_refeicao_hora?: string | null
          ultimo_dia_trabalhado?: string | null
          updated_at?: string
          vitima_aposentado?: boolean | null
          vitima_area?: string | null
          vitima_cargo?: string | null
          vitima_cbo?: string | null
          vitima_ctps?: string | null
          vitima_data_nascimento?: string | null
          vitima_estado_civil?: string | null
          vitima_filiacao?: string | null
          vitima_grau_instrucao?: string | null
          vitima_matricula?: string | null
          vitima_nome: string
          vitima_nome_mae?: string | null
          vitima_pis?: string | null
          vitima_remuneracao?: number | null
          vitima_rg?: string | null
          vitima_setor?: string | null
          vitima_sexo?: string | null
          vitima_telefone?: string | null
        }
        Update: {
          agente_causador?: string | null
          atestado_data?: string | null
          atestado_hora?: string | null
          atestado_medico_crm?: string | null
          atestado_medico_nome?: string | null
          atestado_medico_uf?: string | null
          atestado_observacoes?: string | null
          atestado_unidade?: string | null
          cat_data_emissao?: string | null
          causa_basica?: string | null
          causa_imediata?: string | null
          cid?: string | null
          cnpj_prestadora?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_acidente?: string
          data_obito?: string | null
          data_retorno?: string | null
          descricao?: string
          dias_debitados?: number
          dias_perdidos?: number
          duracao_tratamento_dias?: number | null
          emitente_email?: string | null
          employee_id?: string | null
          evidencias_urls?: string[]
          hora_acidente?: string | null
          horas_trabalhadas_antes?: number | null
          houve_afastamento?: boolean | null
          houve_internacao?: boolean | null
          houve_obito?: boolean | null
          id?: string
          iniciativa_cat?: string | null
          investigado?: boolean
          lateralidade?: string | null
          local_acidente?: string | null
          local_cep?: string | null
          local_municipio?: string | null
          local_tipo?: string | null
          local_uf?: string | null
          natureza_lesao?: string | null
          numero_bo?: string | null
          numero_cat?: string | null
          observacoes?: string | null
          parte_corpo_atingida?: string | null
          registro_policial?: boolean | null
          sera_afastado?: boolean | null
          situacao_geradora?: string | null
          testemunhas?: string | null
          tipo?: Database["public"]["Enums"]["tipo_acidente"]
          tipo_cat?: string | null
          turno?: Database["public"]["Enums"]["turno_acidente"] | null
          ultima_refeicao_hora?: string | null
          ultimo_dia_trabalhado?: string | null
          updated_at?: string
          vitima_aposentado?: boolean | null
          vitima_area?: string | null
          vitima_cargo?: string | null
          vitima_cbo?: string | null
          vitima_ctps?: string | null
          vitima_data_nascimento?: string | null
          vitima_estado_civil?: string | null
          vitima_filiacao?: string | null
          vitima_grau_instrucao?: string | null
          vitima_matricula?: string | null
          vitima_nome?: string
          vitima_nome_mae?: string | null
          vitima_pis?: string | null
          vitima_remuneracao?: number | null
          vitima_rg?: string | null
          vitima_setor?: string | null
          vitima_sexo?: string | null
          vitima_telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acidentes_trabalho_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acidentes_trabalho_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acidentes_trabalho_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
        ]
      }
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
          {
            foreignKeyName: "apr_assinaturas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
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
          modelo_id: string | null
          numero: string
          observacoes_gerais: string | null
          pdf_path: string | null
          pte_id: string | null
          setor: string | null
          signature_enc: string | null
          signature_enc_height: number | null
          signature_tst: string | null
          signature_tst_height: number | null
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
          modelo_id?: string | null
          numero: string
          observacoes_gerais?: string | null
          pdf_path?: string | null
          pte_id?: string | null
          setor?: string | null
          signature_enc?: string | null
          signature_enc_height?: number | null
          signature_tst?: string | null
          signature_tst_height?: number | null
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
          modelo_id?: string | null
          numero?: string
          observacoes_gerais?: string | null
          pdf_path?: string | null
          pte_id?: string | null
          setor?: string | null
          signature_enc?: string | null
          signature_enc_height?: number | null
          signature_tst?: string | null
          signature_tst_height?: number | null
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
            foreignKeyName: "aprs_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "aprs_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "apr_modelos"
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
          {
            foreignKeyName: "aprs_tst_id_fkey"
            columns: ["tst_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      assinaturas_salvas: {
        Row: {
          cargo: string
          created_at: string
          created_by: string | null
          id: string
          imagem_data_url: string
          nome: string
          updated_at: string
        }
        Insert: {
          cargo: string
          created_at?: string
          created_by?: string | null
          id?: string
          imagem_data_url: string
          nome: string
          updated_at?: string
        }
        Update: {
          cargo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          imagem_data_url?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
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
      cargo_riscos: {
        Row: {
          aposentadoria_especial_anos: number | null
          ativo: boolean
          created_at: string
          created_by: string | null
          data_avaliacao: string | null
          epi_atenuacao_db: number | null
          epi_atenuacao_pct: number | null
          fonte_geradora: string | null
          id: string
          insalubridade_grau: string | null
          intensidade: number | null
          limite_referencia: string | null
          limite_tolerancia: number | null
          meios_controle: string | null
          observacao: string | null
          periculosidade: boolean
          proxima_avaliacao: string | null
          responsavel_avaliacao: string | null
          risco_id: string
          role_id: string
          status_avaliacao: string
          tecnica_medicao: string | null
          tempo_exposicao_min: number | null
          trajetoria: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          aposentadoria_especial_anos?: number | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          epi_atenuacao_db?: number | null
          epi_atenuacao_pct?: number | null
          fonte_geradora?: string | null
          id?: string
          insalubridade_grau?: string | null
          intensidade?: number | null
          limite_referencia?: string | null
          limite_tolerancia?: number | null
          meios_controle?: string | null
          observacao?: string | null
          periculosidade?: boolean
          proxima_avaliacao?: string | null
          responsavel_avaliacao?: string | null
          risco_id: string
          role_id: string
          status_avaliacao?: string
          tecnica_medicao?: string | null
          tempo_exposicao_min?: number | null
          trajetoria?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          aposentadoria_especial_anos?: number | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          epi_atenuacao_db?: number | null
          epi_atenuacao_pct?: number | null
          fonte_geradora?: string | null
          id?: string
          insalubridade_grau?: string | null
          intensidade?: number | null
          limite_referencia?: string | null
          limite_tolerancia?: number | null
          meios_controle?: string | null
          observacao?: string | null
          periculosidade?: boolean
          proxima_avaliacao?: string | null
          responsavel_avaliacao?: string | null
          risco_id?: string
          role_id?: string
          status_avaliacao?: string
          tecnica_medicao?: string | null
          tempo_exposicao_min?: number | null
          trajetoria?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_riscos_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "catalogo_riscos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_riscos_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_riscos_medicoes: {
        Row: {
          anexo_path: string | null
          art_numero: string | null
          cargo_risco_id: string
          created_at: string
          created_by: string | null
          data_medicao: string
          equipamento: string | null
          id: string
          observacao: string | null
          responsavel_tecnico: string | null
          tecnica: string | null
          unidade: string
          valor_medido: number
        }
        Insert: {
          anexo_path?: string | null
          art_numero?: string | null
          cargo_risco_id: string
          created_at?: string
          created_by?: string | null
          data_medicao: string
          equipamento?: string | null
          id?: string
          observacao?: string | null
          responsavel_tecnico?: string | null
          tecnica?: string | null
          unidade: string
          valor_medido: number
        }
        Update: {
          anexo_path?: string | null
          art_numero?: string | null
          cargo_risco_id?: string
          created_at?: string
          created_by?: string | null
          data_medicao?: string
          equipamento?: string | null
          id?: string
          observacao?: string | null
          responsavel_tecnico?: string | null
          tecnica?: string | null
          unidade?: string
          valor_medido?: number
        }
        Relationships: [
          {
            foreignKeyName: "cargo_riscos_medicoes_cargo_risco_id_fkey"
            columns: ["cargo_risco_id"]
            isOneToOne: false
            referencedRelation: "cargo_riscos"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "cascos_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      catalogo_gases_atmosfericos: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao_limite: string | null
          id: string
          is_padrao_nr33: boolean
          limite_max: number | null
          limite_min: number | null
          nome: string
          ordem: number
          simbolo: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao_limite?: string | null
          id?: string
          is_padrao_nr33?: boolean
          limite_max?: number | null
          limite_min?: number | null
          nome: string
          ordem?: number
          simbolo: string
          unidade: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao_limite?: string | null
          id?: string
          is_padrao_nr33?: boolean
          limite_max?: number | null
          limite_min?: number | null
          nome?: string
          ordem?: number
          simbolo?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogo_nrs: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          link_oficial: string | null
          titulo: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          link_oficial?: string | null
          titulo: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          link_oficial?: string | null
          titulo?: string
        }
        Relationships: []
      }
      catalogo_riscos: {
        Row: {
          aposentadoria_especial_anos: number | null
          ativo: boolean
          categoria: string
          codigo_esocial: string | null
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
          aposentadoria_especial_anos?: number | null
          ativo?: boolean
          categoria: string
          codigo_esocial?: string | null
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
          aposentadoria_especial_anos?: number | null
          ativo?: boolean
          categoria?: string
          codigo_esocial?: string | null
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
      cbo_catalogo: {
        Row: {
          codigo: string
          codigo_familia: string | null
          created_at: string
          tipo: string
          titulo: string
        }
        Insert: {
          codigo: string
          codigo_familia?: string | null
          created_at?: string
          tipo: string
          titulo: string
        }
        Update: {
          codigo?: string
          codigo_familia?: string | null
          created_at?: string
          tipo?: string
          titulo?: string
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
      company_frentes_servico: {
        Row: {
          cargos: string[] | null
          casco_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_fim_prevista: string | null
          data_inicio: string | null
          escopo: string | null
          ghe_ids: string[] | null
          id: string
          nome: string
          observacoes: string | null
          qtd_prevista: number | null
          status: string
          updated_at: string
        }
        Insert: {
          cargos?: string[] | null
          casco_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          escopo?: string | null
          ghe_ids?: string[] | null
          id?: string
          nome: string
          observacoes?: string | null
          qtd_prevista?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          cargos?: string[] | null
          casco_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          escopo?: string | null
          ghe_ids?: string[] | null
          id?: string
          nome?: string
          observacoes?: string | null
          qtd_prevista?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_frentes_servico_casco_id_fkey"
            columns: ["casco_id"]
            isOneToOne: false
            referencedRelation: "cascos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_frentes_servico_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          created_at: string
          id: string
          pt_exige_apr_valida: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pt_exige_apr_valida?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pt_exige_apr_valida?: boolean
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
          {
            foreignKeyName: "controle_doc_recorrentes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
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
          {
            foreignKeyName: "controle_documentos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
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
      dias_sem_acidente_recordes: {
        Row: {
          company_id: string | null
          created_at: string
          data_inicio: string | null
          data_recorde: string | null
          escopo: string
          id: string
          observacoes: string | null
          recorde_dias: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          data_inicio?: string | null
          data_recorde?: string | null
          escopo?: string
          id?: string
          observacoes?: string | null
          recorde_dias?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          data_inicio?: string | null
          data_recorde?: string | null
          escopo?: string
          id?: string
          observacoes?: string | null
          recorde_dias?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dias_sem_acidente_recordes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_assinados: {
        Row: {
          assinado_por: string | null
          assinado_por_email: string | null
          assinado_por_nome: string | null
          assinaturas: Json
          created_at: string
          id: string
          modulo: string
          nome_arquivo: string
          original_pdf_path: string | null
          pdf_assinado_path: string | null
          placements_draft: Json | null
          referencia_id: string | null
          status: string | null
          total_assinaturas: number
          updated_at: string
        }
        Insert: {
          assinado_por?: string | null
          assinado_por_email?: string | null
          assinado_por_nome?: string | null
          assinaturas?: Json
          created_at?: string
          id?: string
          modulo?: string
          nome_arquivo: string
          original_pdf_path?: string | null
          pdf_assinado_path?: string | null
          placements_draft?: Json | null
          referencia_id?: string | null
          status?: string | null
          total_assinaturas?: number
          updated_at?: string
        }
        Update: {
          assinado_por?: string | null
          assinado_por_email?: string | null
          assinado_por_nome?: string | null
          assinaturas?: Json
          created_at?: string
          id?: string
          modulo?: string
          nome_arquivo?: string
          original_pdf_path?: string | null
          pdf_assinado_path?: string | null
          placements_draft?: Json | null
          referencia_id?: string | null
          status?: string | null
          total_assinaturas?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_atestados: {
        Row: {
          arquivo_path: string | null
          cid: string | null
          created_at: string
          created_by: string | null
          data_inicio: string
          data_retorno: string | null
          dias_afastamento: number
          employee_id: string
          homologado_em: string | null
          homologado_por: string | null
          id: string
          medico_crm: string | null
          medico_nome: string | null
          motivo_recusa: string | null
          observacao: string | null
          override_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          cid?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio: string
          data_retorno?: string | null
          dias_afastamento?: number
          employee_id: string
          homologado_em?: string | null
          homologado_por?: string | null
          id?: string
          medico_crm?: string | null
          medico_nome?: string | null
          motivo_recusa?: string | null
          observacao?: string | null
          override_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          cid?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio?: string
          data_retorno?: string | null
          dias_afastamento?: number
          employee_id?: string
          homologado_em?: string | null
          homologado_por?: string | null
          id?: string
          medico_crm?: string | null
          medico_nome?: string | null
          motivo_recusa?: string | null
          observacao?: string | null
          override_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_atestados_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_atestados_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
        ]
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
          {
            foreignKeyName: "employee_docs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
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
          {
            foreignKeyName: "employee_exams_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      employee_saidas_expediente: {
        Row: {
          assinado_sesmt_em: string | null
          assinado_sesmt_por: string | null
          assinado_supervisor_em: string | null
          assinado_supervisor_por: string | null
          assinatura_funcionario: string | null
          assinatura_sesmt: string | null
          assinatura_supervisor: string | null
          com_retorno: boolean
          company_id: string | null
          created_at: string
          created_by: string | null
          data: string
          employee_id: string
          horario_retorno: string | null
          horario_saida: string
          id: string
          motivo: string | null
          observacao: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          assinado_sesmt_em?: string | null
          assinado_sesmt_por?: string | null
          assinado_supervisor_em?: string | null
          assinado_supervisor_por?: string | null
          assinatura_funcionario?: string | null
          assinatura_sesmt?: string | null
          assinatura_supervisor?: string | null
          com_retorno?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          employee_id: string
          horario_retorno?: string | null
          horario_saida: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          assinado_sesmt_em?: string | null
          assinado_sesmt_por?: string | null
          assinado_supervisor_em?: string | null
          assinado_supervisor_por?: string | null
          assinatura_funcionario?: string | null
          assinatura_sesmt?: string | null
          assinatura_supervisor?: string | null
          com_retorno?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          employee_id?: string
          horario_retorno?: string | null
          horario_saida?: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_saidas_expediente_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_saidas_expediente_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_saidas_expediente_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
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
          assinatura_url: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnh: string | null
          cnpj: string | null
          company_id: string | null
          cpf: string | null
          created_at: string
          data_aso: string | null
          data_desligamento: string | null
          data_integracao: string | null
          data_nascimento: string | null
          desligado_por: string | null
          desligamento_checklist: Json
          desligamento_observacoes: string | null
          email: string | null
          empresa_terceira_id: string | null
          endereco: string | null
          foto_url: string | null
          ghe_id: string | null
          id: string
          matricula: string | null
          motivo_desligamento: string | null
          nome: string
          nome_contato: string | null
          nrs: Json
          pis: string | null
          rg: string | null
          rg_orgao: string | null
          role_id: string | null
          setor: string | null
          sexo: string | null
          status: string
          tipo_cadastro: string
          tipo_vinculo: string
          titulo: string | null
          uf: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_emergencia: string | null
        }
        Insert: {
          admissao?: string | null
          assinatura_url?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnh?: string | null
          cnpj?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          data_aso?: string | null
          data_desligamento?: string | null
          data_integracao?: string | null
          data_nascimento?: string | null
          desligado_por?: string | null
          desligamento_checklist?: Json
          desligamento_observacoes?: string | null
          email?: string | null
          empresa_terceira_id?: string | null
          endereco?: string | null
          foto_url?: string | null
          ghe_id?: string | null
          id?: string
          matricula?: string | null
          motivo_desligamento?: string | null
          nome: string
          nome_contato?: string | null
          nrs?: Json
          pis?: string | null
          rg?: string | null
          rg_orgao?: string | null
          role_id?: string | null
          setor?: string | null
          sexo?: string | null
          status?: string
          tipo_cadastro?: string
          tipo_vinculo?: string
          titulo?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_emergencia?: string | null
        }
        Update: {
          admissao?: string | null
          assinatura_url?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnh?: string | null
          cnpj?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          data_aso?: string | null
          data_desligamento?: string | null
          data_integracao?: string | null
          data_nascimento?: string | null
          desligado_por?: string | null
          desligamento_checklist?: Json
          desligamento_observacoes?: string | null
          email?: string | null
          empresa_terceira_id?: string | null
          endereco?: string | null
          foto_url?: string | null
          ghe_id?: string | null
          id?: string
          matricula?: string | null
          motivo_desligamento?: string | null
          nome?: string
          nome_contato?: string | null
          nrs?: Json
          pis?: string | null
          rg?: string | null
          rg_orgao?: string | null
          role_id?: string | null
          setor?: string | null
          sexo?: string | null
          status?: string
          tipo_cadastro?: string
          tipo_vinculo?: string
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
            foreignKeyName: "employees_empresa_terceira_fk"
            columns: ["empresa_terceira_id"]
            isOneToOne: false
            referencedRelation: "empresas_terceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "pgr_ghe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["ghe_id"]
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
      empresas_terceiras: {
        Row: {
          ativo: boolean
          cnpj: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          contrato_fim: string | null
          contrato_inicio: string | null
          contrato_numero: string | null
          created_at: string
          created_by: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          contrato_fim?: string | null
          contrato_inicio?: string | null
          contrato_numero?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          contrato_fim?: string | null
          contrato_inicio?: string | null
          contrato_numero?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "epi_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      epi_fichas_mensais: {
        Row: {
          ano: number
          arquivo_assinado_path: string | null
          created_at: string
          employee_id: string
          id: string
          mes: number
          observacoes: string | null
          status: string
          total_entregas: number
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          ano: number
          arquivo_assinado_path?: string | null
          created_at?: string
          employee_id: string
          id?: string
          mes: number
          observacoes?: string | null
          status?: string
          total_entregas?: number
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ano?: number
          arquivo_assinado_path?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          mes?: number
          observacoes?: string | null
          status?: string
          total_entregas?: number
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_fichas_mensais_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_fichas_mensais_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
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
      hht_mensal: {
        Row: {
          ano: number
          company_id: string | null
          created_at: string
          created_by: string | null
          empregados_medio: number
          hht: number
          id: string
          mes: number
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          empregados_medio?: number
          hht?: number
          id?: string
          mes: number
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          empregados_medio?: number
          hht?: number
          id?: string
          mes?: number
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hht_mensal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "hora_extra_sabado_funcionarios_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
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
      oss_emissoes: {
        Row: {
          assinado_em: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          cargo_snapshot: string
          conteudo_snapshot: Json
          created_at: string
          emitido_em: string
          emitido_por: string | null
          employee_id: string
          expira_em: string | null
          id: string
          motivo_cancelamento: string | null
          motivo_emissao: Database["public"]["Enums"]["oss_motivo"]
          observacoes: string | null
          pdf_assinado_path: string | null
          pdf_gerado_path: string | null
          status: Database["public"]["Enums"]["oss_status"]
          template_id: string
          template_revisao: number
          updated_at: string
          validado_por: string | null
        }
        Insert: {
          assinado_em?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cargo_snapshot: string
          conteudo_snapshot?: Json
          created_at?: string
          emitido_em?: string
          emitido_por?: string | null
          employee_id: string
          expira_em?: string | null
          id?: string
          motivo_cancelamento?: string | null
          motivo_emissao?: Database["public"]["Enums"]["oss_motivo"]
          observacoes?: string | null
          pdf_assinado_path?: string | null
          pdf_gerado_path?: string | null
          status?: Database["public"]["Enums"]["oss_status"]
          template_id: string
          template_revisao: number
          updated_at?: string
          validado_por?: string | null
        }
        Update: {
          assinado_em?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cargo_snapshot?: string
          conteudo_snapshot?: Json
          created_at?: string
          emitido_em?: string
          emitido_por?: string | null
          employee_id?: string
          expira_em?: string | null
          id?: string
          motivo_cancelamento?: string | null
          motivo_emissao?: Database["public"]["Enums"]["oss_motivo"]
          observacoes?: string | null
          pdf_assinado_path?: string | null
          pdf_gerado_path?: string | null
          status?: Database["public"]["Enums"]["oss_status"]
          template_id?: string
          template_revisao?: number
          updated_at?: string
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oss_emissoes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oss_emissoes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "oss_emissoes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "oss_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      oss_templates: {
        Row: {
          ativo: boolean
          cargo: string
          cbo: string | null
          created_at: string
          created_by: string | null
          descricao_atividades: string
          epis_obrigatorios: string
          hash_conteudo: string | null
          id: string
          medidas_preventivas: string
          penalidades: string
          procedimentos_emergencia: string
          proibicoes: string
          revisao: number
          risco_acidente: string | null
          risco_biologico: string | null
          risco_ergonomico: string | null
          risco_fisico: string | null
          risco_psicossocial: string | null
          risco_quimico: string | null
          riscos_texto: string
          setor: string | null
          titulo: string
          updated_at: string
          updated_by: string | null
          validade_meses: number
        }
        Insert: {
          ativo?: boolean
          cargo: string
          cbo?: string | null
          created_at?: string
          created_by?: string | null
          descricao_atividades?: string
          epis_obrigatorios?: string
          hash_conteudo?: string | null
          id?: string
          medidas_preventivas?: string
          penalidades?: string
          procedimentos_emergencia?: string
          proibicoes?: string
          revisao?: number
          risco_acidente?: string | null
          risco_biologico?: string | null
          risco_ergonomico?: string | null
          risco_fisico?: string | null
          risco_psicossocial?: string | null
          risco_quimico?: string | null
          riscos_texto?: string
          setor?: string | null
          titulo: string
          updated_at?: string
          updated_by?: string | null
          validade_meses?: number
        }
        Update: {
          ativo?: boolean
          cargo?: string
          cbo?: string | null
          created_at?: string
          created_by?: string | null
          descricao_atividades?: string
          epis_obrigatorios?: string
          hash_conteudo?: string | null
          id?: string
          medidas_preventivas?: string
          penalidades?: string
          procedimentos_emergencia?: string
          proibicoes?: string
          revisao?: number
          risco_acidente?: string | null
          risco_biologico?: string | null
          risco_ergonomico?: string | null
          risco_fisico?: string | null
          risco_psicossocial?: string | null
          risco_quimico?: string | null
          riscos_texto?: string
          setor?: string | null
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          validade_meses?: number
        }
        Relationships: []
      }
      pgr_ghe: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao_ambiente: string | null
          id: string
          jornada: string | null
          numero: number
          observacao: string | null
          qtd_colaboradores: number | null
          setor: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao_ambiente?: string | null
          id?: string
          jornada?: string | null
          numero: number
          observacao?: string | null
          qtd_colaboradores?: number | null
          setor: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao_ambiente?: string | null
          id?: string
          jornada?: string | null
          numero?: number
          observacao?: string | null
          qtd_colaboradores?: number | null
          setor?: string
          updated_at?: string
        }
        Relationships: []
      }
      pgr_ghe_membros_override: {
        Row: {
          acao: string
          created_at: string
          created_by: string | null
          employee_id: string
          ghe_id: string
          id: string
          motivo: string | null
          updated_at: string
        }
        Insert: {
          acao: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          ghe_id: string
          id?: string
          motivo?: string | null
          updated_at?: string
        }
        Update: {
          acao?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          ghe_id?: string
          id?: string
          motivo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pgr_ghe_membros_override_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_ghe_membros_override_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "pgr_ghe_membros_override_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "pgr_ghe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_ghe_membros_override_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["ghe_id"]
          },
        ]
      }
      pgr_inventario_riscos: {
        Row: {
          agravo: string | null
          ativo: boolean
          categoria: string
          classificacao: string | null
          controles_existentes: string | null
          created_at: string
          created_by: string | null
          exposicao: string | null
          fonte_geradora: string | null
          ghe_id: string
          id: string
          intensidade: number | null
          limite_tolerancia: number | null
          monitoramento: string | null
          observacao: string | null
          perigo: string
          probabilidade: number | null
          risco: number | null
          severidade: number | null
          tipo_avaliacao: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          agravo?: string | null
          ativo?: boolean
          categoria: string
          classificacao?: string | null
          controles_existentes?: string | null
          created_at?: string
          created_by?: string | null
          exposicao?: string | null
          fonte_geradora?: string | null
          ghe_id: string
          id?: string
          intensidade?: number | null
          limite_tolerancia?: number | null
          monitoramento?: string | null
          observacao?: string | null
          perigo: string
          probabilidade?: number | null
          risco?: number | null
          severidade?: number | null
          tipo_avaliacao?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          agravo?: string | null
          ativo?: boolean
          categoria?: string
          classificacao?: string | null
          controles_existentes?: string | null
          created_at?: string
          created_by?: string | null
          exposicao?: string | null
          fonte_geradora?: string | null
          ghe_id?: string
          id?: string
          intensidade?: number | null
          limite_tolerancia?: number | null
          monitoramento?: string | null
          observacao?: string | null
          perigo?: string
          probabilidade?: number | null
          risco?: number | null
          severidade?: number | null
          tipo_avaliacao?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pgr_inventario_riscos_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "pgr_ghe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_inventario_riscos_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["ghe_id"]
          },
        ]
      }
      pgr_plano_acao: {
        Row: {
          como: string | null
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          evidencia_url: string | null
          id: string
          inventario_id: string
          o_que: string
          observacao: string | null
          onde: string | null
          por_que: string | null
          quando: string | null
          quanto: number | null
          quem: string | null
          status: string
          updated_at: string
        }
        Insert: {
          como?: string | null
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          evidencia_url?: string | null
          id?: string
          inventario_id: string
          o_que: string
          observacao?: string | null
          onde?: string | null
          por_que?: string | null
          quando?: string | null
          quanto?: number | null
          quem?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          como?: string | null
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          evidencia_url?: string | null
          id?: string
          inventario_id?: string
          o_que?: string
          observacao?: string | null
          onde?: string | null
          por_que?: string | null
          quando?: string | null
          quanto?: number | null
          quem?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pgr_plano_acao_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "pgr_inventario_riscos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_plano_acao_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["risco_id"]
          },
        ]
      }
      pgr_risco_epi: {
        Row: {
          created_at: string
          created_by: string | null
          epi_id: string
          id: string
          inventario_id: string
          obrigatorio: boolean
          observacao: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          epi_id: string
          id?: string
          inventario_id: string
          obrigatorio?: boolean
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          epi_id?: string
          id?: string
          inventario_id?: string
          obrigatorio?: boolean
          observacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pgr_risco_epi_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "estoque_epi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_risco_epi_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "pgr_inventario_riscos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_risco_epi_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["risco_id"]
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
      ppp_emissoes: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          dados: Json
          data_emissao: string | null
          emitido_em: string | null
          emitido_por: string | null
          employee_id: string
          id: string
          motivo_cancelamento: string | null
          numero: string | null
          observacoes: string | null
          pdf_hash: string | null
          pdf_path: string | null
          role_id: string | null
          status: string
          updated_at: string
          versao: number
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          data_emissao?: string | null
          emitido_em?: string | null
          emitido_por?: string | null
          employee_id: string
          id?: string
          motivo_cancelamento?: string | null
          numero?: string | null
          observacoes?: string | null
          pdf_hash?: string | null
          pdf_path?: string | null
          role_id?: string | null
          status?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          data_emissao?: string | null
          emitido_em?: string | null
          emitido_por?: string | null
          employee_id?: string
          id?: string
          motivo_cancelamento?: string | null
          numero?: string | null
          observacoes?: string | null
          pdf_hash?: string | null
          pdf_path?: string | null
          role_id?: string | null
          status?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppp_emissoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_emissoes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_emissoes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "ppp_emissoes_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
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
      pte_medicoes_atmosfericas: {
        Row: {
          calibracao_data: string | null
          calibracao_validade: string | null
          created_at: string
          created_by: string | null
          equipamento_marca: string | null
          equipamento_modelo: string | null
          equipamento_serie: string | null
          executor_id: string | null
          executor_nome: string | null
          id: string
          leituras: Json
          medido_em: string
          momento: string
          observacao: string | null
          pte_id: string
          tem_fora_limite: boolean
          updated_at: string
        }
        Insert: {
          calibracao_data?: string | null
          calibracao_validade?: string | null
          created_at?: string
          created_by?: string | null
          equipamento_marca?: string | null
          equipamento_modelo?: string | null
          equipamento_serie?: string | null
          executor_id?: string | null
          executor_nome?: string | null
          id?: string
          leituras?: Json
          medido_em?: string
          momento?: string
          observacao?: string | null
          pte_id: string
          tem_fora_limite?: boolean
          updated_at?: string
        }
        Update: {
          calibracao_data?: string | null
          calibracao_validade?: string | null
          created_at?: string
          created_by?: string | null
          equipamento_marca?: string | null
          equipamento_modelo?: string | null
          equipamento_serie?: string | null
          executor_id?: string | null
          executor_nome?: string | null
          id?: string
          leituras?: Json
          medido_em?: string
          momento?: string
          observacao?: string | null
          pte_id?: string
          tem_fora_limite?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pte_medicoes_atmosfericas_executor_id_fkey"
            columns: ["executor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pte_medicoes_atmosfericas_executor_id_fkey"
            columns: ["executor_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "pte_medicoes_atmosfericas_pte_id_fkey"
            columns: ["pte_id"]
            isOneToOne: false
            referencedRelation: "ptes"
            referencedColumns: ["id"]
          },
        ]
      }
      ptes: {
        Row: {
          apr_id: string | null
          casco_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          dados: Json
          data: string
          data_emissao: string
          emergencia_justificativa: string | null
          emergencia_sem_apr: boolean
          emitente_user_id: string | null
          employee_id: string | null
          employee_name: string | null
          executantes_ids: string[] | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          local: string | null
          numero: string | null
          pdf_path: string | null
          pts_relacionadas: string[] | null
          requisitante_id: string | null
          risco: string | null
          status: string
          supervisor_entrada_id: string | null
          tipo_pt: string
          validade_ate: string | null
          validade_tipo: string
          vigia_id: string | null
        }
        Insert: {
          apr_id?: string | null
          casco_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          data?: string
          data_emissao?: string
          emergencia_justificativa?: string | null
          emergencia_sem_apr?: boolean
          emitente_user_id?: string | null
          employee_id?: string | null
          employee_name?: string | null
          executantes_ids?: string[] | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          local?: string | null
          numero?: string | null
          pdf_path?: string | null
          pts_relacionadas?: string[] | null
          requisitante_id?: string | null
          risco?: string | null
          status?: string
          supervisor_entrada_id?: string | null
          tipo_pt?: string
          validade_ate?: string | null
          validade_tipo?: string
          vigia_id?: string | null
        }
        Update: {
          apr_id?: string | null
          casco_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          data?: string
          data_emissao?: string
          emergencia_justificativa?: string | null
          emergencia_sem_apr?: boolean
          emitente_user_id?: string | null
          employee_id?: string | null
          employee_name?: string | null
          executantes_ids?: string[] | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          local?: string | null
          numero?: string | null
          pdf_path?: string | null
          pts_relacionadas?: string[] | null
          requisitante_id?: string | null
          risco?: string | null
          status?: string
          supervisor_entrada_id?: string | null
          tipo_pt?: string
          validade_ate?: string | null
          validade_tipo?: string
          vigia_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ptes_casco_id_fkey"
            columns: ["casco_id"]
            isOneToOne: false
            referencedRelation: "cascos"
            referencedColumns: ["id"]
          },
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
          cotacao_attempt_count: number
          cotacao_fornecedor: string | null
          cotacao_last_attempt_at: string | null
          cotacao_submitted_at: string | null
          cotacao_submitter_ip: string | null
          cotacao_user_agent: string | null
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
          titulo: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          classificacao?: Database["public"]["Enums"]["purchase_req_class"]
          codigo_formulario?: string | null
          cotacao_at?: string | null
          cotacao_attempt_count?: number
          cotacao_fornecedor?: string | null
          cotacao_last_attempt_at?: string | null
          cotacao_submitted_at?: string | null
          cotacao_submitter_ip?: string | null
          cotacao_user_agent?: string | null
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
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          classificacao?: Database["public"]["Enums"]["purchase_req_class"]
          codigo_formulario?: string | null
          cotacao_at?: string | null
          cotacao_attempt_count?: number
          cotacao_fornecedor?: string | null
          cotacao_last_attempt_at?: string | null
          cotacao_submitted_at?: string | null
          cotacao_submitter_ip?: string | null
          cotacao_user_agent?: string | null
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
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relatorios_investigacao_acidente: {
        Row: {
          acidente_id: string
          acoes_imediatas: Json
          ano: number
          assinaturas: Json
          created_at: string
          created_by: string | null
          dados_gerais: Json
          enquadramento: Json
          fotos_lesao: Json
          fotos_local: Json
          id: string
          numero: string | null
          participantes: Json
          pdf_path: string | null
          plano_acao: Json
          porques: Json
          status: string
          updated_at: string
        }
        Insert: {
          acidente_id: string
          acoes_imediatas?: Json
          ano?: number
          assinaturas?: Json
          created_at?: string
          created_by?: string | null
          dados_gerais?: Json
          enquadramento?: Json
          fotos_lesao?: Json
          fotos_local?: Json
          id?: string
          numero?: string | null
          participantes?: Json
          pdf_path?: string | null
          plano_acao?: Json
          porques?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          acidente_id?: string
          acoes_imediatas?: Json
          ano?: number
          assinaturas?: Json
          created_at?: string
          created_by?: string | null
          dados_gerais?: Json
          enquadramento?: Json
          fotos_lesao?: Json
          fotos_local?: Json
          id?: string
          numero?: string | null
          participantes?: Json
          pdf_path?: string | null
          plano_acao?: Json
          porques?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_investigacao_acidente_acidente_id_fkey"
            columns: ["acidente_id"]
            isOneToOne: false
            referencedRelation: "acidentes_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          atividades: string | null
          ativo: boolean
          cbo: string | null
          cbo_titulo: string | null
          created_at: string
          descricao_atividades: string | null
          exames_por_natureza: Json
          ghe: string | null
          ghe_id: string | null
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
          atividades?: string | null
          ativo?: boolean
          cbo?: string | null
          cbo_titulo?: string | null
          created_at?: string
          descricao_atividades?: string | null
          exames_por_natureza?: Json
          ghe?: string | null
          ghe_id?: string | null
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
          atividades?: string | null
          ativo?: boolean
          cbo?: string | null
          cbo_titulo?: string | null
          created_at?: string
          descricao_atividades?: string | null
          exames_por_natureza?: Json
          ghe?: string | null
          ghe_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "roles_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "pgr_ghe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["ghe_id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "training_attendees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "training_attendees_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "training_matrix_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_colaborador_pgr"
            referencedColumns: ["employee_id"]
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
      user_menu_access: {
        Row: {
          created_at: string
          enabled: boolean
          menu_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          menu_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          menu_key?: string
          updated_at?: string
          user_id?: string
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
      user_signatures: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string
          signature_data: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          signature_data: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          signature_data?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      pgr_ghe_membros_efetivos: {
        Row: {
          employee_id: string | null
          ghe_id: string | null
          origem: string | null
        }
        Relationships: []
      }
      vw_colaborador_pgr: {
        Row: {
          agravo: string | null
          categoria: string | null
          classificacao: string | null
          controles_existentes: string | null
          descricao_ambiente: string | null
          employee_id: string | null
          employee_nome: string | null
          employee_tipo_cadastro: string | null
          epis: Json | null
          exposicao: string | null
          fonte_geradora: string | null
          ghe_id: string | null
          ghe_numero: number | null
          ghe_setor: string | null
          intensidade: number | null
          limite_tolerancia: number | null
          monitoramento: string | null
          perigo: string | null
          probabilidade: number | null
          risco_id: string | null
          risco_score: number | null
          role_id: string | null
          severidade: number | null
          unidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_quadro_estatistico: {
        Row: {
          acid_com_afast: number | null
          acid_fatais: number | null
          acid_sem_afast: number | null
          ano: number | null
          company_id: string | null
          empregados_medio: number | null
          hht: number | null
          mes: number | null
          taxa_frequencia: number | null
          taxa_frequencia_sa: number | null
          taxa_gravidade: number | null
          total_dias: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hht_mensal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_count_user_sessions: { Args: { _user_id: string }; Returns: number }
      admin_force_signout_user: { Args: { _user_id: string }; Returns: number }
      ajustar_saldo_epi: {
        Args: { _epi_id: string; _novo_saldo: number }
        Returns: undefined
      }
      cancelar_os: {
        Args: { _motivo: string; _os_id: string }
        Returns: undefined
      }
      current_aal: { Args: never; Returns: string }
      fn_dias_sem_acidente: {
        Args: { _company_id?: string }
        Returns: {
          company_id: string
          dias_sem_com_afast: number
          dias_sem_registravel: number
          recorde_com_afast: number
          recorde_registravel: number
          ultimo_acidente_com_afast: string
          ultimo_acidente_registravel: string
        }[]
      }
      gerar_numero_apr: { Args: never; Returns: string }
      gerar_numero_controle_doc: { Args: never; Returns: string }
      gerar_numero_extintor: { Args: never; Returns: string }
      gerar_numero_ordem_producao: { Args: never; Returns: string }
      gerar_numero_ppp: { Args: never; Returns: string }
      gerar_numero_ria: { Args: never; Returns: string }
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
      oss_marcar_vencidas: { Args: never; Returns: number }
      peek_proximo_numero_apr: { Args: never; Returns: string }
      pt_title_case: { Args: { s: string }; Returns: string }
      reativar_funcionario: {
        Args: { _employee_id: string }
        Returns: undefined
      }
      registrar_desligamento_funcionario: {
        Args: {
          _checklist?: Json
          _data_desligamento: string
          _employee_id: string
          _motivo: string
          _observacoes?: string
        }
        Returns: undefined
      }
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_estoque_epi_monthly: { Args: never; Returns: undefined }
      unaccent: { Args: { "": string }; Returns: string }
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
      oss_motivo:
        | "ADMISSAO"
        | "MUDANCA_CARGO"
        | "REVISAO_RISCO"
        | "RECICLAGEM_ANUAL"
        | "EMISSAO_MANUAL"
      oss_status:
        | "PENDENTE_ASSINATURA"
        | "ASSINADO"
        | "VENCIDO"
        | "SUBSTITUIDO"
        | "CANCELADO"
      purchase_req_class: "MATERIAL" | "SERVICO"
      purchase_req_status: "PENDENTE" | "COTADA" | "APROVADA" | "INDEFERIDA"
      tipo_acidente: "COM_AFASTAMENTO" | "SEM_AFASTAMENTO" | "TRAJETO" | "FATAL"
      tipo_movimentacao_epi: "SAIDA_ENTREGA" | "ENTRADA_REPOSICAO" | "DEVOLUCAO"
      turno_acidente: "MANHA" | "TARDE" | "NOITE" | "MADRUGADA"
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
      oss_motivo: [
        "ADMISSAO",
        "MUDANCA_CARGO",
        "REVISAO_RISCO",
        "RECICLAGEM_ANUAL",
        "EMISSAO_MANUAL",
      ],
      oss_status: [
        "PENDENTE_ASSINATURA",
        "ASSINADO",
        "VENCIDO",
        "SUBSTITUIDO",
        "CANCELADO",
      ],
      purchase_req_class: ["MATERIAL", "SERVICO"],
      purchase_req_status: ["PENDENTE", "COTADA", "APROVADA", "INDEFERIDA"],
      tipo_acidente: ["COM_AFASTAMENTO", "SEM_AFASTAMENTO", "TRAJETO", "FATAL"],
      tipo_movimentacao_epi: [
        "SAIDA_ENTREGA",
        "ENTRADA_REPOSICAO",
        "DEVOLUCAO",
      ],
      turno_acidente: ["MANHA", "TARDE", "NOITE", "MADRUGADA"],
    },
  },
} as const
