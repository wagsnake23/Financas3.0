import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { TransactionList } from "@/components/TransactionList";
import { AppCategory, TransactionType } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

interface TransactionViewProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string, type: TransactionType, isFixed?: boolean) => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  rawExpenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[];
  selectedMonth: Date; // Reintroduzido
  disableFilters?: boolean; // Nova prop para desativar filtros
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
  rawExpenseInstallments,
  selectedMonth, // Reintroduzido
  disableFilters = false, // Valor padrão é false
}) => {
  console.log("TransactionView: User prop received:", user?.id, "Is user null?", !user);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");

  const content = (
    <TransactionList
      transactions={transactions}
      onDeleteTransaction={onDeleteTransaction}
      onEditTransaction={onEditTransaction}
      allCategories={allCategories}
      cartoes={cartoes}
      filterPaymentMethod={filterPaymentMethod}
      setFilterPaymentMethod={setFilterPaymentMethod}
      isMobile={isMobile}
      queryClient={queryClient}
      user={user}
      rawExpenseInstallments={rawExpenseInstallments}
      selectedMonth={selectedMonth} // Passando selectedMonth
      disableFilters={disableFilters} // Passando a prop disableFilters
    />
  );

  return isMobile ? content : <Card className="p-6 animate-slide-up">{content}</Card>;
};