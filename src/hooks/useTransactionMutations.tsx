import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Transaction, TransactionType } from "@/types/finance";
import { TablesUpdate } from "@/integrations/supabase/types";
import { isValidUuid } from "@/lib/utils";
import { format, parseISO, getDate, addMonths, endOfMonth } from "date-fns";

type DeleteScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff";
type SaveScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff";

interface UseTransactionMutationsProps {
  user: User | null;
  queryClient: ReturnType<typeof useQueryClient>;
  monthlyFilteredTransactions: Transaction[];
  setLoadingEditData: (loading: boolean) => void;
  setEditingTransaction: (transaction: Transaction | null) => void;
  setIsEditModalOpen: (open: boolean) => void;
  selectedMonth: Date;
}

const RECURRING_INSTALLMENTS_COUNT = 120; // Definir aqui também para consistência

export const useTransactionMutations = ({
  user,
  queryClient,
  monthlyFilteredTransactions,
  setLoadingEditData,
  setEditingTransaction,
  setIsEditModalOpen,
  selectedMonth,
}: UseTransactionMutationsProps) => {
  // REMOVIDO: invalidateAllTransactionQueries

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

          if (transactionToDelete.is_recurring_master || transactionToDelete.recurrence_id) {
            const masterRecurrenceId = transactionToDelete.is_recurring_master ? transactionToDelete.id : transactionToDelete.recurrence_id;
            if (!masterRecurrenceId) throw new Error("Erro (DEL-INC-REC-1): ID de recorrência mestre não encontrado.");

            const currentOccurrenceDate = parseISO(transactionToDelete.date);
            const formattedCurrentOccurrenceDate = format(currentOccurrenceDate, 'yyyy-MM-dd');

            if (deleteScope === "oneOff" || deleteScope === "thisMonth") {
              console.log(`[DEBUG] Deleting single income occurrence from 'receitas' table with ID: ${id}`);
              const { error: deleteOccurrenceError } = await supabase.from("receitas").delete().eq("id", id).eq("user_id", user.id);
              if (deleteOccurrenceError) throw deleteOccurrenceError;

              // Se a ocorrência deletada era a mestra, precisamos desvincular as outras
              if (transactionToDelete.is_recurring_master) {
                const { error: updateOccurrencesError } = await supabase
                  .from("receitas")
                  .update({ recurrence_id: null, is_recurring_master: false, recurrence_day: null, updated_at: new Date().toISOString() }) // Força updated_at
                  .eq("recurrence_id", masterRecurrenceId);
                if (updateOccurrencesError) console.error("Error updating occurrences after master deletion:", updateOccurrencesError);
              }

            } else if (deleteScope === "thisMonthForward") {
              console.log(`[DEBUG] Deleting income occurrences from 'receitas' for master ${masterRecurrenceId} from ${formattedCurrentOccurrenceDate} onwards.`);
              const { error: deleteFutureOccurrencesError } = await supabase
                .from("receitas")
                .delete()
                .eq("recurrence_id", masterRecurrenceId)
                .gte("data", formattedCurrentOccurrenceDate)
                .eq("user_id", user.id);
              if (deleteFutureOccurrencesError) throw deleteFutureOccurrencesError;

              // Se a transação original era a mestra e estamos deletando a partir dela,
              // a mestra também deve ser desvinculada ou atualizada.
              if (transactionToDelete.is_recurring_master) {
                 const { error: updateMasterError } = await supabase
                  .from("receitas")
                  .update({ is_recurring_master: false, recurrence_id: null, recurrence_day: null, updated_at: new Date().toISOString() }) // Força updated_at
                  .eq("id", masterRecurrenceId);
                if (updateMasterError) console.error("Error updating master after 'thisMonthForward' deletion:", updateMasterError);
              }

            } else if (deleteScope === "all") {
              console.log(`[DEBUG] Deleting all income occurrences for master ${masterRecurrenceId}.`);
              const { error: deleteAllOccurrencesError } = await supabase.from("receitas").delete().eq("recurrence_id", masterRecurrenceId).eq("user_id", user.id);
              if (deleteAllOccurrencesError) throw deleteAllOccurrencesError;

              // Se a transação original era a mestra, deletar a própria mestra
              if (transactionToDelete.is_recurring_master) {
                const { error: deleteMasterError } = await supabase.from("receitas").delete().eq("id", masterRecurrenceId).eq("user_id", user.id);
                if (deleteMasterError) throw deleteMasterError;
              }
            }
          } else {
            console.log(`[DEBUG] Deleting one-off income from 'receitas' table with ID: ${id}`);
            const { error: deleteError } = await supabase.from("receitas").delete().eq("id", id).eq("user_id", user.id);
            error = deleteError;
          }
        } else if (type === "expense") {
          const parentDespesaId = transactionToDelete.despesa_id;

          if (!isValidUuid(id)) {
            throw new Error("Erro (DEL-EXP-1): ID de parcela de despesa inválido.");
          }

          if (deleteScope === "oneOff" || deleteScope === "thisMonth") {
            console.log(`[DEBUG] Deleting single expense installment from 'despesas_parcelas' table with ID: ${id}`);
            const { error: deleteParcelaError } = await supabase.from("despesas_parcelas").delete().eq("id", id);
            if (deleteParcelaError) throw deleteParcelaError;

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
              } else {
                const { error: updateParentError } = await supabase
                  .from("despesas")
                  .update({ numero_parcelas: remainingParcelas?.length || 0, updated_at: new Date().toISOString() }) // Força updated_at
                  .eq("id", parentDespesaId);
                if (updateParentError) console.error("Error updating parent despesas numero_parcelas:", updateParentError);
              }
            }
          } else if (deleteScope === "thisMonthForward") {
            if (!parentDespesaId || !isValidUuid(parentDespesaId)) {
              throw new Error("Erro (DEL-EXP-2): ID da despesa principal inválido para exclusão 'deste mês em diante'.");
            }
            const currentInstallmentDate = parseISO(transactionToDelete.date);
            console.log(`[DEBUG] Deleting expense installments from 'despesas_parcelas' for parent ${parentDespesaId} from ${format(currentInstallmentDate, 'yyyy-MM-dd')} onwards.`);
            
            const { error: deleteFutureParcelasError } = await supabase
              .from("despesas_parcelas")
              .delete()
              .eq("despesa_id", parentDespesaId)
              .gte("vencimento", format(currentInstallmentDate, 'yyyy-MM-dd'));

            if (deleteFutureParcelasError) throw deleteFutureParcelasError;

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
              const { error: updateParentError } = await supabase
                .from("despesas")
                .update({ numero_parcelas: remainingParcelas?.length || 0, updated_at: new Date().toISOString() }) // Força updated_at
                .eq("id", parentDespesaId);
              if (updateParentError) console.error("Error updating parent despesas numero_parcelas:", updateParentError);
            }

          } else if (deleteScope === "all") {
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
        // 🔥 Invalida E RE-BUSCA os dados realmente alterados
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] }),
          queryClient.refetchQueries({ queryKey: ["expenseInstallments", user?.id] }),
          queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] }),
          queryClient.refetchQueries({ queryKey: ["revenues", user?.id] }),
        ]);
      } catch (err: any) {
        toast.error("Erro ao excluir lançamento", { description: err.message });
        console.error("handleDeleteTransaction: Deletion error:", err);
      } finally {
        setLoadingEditData(false);
      }
    },
    [user, monthlyFilteredTransactions, setLoadingEditData, setEditingTransaction, setIsEditModalOpen, queryClient]
  );

  const handleUpdateTransaction = useCallback(
    async (
      id: string,
      type: TransactionType,
      updatedTransaction: Omit<Transaction, "id">,
      saveScope: SaveScope
    ) => {
      setLoadingEditData(true);
      console.log(`[DEBUG] handleUpdateTransaction called for ID: ${id}, Type: ${type}, Scope: ${saveScope}`);

      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.");
        setLoadingEditData(false);
        return;
      }

      const originalTransaction = monthlyFilteredTransactions.find((t) => t.id === id);
      if (!originalTransaction) {
        toast.error("Lançamento original não encontrado para atualização.");
        setLoadingEditData(false);
        return;
      }
      console.log("[DEBUG] Original Transaction:", originalTransaction);


      try {
        if (type === "income") {
          if (!isValidUuid(id)) {
            toast.error("Erro (UPD-INC-1): ID de receita inválido.");
            setLoadingEditData(false);
            return;
          }
          console.log("[DEBUG] Updating income transaction.");

          if (originalTransaction?.is_recurring_master || originalTransaction?.recurrence_id) {
            const masterRecurrenceId = originalTransaction.is_recurring_master ? originalTransaction.id : originalTransaction.recurrence_id;
            if (!masterRecurrenceId) throw new Error("Erro (UPD-INC-REC-1): ID de recorrência mestre não encontrado.");
            console.log("[DEBUG] Recurring income detected. Master ID:", masterRecurrenceId);

            const newRecurrenceDay = getDate(parseISO(updatedTransaction.date));

            if (saveScope === "thisMonth" || saveScope === "oneOff") {
              console.log(`[DEBUG] Updating single income occurrence (ID: ${id}) for scope: ${saveScope}`);
              const { error: updateOccurrenceError } = await supabase
                .from("receitas")
                .update({
                  valor: updatedTransaction.amount,
                  data: updatedTransaction.date,
                  tipo_receita_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                  descricao: updatedTransaction.description,
                  status: updatedTransaction.status,
                  updated_at: new Date().toISOString(), // Força updated_at
                })
                .eq("id", id)
                .eq("user_id", user.id);
              if (updateOccurrenceError) throw updateOccurrenceError;
              console.log("[DEBUG] Single income occurrence updated.");

            } else if (saveScope === "thisMonthForward" || saveScope === "all") {
              console.log(`[DEBUG] Updating recurring income for scope: ${saveScope}`);
              // 1. Atualizar o registro mestre
              if (originalTransaction.is_recurring_master || saveScope === "all") {
                console.log(`[DEBUG] Updating master income record (ID: ${masterRecurrenceId}).`);
                const { error: updateMasterError } = await supabase
                  .from("receitas")
                  .update({
                    valor: updatedTransaction.amount,
                    tipo_receita_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                    descricao: updatedTransaction.description,
                    recurrence_day: newRecurrenceDay,
                    updated_at: new Date().toISOString(), // Força updated_at
                  })
                  .eq("id", masterRecurrenceId)
                  .eq("user_id", user.id);
                if (updateMasterError) throw updateMasterError;
                console.log("[DEBUG] Master income record updated.");
              }

              // 2. Deletar todas as ocorrências a partir da data de atualização (inclusive)
              const deleteFromDate = format(parseISO(updatedTransaction.date), 'yyyy-MM-dd');
              
              console.log(`[DEBUG] Deleting income occurrences for master ${masterRecurrenceId} from ${deleteFromDate} onwards.`);
              
              const { error: deleteFutureError } = await supabase
                .from("receitas")
                .delete()
                .eq("recurrence_id", masterRecurrenceId)
                .gte("data", deleteFromDate)
                .eq("user_id", user.id);

              if (deleteFutureError) throw deleteFutureError;
              console.log("[DEBUG] Future income occurrences deleted.");

              // 3. Chamar RPC para regenerar TODAS as ocorrências a partir da data de atualização
              console.log("[DEBUG] Calling RPC to regenerate income occurrences.");
              const { error: rpcError } = await supabase.rpc('generate_recurring_entries', {
                p_user_id: user.id,
                p_transaction_type: 'income',
                p_master_id: masterRecurrenceId,
                p_first_occurrence_date: format(parseISO(updatedTransaction.date), 'yyyy-MM-DD'), // Format Date object to string
                p_monthly_amount: updatedTransaction.amount,
                p_category_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                p_description: updatedTransaction.description,
                p_status: 'Prevista', // Required enum value
                p_recurrence_day: newRecurrenceDay,
                p_total_installments: RECURRING_INSTALLMENTS_COUNT,
                p_forma_pagamento: null,
                p_cartao_id: null,
                p_tipo_pagamento: null,
              });
              if (rpcError) throw rpcError;
              console.log("[DEBUG] RPC for income occurrences completed.");

            } else {
              console.warn("handleUpdateTransaction: Unknown saveScope for recurring income:", saveScope);
              toast.error("Escopo de atualização desconhecido para receita recorrente.");
            }

          } else {
            console.log("[DEBUG] Updating one-off income transaction.");
            const { error: updateError } = await supabase
              .from("receitas")
              .update({
                valor: updatedTransaction.amount,
                data: updatedTransaction.date,
                tipo_receita_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                descricao: updatedTransaction.description,
                status: updatedTransaction.status,
                updated_at: new Date().toISOString(), // Força updated_at
              })
              .eq("id", id)
              .eq("user_id", user.id);
            if (updateError) throw updateError;
            console.log("[DEBUG] One-off income transaction updated.");
          }
        } else if (type === "expense") {
          if (!isValidUuid(id)) {
            toast.error("Erro (UPD-NF-1): ID de parcela de despesa inválido.");
            setLoadingEditData(false);
            return;
          }
          console.log("[DEBUG] Updating expense transaction.");

          const parentDespesaId = originalTransaction?.despesa_id;

          if (!parentDespesaId || !isValidUuid(parentDespesaId)) {
            toast.error("Erro (UPD-EXP-PARENT-1): ID da despesa principal inválido.");
            setLoadingEditData(false);
            return;
          }
          console.log("[DEBUG] Parent Despesa ID:", parentDespesaId);

          const newValorParcela = updatedTransaction.amount;
          const newVencimento = updatedTransaction.date;
          const newPagoStatus = updatedTransaction.status === "Recebida";
          const newPagoDate = newPagoStatus ? new Date().toISOString() : null;
          const newRecurrenceDay = getDate(parseISO(updatedTransaction.date));

          // Atualizar o registro mestre de despesa com as novas informações de categoria e descrição
          console.log("[DEBUG] Updating master expense record (despesas).");
          const { error: updateDespesaParentError } = await supabase
            .from("despesas")
            .update({
              categoria_id: updatedTransaction.category === null ? null : updatedTransaction.category,
              descricao: updatedTransaction.description,
              is_recurring_master: originalTransaction?.is_recurring_master,
              tipo_pagamento: updatedTransaction.tipo_pagamento, // NOVO: Incluído tipo_pagamento
              updated_at: new Date().toISOString(), // Força updated_at
            })
            .eq("id", parentDespesaId)
            .eq("user_id", user.id);

          if (updateDespesaParentError) throw updateDespesaParentError;
          console.log("[DEBUG] Master expense record updated.");


          if (saveScope === "thisMonth" || saveScope === "oneOff") {
            console.log(`[DEBUG] Updating single expense installment (ID: ${id}) for scope: ${saveScope}`);
            const { error: updateParcelaError } = await supabase
              .from("despesas_parcelas")
              .update({
                valor_parcela: newValorParcela,
                vencimento: newVencimento,
                pago: newPagoStatus,
                data_pagamento: newPagoDate,
                updated_at: new Date().toISOString(), // Força updated_at
              })
              .eq("id", id);

            if (updateParcelaError) throw updateParcelaError;
            console.log("[DEBUG] Single expense installment updated.");

          } else if (saveScope === "thisMonthForward" || saveScope === "all") {
            console.log(`[DEBUG] Updating recurring expense for scope: ${saveScope}`);
            // 1. Deletar todas as parcelas a partir da data de atualização (inclusive)
            const deleteFromDate = format(parseISO(updatedTransaction.date), 'yyyy-MM-dd');
            
            console.log(`[DEBUG] Deleting expense installments for parent ${parentDespesaId} from ${deleteFromDate} onwards.`);
            
            const { error: deleteFutureParcelasError } = await supabase
              .from("despesas_parcelas")
              .delete()
              .eq("despesa_id", parentDespesaId)
              .gte("vencimento", deleteFromDate);

            if (deleteFutureParcelasError) throw deleteFutureParcelasError;
            console.log("[DEBUG] Future expense installments deleted.");

            // 2. Chamar RPC para regenerar TODAS as parcelas a partir da data de atualização
            console.log("[DEBUG] Calling RPC to regenerate expense installments.");
            const { error: rpcError } = await supabase.rpc('generate_recurring_entries', {
              p_user_id: user.id,
              p_transaction_type: 'expense',
              p_master_id: parentDespesaId,
              p_first_occurrence_date: format(parseISO(updatedTransaction.date), 'yyyy-MM-DD'), // Format Date object to string
              p_monthly_amount: newValorParcela,
              p_category_id: updatedTransaction.category === null ? null : updatedTransaction.category,
              p_description: updatedTransaction.description,
              p_status: 'Pendente', // Default status for expenses, as it's a required enum
              p_recurrence_day: newRecurrenceDay,
              p_total_installments: RECURRING_INSTALLMENTS_COUNT, // Regenerar todas as 120
              p_forma_pagamento: originalTransaction.forma_pagamento,
              p_cartao_id: originalTransaction.cartao_id,
              p_tipo_pagamento: updatedTransaction.tipo_pagamento, // NOVO: Passando tipo_pagamento
            });
            if (rpcError) throw rpcError;
            console.log("[DEBUG] RPC for expense installments completed.");

            // 3. Recalcular valor_total e numero_parcelas para o registro mestre de despesa
            console.log("[DEBUG] Recalculating parent despesa total and number of installments.");
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
                    updated_at: new Date().toISOString(), // Força updated_at
                })
                .eq("id", parentDespesaId)
                .eq("user_id", user.id);

            if (updateParentDespesaTotalError) throw updateParentDespesaTotalError;
            console.log("[DEBUG] Parent despesa total and number of installments updated.");

            toast.success("Lançamento e parcelas futuras atualizadas!", {
                style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
            });

          } else {
            console.warn("handleUpdateTransaction: Unknown saveScope:", saveScope);
            toast.error("Escopo de atualização desconhecido.");
          }
        }

        toast.success("Lançamento atualizado!", {
          style: { backgroundColor: "hsl(var(--soft-green))", color: "hsl(var(--success-darker))" },
        });
        // 🔥 Invalida E RE-BUSCA os dados realmente alterados
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] }),
          queryClient.refetchQueries({ queryKey: ["expenseInstallments", user?.id] }),
          queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] }),
          queryClient.refetchQueries({ queryKey: ["revenues", user?.id] }),
        ]);
        console.log("[DEBUG] Queries invalidated and refetched after update.");

      } catch (err: any) {
        console.error("handleUpdateTransaction: Erro ao atualizar lançamento:", err);
        toast.error("Erro ao atualizar lançamento.", { description: err.message });
      } finally {
        setEditingTransaction(null);
        setIsEditModalOpen(false);
        setLoadingEditData(false);
        console.log("[DEBUG] handleUpdateTransaction finished. setLoadingEditData(false).");
      }
    },
    [user, monthlyFilteredTransactions, setLoadingEditData, setEditingTransaction, setIsEditModalOpen, queryClient]
  );

  return {
    handleDeleteTransaction,
    handleUpdateTransaction,
  };
};