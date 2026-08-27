import { useCallback } from "react";
import { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { Transaction, TransactionType } from "@/types/finance";
import { Database } from "@/integrations/supabase/types"; // Importar Database para ReceitaStatus

// Importar os novos hooks modulares
import { useLancamentosState } from "./useLancamentosState";
import { useTransactionMutations } from "./useTransactionMutations";

type ReceitaStatus = Database['public']['Enums']['receita_status']; // Definir ReceitaStatus aqui

export const useLancamentosLogic = (
  user: User | null
) => {
  console.log(
    "useLancamentosLogic: User received as prop:",
    user?.id
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
    filterType,
    setFilterType,
    filterCategory,
    setFilterCategory,
    searchTerm,
    setSearchTerm,
    handleCancelEdit,
    isValidUuid,
  } = useLancamentosState();

  // Usar o hook de dados para buscar transações e categorias
  const {
    monthlyFilteredTransactions,
    fetchedCategories: allSubcategories,
    cartoes,
    isLoading: isLoadingTransactionsData,
    isFetching,
    isLoadingCategories,
    refetchCartoes, // NOVO: Obter refetchCartoes
  } = useTransactionsData({
    user,
    selectedMonth,
    enabled: !!user,
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

  // Fetch all revenues and installments for historical charts
  const { data: allRevenues = [] } = useQuery<Tables<'receitas'>[]>({
    queryKey: ["allRevenues", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("receitas").select("*").eq("user_id", user.id);
      if (error) throw error;
      return data.filter((r: any) => r.data !== '1900-01-01');
    },
    enabled: !!user,
  });

  const { data: allExpenseInstallments = [] } = useQuery<(Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[]>({
    queryKey: ["allExpenseInstallments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(categoria_id, user_id)")
        .filter("despesas.user_id", "eq", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
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
    filterType,
    setFilterType,
    filterCategory,
    setFilterCategory,
    searchTerm,
    setSearchTerm,
    handleOptimisticToggleStatus, // NOVO RETORNO
    refetchCartoes, // NOVO: Retornar refetchCartoes
    isFetching,
    allRevenues,
    allExpenseInstallments,
  };
};
