import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Transaction, TransactionType } from "@/types/finance";
import { TablesUpdate } from "@/integrations/supabase/types";
import { isValidUuid } from "@/lib/utils";
import { format, parseISO } from "date-fns";

type DeleteScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff";
type SaveScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff"; // NOVO TIPO

interface UseTransactionMutationsProps {
  user: User | null;
  queryClient: ReturnType<typeof useQueryClient>;
  monthlyFilteredTransactions: Transaction[];
  setLoadingEditData: (loading: boolean) => void;
  setEditingTransaction: (transaction: Transaction | null) => void;
  setIsEditModalOpen: (open: boolean) => void;
  selectedMonth: Date;
}

export const useTransactionMutations = ({
  user,
  queryClient,
  monthlyFilteredTransactions,
  setLoadingEditData,
  setEditingTransaction,
  setIsEditModalOpen,
  selectedMonth,
}: UseTransactionMutationsProps) => {
  const invalidateAllTransactionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["despesas", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["cartoes", user?.id] });
  }, [queryClient, user?.id]);

  const handleDeleteTransaction = useCallback(
    async (id: string, type: "income" | "expense", deleteScope: DeleteScope) => {
      setLoadingEditData(true);
      console.log(`[DEBUG] handleDeleteTransaction called for ID: ${id}, Type: ${type}, Scope: ${deleteScope}`);

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

      let error = null;

      try {
        if (type === "income") {
          if (!isValidUuid(id)) {
            throw new Error("Erro (DEL-INC-1): ID de receita inválido.");
          }
          console.log(`[DEBUG] Deleting income from 'receitas' table with ID: ${id}`);
          const { error: deleteError } = await supabase.from("receitas").delete().eq("id", id).eq("user_id", user.id);
          error = deleteError;
        } else if (type === "expense") {
          const parentDespesaId = transactionToDelete.despesa_id;

          if (!isValidUuid(id)) {
            throw new Error("Erro (DEL-EXP-1): ID de parcela de despesa inválido.");
          }

          if (deleteScope === "oneOff" || deleteScope === "thisMonth") {
            // Delete only the specific installment
            console.log(`[DEBUG] Deleting single expense installment from 'despesas_parcelas' table with ID: ${id}`);
            const { error: deleteParcelaError } = await supabase.from("despesas_parcelas").delete().eq("id", id);
            if (deleteParcelaError) throw deleteParcelaError;

            // Check if parent 'despesas' record should be deleted if no more installments
            if (parentDespesaId && isValidUuid(parentDespesaId)) {
              const { data: remainingParcelas, error: checkError } = await supabase
                .from("despesas_parcelas")
                .select("id")
                .eq("despesa_id", parentDespesaId);

              if (checkError) console.error("Error checking remaining installments after single installment deletion:", checkError);

              if (remainingParcelas && remainingParcelas.length === 0) {
                console.log(`[DEBUG] No remaining installments for ${parentDespesaId}. Deleting parent 'despesas' record.`);
                const { error: deleteParentError } = await supabase.from("despesas").delete().eq("id", parentDespesaId);
                if (deleteParentError) throw deleteParentError;
              }
            }
          } else if (deleteScope === "thisMonthForward") {
            // Delete current and all future installments
            if (!parentDespesaId || !isValidUuid(parentDespesaId)) {
              throw new Error("Erro (DEL-EXP-2): ID da despesa principal inválido para exclusão 'deste mês em diante'.");
            }
            const currentInstallmentDate = parseISO(transactionToDelete.date);
            console.log(`[DEBUG] Deleting expense installments from 'despesas_parcelas' for parent ${parentDespesaId} from ${format(currentInstallmentDate, 'yyyy-MM-dd')} onwards.`);
            
            const { error: deleteFutureParcelasError } = await supabase
              .from("despesas_parcelas")
              .delete()
              .eq("despesa_id", parentDespesaId)
              .gte("vencimento", format(currentInstallmentDate, 'yyyy-MM-dd')); // Delete from current month's date onwards

            if (deleteFutureParcelasError) throw deleteFutureParcelasError;

            // Check if parent 'despesas' record should be deleted if no more installments
            const { data: remainingParcelas, error: checkError } = await supabase
              .from("despesas_parcelas")
              .select("id")
              .eq("despesa_id", parentDespesaId);

            if (checkError) console.error("Error checking remaining installments after 'thisMonthForward' deletion:", checkError);

            if (remainingParcelas && remainingParcelas.length === 0) {
              console.log(`[DEBUG] No remaining installments for ${parentDespesaId}. Deleting parent 'despesas' record.`);
              const { error: deleteParentError } = await supabase.from("despesas").delete().eq("id", parentDespesaId);
              if (deleteParentError) throw deleteParentError;
            } else {
              // Update numero_parcelas in parent despesas if some installments remain
              const { error: updateParentError } = await supabase
                .from("despesas")
                .update({ numero_parcelas: remainingParcelas?.length || 0 })
                .eq("id", parentDespesaId);
              if (updateParentError) console.error("Error updating parent despesas numero_parcelas:", updateParentError);
            }

          } else if (deleteScope === "all") {
            // Delete all installments and the parent expense
            if (!parentDespesaId || !isValidUuid(parentDespesaId)) {
              throw new Error("Erro (DEL-EXP-3): ID da despesa principal inválido para exclusão 'todo o período'.");
            }
            console.log(`[DEBUG] Deleting all expense installments for parent ${parentDespesaId}.`);
            const { error: deleteAllParcelasError } = await supabase.from("despesas_parcelas").delete().eq("despesa_id", parentDespesaId);
            if (deleteAllParcelasError) throw deleteAllParcelasError;

            console.log(`[DEBUG] Deleting parent 'despesas' record with ID: ${parentDespesaId}`);
            const { error: deleteParentError } = await supabase.from("despesas").delete().eq("id", parentDespesaId);
            if (deleteParentError) throw deleteParentError;
          }
        }

        toast.success("Lançamento excluído!", {
          style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
        });
        setEditingTransaction(null);
        setIsEditModalOpen(false);
        invalidateAllTransactionQueries();
      } catch (err: any) {
        toast.error("Erro ao excluir lançamento", { description: err.message });
        console.error("handleDeleteTransaction: Deletion error:", err);
      } finally {
        setLoadingEditData(false);
      }
    },
    [user, monthlyFilteredTransactions, setLoadingEditData, setEditingTransaction, setIsEditModalOpen, invalidateAllTransactionQueries]
  );

  const handleUpdateTransaction = useCallback(
    async (
      id: string,
      type: TransactionType,
      updatedTransaction: Omit<Transaction, "id">,
      saveScope: SaveScope // NOVO PARÂMETRO
    ) => {
      setLoadingEditData(true);

      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.");
        setLoadingEditData(false);
        return;
      }

      const originalTransaction = monthlyFilteredTransactions.find((t) => t.id === id);

      try {
        if (type === "income") {
          if (!isValidUuid(id)) {
            toast.error("Erro (UPD-INC-1): ID de receita inválido.");
            setLoadingEditData(false);
            return;
          }

          const { error: updateError } = await supabase
            .from("receitas")
            .update({
              valor: updatedTransaction.amount,
              data: updatedTransaction.date,
              tipo_receita_id: updatedTransaction.category,
              descricao: updatedTransaction.description,
              status: updatedTransaction.status,
            })
            .eq("id", id)
            .eq("user_id", user.id);
          if (updateError) throw updateError;
        } else if (type === "expense") {
          if (!isValidUuid(id)) {
            toast.error("Erro (UPD-NF-1): ID de parcela de despesa inválido.");
            setLoadingEditData(false);
            return;
          }

          const parentDespesaId = originalTransaction?.despesa_id;

          if (!parentDespesaId || !isValidUuid(parentDespesaId)) {
            toast.error("Erro (UPD-EXP-PARENT-1): ID da despesa principal inválido.");
            setLoadingEditData(false);
            return;
          }

          const newValorParcela = updatedTransaction.amount;
          const newVencimento = updatedTransaction.date;
          const newPagoStatus = updatedTransaction.status === "Recebida";
          const newPagoDate = newPagoStatus ? new Date().toISOString() : null;

          // Always update parent despesas description and category
          const { error: updateDespesaParentError } = await supabase
            .from("despesas")
            .update({
              categoria_id: updatedTransaction.category,
              descricao: updatedTransaction.description,
            })
            .eq("id", parentDespesaId)
            .eq("user_id", user.id);

          if (updateDespesaParentError) throw updateDespesaParentError;


          if (saveScope === "thisMonth" || saveScope === "oneOff") { // oneOff is essentially thisMonth for single installment
            // Update only the specific installment
            const { error: updateParcelaError } = await supabase
              .from("despesas_parcelas")
              .update({
                valor_parcela: newValorParcela,
                vencimento: newVencimento,
                pago: newPagoStatus,
                data_pagamento: newPagoDate,
              })
              .eq("id", id);

            if (updateParcelaError) throw updateParcelaError;

          } else if (saveScope === "thisMonthForward" || saveScope === "all") {
            // 1. Update the current installment individually with all its specific fields
            console.log(`[DEBUG] Updating current installment (ID: ${id}) with new values.`);
            const { error: updateCurrentInstallmentError } = await supabase
              .from("despesas_parcelas")
              .update({
                valor_parcela: newValorParcela,
                vencimento: newVencimento,
                pago: newPagoStatus,
                data_pagamento: newPagoDate,
              })
              .eq("id", id);
            if (updateCurrentInstallmentError) throw updateCurrentInstallmentError;

            // 2. Fetch all affected installments (excluding the current one, which is already updated)
            let query = supabase
              .from("despesas_parcelas")
              .select("id") // Only need id for batch update
              .eq("despesa_id", parentDespesaId)
              .neq("id", id); // Exclude the current installment

            if (saveScope === "thisMonthForward") {
              // For "thisMonthForward", filter from the current installment's original date onwards
              query = query.gte("vencimento", format(parseISO(originalTransaction.date), 'yyyy-MM-dd'));
            }
            // For "all", no additional date filter needed, as it already gets all for the parent_id excluding the current one.

            const { data: remainingAffectedInstallments, error: fetchRemainingError } = await query;

            if (fetchRemainingError) throw fetchRemainingError;

            // 3. Perform batch update for remaining affected installments, only updating valor_parcela
            if (remainingAffectedInstallments && remainingAffectedInstallments.length > 0) {
              const installmentIdsToUpdate = remainingAffectedInstallments.map(inst => inst.id);
              console.log(`[DEBUG] Batch updating ${installmentIdsToUpdate.length} remaining installments with new valor_parcela.`);

              const { error: batchUpdateRemainingError } = await supabase
                .from("despesas_parcelas")
                .update({ valor_parcela: newValorParcela }) // Only update valor_parcela
                .in("id", installmentIdsToUpdate); // Update all at once

              if (batchUpdateRemainingError) throw batchUpdateRemainingError;
            }

            // 4. Recalculate parent despesa's valor_total and numero_parcelas based on all current installments
            const { data: allInstallments, error: fetchAllInstallmentsError } = await supabase
                .from("despesas_parcelas")
                .select("valor_parcela")
                .eq("despesa_id", parentDespesaId);

            if (fetchAllInstallmentsError) throw fetchAllInstallmentsError;

            const newParentValorTotal = allInstallments.reduce((sum, inst) => sum + inst.valor_parcela, 0);
            const newParentNumeroParcelas = allInstallments.length;

            console.log(`[DEBUG] Recalculating parent despesa (ID: ${parentDespesaId}): newValorTotal=${newParentValorTotal}, newNumeroParcelas=${newParentNumeroParcelas}`);
            const { error: updateParentDespesaTotalError } = await supabase
                .from("despesas")
                .update({
                    valor_total: newParentValorTotal,
                    numero_parcelas: newParentNumeroParcelas,
                })
                .eq("id", parentDespesaId)
                .eq("user_id", user.id);

            if (updateParentDespesaTotalError) throw updateParentDespesaTotalError;

            toast.success("Lançamento e parcelas futuras atualizadas!", {
                style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
            });

          } else {
            // This case should not be reached if saveScope is properly handled
            console.warn("handleUpdateTransaction: Unknown saveScope:", saveScope);
            toast.error("Escopo de atualização desconhecido.");
          }
        }

        toast.success("Lançamento atualizado!", {
          style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
        });
        invalidateAllTransactionQueries();
      } catch (err: any) {
        console.error("handleUpdateTransaction: Erro ao atualizar lançamento:", err);
        toast.error("Erro ao atualizar lançamento.", { description: err.message });
      } finally {
        setEditingTransaction(null);
        setIsEditModalOpen(false);
        setLoadingEditData(false);
      }
    },
    [user, monthlyFilteredTransactions, invalidateAllTransactionQueries, setLoadingEditData, setEditingTransaction, setIsEditModalOpen]
  );

  return {
    handleDeleteTransaction,
    handleUpdateTransaction,
  };
};