export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  category: string; // ID da categoria ou subcategoria
  description: string;
  // Campos adicionados para suportar edição de receitas fixas e status
  status?: "Prevista" | "Pendente" | "Recebida" | "Cancelada";
  is_fixed?: boolean; // Indica se é uma despesa/receita fixa (legado ou recorrente)
  recurrence_frequency?: string | null;
  recurrence_installments_count?: number | null;
  installmentNumber?: number; // Novo campo para o número da parcela
  totalInstallments?: number; // Novo campo para o total de parcelas
  forma_pagamento?: string | null; // Novo campo para a forma de pagamento
  cartao_id?: string | null; // Novo campo para o ID do cartão (se for pagamento com cartão)
  despesa_id?: string; // ID da despesa principal para parcelas

  // Novos campos para o sistema de recorrência
  recurringEntryId?: string; // ID do registro mestre de recorrência
  isRecurring?: boolean; // Indica se é uma transação materializada de um registro recorrente
  isException?: boolean; // Indica se esta ocorrência tem uma exceção
  exceptionId?: string; // ID da exceção, se houver
  originalValue?: number; // Valor original do registro mestre
  originalCategory?: string | null; // Categoria original do registro mestre
  originalDueDate?: number; // Dia de vencimento original do registro mestre
  frequency?: "monthly" | "quarterly" | "annually"; // Frequência do registro mestre
  recurringStatus?: "active" | "canceled"; // Status do registro mestre
}

// Interface principal para categorias, alinhada com a tabela 'categorias' do Supabase
export interface AppCategory {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  forma_pagamento?: string | null;
  user_id?: string | null;
  created_at?: string | null;
  parent_id?: string | null; // Novo campo para indicar a categoria pai
}

// Interface para Investimentos, alinhada com a nova tabela 'investimentos' do Supabase
export interface Investment {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  valor: number;
  data: string;
  rentabilidade: number;
  created_at?: string | null;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}