import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Transaction, TransactionType } from "@/types/finance";
import { TablesUpdate, Tables, Database } from "@/integrations/supabase/types"; // Importar Tables e Database
import { isValidUuid, formatInTimeZone, TARGET_TIMEZONE, zonedTimeToUtcFallback } from "@/lib/utils"; // Importar formatInTimeZone e zonedTimeToUtcFallback
import { format, parseISO, getDate } from "date-fns";

type DeleteScope = "thisMonth" | "thisMonthForward" | "oneOff";
type SaveScope = "thisMonth" | "thisMonthForward" | "oneOff";
type ReceitaStatus = Database['public']['Enums']['receita_status']; // Importar ReceitaStatus

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
  // A duração agora é fixa para todos os dispositivos
  const toastDuration = 1000; // 1 segundo para todos os dispositivos
  const toastSuccessStyle = { backgroundColor: '#FFFFFF', color: '#006000', border: '1px solid #E5FFE5' };
  const toastErrorStyle = { backgroundColor: '#FFFFFF', color: '#FF2929', border: '1px solid #FFE5E5' };

  const invalidateAllTransactionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["despesas", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["cartoes", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["pending-receipts-notifications", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["overdue-expenses-notifications", user?.id] });
  }, [queryClient, user?.id]);

  const handleDeleteTransaction = useCallback(
    async (id: string, type: "income" | "expense", deleteScope: DeleteScope) => {
      setLoadingEditData(true);
      console.log(`[DEBUG] handleDeleteTransaction called for ID: ${id}, Type: ${type}, Scope: ${deleteScope}`);

      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.", { duration: toastDuration, style: toastErrorStyle });
        setLoadingEditData(false);
        return;
      }

      const transactionToDelete = monthlyFilteredTransactions.find((t) => t.id === id);
      if (!transactionToDelete) {
        toast.error("Lançamento não encontrado.", { duration: toastDuration, style: toastErrorStyle });
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
            const formattedCurrentOccurrenceDate = formatInTimeZone(currentOccurrenceDate, TARGET_TIMEZONE, 'yyyy-MM-dd'); // Usar formatInTimeZone

            if (deleteScope === "oneOff" || deleteScope === "thisMonth") {
              console.log(`[DEBUG] Deleting single income occurrence from 'receitas' table with ID: ${id}`);
              const { error: deleteOccurrenceError } = await supabase.from("receitas").delete().eq("id", id).eq("user_id", user.id);
              if (deleteOccurrenceError) throw deleteOccurrenceError;

              // Se a ocorrência deletada era a mestra, precisamos desvincular as outras
              if (transactionToDelete.is_recurring_master) {
                const { error: updateOccurrencesError } = await supabase
                  .from("receitas")
                  .update({ recurrence_id: null, is_recurring_master: false, recurrence_day: null })
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
                  .update({ is_recurring_master: false, recurrence_id: null, recurrence_day: null })
                  .eq("id", masterRecurrenceId);
                if (updateMasterError) console.error("Error updating master after 'thisMonthForward' deletion:", updateMasterError);
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
                  .update({ numero_parcelas: remainingParcelas?.length || 0 })
                  .eq("id", parentDespesaId);
                if (updateParentError) console.error("Error updating parent despesas numero_parcelas:", updateParentError);
              }
            }
          } else if (deleteScope === "thisMonthForward") {
            if (!parentDespesaId || !isValidUuid(parentDespesaId)) {
              throw new Error("Erro (DEL-EXP-2): ID da despesa principal inválido para exclusão 'deste mês em diante'.");
            }
            const currentInstallmentDate = parseISO(transactionToDelete.date);
            console.log(`[DEBUG] Deleting expense installments from 'despesas_parcelas' for parent ${parentDespesaId} from ${formatInTimeZone(currentInstallmentDate, TARGET_TIMEZONE, 'yyyy-MM-dd')} onwards.`); // Usar formatInTimeZone

            const { error: deleteFutureParcelasError } = await supabase
              .from("despesas_parcelas")
              .delete()
              .eq("despesa_id", parentDespesaId)
              .gte("vencimento", formatInTimeZone(currentInstallmentDate, TARGET_TIMEZONE, 'yyyy-MM-dd')); // Usar formatInTimeZone

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
                .update({ numero_parcelas: remainingParcelas?.length || 0 })
                .eq("id", parentDespesaId);
              if (updateParentError) console.error("Error updating parent despesas numero_parcelas:", updateParentError);
            }

          }
        }

        toast.success("Lançamento excluído!", {
          style: toastSuccessStyle,
          duration: toastDuration
        });
        setIsEditModalOpen(false);
        setTimeout(() => {
          setEditingTransaction(null);
          invalidateAllTransactionQueries();
          setLoadingEditData(false);
        }, 300);
      } catch (err: any) {
        toast.error("Erro ao excluir lançamento", { description: err.message, duration: toastDuration, style: toastErrorStyle });
        console.error("handleDeleteTransaction: Deletion error:", err);
        setLoadingEditData(false);
      }
    },
    [user, monthlyFilteredTransactions, setLoadingEditData, setEditingTransaction, setIsEditModalOpen, invalidateAllTransactionQueries, toastDuration, toastSuccessStyle, toastErrorStyle]
  );

  const handleUpdateTransaction = useCallback(
    async (
      id: string,
      type: TransactionType,
      updatedTransaction: Omit<Transaction, "id">,
      saveScope: SaveScope
    ) => {
      setLoadingEditData(true);

      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.", { duration: toastDuration, style: toastErrorStyle });
        setLoadingEditData(false);
        return;
      }

      const originalTransaction = monthlyFilteredTransactions.find((t) => t.id === id);

      try {
        if (type === "income") {
          if (!isValidUuid(id)) {
            toast.error("Erro (UPD-INC-1): ID de receita inválido.", { duration: toastDuration, style: toastErrorStyle });
            setLoadingEditData(false);
            return;
          }

          if (originalTransaction?.is_recurring_master || originalTransaction?.recurrence_id) {
            const masterRecurrenceId = originalTransaction.is_recurring_master ? originalTransaction.id : originalTransaction.recurrence_id;
            if (!masterRecurrenceId) throw new Error("Erro (UPD-INC-REC-1): ID de recorrência mestre não encontrado.");

            const newRecurrenceDay = getDate(parseISO(updatedTransaction.date));

            if (saveScope === "thisMonth" || saveScope === "oneOff") {
              const { error: updateOccurrenceError } = await supabase
                .from("receitas")
                .update({
                  valor: updatedTransaction.amount,
                  data: updatedTransaction.date,
                  tipo_receita_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                  descricao: updatedTransaction.description,
                  status: updatedTransaction.status,
                  // NOVO: Adicionado updated_at para receitas quando o status é 'Recebida'
                  updated_at: updatedTransaction.status === "Recebida" ? formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss") : null,
                })
                .eq("id", id)
                .eq("user_id", user.id);
              if (updateOccurrenceError) throw updateOccurrenceError;

            } else if (saveScope === "thisMonthForward") {
              // UPDATE PURO — sem DELETE, sem INSERT, sem RPC
              // Preserva todo histórico anterior e não recria nenhum registro
              const updateFromDate = updatedTransaction.date.substring(0, 10);

              // 1. Atualizar ocorrências futuras filhas (não recebidas/canceladas)
              //    Isso preserva o histórico de receitas já recebidas
              const { error: updateFutureError } = await supabase
                .from("receitas")
                .update({
                  valor: updatedTransaction.amount,
                  tipo_receita_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                  descricao: updatedTransaction.description,
                  recurrence_day: newRecurrenceDay,
                })
                .eq("recurrence_id", masterRecurrenceId)
                .neq("id", masterRecurrenceId)
                .gte("data", updateFromDate)
                .not("status", "in", '("Recebida","Cancelada")')
                .eq("user_id", user.id);
              if (updateFutureError) throw updateFutureError;

              // 2. Atualizar a ocorrência atual (independente de status — o usuário editou explicitamente)
              const { error: updateCurrentError } = await supabase
                .from("receitas")
                .update({
                  valor: updatedTransaction.amount,
                  tipo_receita_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                  descricao: updatedTransaction.description,
                  recurrence_day: newRecurrenceDay,
                  status: updatedTransaction.status,
                  updated_at: updatedTransaction.status === "Recebida" ? formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss") : null,
                })
                .eq("id", id)
                .eq("user_id", user.id);
              if (updateCurrentError) throw updateCurrentError;

              // 3. Atualizar o registro mestre (metadados da série)
              const { error: updateMasterError } = await supabase
                .from("receitas")
                .update({
                  valor: updatedTransaction.amount,
                  tipo_receita_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                  descricao: updatedTransaction.description,
                  recurrence_day: newRecurrenceDay,
                })
                .eq("id", masterRecurrenceId)
                .eq("user_id", user.id);
              if (updateMasterError) throw updateMasterError;

            } else {
              console.warn("handleUpdateTransaction: Unknown saveScope for recurring income:", saveScope);
              toast.error("Escopo de atualização desconhecido para receita recorrente.", { duration: toastDuration, style: toastErrorStyle });
            }

          } else {
            const { error: updateError } = await supabase
              .from("receitas")
              .update({
                valor: updatedTransaction.amount,
                data: updatedTransaction.date,
                tipo_receita_id: updatedTransaction.category === null ? null : updatedTransaction.category,
                descricao: updatedTransaction.description,
                status: updatedTransaction.status,
                // NOVO: Adicionado updated_at para receitas quando o status é 'Recebida'
                updated_at: updatedTransaction.status === "Recebida" ? formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss") : null,
              })
              .eq("id", id)
              .eq("user_id", user.id);
            if (updateError) throw updateError;
          }
        } else if (type === "expense") {
          if (!isValidUuid(id)) {
            toast.error("Erro (UPD-NF-1): ID de parcela de despesa inválido.", { duration: toastDuration, style: toastErrorStyle });
            setLoadingEditData(false);
            return;
          }

          const parentDespesaId = originalTransaction?.despesa_id;

          if (!parentDespesaId || !isValidUuid(parentDespesaId)) {
            toast.error("Erro (UPD-EXP-PARENT-1): ID da despesa principal inválido.", { duration: toastDuration, style: toastErrorStyle });
            setLoadingEditData(false);
            return;
          }

          const newValorParcela = updatedTransaction.amount;
          // CORREÇÃO: Garantir que newVencimento inclua a hora atual
          const newVencimento = formatInTimeZone(
            parseISO(updatedTransaction.date),
            TARGET_TIMEZONE,
            "yyyy-MM-dd HH:mm:ss"
          );
          const newPagoStatus = updatedTransaction.status === "Recebida";
          const newPagoDate = newPagoStatus ? formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss") : null; // Usa formatInTimeZone
          const newRecurrenceDay = getDate(parseISO(updatedTransaction.date));

          // Atualizar o registro mestre de despesa com as novas informações de categoria, descrição, forma de pagamento e cartão
          const { error: updateDespesaParentError } = await supabase
            .from("despesas")
            .update({
              categoria_id: updatedTransaction.category === null ? null : updatedTransaction.category,
              descricao: updatedTransaction.description,
              is_recurring_master: originalTransaction?.is_recurring_master,
              tipo_pagamento: updatedTransaction.tipo_pagamento,
              forma_pagamento: updatedTransaction.forma_pagamento,
              cartao_id: updatedTransaction.cartao_id,
              data_competencia: formatInTimeZone(parseISO(updatedTransaction.date), TARGET_TIMEZONE, "yyyy-MM-dd"),
            })
            .eq("id", parentDespesaId)
            .eq("user_id", user.id);

          if (updateDespesaParentError) throw updateDespesaParentError;


          if (saveScope === "thisMonth" || saveScope === "oneOff") {
            const { error: updateParcelaError } = await supabase
              .from("despesas_parcelas")
              .update({
                valor_parcela: newValorParcela,
                vencimento: newVencimento,
                pago: newPagoStatus,
                data_pagamento: newPagoStatus ? formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss") : null, // Directly use new Date()
              })
              .eq("id", id);

            if (updateParcelaError) throw updateParcelaError;

          } else if (saveScope === "thisMonthForward") {
            // UPDATE PURO — sem DELETE, sem INSERT, sem RPC
            // Preserva parcelas pagas e histórico anterior integralmente
            const updateFromDate = formatInTimeZone(parseISO(updatedTransaction.date), TARGET_TIMEZONE, 'yyyy-MM-dd');

            // 1. Atualizar valor_parcela das parcelas futuras NÃO PAGAS (preserva histórico de pagamentos)
            const { error: updateFutureParcelasError } = await supabase
              .from("despesas_parcelas")
              .update({ valor_parcela: newValorParcela })
              .eq("despesa_id", parentDespesaId)
              .gte("vencimento", updateFromDate)
              .eq("pago", false);
            if (updateFutureParcelasError) throw updateFutureParcelasError;

            // 2. Atualizar a parcela atual explicitamente (inclui status de pagamento se marcado)
            //    O usuário editou este registro diretamente — aplicar todas as mudanças
            const { error: updateCurrentParcelaError } = await supabase
              .from("despesas_parcelas")
              .update({
                valor_parcela: newValorParcela,
                vencimento: newVencimento,
                pago: newPagoStatus,
                data_pagamento: newPagoStatus ? formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss") : null,
              })
              .eq("id", id);
            if (updateCurrentParcelaError) throw updateCurrentParcelaError;

            // 3. Recalcular valor_total do mestre (numero_parcelas NUNCA é alterado)
            const { data: allInstallments, error: fetchInstallmentsError } = await supabase
              .from("despesas_parcelas")
              .select("valor_parcela")
              .eq("despesa_id", parentDespesaId);
            if (fetchInstallmentsError) throw fetchInstallmentsError;

            const newParentValorTotal = allInstallments.reduce((sum, inst) => sum + inst.valor_parcela, 0);

            const { error: updateTotalError } = await supabase
              .from("despesas")
              .update({ valor_total: newParentValorTotal })
              .eq("id", parentDespesaId)
              .eq("user_id", user.id);
            if (updateTotalError) throw updateTotalError;

          } else {
            console.warn("handleUpdateTransaction: Unknown saveScope:", saveScope);
            toast.error("Escopo de atualização desconhecido.", { duration: toastDuration, style: toastErrorStyle });
          }
        }

        toast.success("Lançamento atualizado!", {
          style: toastSuccessStyle,
          duration: toastDuration
        });
        setIsEditModalOpen(false);
        setTimeout(() => {
          setEditingTransaction(null);
          invalidateAllTransactionQueries();
          setLoadingEditData(false);
        }, 300);
      } catch (err: any) {
        console.error("handleUpdateTransaction: Erro ao atualizar lançamento:", err);
        toast.error("Erro ao atualizar lançamento.", { description: err.message, duration: toastDuration, style: toastErrorStyle });
        setLoadingEditData(false);
      }
    },
    [user, monthlyFilteredTransactions, invalidateAllTransactionQueries, setLoadingEditData, setEditingTransaction, setIsEditModalOpen, toastDuration, toastSuccessStyle, toastErrorStyle]
  );

  const handleOptimisticToggleStatus = useCallback(
    async (id: string, type: TransactionType, newStatus: ReceitaStatus) => {
      if (!user) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.", { duration: toastDuration, style: toastErrorStyle });
        return;
      }

      const toastId = 'status-update-toast'; // ID consistente para toasts de status
      const currentTimestamp = formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss"); // NOVO: Usa formatInTimeZone

      // 1. Optimistically update the UI
      if (type === "income") {
        queryClient.setQueryData(
          ["revenues", user.id],
          (oldData: Tables<'receitas'>[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map((r) =>
              r.id === id ? { ...r, status: newStatus, updated_at: newStatus === "Recebida" ? currentTimestamp : r.updated_at } : r // NOVO: Atualiza updated_at
            );
          }
        );
      } else { // expense
        queryClient.setQueryData(
          ["expenseInstallments", user.id],
          (oldData: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_recurring_master'> | null })[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map((p) =>
              p.id === id ? { ...p, pago: newStatus === "Recebida", data_pagamento: newStatus === "Recebida" ? currentTimestamp : null } : p // NOVO: Atualiza data_pagamento
            );
          }
        );
      }

      // 2. Perform the API call
      try {
        if (type === "income") {
          const { error } = await supabase
            .from("receitas")
            .update({ status: newStatus, updated_at: currentTimestamp }) // NOVO: Envia updated_at
            .eq("id", id)
            .eq("user_id", user.id);
          if (error) throw error;
        } else { // expense
          const pago = newStatus === "Recebida";
          const dataPagamento = pago
            ? formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss") // NOVO: Directly use new Date()
            : null;

          const { error } = await supabase
            .from("despesas_parcelas")
            .update({
              pago,
              data_pagamento: dataPagamento,
            })
            .eq("id", id);
          if (error) throw error;
        }
        toast.success("Status atualizado!", { id: toastId, duration: toastDuration, style: toastSuccessStyle }); // Adicionar ID, duração e estilo
        // Invalidate queries to ensure data consistency, but the UI is already updated
        invalidateAllTransactionQueries(); // This will re-fetch and confirm the state
      } catch (error: any) {
        console.error("Erro ao atualizar status:", error);
        toast.error("Erro ao atualizar status.", { id: toastId, description: error.message, duration: toastDuration, style: toastErrorStyle }); // Adicionar ID, duração e estilo
        // 3. Revert UI on error
        if (type === "income") {
          queryClient.setQueryData(
            ["revenues", user.id],
            (oldData: Tables<'receitas'>[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map((r) =>
                r.id === id ? { ...r, status: (newStatus === "Recebida" ? "Pendente" : "Recebida"), updated_at: r.updated_at } : r // Reverte updated_at também
              );
            }
          );
        } else { // expense
          queryClient.setQueryData(
            ["expenseInstallments", user.id],
            (oldData: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_recurring_master'> | null })[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map((p) =>
                p.id === id ? { ...p, pago: (newStatus === "Recebida" ? false : true), data_pagamento: p.data_pagamento } : p // Reverte data_pagamento também
              );
            }
          );
        }
      }
    },
    [user, queryClient, invalidateAllTransactionQueries, toastDuration, toastSuccessStyle, toastErrorStyle] // Adicionar toastDuration às dependências
  );

  return {
    handleDeleteTransaction,
    handleUpdateTransaction,
    handleOptimisticToggleStatus,
  };
};
