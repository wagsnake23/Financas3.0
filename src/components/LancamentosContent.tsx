import React, { useMemo } from "react"; // Adicionado useMemo
import { TransactionView } from "@/components/TransactionView";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { MaterializedRecurringTransaction, useRecurringEntries } from "@/hooks/useRecurringEntries";

type EditOption = "thisMonth" | "thisMonthForward" | "all";

interface LancamentosContentProps {
  editingTransaction: Transaction | null;
  fullEditingRevenue: Tables<'receitas'> | null;
  fullEditingExpense: Tables<'despesas'> | null;
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">,
    editOption?: EditOption,
    preserveExceptions?: boolean,
    recurringData?: {
      title: string;
      value: number;
      categoryId: string | null;
      dueDay: number;
      frequency: Enums<'recurring_frequency'>;
      startDate: string | null;
      endDate: string | null;
      recurringStatus: Enums<'recurring_status'>;
      note: string | null;
      overrideDueDate: string | null;
      isPaid: boolean;
    }
  ) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (id: string, type: TransactionType, isFixed?: boolean) => void;
  allCategories: AppCategory[];
  isMobile: boolean;
  monthlyFilteredTransactions: Transaction[];
  cartoes: Tables<'cartoes'>[];
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  selectedMonth: Date;
  onEditTransaction: (transaction: Transaction) => void;
  markMonthPaid: ReturnType<typeof useRecurringEntries>['markMonthPaid'];
  filterPaymentOptionId: string;
  setFilterPaymentOptionId: (cardId: string) => void;
  loadingPayInvoice: boolean; // NOVO: Receber loadingPayInvoice
  setLoadingPayInvoice: (loading: boolean) => void; // NOVO: Receber setter
  filterType: string; // NOVO: Receber filterType
  setFilterType: (type: string) => void; // NOVO: Receber setFilterType
}

export const LancamentosContent: React.FC<LancamentosContentProps> = ({
  editingTransaction, // Mantido para contexto, mas não usado para renderização condicional
  fullEditingRevenue, // Mantido para contexto
  fullEditingExpense, // Mantido para contexto
  onUpdateTransaction, // Mantido para contexto
  onCancelEdit, // Mantido para contexto
  onDeleteTransaction,
  allCategories,
  isMobile,
  monthlyFilteredTransactions,
  cartoes,
  queryClient,
  user,
  selectedMonth,
  onEditTransaction,
  markMonthPaid,
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  loadingPayInvoice,
  setLoadingPayInvoice,
  filterType, // NOVO
  setFilterType, // NOVO
}) => {
  console.log("LancamentosContent.tsx: User prop received:", user?.id, "Is user null?", !user);

  // A lógica de `transactionToEdit` e renderização condicional foi movida para Lancamentos.tsx
  // Este componente agora sempre renderiza a TransactionView.
  const disableFilters = !!editingTransaction; // Desabilita filtros se houver uma transação em edição (no modal)

  return (
    <TransactionView
      transactions={monthlyFilteredTransactions}
      onDeleteTransaction={onDeleteTransaction}
      onEditTransaction={onEditTransaction}
      allCategories={allCategories}
      cartoes={cartoes}
      isMobile={isMobile}
      queryClient={queryClient}
      user={user}
      selectedMonth={selectedMonth}
      disableFilters={disableFilters}
      markMonthPaid={markMonthPaid}
      filterPaymentOptionId={filterPaymentOptionId}
      setFilterPaymentOptionId={setFilterPaymentOptionId}
      loadingPayInvoice={loadingPayInvoice}
      setLoadingPayInvoice={setLoadingPayInvoice}
      filterType={filterType} // NOVO: Passar filterType
      setFilterType={setFilterType} // NOVO: Passar setFilterType
    />
  );
};