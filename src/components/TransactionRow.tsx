import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useRecurringEntries } from "@/hooks/useRecurringEntries"; // Importar useRecurringEntries para o tipo

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
  markMonthPaid: ReturnType<typeof useRecurringEntries>['markMonthPaid']; // Adicionado
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
  user,
  markMonthPaid, // Destruturando a nova prop
}) => {
  console.log("TransactionRow: Rendering for transaction ID:", transaction.id, "Current Status (on render):", transaction.status);

  // REMOVIDO: const { markMonthPaid } = useRecurringEntries(user, new Date(), []);

  const getCategoryDisplay = (categoryId: string) => {
    const category = allCategories.find(cat => cat.id === categoryId);
    if (!category) return { name: categoryId, icon: null };

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
    console.log("handleToggleStatus: User at start of function:", user?.id, "Is user null?", !user);
    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      return;
    }

    // Adiciona verificação defensiva para queryClient
    if (!queryClient) {
      console.error("queryClient is undefined in handleToggleStatus!");
      toast.error("Erro interno: Cliente de consulta não disponível.");
      return;
    }

    console.log("handleToggleStatus: Transaction:", transaction);
    console.log("handleToggleStatus: isRecurring:", transaction.isRecurring);
    console.log("handleToggleStatus: recurringEntryId:", transaction.recurringEntryId);
    console.log("handleToggleStatus: Current transaction status before toggle:", transaction.status);


    // Priority 1: Handle NEW recurring transactions (materialized from recurring_entries)
    if (transaction.isRecurring && transaction.recurringEntryId) {
      console.log("handleToggleStatus: Handling as recurring transaction.");
      const transactionDate = new Date(transaction.date);
      const year = transactionDate.getFullYear();
      const month = transactionDate.getMonth() + 1; // CORRIGIDO: Mês 1-indexado
      console.log("handleToggleStatus: Calculated month for RPC:", month, "Year:", year);
      const isPaid = transaction.status !== "Recebida"; // Toggle status
      console.log("handleToggleStatus: Toggling recurring status to isPaid:", isPaid, "for recurring ID:", transaction.recurringEntryId, "Month (1-indexed):", month, "Year:", year); // Log ajustado

      try {
        await markMonthPaid({
          recurring_id: transaction.recurringEntryId,
          year,
          month, // Este 'month' é o que será passado para a mutação
          is_paid: isPaid,
        });
        console.log("handleToggleStatus: markMonthPaid called successfully.");
        // Invalida as queries que useTransactionsData depende
        queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user.id] });
        queryClient.invalidateQueries({ queryKey: ["recurringEntries", user.id] });
        queryClient.invalidateQueries({ queryKey: ["revenues", user.id] });
        queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user.id] });
        console.log("handleToggleStatus: Queries invalidated for recurring transaction.");
      } catch (error) {
        console.error("handleToggleStatus: Error marking recurring month paid:", error);
      }
      return; // EXIT HERE FOR ALL RECURRING TRANSACTIONS
    }

    // Priority 2: Handle ONE-OFF transactions (legacy fixed are now filtered out in useTransactionsData)
    console.log("handleToggleStatus: Handling as one-off transaction.");
    let error = null;
    const newStatus = transaction.status === "Recebida" ? "Pendente" : "Recebida";
    const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    if (transaction.type === "income") {
      // For one-off income, transaction.id is always the UUID of the 'receitas' entry.
      const revenueIdToUse = transaction.id;
      if (!isValidUuid(revenueIdToUse)) {
        // This should ideally not happen if data is clean and filtered correctly.
        toast.error("Erro (TOGGLE-INC-1): ID de receita inválido.");
        return;
      }
      const { error: updateError } = await supabase
        .from("receitas")
        .update({ status: newStatus })
        .eq("id", revenueIdToUse)
        .eq("user_id", user.id);
      error = updateError;

      if (!error) {
        queryClient.setQueryData(["revenues", user.id], (oldData: Tables<'receitas'>[] | undefined) => {
          if (!oldData) return [];
          return oldData.map(r => r.id === revenueIdToUse ? { ...r, status: newStatus } : r);
        });
        queryClient.invalidateQueries({ queryKey: ["revenues", user.id] }); // Invalida a query de receitas
      }
    } else if (transaction.type === "expense") {
      // For one-off expense, transaction.id is always the ID of a 'despesas_parcelas' entry.
      const isPaid = newStatus === "Recebida";
      const dataPagamento = isPaid ? currentTimestamp : null;
      const installmentId = transaction.id;

      if (!isValidUuid(installmentId)) {
        // This should ideally not happen if data is clean and filtered correctly.
        toast.error("Erro (TOGGLE-EXP-1): ID de parcela de despesa inválido.");
        return;
      }

      const { error: updateError } = await supabase
        .from("despesas_parcelas")
        .update({
          pago: isPaid,
          data_pagamento: dataPagamento,
        })
        .eq("id", installmentId);
      error = updateError;

      if (!error) {
        queryClient.setQueryData(["expenseInstallments", user.id], (oldData: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[] | undefined) => {
          if (!oldData) return [];
          return oldData.map(p => p.id === installmentId ? { ...p, pago: isPaid, data_pagamento: dataPagamento } : p);
        });
        queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user.id] }); // Invalida a query de parcelas
      }
    }
    
    if (error) {
      toast.error("Erro ao atualizar status", { description: error.message });
      console.error("handleToggleStatus: Status update error:", error);
    } else {
      toast.success("Status atualizado!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
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
        {/* Botão de toggle para o status */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleToggleStatus}
          disabled={transaction.status === "Cancelada"} // Desabilita o toggle se a transação estiver cancelada
        >
          {transaction.status === "Recebida" && <DynamicIcon name="CheckCircle" className="h-4 w-4 text-success" />}
          {(transaction.status === "Pendente" || transaction.status === "Prevista") && <DynamicIcon name="Circle" className="h-4 w-4 text-destructive" />}
          {transaction.status === "Cancelada" && <DynamicIcon name="XCircle" className="h-4 w-4 text-muted-foreground" />}
        </Button>
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