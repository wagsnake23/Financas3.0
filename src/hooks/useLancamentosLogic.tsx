import { useCallback, useState } from "react"; // Adicionado useState
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { Transaction, TransactionType } from "@/types/finance";
import { TablesUpdate } from "@/integrations/supabase/types";
import { Database, Tables } from "@/integrations/supabase/types"; // Importar Tables

// Importar os novos hooks modulares
import { useLancamentosState } from "./useLancamentosState";
import { useTransactionMutations } from "./useTransactionMutations";
import { format, parseISO } from "date-fns"; // Importar format e parseISO
import { isValidUuid } from "@/lib/utils"; // Importar isValidUuid

type ReceitaStatus = Database['public']['Enums']['receita_status']; // Definir ReceitaStatus aqui
type DeleteScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff"; // 'oneOff' para transações avulsas

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
    loadingPayInvoice, // NOVO
    setLoadingPayInvoice, // NOVO
    isEditModalOpen,
    setIsEditModalOpen,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    handleCancelEdit,
    isValidUuid: isValidUuidFromState, // Renomeado para evitar conflito
  } = useLancamentosState();

  // Usar o hook de dados para buscar transações e categorias
  const {
    monthlyFilteredTransactions,
    fetchedCategories: allSubcategories,
    cartoes,
    isLoading: isLoadingTransactionsData,
    isLoadingCategories,
    refetchCartoes, // NOVO: Obter refetchCartoes
  } = useTransactionsData({
    user,
    selectedMonth,
    enabled: !!user && !authLoading,
  });

  // Usar o hook de mutações para gerenciar as operações de CRUD
  const {
    handleDeleteTransaction,
    handleUpdateTransaction,
    handleOptimisticToggleStatus, // NOVO: Obter a função de toggle otimista
  } = useTransactionMutations({
    user,
    queryClient,
    monthlyFilteredTransactions,
    setLoadingEditData,
    setEditingTransaction,
    setIsEditModalOpen,
    selectedMonth,
  });

  // NOVO: Estados e lógica para o fluxo de exclusão
  const [showDeleteOptionsDialog, setShowDeleteOptionsDialog] = useState(false);
  const [showSimpleDeleteDialog, setShowSimpleDeleteDialog] = useState(false);
  const [selectedDeleteScope, setSelectedDeleteScope] = useState<DeleteScope>("thisMonth");
  const [pendingFutureItemsCount, setPendingFutureItemsCount] = useState(0);
  const [isFetchingDeleteOptions, setIsFetchingDeleteOptions] = useState(false);

  // Helper function to fetch pending future items (installments or occurrences)
  const fetchPendingFutureItems = useCallback(async (transaction: Transaction): Promise<number> => {
    let count = 0;
    try {
      const formattedTransactionDate = format(parseISO(transaction.date) || new Date(), 'yyyy-MM-dd');

      if (transaction.type === "expense") {
        const parentDespesaId = transaction.despesa_id;
        if (parentDespesaId && isValidUuid(parentDespesaId)) {
          const { count: futureInstallmentsCount, error } = await supabase
            .from("despesas_parcelas")
            .select("id", { count: 'exact' })
            .eq("despesa_id", parentDespesaId)
            .eq("pago", false) // Apenas parcelas não pagas
            .gte("vencimento", formattedTransactionDate);
          
          if (error) throw error;
          count = futureInstallmentsCount || 0;
        }
      } else if (transaction.type === "income") {
        const masterRecurrenceId = transaction.is_recurring_master ? transaction.id : transaction.recurrence_id;
        if (masterRecurrenceId && isValidUuid(masterRecurrenceId)) {
          const { count: futureOccurrencesCount, error } = await supabase
            .from("receitas")
            .select("id", { count: 'exact' })
            .eq("recurrence_id", masterRecurrenceId)
            .in("status", ["Pendente", "Prevista"]) // Apenas ocorrências pendentes ou previstas
            .gte("data", formattedTransactionDate);
          
          if (error) throw error;
          count = futureOccurrencesCount || 0;
        }
      }
    } catch (error) {
      console.error("Error fetching pending future items:", error);
      toast.error("Erro ao verificar lançamentos futuros.");
    }
    return count;
  }, []);

  const handleTriggerDeleteConfirmation = useCallback(async () => {
    if (!editingTransaction) return;

    setIsFetchingDeleteOptions(true);
    const futureItems = await fetchPendingFutureItems(editingTransaction);
    setPendingFutureItemsCount(futureItems);
    setIsFetchingDeleteOptions(false);

    const totalItemsInSeries = editingTransaction.totalInstallments || 1;

    const isFixedRecurringSeries =
      editingTransaction.tipo_pagamento === "fixo" &&
      (editingTransaction.is_recurring_master || !!editingTransaction.recurrence_id);

    const isInstallmentSeries =
      editingTransaction.tipo_pagamento === "parcelado" &&
      totalItemsInSeries > 1 &&
      futureItems > 0;

    const shouldShowSeriesOptions = isFixedRecurringSeries || isInstallmentSeries;

    if (shouldShowSeriesOptions) {
      setShowDeleteOptionsDialog(true);
    } else {
      setShowSimpleDeleteDialog(true);
    }
  }, [editingTransaction, fetchPendingFutureItems]);

  const handleConfirmDeleteAction = useCallback(() => {
    if (editingTransaction) {
      handleDeleteTransaction(
        editingTransaction.id,
        editingTransaction.type,
        selectedDeleteScope
      );
    }
    setShowDeleteOptionsDialog(false);
    setShowSimpleDeleteDialog(false);
  }, [editingTransaction, selectedDeleteScope, handleDeleteTransaction]);


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
        // For recurring income, we need to fetch the master if this is an occurrence
        const masterId = transaction.is_recurring_master ? transaction.id : transaction.recurrence_id;
        if (masterId) {
          const { data: masterRevenue, error } = await supabase
            .from("receitas")
            .select("*, status, is_recurring_master, recurrence_id, recurrence_day")
            .eq("id", masterId)
            .eq("user_id", user.id)
            .single();
          if (error) {
            console.error("Error fetching master revenue for editing:", error);
            toast.error("Erro ao carregar receita recorrente.");
            setLoadingEditData(false);
            return;
          }
          setFullEditingRevenue(masterRevenue || null);
        } else {
          // For one-off income, just use the transaction data
          const fullRevenue = queryClient.getQueryData<Tables<"receitas">[]>(["revenues", user.id])?.find((r) => r.id === transaction.id);
          setFullEditingRevenue(fullRevenue || null);
        }
        setFullEditingExpense(null);
      } else { // Expense
        // For expenses, the 'despesas' record is the master, and 'despesas_parcelas' are occurrences.
        // We need to fetch the 'despesas' master record for editing.
        const despesaId = transaction.despesa_id;
        if (despesaId) {
          const { data: masterExpense, error } = await supabase
            .from("despesas")
            .select("*, is_recurring_master") // Include is_recurring_master
            .eq("id", despesaId)
            .eq("user_id", user.id)
            .single();
          if (error) {
            console.error("Error fetching master expense for editing:", error);
            toast.error("Erro ao carregar despesa recorrente.");
            setLoadingEditData(false);
            return;
          }
          setFullEditingExpense(masterExpense || null);
        } else {
          setFullEditingExpense(null); // Should not happen for valid expense installments
        }
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
    handleOptimisticToggleStatus, // NOVO RETORNO
    refetchCartoes, // NOVO: Retornar refetchCartoes
    // NOVO: Retornos para o fluxo de exclusão
    showDeleteOptionsDialog,
    setShowDeleteOptionsDialog,
    showSimpleDeleteDialog,
    setShowSimpleDeleteDialog,
    selectedDeleteScope,
    setSelectedDeleteScope,
    pendingFutureItemsCount,
    isFetchingDeleteOptions,
    handleTriggerDeleteConfirmation,
    handleConfirmDeleteAction,
  };
};