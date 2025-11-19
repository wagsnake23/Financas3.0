import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { TransactionList } from "@/components/TransactionList";
import { AppCategory, TransactionType } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { useRecurringEntries } from "@/hooks/useRecurringEntries"; // Importar useRecurringEntries para o tipo

interface TransactionViewProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string, type: TransactionType, isFixed?: boolean) => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[]; // Agora contém apenas subcategorias
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  // rawExpenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagão' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[]; // Removido
  selectedMonth: Date; // NOVO: Adicionado selectedMonth
  disableFilters?: boolean; // Nova prop para desativar filtros
  markMonthPaid: ReturnType<typeof useRecurringEntries>['markMonthPaid']; // Re-adicionado
  filterPaymentOptionId: string; // NOVO: Receber o estado do filtro
  setFilterPaymentOptionId: (cardId: string) => void; // NOVO: Receber o setter do filtro
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
  // rawExpenseInstallments, // Removido
  selectedMonth, // NOVO: Recebendo selectedMonth
  disableFilters = false, // Valor padrão é false
  markMonthPaid, // Re-adicionado
  filterPaymentOptionId, // NOVO
  setFilterPaymentOptionId, // NOVO
}) => {
  console.log("TransactionView: User prop received:", user?.id, "Is user null?", !user);
  // const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all"); // Removido

  const content = (
    <TransactionList
      transactions={transactions}
      onDeleteTransaction={onDeleteTransaction}
      onEditTransaction={onEditTransaction}
      allCategories={allCategories}
      cartoes={cartoes}
      // filterPaymentMethod={filterPaymentMethod} // Removido
      // setFilterPaymentMethod={setFilterPaymentMethod} // Removido
      isMobile={isMobile}
      queryClient={queryClient}
      user={user}
      // rawExpenseInstallments={rawExpenseInstallments} // Removido
      selectedMonth={selectedMonth} // NOVO: Passando selectedMonth
      disableFilters={disableFilters} // Passando a prop disableFilters
      markMonthPaid={markMonthPaid} // Re-adicionado
      filterPaymentOptionId={filterPaymentOptionId} // NOVO
      setFilterPaymentOptionId={setFilterPaymentOptionId} // NOVO
    />
  );

  return isMobile ? content : <Card className="p-6 animate-slide-up rounded-xl shadow-sm">{content}</Card>;
};