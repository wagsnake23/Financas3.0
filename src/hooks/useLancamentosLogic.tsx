import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { Transaction, TransactionType } from "@/types/finance";
import { TablesUpdate } from "@/integrations/supabase/types";

// Importar os novos hooks modulares
import { useLancamentosState } from "./useLancamentosState";
import { useTransactionMutations } from "./useTransactionMutations";

export const useLancamentosLogic = (
  user: User | null,
  authLoading: boolean
) => {
  console.log(
    "useLancamentosLogic: User received as prop:",
    user?.id,
    "AuthLoading:",
    authLoading
  );

  const queryClient = useQueryClient();

  // Usar o hook de estado para gerenciar todos os estados da UI
  const {
    selectedMonth,
    setSelectedMonth,
    handlePreviousMonth,
    handleNextMonth,
    editingTransaction,
    setEditingTransaction,
    fullEditingRevenue,
    setFullEditingRevenue,
    fullEditingExpense,
    setFullEditingExpense,
    loadingEditData,
    setLoadingEditData,
    loadingPayInvoice, // NOVO
    setLoadingPayInvoice, // NOVO
    isEditModalOpen,
    setIsEditModalOpen,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    handleCancelEdit,
    isValidUuid,
  } = useLancamentosState();

  // Usar o hook de dados para buscar transações e categorias
  const {
    monthlyFilteredTransactions,
    fetchedCategories: allSubcategories,
    cartoes,
    isLoading: isLoadingTransactionsData,
    isLoadingCategories,
  } = useTransactionsData({
    user,
    selectedMonth,
    enabled: !!user && !authLoading,
  });

  // Usar o hook de mutações para gerenciar as operações de CRUD
  const {
    handleDeleteTransaction,
    handleUpdateTransaction,
  } = useTransactionMutations({
    user,
    queryClient,
    monthlyFilteredTransactions,
    setLoadingEditData,
    setEditingTransaction,
    setIsEditModalOpen,
    selectedMonth,
  });

  // Lógica para carregar dados completos da transação para edição (mantida aqui, pois depende de queryClient e setStates específicos)
  const handleEditTransaction = useCallback(
    async (transaction: Transaction) => {
      setEditingTransaction(transaction);
      setLoadingEditData(true);
      setIsEditModalOpen(true);

      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.");
        setLoadingEditData(false);
        return;
      }

      if (transaction.type === "income") {
        const fullRevenue = queryClient.getQueryData<Tables<"receitas">[]>(["revenues", user.id])?.find((r) => r.id === transaction.id);
        setFullEditingRevenue(fullRevenue || null);
        setFullEditingExpense(null);
      } else {
        setFullEditingExpense(null); // No full expense data needed for one-off
        setFullEditingRevenue(null);
      }
      setLoadingEditData(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [user, queryClient, setLoadingEditData, setIsEditModalOpen, setFullEditingRevenue, setFullEditingExpense]
  );

  const isLoading =
    authLoading ||
    isLoadingTransactionsData ||
    isLoadingCategories;

  return {
    selectedMonth,
    setSelectedMonth, // Adicionado
    handlePreviousMonth,
    handleNextMonth,
    editingTransaction,
    setEditingTransaction,
    fullEditingRevenue,
    setFullEditingRevenue,
    fullEditingExpense,
    setFullEditingExpense,
    loadingEditData,
    setLoadingEditData,
    loadingPayInvoice, // NOVO RETORNO
    setLoadingPayInvoice, // NOVO RETORNO
    isEditModalOpen,
    setIsEditModalOpen,
    monthlyFilteredTransactions,
    fetchedCategories: allSubcategories,
    cartoes,
    isLoading,
    isLoadingCategories,
    handleDeleteTransaction,
    handleEditTransaction,
    handleUpdateTransaction,
    handleCancelEdit,
    user,
    queryClient,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
  };
};