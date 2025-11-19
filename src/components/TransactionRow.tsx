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
  allCategories: AppCategory[]; // Agora contém apenas subcategorias
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  markMonthPaid: ReturnType<typeof useRecurringEntries>['markMonthPaid']; // Re-adicionado
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
  allCategories, // Usar allCategories diretamente (já são subcategorias)
  cartoes,
  isMobile,
  queryClient,
  user,
  markMonthPaid, // Re-adicionado
}) => {
  console.log("TransactionRow: Rendering for transaction ID:", transaction.id, "Type:", transaction.type, "IsRecurring:", transaction.isRecurring, "Current Status (on render):", transaction.status);

  const getCategoryDisplay = (categoryId: string) => {
    const category = allCategories.find(cat => cat.id === categoryId);
    // Como agora só temos subcategorias, não precisamos mais da hierarquia "Pai > Filho"
    return { name: category?.nome || categoryId, icon: category?.icone || null };
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
    console.log("handleToggleStatus: START for transaction ID:", transaction.id, "Current Status (before toggle logic):", transaction.status);
    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      return;
    }

    if (!queryClient) {
      console.error("queryClient is undefined in handleToggleStatus!");
      toast.error("Erro interno: Cliente de consulta não disponível.");
      return;
    }

    if (transaction.isRecurring && transaction.recurringEntryId) {
      console.log("handleToggleStatus: Identified as recurring transaction. Transaction object:", transaction);
      const transactionDate = new Date(transaction.date);
      const year = transactionDate.getFullYear();
      const month = transactionDate.getMonth() + 1;
      const isPaid = transaction.status !== "Recebida"; // Toggle logic: if currently 'Recebida', set to false (Pendente), else set to true (Recebida)
      console.log("handleToggleStatus: Toggling recurring status. Target isPaid:", isPaid, "for recurring ID:", transaction.recurringEntryId, "Month (1-indexed):", month, "Year:", year);

      try {
        await markMonthPaid({
          recurring_id: transaction.recurringEntryId,
          year,
          month,
          is_paid: isPaid,
        });
        console.log("handleToggleStatus: markMonthPaid call AWAITED. Mutation should be in progress/completed.");
      } catch (error) {
        console.error("handleToggleStatus: Error marking recurring month paid:", error);
        toast.error("Erro ao atualizar status de lançamento recorrente.");
      }
      return;
    }

    console.log("handleToggleStatus: Handling as one-off transaction.");
    let error = null;
    const newStatus = transaction.status === "Recebida" ? "Pendente" : "Recebida";
    const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    if (transaction.type === "income") {
      const revenueIdToUse = transaction.id;
      if (!isValidUuid(revenueIdToUse)) {
        toast.error("Erro (TOGGLE-INC-1): ID de receita inválido.");
        return;
      }
      const { error: updateError } = await supabase
        .from("receitas")
        .update({ status: newStatus })
        .eq("id", revenueIdToUse)
        .eq("user_id", user.id); // Corrigido para user.id
      error = updateError;

      if (!error) {
        queryClient.setQueryData(["revenues", user.id], (oldData: Tables<'receitas'>[] | undefined) => {
          if (!oldData) return [];
          return oldData.map(r => r.id === revenueIdToUse ? { ...r, status: newStatus } : r);
        });
        queryClient.invalidateQueries({ queryKey: ["revenues", user.id] });
      }
    } else if (transaction.type === "expense") {
      const isPaid = newStatus === "Recebida";
      const dataPagamento = isPaid ? currentTimestamp : null;
      const installmentId = transaction.id;

      if (!isValidUuid(installmentId)) {
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
        queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user.id] });
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

  const transactionDate = new Date(transaction.date);
  const currentYear = transactionDate.getFullYear();
  const currentMonth = transactionDate.getMonth() + 1; // Mês 1-indexado

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
      {!isMobile && (
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
        {categoryIcon && <DynamicIcon name={categoryIcon} className="h-4 w-4" />} {/* Usar DynamicIcon */}
        <span>{categoryName}</span>
      </TableCell>
      {!isMobile && (
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
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleToggleStatus}
          disabled={transaction.status === "Cancelada"}
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