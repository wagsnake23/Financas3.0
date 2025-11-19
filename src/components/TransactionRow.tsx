import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format, addMonths, addQuarters, addYears, getDate, setDate, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useRecurringEntries, MaterializedRecurringTransaction } from "@/hooks/useRecurringEntries"; // Importar o hook de recorrência

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface TransactionRowProps {
  transaction: Transaction;
  onDeleteTransaction: (id: string, type: "income" | "expense", isFixed?: boolean) => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
}

// Helper function to validate UUID format (basic check)
const isValidUuid = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onDeleteTransaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  queryClient,
  user, // This is the prop we need to check
}) => {
  console.log("TransactionRow: Rendering for transaction ID:", transaction.id, "User prop:", user?.id, "Is user null?", !user);

  const { markMonthPaid } = useRecurringEntries(user, new Date(), []); // Ensure user is passed here too

  const getCategoryDisplay = (categoryId: string) => {
    const category = allCategories.find(cat => cat.id === categoryId);
    if (!category) return { name: categoryId, icon: null }; // Fallback if category not found

    if (category.parent_id) {
      const parent = allCategories.find(p => p.id === category.parent_id);
      return { name: category.nome, icon: category.icone };
    }
    return { name: category.nome, icon: category.icone };
  };

  const { name: categoryName, icon: categoryIcon } = getCategoryDisplay(transaction.category);

  const getPaymentMethodDisplay = (formaPagamento: string | null, cartaoId: string | null) => {
    if (!formaPagamento) return null;

    switch (formaPagamento) {
      case "dinheiro": return "Dinheiro";
      case "pix": return "PIX";
      case "boleto": return "Boleto";
      case "cartao":
        const card = cartoes.find(c => c.id === cartaoId);
        return card ? `Cartão: ${card.nome} (****${card.ultimos_digitos})` : "Cartão";
      default: return formaPagamento;
    }
  };

  const paymentMethodDisplay = getPaymentMethodDisplay(transaction.forma_pagamento, transaction.cartao_id);

  const handleToggleStatus = async () => {
    console.log("handleToggleStatus: User at start of function:", user?.id, "Is user null?", !user); // ADD THIS LOG
    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      return;
    }

    // Handle recurring transactions status toggle
    if (transaction.isRecurring && transaction.recurringEntryId) {
      const transactionDate = new Date(transaction.date);
      const year = transactionDate.getFullYear();
      const month = transactionDate.getMonth() + 1;
      const isPaid = transaction.status !== "Recebida"; // Toggle status

      try {
        await markMonthPaid({
          recurring_id: transaction.recurringEntryId,
          year,
          month,
          is_paid: isPaid,
        });
        // Invalidate queries to refetch and re-materialize transactions
        queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user.id] });
        queryClient.invalidateQueries({ queryKey: ["recurringEntries", user.id] });
      } catch (error) {
        // Error handled by mutation's onError
      }
      return;
    }

    // --- Existing logic for non-recurring transactions ---
    let error = null;
    const newStatus = transaction.status === "Recebida" ? "Pendente" : "Recebida";
    const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    if (transaction.type === "income") {
      let revenueIdToUse = transaction.id;
      if (transaction.is_fixed) {
        const lastHyphenIndex = transaction.id.lastIndexOf('-');
        if (lastHyphenIndex !== -1) {
          revenueIdToUse = transaction.id.substring(0, lastHyphenIndex);
        }
      }
      if (!isValidUuid(revenueIdToUse)) {
        toast.error("Erro (TOGGLE-INC-1): ID de receita inválido.");
        return;
      }
      const { error: updateError } = await supabase
        .from("receitas")
        .update({ status: newStatus })
        .eq("id", revenueIdToUse)
        .eq("user_id", user.id); // Use user.id directly
      error = updateError;

      if (!error) {
        queryClient.setQueryData(["revenues", user.id], (oldData: Tables<'receitas'>[] | undefined) => { // Use user.id directly
          if (!oldData) return [];
          return oldData.map(r => r.id === revenueIdToUse ? { ...r, status: newStatus } : r);
        });
      }
    } else if (transaction.type === "expense") {
      const isPaid = newStatus === "Recebida";
      const dataPagamento = isPaid ? currentTimestamp : null;

      if (transaction.is_fixed) {
        const lastHyphenIndex = transaction.id.lastIndexOf('-');
        const parentDespesaId = transaction.id.substring(0, lastHyphenIndex);
        const occurrenceNumber = parseInt(transaction.id.substring(lastHyphenIndex + 1));

        if (!isValidUuid(parentDespesaId) || isNaN(occurrenceNumber)) {
          toast.error("Erro (TOGGLE-FX-1): ID de ocorrência de despesa fixa inválido.");
          return;
        }

        const currentExpenseInstallments = queryClient.getQueryData<(Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[]>(["expenseInstallments", user.id]) || []; // Use user.id directly
        const existingInstallment = currentExpenseInstallments.find(p => p.despesa_id === parentDespesaId && p.numero_parcela === occurrenceNumber);

        if (existingInstallment) {
          // Update existing installment in DB
          const { error: updateError } = await supabase
            .from("despesas_parcelas")
            .update({
              pago: isPaid,
              data_pagamento: dataPagamento,
            })
            .eq("id", existingInstallment.id);
          error = updateError;

          if (!error) {
            // Update cache directly
            queryClient.setQueryData(["expenseInstallments", user.id], (oldData: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[] | undefined) => { // Use user.id directly
              if (!oldData) return [];
              return oldData.map(p => p.id === existingInstallment.id ? { ...p, pago: isPaid, data_pagamento: dataPagamento } : p);
            });
          }
        } else {
          // Insert new installment in DB
          const parentDespesa = queryClient.getQueryData<Tables<'despesas'>[]>(["expenses", user.id])?.find(d => d.id === parentDespesaId); // Use user.id directly
          if (!parentDespesa) {
            toast.error("Erro (TOGGLE-FX-2): Despesa fixa pai não encontrada.");
            return;
          }

          const firstInstallmentVencimento = currentExpenseInstallments.find(p => p.despesa_id === parentDespesaId && p.numero_parcela === 1)?.vencimento;
          let baseRecurrenceDate: Date;
          if (firstInstallmentVencimento) {
            const [year, month, day] = firstInstallmentVencimento.split('-').map(Number);
            baseRecurrenceDate = new Date(year, month - 1, day); // Explicitly local date
          } else {
            baseRecurrenceDate = new Date(parentDespesa.created_at); // created_at is ISO string, new Date() handles it well
          }
          
          let occurrenceDate = new Date(baseRecurrenceDate);
          if (parentDespesa.recurrence_frequency === "monthly") {
            occurrenceDate = addMonths(baseRecurrenceDate, occurrenceNumber - 1);
          } else if (parentDespesa.recurrence_frequency === "quarterly") {
            occurrenceDate = addQuarters(baseRecurrenceDate, occurrenceNumber - 1);
          } else if (parentDespesa.recurrence_frequency === "annually") {
            occurrenceDate = addYears(baseRecurrenceDate, occurrenceNumber - 1);
          }
          const formattedOccurrenceDate = format(occurrenceDate, "yyyy-MM-dd");

          const { data: newInstallmentData, error: insertError } = await supabase
            .from("despesas_parcelas")
            .insert({
              despesa_id: parentDespesa.id, // Use parentDespesa.id directly
              numero_parcela: occurrenceNumber,
              valor_parcela: parentDespesa.valor_total,
              vencimento: formattedOccurrenceDate,
              pago: isPaid,
              data_pagamento: dataPagamento,
            })
            .select()
            .single();
          error = insertError;

          if (!error && newInstallmentData) {
            const newInstallmentEntry = {
              ...newInstallmentData,
              despesas: {
                id: parentDespesa.id,
                categoria_id: parentDespesa.categoria_id,
                user_id: parentDespesa.user_id,
                descricao: parentDespesa.descricao,
                forma_pagamento: parentDespesa.forma_pagamento,
                tipo_pagamento: parentDespesa.tipo_pagamento,
                cartao_id: parentDespesa.cartao_id,
                is_fixed: parentDespesa.is_fixed,
                recurrence_frequency: parentDespesa.recurrence_frequency,
                recurrence_installments_count: parentDespesa.recurrence_installments_count,
              }
            };
            queryClient.setQueryData(["expenseInstallments", user.id], (oldData: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[] | undefined) => { // Use user.id directly
              return oldData ? [...oldData, newInstallmentEntry] : [newInstallmentEntry];
            });
          }
        }
      }
    }
  
    if (error) {
      toast.error("Erro ao atualizar status", { description: error.message });
      console.error("handleToggleStatus: Status update error:", error);
    } else {
      toast.success("Status atualizado!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
      });
    }
  };

  return (
    <TableRow
      key={transaction.id}
      className={cn(
        transaction.status === "Recebida" && "bg-soft-green/30 hover:bg-soft-green/50",
        (transaction.status === "Pendente" || transaction.status === "Prevista") && "bg-soft-red/30 hover:bg-soft-red/50",
        transaction.status === "Cancelada" && "bg-muted/20 hover:bg-muted/40 text-muted-foreground"
      )}
    >
      <TableCell className="py-2 px-2 text-xs min-w-[70px]">
        {(() => {
          const [year, month, day] = transaction.date.split('-').map(Number);
          const localDate = new Date(year, month - 1, day);
          return localDate.toLocaleDateString("pt-BR");
        })()}
      </TableCell>
      {!isMobile && ( // Ocultar em mobile
        <TableCell className="py-2 px-2 min-w-[60px]">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            transaction.type === "income"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}>
            {transaction.type === "income" ? "Receita" : "Despesa"}
          </span>
        </TableCell>
      )}
      <TableCell className="py-2 px-2 text-xs min-w-[80px] flex items-center gap-1">
        {categoryIcon && <span>{categoryIcon}</span>}
        <span>{categoryName}</span>
      </TableCell>
      {!isMobile && ( // Ocultar em mobile
        <TableCell className="py-2 px-2 text-xs min-w-[100px]">
          {transaction.installmentNumber && transaction.totalInstallments && transaction.totalInstallments > 1
            ? `Parcela ${transaction.installmentNumber} de ${transaction.totalInstallments}`
            : transaction.description || "-"}
          {paymentMethodDisplay && (
            <span className="block text-xs text-muted-foreground mt-0.5">
              {paymentMethodDisplay}
            </span>
          )}
        </TableCell>
      )}
      <TableCell className={`py-2 px-2 text-right font-semibold text-xs min-w-[80px] ${
        transaction.type === "income" ? "text-success" : "text-destructive"
      }`}>
        {transaction.type === "income" ? "+" : "-"}
        R$ {transaction.amount.toFixed(2)}
      </TableCell>
      <TableCell className="py-2 px-2 text-center min-w-[50px]">
        {transaction.status !== "Cancelada" ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full",
              transaction.status === "Recebida" && "text-success hover:bg-success/10",
              (transaction.status === "Pendente" || transaction.status === "Prevista") && "text-destructive hover:bg-destructive/10",
            )}
            onClick={handleToggleStatus}
          >
            {transaction.status === "Recebida" && <DynamicIcon name="CheckCircle" className="h-4 w-4" />}
            {(transaction.status === "Pendente" || transaction.status === "Prevista") && <DynamicIcon name="Circle" className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full cursor-not-allowed",
              transaction.status === "Cancelada" && "text-destructive/50",
            )}
            disabled
          >
            {transaction.status === "Recebida" && <DynamicIcon name="CheckCircle" className="h-4 w-4" />}
            {(transaction.status === "Pendente" || transaction.status === "Prevista") && <DynamicIcon name="Circle" className="h-4 w-4" />}
            {transaction.status === "Cancelada" && <DynamicIcon name="XCircle" className="h-4 w-4" />}
          </Button>
        )}
      </TableCell>
      <TableCell className="py-2 px-2 text-right min-w-[50px]">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEditTransaction(transaction)}
          >
            <DynamicIcon name="Pencil" className="h-3.5 w-3.5 text-primary" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default memo(TransactionRow);