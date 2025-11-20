import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Transaction, TransactionType } from "@/types/finance";
import { TablesUpdate } from "@/integrations/supabase/types";
import {
  MaterializedRecurringTransaction,
  useRecurringEntries,
} from "@/hooks/useRecurringEntries";
import { startOfMonth, subMonths } from "date-fns";

// Helper function to validate if a string is a UUID
const isValidUuid = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

type EditOption = "thisMonth" | "thisMonthForward" | "all";

interface UseTransactionMutationsProps {
  user: User | null;
  queryClient: ReturnType<typeof useQueryClient>;
  monthlyFilteredTransactions: Transaction[];
  setLoadingEditData: (loading: boolean) => void;
  setIsDeleteRecurrenceModalOpen: (open: boolean) => void;
  setEditingTransaction: (transaction: Transaction | null) => void;
  setIsEditModalOpen: (open: boolean) => void;
  setSelectedRecurringTransactionForDelete: (transaction: Transaction | null) => void;
  selectedMonth: Date; // Adicionado selectedMonth
}

export const useTransactionMutations = ({
  user,
  queryClient,
  monthlyFilteredTransactions,
  setLoadingEditData,
  setIsDeleteRecurrenceModalOpen,
  setEditingTransaction,
  setIsEditModalOpen,
  setSelectedRecurringTransactionForDelete,
  selectedMonth, // Usar selectedMonth
}: UseTransactionMutationsProps) => {
  const {
    createOrUpdateException,
    updateRecurringMasterFuture,
    updateRecurringMasterGlobal,
    deleteRecurringEntry,
    cancelMonth,
    endRecurringAt,
  } = useRecurringEntries(user, selectedMonth, [], !!user); // Passar selectedMonth e allCategories vazias, pois não são usadas aqui

  const invalidateAllTransactionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] }); // Invalida a query geral de transações
  }, [queryClient, user?.id]);

  const confirmDeleteWithOptions = useCallback(
    async (
      transaction: Transaction,
      deleteOption: "thisMonth" | "thisMonthForward" | "all"
    ) => {
      setLoadingEditData(true);
      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.");
        setLoadingEditData(false);
        return;
      }

      try {
        if (transaction.isRecurring && transaction.recurringEntryId) {
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
          toast.success("Lançamento recorrente excluído/cancelado!", {
            style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
          });
        } else if (
          transaction.type === "expense" &&
          transaction.installmentNumber &&
          transaction.despesa_id
        ) {
          const parentDespesaId = transaction.despesa_id;
          const installmentId = transaction.id;

          if (deleteOption === "thisMonth") {
            const { error } = await supabase.from("despesas_parcelas").delete().eq("id", installmentId);
            if (error) throw error;
            const { data: remainingParcelas, error: checkError } = await supabase
              .from("despesas_parcelas")
              .select("id")
              .eq("despesa_id", parentDespesaId);
            if (checkError) console.error("Error checking remaining installments:", checkError);
            if (remainingParcelas && remainingParcelas.length === 0) {
              await supabase.from("despesas").delete().eq("id", parentDespesaId);
            }
            toast.success("Parcela excluída!", {
              style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
            });
          } else if (deleteOption === "thisMonthForward") {
            const { error } = await supabase
              .from("despesas_parcelas")
              .delete()
              .eq("despesa_id", parentDespesaId)
              .gte("numero_parcela", transaction.installmentNumber);
            if (error) throw error;
            const { data: remainingParcelas, error: checkError } = await supabase
              .from("despesas_parcelas")
              .select("id")
              .eq("despesa_id", parentDespesaId);
            if (checkError) console.error("Error checking remaining installments:", checkError);
            if (remainingParcelas && remainingParcelas.length === 0) {
              await supabase.from("despesas").delete().eq("id", parentDespesaId);
            }
            toast.success("Parcelas futuras excluídas!", {
              style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
            });
          } else if (deleteOption === "all") {
            const { error } = await supabase.from("despesas").delete().eq("id", parentDespesaId);
            if (error) throw error;
            toast.success("Despesa parcelada excluída!", {
              style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
            });
          }
        } else {
          toast.error("Tipo de transação não suportado para exclusão avançada.");
          setLoadingEditData(false);
          return;
        }

        invalidateAllTransactionQueries();
      } catch (error: any) {
        toast.error("Erro ao excluir lançamento", { description: error.message });
        console.error("Deletion error:", error);
      } finally {
        setLoadingEditData(false);
        setIsDeleteRecurrenceModalOpen(false);
        setEditingTransaction(null);
        setIsEditModalOpen(false);
      }
    },
    [user, invalidateAllTransactionQueries, cancelMonth, endRecurringAt, deleteRecurringEntry, setLoadingEditData, setIsDeleteRecurrenceModalOpen, setEditingTransaction, setIsEditModalOpen]
  );

  const handleDeleteTransaction = useCallback(
    async (id: string, type: "income" | "expense", isFixed?: boolean) => {
      setLoadingEditData(true);

      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.");
        setLoadingEditData(false);
        return;
      }

      const transactionToDelete = monthlyFilteredTransactions.find((t) => t.id === id);
      if (!transactionToDelete) {
        toast.error("Lançamento não encontrado.");
        setLoadingEditData(false);
        return;
      }

      if (
        transactionToDelete.isRecurring ||
        (transactionToDelete.type === "expense" &&
          transactionToDelete.installmentNumber &&
          transactionToDelete.totalInstallments &&
          transactionToDelete.totalInstallments > 1)
      ) {
        setSelectedRecurringTransactionForDelete(transactionToDelete);
        setIsDeleteRecurrenceModalOpen(true);
        setLoadingEditData(false);
        return;
      }

      let error = null;

      if (type === "income") {
        let revenueIdToUse = id;
        if (isFixed) {
          const lastHyphenIndex = revenueIdToUse.lastIndexOf("-");
          if (lastHyphenIndex !== -1) {
            revenueIdToUse = revenueIdTo, revenueIdToUse.substring(0, lastHyphenIndex);
          }
        }
        if (!isValidUuid(revenueIdToUse)) {
          toast.error("Erro (DEL-INC-1): ID de receita inválido.");
          setLoadingEditData(false);
          return;
        }
        const { error: deleteError } = await supabase.from("receitas").delete().eq("id", revenueIdToUse).eq("user_id", user.id);
        error = deleteError;
      } else if (type === "expense") {
        if (!isValidUuid(id)) {
          toast.error("Erro (DEL-NF-1): ID de parcela de despesa inválido.");
          setLoadingEditData(false);
          return;
        }
        const { error: deleteParcelaError } = await supabase.from("despesas_parcelas").delete().eq("id", id);
        error = deleteParcelaError;
      }

      if (error) {
        toast.error("Erro ao excluir lançamento", { description: error.message });
        console.error("handleDeleteTransaction: Deletion error:", error);
      } else {
        toast.success("Lançamento excluído!", {
          style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
        });
        setEditingTransaction(null);
        setIsEditModalOpen(false);
        invalidateAllTransactionQueries();
      }
      setLoadingEditData(false);
    },
    [user, monthlyFilteredTransactions, setLoadingEditData, setSelectedRecurringTransactionForDelete, setIsDeleteRecurrenceModalOpen, setEditingTransaction, setIsEditModalOpen, invalidateAllTransactionQueries]
  );

  const handleUpdateTransaction = useCallback(
    async (
      id: string,
      type: TransactionType,
      updatedTransaction: Omit<Transaction, "id">,
      editOption?: EditOption,
      preserveExceptions?: boolean,
      recurringData?: TablesUpdate<"recurring_entries"> | TablesUpdate<"recurring_entry_exceptions">
    ) => {
      setLoadingEditData(true);

      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.");
        setLoadingEditData(false);
        return;
      }

      const originalTransaction = monthlyFilteredTransactions.find((t) => t.id === id);
      const isRecurring = originalTransaction?.isRecurring;

      try {
        if (isRecurring && recurringData) {
          const recurringTrans = originalTransaction as MaterializedRecurringTransaction;
          const currentYear = new Date(recurringTrans.date).getFullYear();
          const currentMonth = new Date(recurringTrans.date).getMonth() + 1;

          if (editOption === "thisMonth") {
            const payload = recurringData as TablesUpdate<"recurring_entry_exceptions">;
            await createOrUpdateException({
              recurring_id: recurringTrans.recurringEntryId,
              year: currentYear,
              month: currentMonth,
              payload,
            });
          } else if (editOption === "thisMonthForward") {
            const payload = recurringData as TablesUpdate<"recurring_entries">;
            await updateRecurringMasterFuture({
              recurring_id: recurringTrans.recurringEntryId,
              start_date: startOfMonth(new Date(recurringTrans.date)),
              payload,
            });
          } else if (editOption === "all") {
            const payload = recurringData as TablesUpdate<"recurring_entries">;
            await updateRecurringMasterGlobal({
              recurring_id: recurringTrans.recurringEntryId,
              payload,
              preserve_exceptions: preserveExceptions,
            });
          }

          toast.success("Lançamento recorrente atualizado!", {
            style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
          });

          invalidateAllTransactionQueries();
        } else {
          if (type === "income") {
            let revenueIdToUse = id;
            if (originalTransaction?.is_fixed) {
              const lastHyphenIndex = id.lastIndexOf("-");
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
            if (updateError) throw updateError;
          } else if (type === "expense") {
            if (originalTransaction?.is_fixed) {
              const lastHyphenIndex = id.lastIndexOf("-");
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
              if (updateDespesaError) throw updateDespesaError;

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

              const { error: updateParcelaError } = await supabase
                .from("despesas_parcelas")
                .update({
                  valor_parcela: updatedTransaction.amount,
                  vencimento: updatedTransaction.date,
                  pago: updatedTransaction.status === "Recebida",
                  data_pagamento: updatedTransaction.status === "Recebida" ? new Date().toISOString() : null,
                })
                .eq("id", id);

              if (updateParcelaError) {
                throw updateParcelaError;
              }

              const parentDespesaId = originalTransaction?.despesa_id;
              if (parentDespesaId && isValidUuid(parentDespesaId)) {
                const { error: updateDespesaParentError } = await supabase
                  .from("despesas")
                  .update({
                    categoria_id: updatedTransaction.category,
                    descricao: updatedTransaction.description,
                  })
                  .eq("id", parentDespesaId)
                  .eq("user_id", user.id);

                if (updateDespesaParentError) {
                  throw updateDespesaParentError;
                }
              } else {
                console.warn("handleUpdateTransaction: Parent despesa_id not found or invalid for installment update:", parentDespesaId);
              }
            }
          }

          toast.success("Lançamento atualizado!", {
            style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
          });
          invalidateAllTransactionQueries();
        }
      } catch (err: any) {
        console.error("handleUpdateTransaction: Erro ao atualizar lançamento:", err);
        toast.error("Erro ao atualizar lançamento.", { description: err.message });
      } finally {
        setEditingTransaction(null);
        setIsEditModalOpen(false);
        setLoadingEditData(false);
      }
    },
    [user, monthlyFilteredTransactions, createOrUpdateException, updateRecurringMasterFuture, updateRecurringMasterGlobal, invalidateAllTransactionQueries, setLoadingEditData, setEditingTransaction, setIsEditModalOpen]
  );

  return {
    confirmDeleteWithOptions,
    handleDeleteTransaction,
    handleUpdateTransaction,
  };
};