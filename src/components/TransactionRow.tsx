import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
// Removido: import { toast } from "sonner";
// Removido: import { useQueryClient } from "@tanstack/react-query";
// Removido: import { User } from "@supabase/supabase-js";
// Removido: import { supabase } from "@/integrations/supabase/client";
// Removido: import { useRecurringEntries, MaterializedRecurringTransaction } from "@/hooks/useRecurringEntries"; // Importar o hook de recorrência

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
  // Removido: queryClient: ReturnType<typeof useQueryClient>;
  // Removido: user: User | null;
}

// Helper function to validate UUID format (basic check)
// Removido: const isValidUuid = (uuid: string) => {
// Removido:   const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Removido:   return uuidRegex.test(uuid);
// Removido: };

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onDeleteTransaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  // Removido: queryClient,
  // Removido: user,
}) => {
  // Removido: console.log("TransactionRow: Rendering for transaction ID:", transaction.id, "Current Status (on render):", transaction.status);

  // Removido: const { markMonthPaid } = useRecurringEntries(user, new Date(), []);

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

  // Removido: const handleToggleStatus = async () => {
  // Removido:   console.log("handleToggleStatus: User at start of function:", user?.id, "Is user null?", !user);
  // Removido:   if (!user) {
  // Removido:     toast.error("Usuário não autenticado. Por favor, faça login novamente.");
  // Removido:     return;
  // Removido:   }

  // Removido:   // Adiciona verificação defensiva para queryClient
  // Removido:   if (!queryClient) {
  // Removido:     console.error("queryClient is undefined in handleToggleStatus!");
  // Removido:     toast.error("Erro interno: Cliente de consulta não disponível.");
  // Removido:     return;
  // Removido:   }

  // Removido:   console.log("handleToggleStatus: Transaction:", transaction);
  // Removido:   console.log("handleToggleStatus: isRecurring:", transaction.isRecurring);
  // Removido:   console.log("handleToggleStatus: recurringEntryId:", transaction.recurringEntryId);
  // Removido:   console.log("handleToggleStatus: Current transaction status before toggle:", transaction.status);


  // Removido:   // Priority 1: Handle NEW recurring transactions (materialized from recurring_entries)
  // Removido:   if (transaction.isRecurring && transaction.recurringEntryId) {
  // Removido:     console.log("handleToggleStatus: Handling as recurring transaction.");
  // Removido:     const transactionDate = new Date(transaction.date);
  // Removido:     const year = transactionDate.getFullYear();
  // Removido:     const month = transactionDate.getMonth() + 1; // CORRIGIDO: Mês 1-indexado
  // Removido:     console.log("handleToggleStatus: Calculated month for RPC:", month, "Year:", year);
  // Removido:     const isPaid = transaction.status !== "Recebida"; // Toggle status
  // Removido:     console.log("handleToggleStatus: Toggling recurring status to isPaid:", isPaid, "for recurring ID:", transaction.recurringEntryId, "Month (1-indexed):", month, "Year:", year); // Log ajustado

  // Removido:     try {
  // Removido:       await markMonthPaid({
  // Removido:         recurring_id: transaction.recurringEntryId,
  // Removido:         year,
  // Removido:         month, // Este 'month' é o que será passado para a mutação
  // Removido:         is_paid: isPaid,
  // Removido:       });
  // Removido:       console.log("handleToggleStatus: markMonthPaid called successfully.");
  // Removido:       // Invalida as queries que useTransactionsData depende
  // Removido:       queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user.id] });
  // Removido:       queryClient.invalidateQueries({ queryKey: ["recurringEntries", user.id] });
  // Removido:       queryClient.invalidateQueries({ queryKey: ["revenues", user.id] });
  // Removido:       queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user.id] });
  // Removido:       console.log("handleToggleStatus: Queries invalidated for recurring transaction.");
  // Removido:     } catch (error) {
  // Removido:       console.error("handleToggleStatus: Error marking recurring month paid:", error);
  // Removido:     }
  // Removido:     return; // EXIT HERE FOR ALL RECURRING TRANSACTIONS
  // Removido:   }

  // Removido:   // Priority 2: Handle ONE-OFF transactions (legacy fixed are now filtered out in useTransactionsData)
  // Removido:   console.log("handleToggleStatus: Handling as one-off transaction.");
  // Removido:   let error = null;
  // Removido:   const newStatus = transaction.status === "Recebida" ? "Pendente" : "Recebida";
  // Removido:   const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

  // Removido:   if (transaction.type === "income") {
  // Removido:     // For one-off income, transaction.id is always the UUID of the 'receitas' entry.
  // Removido:     const revenueIdToUse = transaction.id;
  // Removido:     if (!isValidUuid(revenueIdToUse)) {
  // Removido:       // This should ideally not happen if data is clean and filtered correctly.
  // Removido:       toast.error("Erro (TOGGLE-INC-1): ID de receita inválido.");
  // Removido:       return;
  // Removido:     }
  // Removido:     const { error: updateError } = await supabase
  // Removido:       .from("receitas")
  // Removido:       .update({ status: newStatus })
  // Removido:       .eq("id", revenueIdToUse)
  // Removido:       .eq("user_id", user.id); // CORRIGIDO: de "user.id" para "user_id"
  // Removido:     error = updateError;

  // Removido:     if (!error) {
  // Removido:       queryClient.setQueryData(["revenues", user.id], (oldData: Tables<'receitas'>[] | undefined) => {
  // Removido:         if (!oldData) return [];
  // Removido:         return oldData.map(r => r.id === revenueIdToUse ? { ...r, status: newStatus } : r);
  // Removido:       });
  // Removido:       queryClient.invalidateQueries({ queryKey: ["revenues", user.id] }); // Invalida a query de receitas
  // Removido:     }
  // Removido:   } else if (transaction.type === "expense") {
  // Removido:     // For one-off expense, transaction.id is always the ID of a 'despesas_parcelas' entry.
  // Removido:     const isPaid = newStatus === "Recebida";
  // Removido:     const dataPagamento = isPaid ? currentTimestamp : null;
  // Removido:     const installmentId = transaction.id;

  // Removido:     if (!isValidUuid(installmentId)) {
  // Removido:       // This should ideally not happen if data is clean and filtered correctly.
  // Removido:       toast.error("Erro (TOGGLE-EXP-1): ID de parcela de despesa inválido.");
  // Removido:       return;
  // Removido:     }

  // Removido:     const { error: updateError } = await supabase
  // Removido:       .from("despesas_parcelas")
  // Removido:       .update({
  // Removido:         pago: isPaid,
  // Removido:         data_pagamento: dataPagamento,
  // Removido:       })
  // Removido:       .eq("id", installmentId);
  // Removido:     error = updateError;

  // Removido:     if (!error) {
  // Removido:       queryClient.setQueryData(["expenseInstallments", user.id], (oldData: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[] | undefined) => {
  // Removido:         if (!oldData) return [];
  // Removido:         return oldData.map(p => p.id === installmentId ? { ...p, pago: isPaid, data_pagamento: dataPagamento } : p);
  // Removido:       });
  // Removido:       queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user.id] }); // Invalida a query de parcelas
  // Removido:     }
  // Removido:   }
  
  // Removido:   if (error) {
  // Removido:     toast.error("Erro ao atualizar status", { description: error.message });
  // Removido:     console.error("handleToggleStatus: Status update error:", error);
  // Removido:   } else {
  // Removido:     toast.success("Status atualizado!", {
  // Removido:       style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
  // Removido:     });
  // Removido:   }
  // Removido: };

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
        {/* Apenas exibe o ícone de status, sem o botão de toggle */}
        <div className="flex items-center justify-center">
          {transaction.status === "Recebida" && <DynamicIcon name="CheckCircle" className="h-4 w-4 text-success" />}
          {(transaction.status === "Pendente" || transaction.status === "Prevista") && <DynamicIcon name="Circle" className="h-4 w-4 text-destructive" />}
          {transaction.status === "Cancelada" && <DynamicIcon name="XCircle" className="h-4 w-4 text-muted-foreground" />}
        </div>
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