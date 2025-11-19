import React, { useMemo } from "react"; // Adicionado useMemo
import { TransactionEditForm } from "@/components/TransactionEditForm";
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
  markMonthPaid,
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  loadingPayInvoice, // NOVO
  setLoadingPayInvoice, // NOVO
}) => {
  console.log("LancamentosContent.tsx: User prop received:", user?.id, "Is user null?", !user);

  const transactionToEdit = useMemo(() => {
    if (!editingTransaction) return null;

    if ((editingTransaction as MaterializedRecurringTransaction).isRecurring) {
      return editingTransaction as MaterializedRecurringTransaction;
    }

    const baseTransaction = { ...editingTransaction };
    if (editingTransaction.type === "income" && fullEditingRevenue) {
      return {
        ...baseTransaction,
        status: fullEditingRevenue.status,
        is_fixed: fullEditingRevenue.is_fixed,
        recurrence_frequency: fullEditingRevenue.recurrence_frequency,
        recurrence_installments_count: fullEditingRevenue.recurrence_installments_count,
      };
    } else if (editingTransaction.type === "expense" && fullEditingExpense) {
      return {
        ...baseTransaction,
        is_fixed: fullEditingExpense.is_fixed,
        recurrence_frequency: fullEditingExpense.recurrence_frequency,
        recurrence_installments_count: fullEditingExpense.recurrence_installments_count,
      };
    }
    return baseTransaction;
  }, [editingTransaction, fullEditingRevenue, fullEditingExpense]);

  const disableFilters = !!editingTransaction;

  return transactionToEdit ? (
    <TransactionEditForm
      editingTransaction={transactionToEdit}
      onUpdateTransaction={onUpdateTransaction}
      onCancelEdit={onCancelEdit}
      onDeleteTransaction={onDeleteTransaction}
      allCategories={allCategories}
      isMobile={isMobile}
    />
  ) : (
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
      loadingPayInvoice={loadingPayInvoice} // NOVO
      setLoadingPayInvoice={setLoadingPayInvoice} // NOVO
    />
  );
};