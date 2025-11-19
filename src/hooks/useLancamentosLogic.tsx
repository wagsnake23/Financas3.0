import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { AppCategory, Transaction, TransactionType } from "@/types/finance";
import { Tables, TablesUpdate, Enums } from "@/integrations/supabase/types";
import { MaterializedRecurringTransaction, useRecurringEntries } from "@/hooks/useRecurringEntries";

const isValidUuid = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const useLancamentosLogic = (user: User | null) => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  console.log("useLancamentosLogic: User received as prop:", user?.id);

  const initialMonth = useMemo(() => {
    const monthParam = searchParams.get("month");
    if (monthParam) {
      try {
        const [year, month, day] = monthParam.split('-').map(Number);
        return new Date(year, month - 1, day);
      } catch (e) {
        console.error("Invalid month parameter in URL:", monthParam, e);
        return new Date();
      }
    }
    return new Date();
  }, [searchParams]);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [fullEditingRevenue, setFullEditingRevenue] = useState<Tables<'receitas'> | null>(null);
  const [fullEditingExpense, setFullEditingExpense] = useState<Tables<'despesas'> | null>(null);
  const [loadingEditData, setLoadingEditData] = useState(false);

  const [isDeleteRecurrenceModalOpen, setIsDeleteRecurrenceModalOpen] = useState(false);
  const [selectedRecurringTransactionForDelete, setSelectedRecurringTransactionForDelete] = useState<Transaction | null>(null); // Alterado o tipo para Transaction

  const {
    allRawTransactions,
    fetchedCategories,
    cartoes,
    expenseInstallments,
    isLoading,
    isLoadingCategories,
  } = useTransactionsData({ user, selectedMonth }); // Passando selectedMonth para useTransactionsData

  const {
    createOrUpdateException,
    updateRecurringMasterFuture,
    updateRecurringMasterGlobal,
    deleteRecurringEntry, // Usado para exclusão global
    cancelMonth, // Usado para exclusão de mês específico
    endRecurringAt, // Usado para exclusão a partir de um mês
  } = useRecurringEntries(user, selectedMonth, fetchedCategories);

  // Nova função para lidar com a exclusão baseada nas opções do modal
  const confirmDeleteWithOptions = useCallback(async (transaction: Transaction, deleteOption: "thisMonth" | "thisMonthForward" | "all") => {
    setLoadingEditData(true);
    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      setLoadingEditData(false);
      return;
    }

    try {
      if (transaction.isRecurring && transaction.recurringEntryId) {
        // Lógica para lançamentos recorrentes (MaterializedRecurringTransaction)
        const recurringTrans = transaction as MaterializedRecurringTransaction;
        const transactionDate = new Date(recurringTrans.date);
        const year = transactionDate.getFullYear();
        const month = transactionDate.getMonth() + 1;

        if (deleteOption === "thisMonth") {
          await cancelMonth({
            recurring_id: recurringTrans.recurringEntryId,
            year,
            month,
          });
        } else if (deleteOption === "thisMonthForward") {
          const previousMonthDate = subMonths(new Date(recurringTrans.date), 1);
          await endRecurringAt({
            recurring_id: recurringTrans.recurringEntryId,
            end_year: previousMonthDate.getFullYear(),
            end_month: previousMonthDate.getMonth() + 1,
          });
        } else if (deleteOption === "all") {
          await deleteRecurringEntry(recurringTrans.recurringEntryId);
        }
        toast.success("Lançamento recorrente excluído/cancelado!", { style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' } });
      } else if (transaction.type === "expense" && transaction.installmentNumber && transaction.despesa_id) {
        // Lógica para despesas parceladas (não recorrentes)
        const parentDespesaId = transaction.despesa_id;
        const installmentId = transaction.id;

        if (deleteOption === "thisMonth") {
          // Excluir apenas esta parcela específica
          const { error } = await supabase.from("despesas_parcelas").delete().eq("id", installmentId);
          if (error) throw error;
          // Verificar se a despesa pai precisa ser excluída (se não houver mais parcelas)
          const { data: remainingParcelas, error: checkError } = await supabase.from("despesas_parcelas").select("id").eq("despesa_id", parentDespesaId);
          if (checkError) console.error("Error checking remaining installments:", checkError);
          if (remainingParcelas && remainingParcelas.length === 0) {
            await supabase.from("despesas").delete().eq("id", parentDespesaId);
          }
          toast.success("Parcela excluída!", { style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' } });
        } else if (deleteOption === "thisMonthForward") {
          // Excluir esta parcela e todas as parcelas futuras para esta despesa pai
          const { error } = await supabase.from("despesas_parcelas").delete().eq("despesa_id", parentDespesaId).gte("numero_parcela", transaction.installmentNumber);
          if (error) throw error;
          // Verificar se a despesa pai precisa ser excluída (se não houver mais parcelas)
          const { data: remainingParcelas, error: checkError } = await supabase.from("despesas_parcelas").select("id").eq("despesa_id", parentDespesaId);
          if (checkError) console.error("Error checking remaining installments:", checkError);
          if (remainingParcelas && remainingParcelas.length === 0) {
            await supabase.from("despesas").delete().eq("id", parentDespesaId);
          }
          toast.success("Parcelas futuras excluídas!", { style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' } });
        } else if (deleteOption === "all") {
          // Excluir a despesa pai inteira e todas as suas parcelas
          const { error } = await supabase.from("despesas").delete().eq("id", parentDespesaId);
          if (error) throw error;
          toast.success("Despesa parcelada excluída!", { style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' } });
        }
      } else {
        // Este caso não deve ser atingido se o modal for aberto apenas para recorrentes/parceladas
        toast.error("Tipo de transação não suportado para exclusão avançada.");
        setLoadingEditData(false);
        return;
      }

      // Invalidar queries após exclusão bem-sucedida
      queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
    } catch (error: any) {
      toast.error("Erro ao excluir lançamento", { description: error.message });
      console.error("Deletion error:", error);
    } finally {
      setLoadingEditData(false);
      setIsDeleteRecurrenceModalOpen(false); // Fechar o modal
      setEditingTransaction(null); // Fechar o formulário de edição
    }
  }, [user, queryClient, cancelMonth, endRecurringAt, deleteRecurringEntry]);

  const handleDeleteTransaction = useCallback(async (id: string, type: "income" | "expense", isFixed?: boolean) => {
    setLoadingEditData(true);

    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      setLoadingEditData(false);
      return;
    }

    const transactionToDelete = allRawTransactions.find(t => t.id === id);
    if (!transactionToDelete) {
      toast.error("Lançamento não encontrado.");
      setLoadingEditData(false);
      return;
    }

    // Se for um lançamento recorrente OU uma despesa parcelada (com mais de 1 parcela), abrir o modal de exclusão avançada
    if (transactionToDelete.isRecurring || (transactionToDelete.type === "expense" && transactionToDelete.installmentNumber && transactionToDelete.totalInstallments && transactionToDelete.totalInstallments > 1)) {
      setSelectedRecurringTransactionForDelete(transactionToDelete);
      setIsDeleteRecurrenceModalOpen(true);
      setLoadingEditData(false);
      return;
    }

    // Lógica original para transações avulsas (receitas ou despesas de parcela única)
    let error = null;
    const currentExpenseInstallments = queryClient.getQueryData<(Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[]>(["expenseInstallments", user?.id]) || [];

    if (type === "income") {
      let revenueIdToUse = id;
      if (isFixed) { // Este caminho para receitas fixas legadas, que devem ser filtradas por useTransactionsData agora
        const lastHyphenIndex = revenueIdToUse.lastIndexOf('-');
        if (lastHyphenIndex !== -1) {
          revenueIdToUse = revenueIdToUse.substring(0, lastHyphenIndex);
        }
      }
      if (!isValidUuid(revenueIdToUse)) {
        toast.error("Erro (DEL-INC-1): ID de receita inválido.");
        setLoadingEditData(false);
        return;
      }
      const { error: deleteError } = await supabase
        .from("receitas")
        .delete()
        .eq("id", revenueIdToUse)
        .eq("user_id", user.id);
      error = deleteError;
    } else if (type === "expense") {
      // Este caminho para despesas de parcela única (não recorrentes)
      if (!isValidUuid(id)) {
        toast.error("Erro (DEL-NF-1): ID de parcela de despesa inválido.");
        setLoadingEditData(false);
        return;
      }
      const installmentData = currentExpenseInstallments.find(p => p.id === id);

      if (!installmentData) {
        toast.error("Erro (DEL-NF-1.5): Parcela não encontrada.");
        setLoadingEditData(false);
        return;
      } else if (installmentData) {
        const despesaId = installmentData.despesa_id;
        if (!isValidUuid(despesaId)) {
          toast.error("Erro (DEL-NF-2): ID da despesa principal da parcela inválido.");
          setLoadingEditData(false);
          return;
        }
        const { error: deleteParcelaError } = await supabase
          .from("despesas_parcelas")
          .delete()
          .eq("id", id);
        error = deleteParcelaError;

        if (!error) {
          const { data: remainingParcelas, error: checkError } = await supabase
            .from("despesas_parcelas")
            .select("id")
            .eq("despesa_id", despesaId);

          if (checkError) {
            console.error("handleDeleteTransaction: Erro ao verificar parcelas restantes:", checkError);
          } else if (remainingParcelas && remainingParcelas.length === 0) {
            const { error: deleteDespesaError } = await supabase
              .from("despesas")
              .delete()
              .eq("id", despesaId)
              .eq("user_id", user.id);
            if (deleteDespesaError) {
              console.error("handleDeleteTransaction: Erro ao excluir despesa pai:", deleteDespesaError);
            }
          }
        }
      }
    }

    if (error) {
      toast.error("Erro ao excluir lançamento", { description: error.message });
      console.error("handleDeleteTransaction: Deletion error:", error);
    } else {
      toast.success("Lançamento excluído!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
      });
      setEditingTransaction(null); // Fechar o formulário de edição
      setFullEditingRevenue(null);
      setFullEditingExpense(null);
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user?.id] });
    }
    setLoadingEditData(false);
  }, [user, queryClient, allRawTransactions, expenseInstallments, confirmDeleteWithOptions]);

  const handleEditTransaction = useCallback(async (transaction: Transaction) => {
    // Sempre define editingTransaction, o formulário de edição unificado lidará com a renderização
    setEditingTransaction(transaction);
    setLoadingEditData(true);

    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      setLoadingEditData(false);
      return;
    }

    // Se for uma transação recorrente materializada, não precisamos buscar dados adicionais
    // O TransactionEditForm usará as propriedades de MaterializedRecurringTransaction
    if (transaction.isRecurring) {
      setFullEditingRevenue(null);
      setFullEditingExpense(null);
      setLoadingEditData(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Lógica existente para transações não recorrentes (avulsas ou fixas legadas)
    const currentRevenues = queryClient.getQueryData<Tables<'receitas'>[]>(["revenues", user.id]) || [];
    const currentExpenseInstallments = queryClient.getQueryData<(Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[]>(["expenseInstallments", user.id]) || [];

    if (transaction.type === "income") {
      let revenueIdToUse = transaction.id;
      if (transaction.is_fixed) {
        const lastHyphenIndex = transaction.id.lastIndexOf('-');
        if (lastHyphenIndex !== -1) {
          revenueIdToUse = transaction.id.substring(0, lastHyphenIndex);
        }
      }
      if (!isValidUuid(revenueIdToUse)) {
        toast.error("Erro (EDIT-INC-1): ID de receita inválido.");
        setLoadingEditData(false);
        return;
      }
      const fullRevenue = currentRevenues.find(r => r.id === revenueIdToUse);
      setFullEditingRevenue(fullRevenue || null);
      setFullEditingExpense(null);
    } else {
      if (transaction.is_fixed) {
        const lastHyphenIndex = transaction.id.lastIndexOf('-');
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
        if (!isValidUuid(transaction.id)) {
          toast.error("Erro (EDIT-NF-1): ID de parcela de despesa inválido.");
          setLoadingEditData(false);
          return;
        }
        const installment = currentExpenseInstallments.find(p => p.id === transaction.id);
        if (installment?.despesas) {
          setFullEditingExpense(installment.despesas);
        } else {
          toast.error("Erro ao carregar detalhes da despesa não fixa para edição (dados não encontrados).");
          setFullEditingExpense(null);
        }
      }
      setFullEditingRevenue(null);
    }
    setLoadingEditData(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user, queryClient, allRawTransactions, expenseInstallments]);

  const handleUpdateTransaction = useCallback(async (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">,
    editOption?: "thisMonth" | "thisMonthForward" | "all",
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
  ) => {
    let error = null;
    setLoadingEditData(true);

    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      setLoadingEditData(false);
      return;
    }

    const originalTransaction = allRawTransactions.find(t => t.id === id);
    const isRecurring = originalTransaction?.isRecurring;

    try {
      if (isRecurring && recurringData) {
        const recurringTrans = originalTransaction as MaterializedRecurringTransaction;
        const currentYear = new Date(recurringTrans.date).getFullYear();
        const currentMonth = new Date(recurringTrans.date).getMonth() + 1;

        if (editOption === "thisMonth") {
          const payload: TablesUpdate<'recurring_entry_exceptions'> = {
            override_value: recurringData.value,
            override_category_id: recurringData.categoryId,
            override_due_date: recurringData.overrideDueDate,
            note: recurringData.note,
            canceled: false, // Ensure it's not marked as canceled if we are editing it
            paid: recurringData.isPaid,
          };
          await createOrUpdateException({
            recurring_id: recurringTrans.recurringEntryId,
            year: currentYear,
            month: currentMonth,
            payload,
          });
        } else if (editOption === "thisMonthForward") {
          const payload: TablesUpdate<'recurring_entries'> = {
            title: recurringData.title,
            value: recurringData.value,
            category_id: recurringData.categoryId,
            due_day: recurringData.dueDay,
            frequency: recurringData.frequency,
            end_date: recurringData.endDate,
            status: recurringData.recurringStatus,
          };
          await updateRecurringMasterFuture({
            recurring_id: recurringTrans.recurringEntryId,
            start_date: startOfMonth(new Date(recurringTrans.date)),
            payload,
          });
        } else if (editOption === "all") {
          const payload: TablesUpdate<'recurring_entries'> = {
            title: recurringData.title,
            value: recurringData.value,
            category_id: recurringData.categoryId,
            due_day: recurringData.dueDay,
            frequency: recurringData.frequency,
            start_date: recurringData.startDate,
            end_date: recurringData.endDate,
            status: recurringData.recurringStatus,
          };
          await updateRecurringMasterGlobal({
            recurring_id: recurringTrans.recurringEntryId,
            payload,
            preserve_exceptions: preserveExceptions,
          });
        }
        toast.success("Lançamento recorrente atualizado!", {
          style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
        });
        queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
        queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user?.id] });
        queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] }); // Invalida o cache de transações para o useTransactionsData
        queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] }); // Invalida o cache de transações para o useTransactionsData
      } else {
        // Lógica existente para transações não recorrentes (avulsas ou fixas legadas)
        const currentExpenseInstallments = queryClient.getQueryData<(Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[]>(["expenseInstallments", user.id]) || [];

        if (type === "income") {
          let revenueIdToUse = id;
          if (originalTransaction?.is_fixed) {
            const lastHyphenIndex = id.lastIndexOf('-');
            if (lastHyphenIndex !== -1) {
              revenueIdToUse = id.substring(0, lastHyphenIndex);
            }
          }
          if (!isValidUuid(revenueIdToUse)) {
            toast.error("Erro (UPD-INC-1): ID de receita inválido.");
            setLoadingEditData(false);
            return;
          }
          
          const is_fixed_to_use = updatedTransaction.is_fixed ?? originalTransaction?.is_fixed ?? false;
          const recurrence_frequency_to_use = updatedTransaction.recurrence_frequency ?? originalTransaction?.recurrence_frequency ?? null;
          const recurrence_installments_count_to_use = updatedTransaction.recurrence_installments_count ?? originalTransaction?.recurrence_installments_count ?? null;

          const { error: updateError } = await supabase
            .from("receitas")
            .update({
              valor: updatedTransaction.amount,
              data: updatedTransaction.date,
              tipo_receita_id: updatedTransaction.category,
              descricao: updatedTransaction.description,
              status: updatedTransaction.status,
              is_fixed: is_fixed_to_use,
              recurrence_frequency: recurrence_frequency_to_use,
              recurrence_installments_count: recurrence_installments_count_to_use,
            })
            .eq("id", revenueIdToUse)
            .eq("user_id", user.id);
          error = updateError;
        } else if (type === "expense") {
          if (originalTransaction?.is_fixed) {
            const lastHyphenIndex = id.lastIndexOf('-');
            const parentDespesaId = id.substring(0, lastHyphenIndex);
            if (!isValidUuid(parentDespesaId)) {
              toast.error("Erro (UPD-FX-2): ID de despesa fixa inválido.");
              setLoadingEditData(false);
              return;
            }

            const is_fixed_to_use = updatedTransaction.is_fixed ?? originalTransaction?.is_fixed ?? false;
            const recurrence_frequency_to_use = updatedTransaction.recurrence_frequency ?? originalTransaction?.recurrence_frequency ?? null;
            const recurrence_installments_count_to_use = updatedTransaction.recurrence_installments_count ?? originalTransaction?.recurrence_installments_count ?? null;
            
            const { error: updateDespesaError } = await supabase
              .from("despesas")
              .update({
                valor_total: updatedTransaction.amount,
                categoria_id: updatedTransaction.category,
                descricao: updatedTransaction.description,
                is_fixed: is_fixed_to_use,
                recurrence_frequency: recurrence_frequency_to_use,
                recurrence_installments_count: recurrence_installments_count_to_use,
              })
              .eq("id", parentDespesaId)
              .eq("user_id", user.id);
            error = updateDespesaError;

            const { data: firstInstallment, error: fetchFirstInstallmentError } = await supabase
              .from("despesas_parcelas")
              .select("id")
              .eq("despesa_id", parentDespesaId)
              .eq("numero_parcela", 1)
              .single();

            if (firstInstallment && !fetchFirstInstallmentError) {
              const { error: updateFirstInstallmentDateError } = await supabase
                .from("despesas_parcelas")
                .update({ vencimento: updatedTransaction.date })
                .eq("id", firstInstallment.id);
              if (updateFirstInstallmentDateError) {
                console.error("handleUpdateTransaction: Error updating first installment date for fixed expense:", updateFirstInstallmentDateError);
                toast.error("Erro ao atualizar a data da primeira ocorrência da despesa fixa.");
              }
            }

          } else {
            if (!isValidUuid(id)) {
              toast.error("Erro (UPD-NF-1): ID de parcela de despesa inválido.");
              setLoadingEditData(false);
              return;
            }
            const originalInstallment = currentExpenseInstallments.find(p => p.id === id);
            if (originalInstallment && originalInstallment.despesas?.id) {
              const parentDespesaId = originalInstallment.despesas.id;
              const { error: updateDespesaError } = await supabase
                .from("despesas")
                .update({
                  categoria_id: updatedTransaction.category,
                  descricao: updatedTransaction.description,
                })
                .eq("id", parentDespesaId)
                .eq("user_id", user.id);
              if (updateDespesaError) {
                console.error("handleUpdateTransaction: Error updating parent expense for installment:", updateDespesaError);
                toast.error("Erro ao atualizar a despesa principal.");
              }
            }
            const { error: updateError } = await supabase
              .from("despesas_parcelas")
              .update({
                valor_parcela: updatedTransaction.amount,
                vencimento: updatedTransaction.date,
              })
              .eq("id", id);
            error = updateError;
          }
        }

        if (error) {
          toast.error("Erro ao atualizar lançamento", { description: error.message });
          console.error("handleUpdateTransaction: Update error:", error);
        } else {
          toast.success("Lançamento atualizado!", {
            style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
          });
          queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
          queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
        }
      }
    } catch (err) {
      console.error("handleUpdateTransaction: Unexpected error:", err);
      toast.error("Ocorreu um erro inesperado ao atualizar o lançamento.");
    } finally {
      setEditingTransaction(null);
      setFullEditingRevenue(null);
      setFullEditingExpense(null);
      setLoadingEditData(false);
    }
  }, [user, queryClient, allRawTransactions, createOrUpdateException, updateRecurringMasterFuture, updateRecurringMasterGlobal]);

  return {
    selectedMonth,
    setSelectedMonth,
    editingTransaction,
    setEditingTransaction,
    fullEditingRevenue,
    setFullEditingRevenue,
    fullEditingExpense,
    setFullEditingExpense,
    loadingEditData,
    setLoadingEditData,
    isDeleteRecurrenceModalOpen,
    setIsDeleteRecurrenceModalOpen,
    selectedRecurringTransaction: selectedRecurringTransactionForDelete, // Renomeado para clareza
    setSelectedRecurringTransaction: setSelectedRecurringTransactionForDelete, // Renomeado para clareza
    monthlyFilteredTransactions: allRawTransactions, // Será filtrado em useTransactionsData
    fetchedCategories,
    cartoes,
    expenseInstallments,
    isLoading,
    isLoadingCategories,
    handleDeleteTransaction,
    handleEditTransaction,
    handleUpdateTransaction,
    user,
    queryClient, // Adicionado queryClient ao retorno
    confirmDeleteWithOptions, // Adicionado a nova função de exclusão
  };
};