import React from "react";
import { TransactionView } from "@/components/TransactionView";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types"; // Importar Database para ReceitaStatus
import { cn } from "@/lib/utils";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface LancamentosContentProps {
  editingTransaction: Transaction | null;
  fullEditingRevenue: Tables<'receitas'> | null;
  fullEditingExpense: Tables<'despesas'> | null;
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">,
    saveScope: "thisMonth" | "thisMonthForward" | "all" | "oneOff" // Adicionado saveScope
  ) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (id: string, type: TransactionType, deleteScope: "thisMonth" | "thisMonthForward" | "all" | "oneOff") => void; // Atualizado
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
  loadingPayInvoice: boolean; // NOVA PROP
  setLoadingPayInvoice: (loading: boolean) => void; // NOVA PROP
  setSelectedMonth: (month: Date) => void; // Adicionado
  onToggleTransactionStatus: (id: string, type: TransactionType, newStatus: ReceitaStatus) => void; // NOVA PROP
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
  loadingPayInvoice, // NOVO
  setLoadingPayInvoice, // NOVO
  setSelectedMonth, // Adicionado
  onToggleTransactionStatus, // NOVA PROP
}) => {
  console.log("LancamentosContent.tsx: User prop received:", user?.id, "Is user null?", !user);

  // Removido: const disableFilters = !!editingTransaction;

  return (
    <div className={cn(isMobile ? "flex-1 flex flex-col min-h-0" : "")}>
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
        // Removido: disableFilters={disableFilters}
        filterPaymentOptionId={filterPaymentOptionId}
        setFilterPaymentOptionId={setFilterPaymentOptionId}
        loadingPayInvoice={loadingPayInvoice} // NOVO
        setLoadingPayInvoice={setLoadingPayInvoice} // NOVO
        setSelectedMonth={setSelectedMonth} // Adicionado
        onToggleTransactionStatus={onToggleTransactionStatus} // Passando a nova prop
      />
    </div>
  );
};