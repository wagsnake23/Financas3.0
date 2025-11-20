import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { Transaction, TransactionType } from "@/types/finance";
import { TablesUpdate } from "@/integrations/supabase/types";
import { useRecurringEntries } from "@/hooks/useRecurringEntries";

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
    loadingPayInvoice,
    setLoadingPayInvoice,
    isEditModalOpen,
    setIsEditModalOpen,
    isDeleteRecurrenceModalOpen,
    setIsDeleteRecurrenceModalOpen,
    selectedRecurringTransactionForDelete,
    setSelectedRecurringTransactionForDelete,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    handleCancelEdit,
    isValidUuid, // Re-exportar isValidUuid do useLancamentosState
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

  // Usar o hook de recorrências para operações específicas de recorrência
  const {
    markMonthPaid,
    isLoading: isLoadingRecurringEntriesHook,
  } = useRecurringEntries(
    user,
    selectedMonth,
    allSubcategories, // Passar allSubcategories para useRecurringEntries
    !!user && !authLoading
  );

  // Usar o hook de mutações para gerenciar as operações de CRUD
  const {
    confirmDeleteWithOptions,
    handleDeleteTransaction,
    handleUpdateTransaction,
  } = useTransactionMutations({
    user,
    queryClient,
    monthlyFilteredTransactions,
    setLoadingEditData,
    setIsDeleteRecurrenceModalOpen,
    setEditingTransaction,
    setIsEditModalOpen,
    setSelectedRecurringTransactionForDelete,
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

      if (transaction.isRecurring) {
        setFullEditingRevenue(null);
        setFullEditingExpense(null);
        setLoadingEditData(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const currentRevenues =
        queryClient.getQueryData<Tables<"receitas">[]>(["revenues", user.id]) || [];

      if (transaction.type === "income") {
        let revenueIdToUse = transaction.id;
        if (transaction.is_fixed) {
          const lastHyphenIndex = transaction.id.lastIndexOf("-");
          if (lastHyphenIndex !== -1) {
            revenueIdToUse = transaction.id.substring(0, lastHyphenIndex);
          }
        }
        if (!isValidUuid(revenueIdToUse)) {
          toast.error("Erro (EDIT-INC-1): ID de receita inválido.");
          setLoadingEditData(false);
          return;
        }
        const fullRevenue = currentRevenues.find((r) => r.id === revenueIdToUse);
        setFullEditingRevenue(fullRevenue || null);
        setFullEditingExpense(null);
      } else {
        if (transaction.is_fixed) {
          const lastHyphenIndex = transaction.id.lastIndexOf("-");
          if (lastHyphenIndex === -1) {
            toast.error("Erro (EDIT-FX-1): Formato de ID de despesa fixa inesperado.");
            setLoadingEditData(false);
            return;
          }
          const parentDespesaId = transaction.id.substring(0, lastHyphenIndex);
          if (!isValidUuid(parentDespesaId)) {
            toast.error("Erro (EDIT-FX-2): ID de despesa fixa inválido.");
            setLoadingEditData(false);
            return;
          }

          const { data: fetchedParentDespesa, error: fetchError } = await supabase
            .from("despesas")
            .select("*")
            .eq("id", parentDespesaId)
            .single();

          if (fetchError) {
            console.error("handleEditTransaction: Erro ao buscar despesa pai para edição:", fetchError);
            toast.error("Erro ao carregar detalhes da despesa fixa para edição.");
            setFullEditingExpense(null);
          } else if (fetchedParentDespesa) {
            setFullEditingExpense(fetchedParentDespesa);
          } else {
            toast.error("Erro ao carregar detalhes da despesa fixa para edição (dados não encontrados).");
            setFullEditingExpense(null);
          }
        } else {
          setFullEditingExpense(null);
        }
        setFullEditingRevenue(null);
      }
      setLoadingEditData(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [user, queryClient, setLoadingEditData, setIsEditModalOpen, setFullEditingRevenue, setFullEditingExpense, isValidUuid]
  );

  const isLoading =
    authLoading ||
    isLoadingTransactionsData ||
    isLoadingCategories ||
    isLoadingRecurringEntriesHook;

  return {
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
    loadingPayInvoice,
    setLoadingPayInvoice,
    isEditModalOpen,
    setIsEditModalOpen,
    isDeleteRecurrenceModalOpen,
    setIsDeleteRecurrenceModalOpen,
    selectedRecurringTransaction: selectedRecurringTransactionForDelete,
    setSelectedRecurringTransaction: setSelectedRecurringTransactionForDelete,
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
    confirmDeleteWithOptions,
    markMonthPaid,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
  };
};