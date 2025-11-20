import React from "react";
import { TransactionView } from "@/components/TransactionView";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";

interface LancamentosContentProps {
  editingTransaction: Transaction | null;
  fullEditingRevenue: Tables<'receitas'> | null;
  fullEditingExpense: Tables<'despesas'> | null;
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">
  ) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (id: string, type: TransactionType) => void;
  allCategories: AppCategory[];
  isMobile: boolean;
  monthlyFilteredTransactions: Transaction[];
  cartoes: Tables<'cartoes'>[];
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  selectedMonth: Date;
  onEditTransaction: (transaction: Transaction) => void;
  filterPaymentOptionId: string;
  setFilterPaymentOptionId: (cardId: string) => void;
  loadingPayInvoice: boolean;
  setLoadingPayInvoice: (loading: boolean) => void;
}

export const LancamentosContent: React.FC<LancamentosContentProps> = ({
  editingTransaction,
  fullEditingRevenue,
  fullEditingExpense,
  onUpdateTransaction,
  onCancelEdit,
  onDeleteTransaction,
  allCategories,
  isMobile,
  monthlyFilteredTransactions,
  cartoes,
  queryClient,
  user,
  selectedMonth,
  onEditTransaction,
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  loadingPayInvoice,
  setLoadingPayInvoice,
}) => {
  console.log("LancamentosContent.tsx: User prop received:", user?.id, "Is user null?", !user);

  const disableFilters = !!editingTransaction;

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
      filterPaymentOptionId={filterPaymentOptionId}
      setFilterPaymentOptionId={setFilterPaymentOptionId}
      loadingPayInvoice={loadingPayInvoice}
      setLoadingPayInvoice={setLoadingPayInvoice}
    />
  );
};