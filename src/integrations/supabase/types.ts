export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      cartoes: {
        Row: {
          banco: string
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          id: string
          nome: string
          ultimos_digitos: string
          user_id: string
        }
        Insert: {
          banco: string
          created_at?: string
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          nome: string
          ultimos_digitos: string
          user_id: string
        }
        Update: {
          banco?: string
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          nome?: string
          ultimos_digitos?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "categorias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          cartao_id: string | null
          categoria_id: string | null
          created_at: string
          descricao: string | null
          id: string
          is_recurring_master: boolean
          numero_parcelas: number
          forma_pagamento: string
          tipo_pagamento: Database["public"]["Enums"]["despesa_tipo_pagamento"]
          user_id: string
          valor_total: number
        }
        Insert: {
          cartao_id?: string | null
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_recurring_master?: boolean
          numero_parcelas: number
          forma_pagamento: string
          tipo_pagamento: Database["public"]["Enums"]["despesa_tipo_pagamento"]
          user_id: string
          valor_total: number
        }
        Update: {
          cartao_id?: string | null
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_recurring_master?: boolean
          numero_parcelas?: number
          forma_pagamento?: string
          tipo_pagamento?: Database["public"]["Enums"]["despesa_tipo_pagamento"]
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
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_parcelas: {
        Row: {
          created_at: string
          data_pagamento: string | null
          despesa_id: string
          id: string
          numero_parcela: number
          pago: boolean
          valor_parcela: number
          vencimento: string
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          despesa_id: string
          id?: string
          numero_parcela: number
          pago?: boolean
          valor_parcela: number
          vencimento: string
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          despesa_id?: string
          id?: string
          numero_parcela?: number
          pago?: boolean
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
          rentabilidade: number
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          nome: string
          rentabilidade: number
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          nome?: string
          rentabilidade?: number
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "investimentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
          is_recurring_master: boolean
          recurrence_day: number | null
          recurrence_id: string | null
          status: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          is_recurring_master?: boolean
          recurrence_day?: number | null
          recurrence_id?: string | null
          status?: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          is_recurring_master?: boolean
          recurrence_day?: number | null
          recurrence_id?: string | null
          status?: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_recurrence_id_fkey"
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
          {
            foreignKeyName: "receitas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_recurring_entries: {
        Args: {
          p_user_id: string
          p_transaction_type: string
          p_master_id: string
          p_first_occurrence_date: string
          p_monthly_amount: number
          p_category_id: string | null
          p_description: string | null
          p_status: string | null
          p_recurrence_day: number | null
          p_total_installments: number
          p_forma_pagamento?: string | null
          p_cartao_id?: string | null
          p_tipo_pagamento?: string | null
        }
        Returns: undefined
      }
    }
    Enums: {
      despesa_tipo_pagamento: "avista" | "parcelado" | "fixo"
      receita_status: "Prevista" | "Pendente" | "Recebida" | "Cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableName_OrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never