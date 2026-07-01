import React from "react";
import { TransactionList } from "@/components/TransactionList";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types"; // Importar Database para ReceitaStatus
import { cn } from "@/lib/utils";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface TransactionViewProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string, type: TransactionType, deleteScope: "thisMonth" | "thisMonthForward" | "all" | "oneOff") => void; // Atualizado
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  selectedMonth: Date;
  disableFilters?: boolean;
  filterPaymentOptionId: string;
  setFilterPaymentOptionId: (cardId: string) => void;
  loadingPayInvoice: boolean; // NOVA PROP
  setLoadingPayInvoice: (loading: boolean) => void; // NOVA PROP
  setSelectedMonth: (month: Date) => void; // Adicionado
  onToggleTransactionStatus: (id: string, type: TransactionType, newStatus: ReceitaStatus) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export const TransactionView: React.FC<TransactionViewProps> = ({
  transactions,
  onDeleteTransaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  queryClient,
  user,
  selectedMonth,
  disableFilters = false,
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  loadingPayInvoice, // NOVO
  setLoadingPayInvoice, // NOVO
  setSelectedMonth, // Adicionado
  onToggleTransactionStatus, // NOVA PROP
  filterType,
  setFilterType,
  filterCategory,
  setFilterCategory,
  searchTerm,
  setSearchTerm,
}) => {
  console.log("TransactionView: User prop received:", user?.id, "Is user null?", !user);

  const content = (
    <TransactionList
      transactions={transactions}
      onDeleteTransaction={onDeleteTransaction}
      onEditTransaction={onEditTransaction}
      allCategories={allCategories}
      cartoes={cartoes}
      isMobile={isMobile}
      queryClient={queryClient}
      user={user}
      selectedMonth={selectedMonth}
      filterPaymentOptionId={filterPaymentOptionId}
      setFilterPaymentOptionId={setFilterPaymentOptionId}
      loadingPayInvoice={loadingPayInvoice} // NOVO
      setLoadingPayInvoice={setLoadingPayInvoice} // NOVO
      setSelectedMonth={setSelectedMonth} // Adicionado
      onToggleTransactionStatus={onToggleTransactionStatus}
      filterType={filterType}
      setFilterType={setFilterType}
      filterCategory={filterCategory}
      setFilterCategory={setFilterCategory}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
    />
  );

  return (
    <div className={cn(isMobile ? "flex-1 flex flex-col min-h-0 bg-[#F7F9FC]" : "")}>
      {content}
    </div>
  );
};