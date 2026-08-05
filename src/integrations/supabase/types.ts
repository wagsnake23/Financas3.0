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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      indexadores: {
        Row: {
          id: string
          tipo: string
          taxa_anual: number
          taxa_diaria: number | null
          taxa_mensal: number | null
          data_inicio: string
          data_fim: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tipo: string
          taxa_anual: number
          taxa_diaria?: number | null
          taxa_mensal?: number | null
          data_inicio: string
          data_fim?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tipo?: string
          taxa_anual?: number
          taxa_diaria?: number | null
          taxa_mensal?: number | null
          data_inicio?: string
          data_fim?: string | null
          created_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cartoes: {
        Row: {
          banco: string
          created_at: string | null
          dia_fechamento: number
          dia_vencimento: number
          id: string
          nome: string
          ultimos_digitos: string
          user_id: string
          is_principal: boolean
        }
        Insert: {
          banco: string
          created_at?: string | null
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          nome: string
          ultimos_digitos: string
          user_id: string
          is_principal?: boolean
        }
        Update: {
          banco?: string
          created_at?: string | null
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          nome?: string
          ultimos_digitos?: string
          user_id?: string
          is_principal?: boolean
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string
          created_at: string | null
          forma_pagamento: string | null
          icone: string
          id: string
          nome: string
          parent_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cor: string
          created_at?: string | null
          forma_pagamento?: string | null
          icone: string
          id: string
          nome: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cor?: string
          created_at?: string | null
          forma_pagamento?: string | null
          icone?: string
          id?: string
          nome?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          banco: string
          created_at: string | null
          id: string
          numero: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          agencia?: string | null
          banco: string
          created_at?: string | null
          id?: string
          numero?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          agencia?: string | null
          banco?: string
          created_at?: string | null
          id?: string
          numero?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          cartao_id: string | null
          categoria_id: string | null
          created_at: string | null
          descricao: string | null
          forma_pagamento: string
          id: string
          is_recurring_master: boolean | null
          numero_parcelas: number
          tipo_pagamento: string
          updated_at: string | null
          user_id: string
          valor_total: number
        }
        Insert: {
          cartao_id?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao?: string | null
          forma_pagamento: string
          id?: string
          is_recurring_master?: boolean | null
          numero_parcelas?: number
          tipo_pagamento: string
          updated_at?: string | null
          user_id: string
          valor_total: number
        }
        Update: {
          cartao_id?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao?: string | null
          forma_pagamento?: string
          id?: string
          is_recurring_master?: boolean | null
          numero_parcelas?: number
          tipo_pagamento?: string
          updated_at?: string | null
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_categoria_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_parcelas: {
        Row: {
          created_at: string | null
          data_pagamento: string | null
          despesa_id: string
          id: string
          numero_parcela: number
          pago: boolean | null
          updated_at: string
          valor_parcela: number
          vencimento: string
        }
        Insert: {
          created_at?: string | null
          data_pagamento?: string | null
          despesa_id: string
          id?: string
          numero_parcela: number
          pago?: boolean | null
          updated_at?: string
          valor_parcela: number
          vencimento: string
        }
        Update: {
          created_at?: string | null
          data_pagamento?: string | null
          despesa_id?: string
          id?: string
          numero_parcela?: number
          pago?: boolean | null
          updated_at?: string
          valor_parcela?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_parcelas_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      investimentos: {
        Row: {
          created_at: string
          data: string
          id: string
          nome: string
          tipo: string
          user_id: string
          valor: number
          tipo_rentabilidade: string | null
          taxa_fixa: number | null
          indexador: string | null
          percentual_indexador: number | null
          taxa_adicional: number | null
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          nome: string
          tipo: string
          user_id: string
          valor: number
          tipo_rentabilidade?: string | null
          taxa_fixa?: number | null
          indexador?: string | null
          percentual_indexador?: number | null
          taxa_adicional?: number | null
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          nome?: string
          tipo?: string
          user_id?: string
          valor?: number
          tipo_rentabilidade?: string | null
          taxa_fixa?: number | null
          indexador?: string | null
          percentual_indexador?: number | null
          taxa_adicional?: number | null
        }
        Relationships: []
      }
      pix_chaves: {
        Row: {
          chave: string
          created_at: string | null
          id: string
          padrao: boolean | null
          tipo: string
          user_id: string
        }
        Insert: {
          chave: string
          created_at?: string | null
          id?: string
          padrao?: boolean | null
          tipo: string
          user_id: string
        }
        Update: {
          chave?: string
          created_at?: string | null
          id?: string
          padrao?: boolean | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          updated_at: string | null
          avatar_url: string | null
          avatar: string | null
          apelido: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          nome: string
          updated_at?: string | null
          avatar_url?: string | null
          avatar?: string | null
          apelido?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
          avatar_url?: string | null
          avatar?: string | null
          apelido?: string | null
        }
        Relationships: []
      }
      receitas: {
        Row: {
          created_at: string | null
          data: string
          descricao: string | null
          id: string
          is_recurring_master: boolean | null
          recurrence_day: number | null
          recurrence_id: string | null
          status: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          data: string
          descricao?: string | null
          id?: string
          is_recurring_master?: boolean | null
          recurrence_day?: number | null
          recurrence_id?: string | null
          status?: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id?: string | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          is_recurring_master?: boolean | null
          recurrence_day?: number | null
          recurrence_id?: string | null
          status?: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_receitas_recurrence_id"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_tipo_receita_id_fkey"
            columns: ["tipo_receita_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas_ocorrencias: {
        Row: {
          created_at: string | null
          data_atualizacao_status: string | null
          data_ocorrencia: string
          id: string
          numero_ocorrencia: number
          receita_id: string
          status: Database["public"]["Enums"]["receita_status"]
          updated_at: string | null
          valor_ocorrencia: number
        }
        Insert: {
          created_at?: string | null
          data_atualizacao_status?: string | null
          data_ocorrencia: string
          id?: string
          numero_ocorrencia: number
          receita_id: string
          status?: Database["public"]["Enums"]["receita_status"]
          updated_at?: string | null
          valor_ocorrencia: number
        }
        Update: {
          created_at?: string | null
          data_atualizacao_status?: string | null
          data_ocorrencia?: string
          id?: string
          numero_ocorrencia?: number
          receita_id?: string
          status?: Database["public"]["Enums"]["receita_status"]
          updated_at?: string | null
          valor_ocorrencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_ocorrencias_receita_id_fkey"
            columns: ["receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          created_at: string
          date: string | null
          id: string
          order: number
          product: string
          status: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: string
          order?: number
          product: string
          status?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: string
          order?: number
          product?: string
          status?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      generate_recurring_entries: {
        Args: {
          p_cartao_id?: string
          p_category_id: string
          p_description: string
          p_first_occurrence_date: string
          p_forma_pagamento?: string
          p_master_id: string
          p_monthly_amount: number
          p_recurrence_day: number
          p_status: Database["public"]["Enums"]["receita_status"]
          p_tipo_pagamento?: string
          p_total_installments: number
          p_transaction_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      rpc_audit: {
        Args: {
          p_action_type: string
          p_new_data?: Json
          p_notes?: string
          p_old_data?: Json
          p_record_id: string
          p_table_name: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "conferente"
      receita_status: "Prevista" | "Pendente" | "Recebida" | "Cancelada"
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
      app_role: ["admin", "conferente"],
      receita_status: ["Prevista", "Pendente", "Recebida", "Cancelada"],
    },
  },
} as const
