import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { TransactionList } from "@/components/TransactionList";
import { AppCategory, TransactionType } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { useRecurringEntries } from "@/hooks/useRecurringEntries";

interface TransactionViewProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string, type: TransactionType, isFixed?: boolean) => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  selectedMonth: Date;
  disableFilters?: boolean;
  markMonthPaid: ReturnType<typeof useRecurringEntries>['markMonthPaid'];
  filterPaymentOptionId: string;
  setFilterPaymentOptionId: (cardId: string) => void;
  loadingPayInvoice: boolean; // NOVO: Receber loadingPayInvoice
  setLoadingPayInvoice: (loading: boolean) => void; // NOVO: Receber setter
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
  markMonthPaid,
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  loadingPayInvoice, // NOVO
  setLoadingPayInvoice, // NOVO
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
      disableFilters={disableFilters}
      markMonthPaid={markMonthPaid}
      filterPaymentOptionId={filterPaymentOptionId}
      setFilterPaymentOptionId={setFilterPaymentOptionId}
      loadingPayInvoice={loadingPayInvoice}
      setLoadingPayInvoice={setLoadingPayInvoice}
    />
  );

  // Se for mobile, retorna o conteúdo diretamente.
  // Se não for mobile, retorna o conteúdo diretamente (removendo o Card).
  return content;
};