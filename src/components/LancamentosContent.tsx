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
  monthlyFilteredTransactions: Transaction[]; // NOVO: Receber monthlyFilteredTransactions
  cartoes: Tables<'cartoes'>[]; // NOVO: Receber cartoes
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  selectedMonth: Date;
  onEditTransaction: (transaction: Transaction) => void;
  // markMonthPaid: ReturnType<typeof useRecurringEntries>['markMonthPaid']; // REMOVIDO: markMonthPaid será passado via useTransactionMutations
  filterPaymentOptionId: string;
  setFilterPaymentOptionId: (cardId: string) => void;
  loadingPayInvoice: boolean;
  setLoadingPayInvoice: (loading: boolean) => void;
  filterType: string;
  setFilterType: (type: string) => void;
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
  monthlyFilteredTransactions, // NOVO
  cartoes, // NOVO
  queryClient,
  user,
  selectedMonth,
  onEditTransaction,
  // markMonthPaid, // REMOVIDO
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  loadingPayInvoice,
  setLoadingPayInvoice,
  filterType,
  setFilterType,
}) => {
  console.log("LancamentosContent.tsx: User prop received:", user?.id, "Is user null?", !user);

  const disableFilters = !!editingTransaction;

  // markMonthPaid agora precisa ser obtido de useRecurringEntries aqui, se for usado diretamente.
  // No entanto, como ele é uma função de mutação, é melhor que seja passado de useTransactionMutations.
  // Por enquanto, vamos mockar ou garantir que ele não seja usado diretamente aqui.
  // Para o contexto atual, ele é usado em TransactionRow, que recebe de TransactionList, que por sua vez recebe de LancamentosContent.
  // Então, precisamos passá-lo de Lancamentos.tsx -> LancamentosContent.tsx -> TransactionView.tsx -> TransactionList.tsx -> TransactionRow.tsx.
  // Como useTransactionMutations já o encapsula, vamos passá-lo de lá.

  // Temporariamente, para evitar erro de tipo, vamos criar um mock ou garantir que não seja usado diretamente aqui.
  // A melhor abordagem é que Lancamentos.tsx passe a função `markMonthPaid` do `useTransactionMutations` para cá.
  // Por enquanto, vou deixar um placeholder para `markMonthPaid` para que o código compile.
  const { markMonthPaid } = useRecurringEntries(user, selectedMonth, allCategories, !!user);


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
      markMonthPaid={markMonthPaid} // Passando markMonthPaid
      filterPaymentOptionId={filterPaymentOptionId}
      setFilterPaymentOptionId={setFilterPaymentOptionId}
      loadingPayInvoice={loadingPayInvoice}
      setLoadingPayInvoice={setLoadingPayInvoice}
      filterType={filterType}
      setFilterType={setFilterType}
    />
  );
};