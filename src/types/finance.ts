export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  category: string; // ID da categoria ou subcategoria
  description: string;
  // Campos para suportar edição de receitas e status
  status?: "Prevista" | "Pendente" | "Recebida" | "Cancelada";
  installmentNumber?: number; // Novo campo para o número da parcela
  totalInstallments?: number; // Novo campo para o total de parcelas
  forma_pagamento?: string | null; // Novo campo para a forma de pagamento
  cartao_id?: string | null; // Novo campo para o ID do cartão (se for pagamento com cartão)
  despesa_id?: string; // ID da despesa principal para parcelas
  // NOVOS CAMPOS PARA RECORRÊNCIA
  is_recurring_master?: boolean; // Indica se é a transação mestra de uma série recorrente
  recurrence_id?: string | null; // ID da série recorrente
  recurrence_day?: number | null; // Dia do mês para recorrência
  tipo_pagamento?: "avista" | "parcelado" | "fixo"; // NOVO: Adicionado tipo_pagamento
  updated_at?: string | null; // NOVO: Adicionado para forçar re-renderização do useMemo
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