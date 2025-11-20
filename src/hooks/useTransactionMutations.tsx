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
            let query = supabase
              .from("despesas_parcelas")
              .select("id, numero_parcela, vencimento, valor_parcela, pago, data_pagamento")
              .eq("despesa_id", parentDespesaId);

            if (saveScope === "thisMonthForward") {
              // For "thisMonthForward", start from the current installment's original date
              query = query.gte("vencimento", format(parseISO(originalTransaction.date), 'yyyy-MM-dd'));
            } else if (saveScope === "all") {
              // For "all", no date filter needed, get all installments
              // The query already filters by despesa_id, so it gets all for that parent.
            }
            query = query.order("vencimento", { ascending: true });

            const { data: affectedInstallments, error: fetchAffectedError } = await query;

            if (fetchAffectedError) throw fetchAffectedError;

            if (!affectedInstallments || affectedInstallments.length === 0) {
                toast.info("Nenhuma parcela encontrada para atualização no escopo selecionado.");
                // No installments to update, but parent description/category already updated.
                setLoadingEditData(false);
                setEditingTransaction(null);
                setIsEditModalOpen(false);
                invalidateAllTransactionQueries();
                return;
            }

            // Prepare batch update for installments
            const updates = affectedInstallments.map(inst => {
                const isCurrentInstallment = inst.id === id;
                return {
                    id: inst.id,
                    valor_parcela: newValorParcela, // Apply new value to all affected
                    // Only update date, paid status, and paid date for the *current* installment
                    vencimento: isCurrentInstallment ? newVencimento : inst.vencimento,
                    pago: isCurrentInstallment ? newPagoStatus : inst.pago,
                    data_pagamento: isCurrentInstallment ? newPagoDate : inst.data_pagamento,
                };
            });

            const { error: batchUpdateError } = await supabase
                .from("despesas_parcelas")
                .upsert(updates, { onConflict: 'id' }); // Use upsert with onConflict: 'id' for batch update

            if (batchUpdateError) throw batchUpdateError;

            // Recalculate parent despesa's valor_total and numero_parcelas based on all current installments
            const { data: allInstallments, error: fetchAllInstallmentsError } = await supabase
                .from("despesas_parcelas")
                .select("valor_parcela")
                .eq("despesa_id", parentDespesaId);

            if (fetchAllInstallmentsError) throw fetchAllInstallmentsError;

            const newParentValorTotal = allInstallments.reduce((sum, inst) => sum + inst.valor_parcela, 0);
            const newParentNumeroParcelas = allInstallments.length;

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