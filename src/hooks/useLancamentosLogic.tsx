import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths, subMonths, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { Transaction, TransactionType } from "@/types/finance";
import { Tables, TablesUpdate } from "@/integrations/supabase/types";
import {
  MaterializedRecurringTransaction,
  useRecurringEntries,
} from "@/hooks/useRecurringEntries";

const isValidUuid = (uuid: string) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const useLancamentosLogic = (
  user: User | null,
  authLoading: boolean
) => {
  const queryClient = useQueryClient();
  console.log(
    "useLancamentosLogic: User received as prop:",
    user?.id,
    "AuthLoading:",
    authLoading
  );

  const [searchParams] = useSearchParams();

  const initialMonth = useMemo(() => {
    const monthParam = searchParams.get("month");
    if (monthParam) {
      try {
        const [year, month, day] = monthParam.split("-").map(Number);
        return new Date(year, month - 1, day);
      } catch (e) {
        console.error("Invalid month parameter in URL:", monthParam, e);
        return new Date();
      }
    }
    return new Date();
  }, [searchParams]);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [fullEditingRevenue, setFullEditingRevenue] =
    useState<Tables<"receitas"> | null>(null);
  const [fullEditingExpense, setFullEditingExpense] =
    useState<Tables<"despesas"> | null>(null);
  const [loadingEditData, setLoadingEditData] = useState(false);

  const [isDeleteRecurrenceModalOpen, setIsDeleteRecurrenceModalOpen] =
    useState(false);
  const [
    selectedRecurringTransactionForDelete,
    setSelectedRecurringTransactionForDelete,
  ] = useState<Transaction | null>(null);

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

  const {
    createOrUpdateException,
    updateRecurringMasterFuture,
    updateRecurringMasterGlobal,
    deleteRecurringEntry,
    cancelMonth,
    endRecurringAt,
    markMonthPaid,
    isLoading: isLoadingRecurringEntriesHook,
  } = useRecurringEntries(
    user,
    selectedMonth,
    allSubcategories,
    !!user && !authLoading
  );

  const isLoading =
    authLoading ||
    isLoadingTransactionsData ||
    isLoadingCategories ||
    isLoadingRecurringEntriesHook;

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth((prevMonth) => subMonths(prevMonth, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prevMonth) => addMonths(prevMonth, 1));
  }, []);

  const confirmDeleteWithOptions = useCallback(
    async (
      transaction: Transaction,
      deleteOption: "thisMonth" | "thisMonthForward" | "all"
    ) => {
      setLoadingEditData(true);
      if (!user) {
        toast.error(
          "Usuário não autenticado. Por favor, faça login novamente."
        );
        setLoadingEditData(false);
        return;
      }

      try {
        if (transaction.isRecurring && transaction.recurringEntryId) {
          const recurringTrans =
            transaction as MaterializedRecurringTransaction;
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
            const previousMonthDate = subMonths(
              new Date(recurringTrans.date),
              1
            );
            await endRecurringAt({
              recurring_id: recurringTrans.recurringEntryId,
              end_year: previousMonthDate.getFullYear(),
              end_month: previousMonthDate.getMonth() + 1,
            });
          } else if (deleteOption === "all") {
            await deleteRecurringEntry(recurringTrans.recurringEntryId);
          }
          toast.success("Lançamento recorrente excluído/cancelado!", {
            style: {
              backgroundColor: "hsl(var(--soft-green))",
              color: "hsl(var(--success-darker))",
            },
          });
        } else if (
          transaction.type === "expense" &&
          transaction.installmentNumber &&
          transaction.despesa_id
        ) {
          const parentDespesaId = transaction.despesa_id;
          const installmentId = transaction.id;

          if (deleteOption === "thisMonth") {
            const { error } = await supabase
              .from("despesas_parcelas")
              .delete()
              .eq("id", installmentId);
            if (error) throw error;
            const { data: remainingParcelas, error: checkError } =
              await supabase
                .from("despesas_parcelas")
                .select("id")
                .eq("despesa_id", parentDespesaId);
            if (checkError)
              console.error(
                "Error checking remaining installments:",
                checkError
              );
            if (remainingParcelas && remainingParcelas.length === 0) {
              await supabase
                .from("despesas")
                .delete()
                .eq("id", parentDespesaId);
            }
            toast.success("Parcela excluída!", {
              style: {
                backgroundColor: "hsl(var(--soft-green))",
                color: "hsl(var(--success-darker))",
              },
            });
          } else if (deleteOption === "thisMonthForward") {
            const { error } = await supabase
              .from("despesas_parcelas")
              .delete()
              .eq("despesa_id", parentDespesaId)
              .gte("numero_parcela", transaction.installmentNumber);
            if (error) throw error;
            const { data: remainingParcelas, error: checkError } =
              await supabase
                .from("despesas_parcelas")
                .select("id")
                .eq("despesa_id", parentDespesaId);
            if (checkError)
              console.error(
                "Error checking remaining installments:",
                checkError
              );
            if (remainingParcelas && remainingParcelas.length === 0) {
              await supabase
                .from("despesas")
                .delete()
                .eq("id", parentDespesaId);
            }
            toast.success("Parcelas futuras excluídas!", {
              style: {
                backgroundColor: "hsl(var(--soft-green))",
                color: "hsl(var(--success-darker))",
              },
            });
          } else if (deleteOption === "all") {
            const { error } = await supabase
              .from("despesas")
              .delete()
              .eq("id", parentDespesaId);
            if (error) throw error;
            toast.success("Despesa parcelada excluída!", {
              style: {
                backgroundColor: "hsl(var(--soft-green))",
                color: "hsl(var(--success-darker))",
              },
            });
          }
        } else {
          toast.error(
            "Tipo de transação não suportado para exclusão avançada."
          );
          setLoadingEditData(false);
          return;
        }

        queryClient.invalidateQueries({
          queryKey: ["recurringEntries", user?.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["recurringExceptions", user?.id],
        });
        queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
        queryClient.invalidateQueries({
          queryKey: ["expenseInstallments", user?.id],
        });
        // Opcional: força recarregar tudo também
        // queryClient.invalidateQueries();
      } catch (error: any) {
        toast.error("Erro ao excluir lançamento", {
          description: error.message,
        });
        console.error("Deletion error:", error);
      } finally {
        setLoadingEditData(false);
        setIsDeleteRecurrenceModalOpen(false);
        setEditingTransaction(null);
      }
    },
    [user, queryClient, cancelMonth, endRecurringAt, deleteRecurringEntry]
  );

  const handleDeleteTransaction = useCallback(
    async (id: string, type: "income" | "expense", isFixed?: boolean) => {
      setLoadingEditData(true);

      if (!user) {
        toast.error(
          "Usuário não autenticado. Por favor, faça login novamente."
        );
        setLoadingEditData(false);
        return;
      }

      const transactionToDelete = monthlyFilteredTransactions.find(
        (t) => t.id === id
      );
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
        if (!isValidUuid(id)) {
          toast.error("Erro (DEL-NF-1): ID de parcela de despesa inválido.");
          setLoadingEditData(false);
          return;
        }
        const { error: deleteParcelaError } = await supabase
          .from("despesas_parcelas")
          .delete()
          .eq("id", id);
        error = deleteParcelaError;
      }

      if (error) {
        toast.error("Erro ao excluir lançamento", {
          description: error.message,
        });
        console.error("handleDeleteTransaction: Deletion error:", error);
      } else {
        toast.success("Lançamento excluído!", {
          style: {
            backgroundColor: "hsl(var(--soft-green))",
            color: "hsl(var(--success-darker))",
          },
        });
        setEditingTransaction(null);
        setFullEditingRevenue(null);
        setFullEditingExpense(null);
        queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
        queryClient.invalidateQueries({
          queryKey: ["expenseInstallments", user?.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["recurringEntries", user?.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["recurringExceptions", user?.id],
        });
        // Opcional: também aqui, se quiser reforçar:
        // queryClient.invalidateQueries();
      }
      setLoadingEditData(false);
    },
    [user, queryClient, monthlyFilteredTransactions]
  );

  const handleEditTransaction = useCallback(
    async (transaction: Transaction) => {
      setEditingTransaction(transaction);
      setLoadingEditData(true);

      if (!user) {
        toast.error(
          "Usuário não autenticado. Por favor, faça login novamente."
        );
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
        queryClient.getQueryData<Tables<"receitas">[]>(["revenues", user.id]) ||
        [];

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
        const fullRevenue = currentRevenues.find(
          (r) => r.id === revenueIdToUse
        );
        setFullEditingRevenue(fullRevenue || null);
        setFullEditingExpense(null);
      } else {
        if (transaction.is_fixed) {
          const lastHyphenIndex = transaction.id.lastIndexOf("-");
          if (lastHyphenIndex === -1) {
            toast.error(
              "Erro (EDIT-FX-1): Formato de ID de despesa fixa inesperado."
            );
            setLoadingEditData(false);
            return;
          }
          const parentDespesaId = transaction.id.substring(0, lastHyphenIndex);
          if (!isValidUuid(parentDespesaId)) {
            toast.error("Erro (EDIT-FX-2): ID de despesa fixa inválido.");
            setLoadingEditData(false);
            return;
          }

          const { data: fetchedParentDespesa, error: fetchError } =
            await supabase
              .from("despesas")
              .select("*")
              .eq("id", parentDespesaId)
              .single();

          if (fetchError) {
            console.error(
              "handleEditTransaction: Erro ao buscar despesa pai para edição:",
              fetchError
            );
            toast.error(
              "Erro ao carregar detalhes da despesa fixa para edição."
            );
            setFullEditingExpense(null);
          } else if (fetchedParentDespesa) {
            setFullEditingExpense(fetchedParentDespesa);
          } else {
            toast.error(
              "Erro ao carregar detalhes da despesa fixa para edição (dados não encontrados)."
            );
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
    [user, queryClient, monthlyFilteredTransactions]
  );

  const handleUpdateTransaction = useCallback(
    async (
      id: string,
      type: TransactionType,
      updatedTransaction: Omit<Transaction, "id">,
      editOption?: "thisMonth" | "thisMonthForward" | "all",
      preserveExceptions?: boolean,
      recurringData?:
        | TablesUpdate<"recurring_entries">
        | TablesUpdate<"recurring_entry_exceptions">
    ) => {
      let error = null;
      setLoadingEditData(true);

      if (!user) {
        toast.error(
          "Usuário não autenticado. Por favor, faça login novamente."
        );
        setLoadingEditData(false);
        return;
      }

      const originalTransaction = monthlyFilteredTransactions.find(
        (t) => t.id === id
      );
      const isRecurring = originalTransaction?.isRecurring;

      try {
        if (isRecurring && recurringData) {
          const recurringTrans =
            originalTransaction as MaterializedRecurringTransaction;
          const currentYear = new Date(recurringTrans.date).getFullYear();
          const currentMonth = new Date(recurringTrans.date).getMonth() + 1;

          if (editOption === "thisMonth") {
            const payload =
              recurringData as TablesUpdate<"recurring_entry_exceptions">;
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
            style: {
              backgroundColor: "hsl(var(--soft-green))",
              color: "hsl(var(--success-darker))",
            },
          });

          // Invalida queries específicas
          queryClient.invalidateQueries({
            queryKey: ["recurringEntries", user?.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["recurringExceptions", user?.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["revenues", user?.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["expenseInstallments", user?.id],
          });

          // 🔥 Força recomputar qualquer lista derivada (incluindo useTransactionsData)
          queryClient.invalidateQueries();
        } else {
          // --- ONE-OFF / LEGACY FIXED TRANSACTIONS ---
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

            const is_fixed_to_use =
              updatedTransaction.is_fixed ??
              originalTransaction?.is_fixed ??
              false;
            const recurrence_frequency_to_use =
              updatedTransaction.recurrence_frequency ??
              originalTransaction?.recurrence_frequency ??
              null;
            const recurrence_installments_count_to_use =
              updatedTransaction.recurrence_installments_count ??
              originalTransaction?.recurrence_installments_count ??
              null;

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
                recurrence_installments_count:
                  recurrence_installments_count_to_use,
              })
              .eq("id", revenueIdToUse)
              .eq("user_id", user.id);
            error = updateError;
          } else if (type === "expense") {
            if (originalTransaction?.is_fixed) {
              const lastHyphenIndex = id.lastIndexOf("-");
              const parentDespesaId = id.substring(0, lastHyphenIndex);
              if (!isValidUuid(parentDespesaId)) {
                toast.error("Erro (UPD-FX-2): ID de despesa fixa inválido.");
                setLoadingEditData(false);
                return;
              }

              const is_fixed_to_use =
                updatedTransaction.is_fixed ??
                originalTransaction?.is_fixed ??
                false;
              const recurrence_frequency_to_use =
                updatedTransaction.recurrence_frequency ??
                originalTransaction?.recurrence_frequency ??
                null;
              const recurrence_installments_count_to_use =
                updatedTransaction.recurrence_installments_count ??
                originalTransaction?.recurrence_installments_count ??
                null;

              const { error: updateDespesaError } = await supabase
                .from("despesas")
                .update({
                  valor_total: updatedTransaction.amount,
                  categoria_id: updatedTransaction.category,
                  descricao: updatedTransaction.description,
                  is_fixed: is_fixed_to_use,
                  recurrence_frequency: recurrence_frequency_to_use,
                  recurrence_installments_count:
                    recurrence_installments_count_to_use,
                })
                .eq("id", parentDespesaId)
                .eq("user_id", user.id);
              error = updateDespesaError;

              const {
                data: firstInstallment,
                error: fetchFirstInstallmentError,
              } = await supabase
                .from("despesas_parcelas")
                .select("id")
                .eq("despesa_id", parentDespesaId)
                .eq("numero_parcela", 1)
                .single();

              if (firstInstallment && !fetchFirstInstallmentError) {
                const { error: updateFirstInstallmentDateError } =
                  await supabase
                    .from("despesas_parcelas")
                    .update({ vencimento: updatedTransaction.date })
                    .eq("id", firstInstallment.id);
                if (updateFirstInstallmentDateError) {
                  console.error(
                    "handleUpdateTransaction: Error updating first installment date for fixed expense:",
                    updateFirstInstallmentDateError
                  );
                  toast.error(
                    "Erro ao atualizar a data da primeira ocorrência da despesa fixa."
                  );
                }
              }
            } else {
              // One-off or installment expense (NOT legacy fixed)
              if (!isValidUuid(id)) {
                toast.error(
                  "Erro (UPD-NF-1): ID de parcela de despesa inválido."
                );
                setLoadingEditData(false);
                return;
              }

              // 1. Update the installment (despesas_parcelas)
              const { error: updateParcelaError } = await supabase
                .from("despesas_parcelas")
                .update({
                  valor_parcela: updatedTransaction.amount,
                  vencimento: updatedTransaction.date,
                  pago: updatedTransaction.status === "Recebida",
                  data_pagamento: updatedTransaction.status === "Recebida" ? new Date().toISOString() : null,
                })
                .eq("id", id); // 'id' here is the installment ID
              
              if (updateParcelaError) {
                error = updateParcelaError;
                throw error; // Propagate error to catch block
              }

              // 2. Update the parent expense (despesas) for category and description
              // We need the parent despesa_id, which is available in originalTransaction
              const parentDespesaId = originalTransaction?.despesa_id;
              if (parentDespesaId && isValidUuid(parentDespesaId)) {
                const { error: updateDespesaParentError } = await supabase
                  .from("despesas")
                  .update({
                    categoria_id: updatedTransaction.category,
                    descricao: updatedTransaction.description,
                  })
                  .eq("id", parentDespesaId)
                  .eq("user_id", user.id); // Ensure user owns the parent expense
                
                if (updateDespesaParentError) {
                  error = updateDespesaParentError;
                  throw error; // Propagate error
                }
              } else {
                console.warn("handleUpdateTransaction: Parent despesa_id not found or invalid for installment update:", parentDespesaId);
                // This might be an edge case for very old data or malformed data.
                // For now, we'll let it proceed without updating parent if ID is missing/invalid.
              }
            }
          }

          if (error) {
            toast.error("Erro ao atualizar lançamento", {
              description: error.message,
            });
            console.error("handleUpdateTransaction: Update error:", error);
          } else {
            toast.success("Lançamento atualizado!", {
              style: {
                backgroundColor: "hsl(var(--soft-green))",
                color: "hsl(var(--success-darker))",
              },
            });
            queryClient.invalidateQueries({
              queryKey: ["revenues", user?.id],
            });
            queryClient.invalidateQueries({
              queryKey: ["expenseInstallments", user?.id],
            });

            // 🔥 Garante que qualquer lista derivada também seja recalculada
            queryClient.invalidateQueries();
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
    },
    [
      user,
      queryClient,
      monthlyFilteredTransactions,
      createOrUpdateException,
      updateRecurringMasterFuture,
      updateRecurringMasterGlobal,
    ]
  );

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
    user,
    queryClient,
    confirmDeleteWithOptions,
    markMonthPaid,
  };
};