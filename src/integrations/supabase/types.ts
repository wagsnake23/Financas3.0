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
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          user_id: string | null
        }
        Insert: {
          cor: string
          created_at?: string | null
          forma_pagamento?: string | null
          icone: string
          id?: string
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
          tipo_pagamento: string
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
          tipo_pagamento: string
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
          tipo_pagamento?: string
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
          created_at: string | null
          data: string
          id: string
          nome: string
          rentabilidade: number
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          data: string
          id?: string
          nome: string
          rentabilidade: number
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          nome?: string
          rentabilidade?: number
          tipo?: string
          user_id?: string
          valor?: number
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
        }
        Insert: {
          created_at?: string | null
          id: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      receitas: {
        Row: {
          created_at: string | null
          data: string
          descricao: string | null
          id: string
          status: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          data: string
          descricao?: string | null
          id?: string
          status?: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          status?: Database["public"]["Enums"]["receita_status"]
          tipo_receita_id?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_tipo_receita_id_fkey"
            columns: ["tipo_receita_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      rpc_audit: {
        Args: {
          p_user_id: string
          p_action_type: string
          p_table_name: string
          p_record_id: string
          p_old_data?: Json
          p_new_data?: Json
          p_notes?: string
        }
        Returns: void
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
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
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
  ? Database[PublicTableNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never