import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Transaction, TransactionType } from "@/types/finance";
import { TablesUpdate } from "@/integrations/supabase/types";
import { isValidUuid } from "@/lib/utils";

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
    async (id: string, type: "income" | "expense") => {
      setLoadingEditData(true);
      console.log(`[DEBUG] handleDeleteTransaction called for ID: ${id}, Type: ${type}`);

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

      if (type === "income") {
        if (!isValidUuid(id)) {
          toast.error("Erro (DEL-INC-1): ID de receita inválido.");
          setLoadingEditData(false);
          return;
        }
        console.log(`[DEBUG] Deleting income from 'receitas' table with ID: ${id}`);
        const { error: deleteError } = await supabase.from("receitas").delete().eq("id", id).eq("user_id", user.id);
        error = deleteError;
      } else if (type === "expense") {
        // First, delete the installment from 'despesas_parcelas'
        if (!isValidUuid(id)) {
          toast.error("Erro (DEL-EXP-1): ID de parcela de despesa inválido.");
          setLoadingEditData(false);
          return;
        }
        console.log(`[DEBUG] Deleting expense installment from 'despesas_parcelas' table with ID: ${id}`);
        const { error: deleteParcelaError } = await supabase.from("despesas_parcelas").delete().eq("id", id);
        if (deleteParcelaError) throw deleteParcelaError;

        // Then, check if the parent 'despesas' record should be deleted
        const parentDespesaId = transactionToDelete.despesa_id;
        if (parentDespesaId && isValidUuid(parentDespesaId)) {
          console.log(`[DEBUG] Checking if parent 'despesas' record ${parentDespesaId} should be deleted.`);
          const { data: remainingParcelas, error: checkError } = await supabase
            .from("despesas_parcelas")
            .select("id")
            .eq("despesa_id", parentDespesaId);

          if (checkError) console.error("Error checking remaining installments after single installment deletion:", checkError);

          if (remainingParcelas && remainingParcelas.length === 0) {
            // No more installments for this parent despesa, delete the parent
            console.log(`[DEBUG] No remaining installments for ${parentDespesaId}. Deleting parent 'despesas' record.`);
            const { error: deleteParentError } = await supabase.from("despesas").delete().eq("id", parentDespesaId);
            if (deleteParentError) throw deleteParentError;
          } else {
            console.log(`[DEBUG] Remaining installments found for ${parentDespesaId}. Not deleting parent 'despesas' record.`);
          }
        } else {
          console.warn(`[DEBUG] Parent despesa_id not found or invalid for installment deletion: ${parentDespesaId}. Skipping parent deletion check.`);
        }
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
    [user, monthlyFilteredTransactions, setLoadingEditData, setEditingTransaction, setIsEditModalOpen, invalidateAllTransactionQueries]
  );

  const handleUpdateTransaction = useCallback(
    async (
      id: string,
      type: TransactionType,
      updatedTransaction: Omit<Transaction, "id">
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