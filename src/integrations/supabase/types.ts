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
          id: string
          user_id: string
          nome: string
          banco: string
          ultimos_digitos: string
          dia_fechamento: number
          dia_vencimento: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          banco: string
          ultimos_digitos: string
          dia_fechamento: number
          dia_vencimento: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          banco?: string
          ultimos_digitos?: string
          dia_fechamento?: number
          dia_vencimento?: number
          created_at?: string
          updated_at?: string
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
          id: string
          nome: string
          icone: string
          cor: string
          forma_pagamento: string | null
          user_id: string | null
          created_at: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          icone: string
          cor: string
          forma_pagamento?: string | null
          user_id?: string | null
          created_at?: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          icone?: string
          cor?: string
          forma_pagamento?: string | null
          user_id?: string | null
          created_at?: string
          parent_id?: string | null
          updated_at?: string
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
          id: string
          user_id: string
          categoria_id: string | null
          forma_pagamento: string | null
          tipo_pagamento: "avista" | "parcelado" | "fixo"
          cartao_id: string | null
          valor_total: number
          numero_parcelas: number
          descricao: string | null
          is_recurring_master: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          categoria_id?: string | null
          forma_pagamento?: string | null
          tipo_pagamento?: "avista" | "parcelado" | "fixo"
          cartao_id?: string | null
          valor_total?: number
          numero_parcelas?: number
          descricao?: string | null
          is_recurring_master?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          categoria_id?: string | null
          forma_pagamento?: string | null
          tipo_pagamento?: "avista" | "parcelado" | "fixo"
          cartao_id?: string | null
          valor_total?: number
          numero_parcelas?: number
          descricao?: string | null
          is_recurring_master?: boolean
          created_at?: string
          updated_at?: string
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
          id: string
          despesa_id: string
          numero_parcela: number
          valor_parcela: number
          vencimento: string
          pago: boolean
          data_pagamento: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          despesa_id: string
          numero_parcela: number
          valor_parcela: number
          vencimento: string
          pago?: boolean
          data_pagamento?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          despesa_id?: string
          numero_parcela?: number
          valor_parcela?: number
          vencimento?: string
          pago?: boolean
          data_pagamento?: string | null
          created_at?: string
          updated_at?: string
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
          id: string
          user_id: string
          nome: string
          tipo: string
          valor: number
          data: string
          rentabilidade: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          tipo: string
          valor: number
          data: string
          rentabilidade: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          tipo?: string
          valor?: number
          data?: string
          rentabilidade?: number
          created_at?: string
          updated_at?: string
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
          id: string
          user_id: string
          tipo_receita_id: string | null
          valor: number
          data: string
          descricao: string | null
          status: "Prevista" | "Pendente" | "Recebida" | "Cancelada"
          is_recurring_master: boolean
          recurrence_id: string | null
          recurrence_day: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tipo_receita_id?: string | null
          valor: number
          data: string
          descricao?: string | null
          status?: "Prevista" | "Pendente" | "Recebida" | "Cancelada"
          is_recurring_master?: boolean
          recurrence_id?: string | null
          recurrence_day?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tipo_receita_id?: string | null
          valor?: number
          data?: string
          descricao?: string | null
          status?: "Prevista" | "Pendente" | "Recebida" | "Cancelada"
          is_recurring_master?: boolean
          recurrence_id?: string | null
          recurrence_day?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
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
      users: {
        Row: {
          id: string
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          created_at?: string
          updated_at?: string
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
          p_user_id: string
          p_transaction_type: string
          p_master_id: string
          p_first_occurrence_date: string
          p_monthly_amount: number
          p_category_id: string
          p_description: string
          p_status: string
          p_recurrence_day: number
          p_total_installments: number
          p_forma_pagamento: string
          p_cartao_id: string
          p_tipo_pagamento: string
        }
        Returns: undefined
      }
    }
    Enums: {
      receita_status: "Prevista" | "Pendente" | "Recebida" | "Cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type PublicSchema = Database[Extract<keyof Database, "public">]

type PublicTableNameOrOptions<
  TableName extends keyof PublicSchema["Tables"] | keyof PublicSchema["Views"]
> = TableName extends keyof PublicSchema["Tables"]
  ? {
      Args: PublicSchema["Tables"][TableName] extends { Args: any }
        ? PublicSchema["Tables"][TableName]["Args"]
        : never
      Row: PublicSchema["Tables"][TableName] extends { Row: any }
        ? PublicSchema["Tables"][TableName]["Row"]
        : never
      Insert: PublicSchema["Tables"][TableName] extends { Insert: any }
        ? PublicSchema["Tables"][TableName]["Insert"]
        : never
      Update: PublicSchema["Tables"][TableName] extends { Update: any }
        ? PublicSchema["Tables"][TableName]["Update"]
        : never
      Relationships: PublicSchema["Tables"][TableName] extends {
        Relationships: infer R
      }
        ? R
        : never
    }
  : TableName extends keyof PublicSchema["Views"]
  ? {
      Args: PublicSchema["Views"][TableName] extends { Args: any }
        ? PublicSchema["Views"][TableName]["Args"]
        : never
      Row: PublicSchema["Views"][TableName] extends { Row: any }
        ? PublicSchema["Views"][TableName]["Row"]
        : never
      Insert: PublicSchema["Views"][TableName] extends { Insert: any }
        ? PublicSchema["Views"][TableName]["Insert"]
        : never
      Update: PublicSchema["Views"][TableName] extends { Update: any }
        ? PublicSchema["Views"][TableName]["Update"]
        : never
      Relationships: PublicSchema["Views"][TableName] extends {
        Relationships: infer R
      }
        ? R
        : never
    }
  : never