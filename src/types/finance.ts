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
  paymentTimestamp?: string | null; // NOVO: Data e hora do pagamento/recebimento
  created_at?: string; // NOVO: Data de criação do registro
  data_competencia?: string; // NOVO: Mês/competência real da despesa
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
  tipo_tributacao?: "regressivo" | "isento";
}

// Interface para Investimentos, alinhada com a nova tabela 'investimentos' do Supabase
export interface Investment {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  tipo_rentabilidade: "fixo" | "indexado";
  taxa_fixa?: number | null;
  indexador?: "CDI" | "IPCA" | null;
  percentual_indexador?: number | null;
  origem_investimento?: "saldo_atual" | "caixa_externo" | null;
  status?: "ativo" | "resgatado" | null;
  data_resgate?: string | null;
  created_at?: string | null;
}

// Interfaces para Múltiplos Aportes e Resgates FIFO
export interface InvestmentContribution {
  id: string;
  investimento_id: string;
  user_id: string;
  valor_original: number;
  data_aporte: string;
  created_at: string;
}

export interface InvestmentRedemption {
  id: string;
  investimento_id: string;
  user_id: string;
  data_resgate: string;
  tipo: "parcial" | "total" | "legado";
  valor_liquido_solicitado: number;
  valor_bruto_total: number;
  rendimento_bruto_total: number;
  ir_total: number;
  valor_liquido_total: number;
  is_legado?: boolean;
  observacao?: string | null;
  created_at: string;
}

export interface InvestmentRedemptionAllocation {
  id: string;
  resgate_id: string;
  aporte_id: string;
  investimento_id: string;
  user_id: string;
  principal_consumido: number;
  valor_bruto_resgatado: number;
  rendimento_bruto: number;
  ir_retido: number;
  valor_liquido: number;
  aliquota_ir: number;
  is_legado?: boolean;
  created_at: string;
}

export interface InvestmentLotCalculation {
  aporte: InvestmentContribution;
  numero: number;
  principalOriginal: number;
  principalJaResgatado: number;
  principalRemanescente: number;
  isEsgotado: boolean;
  rendimentoBruto: number;
  irProvisionado: number;
  aliquotaAplicada: number;
  rendimentoLiquido: number;
  saldoLiquido: number;
  saldoBrutoVirtual: number;
  ultimaTaxaAplicada: number;
  rendimentoHojeLiquido: number;
}

export interface InvestmentConsolidatedMetrics {
  investimento: Investment;
  aportes: InvestmentContribution[];
  lotes: InvestmentLotCalculation[];
  totalAportes: number;
  valorAplicadoTotal: number;
  valorOriginalTotal: number;
  principalJaResgatadoTotal: number;
  rendimentoBrutoTotal: number;
  irProvisionadoTotal: number;
  rendimentoLiquidoTotal: number;
  saldoLiquidoTotal: number;
  saldoBrutoVirtualTotal: number;
  rendimentoHojeLiquidoTotal: number;
  rendimentoMesTotal: number;
  rendimentoMesLiquidoTotal: number;
  taxaDiariaPonderada: number;
  rentabilidadeBrutaAnual: number;
  rentabilidadeLiquidaAnual: number;
  dataPrimeiroAporte: string;
  isVencido: boolean;
  dueDateStr: string | null;
}

// NOVO: Interface para Itens da Lista de Compras
export interface ShoppingItem {
  id: string;
  product: string;
  status: boolean;
  date: string; // Formato: mmm/dd
  order: number;
  created_at?: string;
  updated_at?: string;
}

// NOVO: Interface para Metas Financeiras
export interface Meta {
  id: string;
  user_id: string;
  categoria_id: string;
  valor_objetivo: number;
  valor_mensal: number;
  data_limite?: string | null;
  created_at?: string;
  updated_at?: string;
}

// NOVO: Interface para Orçamento Mensal
export interface Orcamento {
  id: string;
  user_id: string;
  categoria_id: string; // Deve ser uma subcategoria
  mes_ano: string; // Formato YYYY-MM
  tipo_planejamento: "valor" | "percentual";
  valor_planejado: number;
  percentual_planejado: number;
  created_at?: string;
  updated_at?: string;
}