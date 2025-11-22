import React, { memo } from "react"; // Removido useState
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn, isValidUuid } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  onDeleteTransaction: (
    id: string,
    type: "income" | "expense",
    deleteScope: "thisMonth" | "thisMonthForward" | "all" | "oneOff" // Corrigido o tipo da prop
  ) => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<"cartoes">[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  queryClient,
  user,
  // onDeleteTransaction não é usado diretamente aqui, mas o tipo foi corrigido
}) => {
  // Removido: const [loadingToggle, setLoadingToggle] = useState(false); // Novo estado de carregamento para o toggle

  const getCategoryDisplay = (categoryId: string) => {
    const category = allCategories.find((cat) => cat.id === categoryId);
    return {
      name: category?.nome || categoryId,
      icon: category?.icone || null,
    };
  };

  const { name: categoryName, icon: categoryIcon } = getCategoryDisplay(
    transaction.category
  );

  const getPaymentMethodDisplay = (
    formaPagamento: string | null,
    cartaoId: string | null
    ) => {
    if (!formaPagamento) return null;

    switch (formaPagamento) {
      case "dinheiro":
        return "Dinheiro";
      case "pix":
        return "PIX";
      case "boleto":
        return "Boleto";
      case "cartao":
        const card = cartoes.find((c) => c.id === cartaoId);
        return card
          ? `Cartão: ${card.nome} (****${card.ultimos_digitos})`
          : "Cartão";
      default:
        return formaPagamento;
    }
  };

  const paymentMethodDisplay = getPaymentMethodDisplay(
    transaction.forma_pagamento,
    transaction.cartao_id
  );

  const handleToggleStatus = async () => {
    console.log("handleToggleStatus: Clicked for transaction ID:", transaction.id);
    if (!user) {
      toast.error("Usuário não autenticado.");
      console.error("handleToggleStatus: User not authenticated.");
      return;
    }

    // Removido: setLoadingToggle(true);
    // Removido: console.log("handleToggleStatus: Setting loadingToggle to true.");

    const newStatus =
      transaction.status === "Recebida" ? "Pendente" : "Recebida";
    const newPago = newStatus === "Recebida";
    console.log("handleToggleStatus: New status will be:", newStatus);

    // --- OPTIMISTIC UPDATE START ---
    const previousRevenues = queryClient.getQueryData<Tables<"receitas">[]>(["revenues", user.id]);
    const previousExpenseInstallments = queryClient.getQueryData<(Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[]>(["expenseInstallments", user.id]);

    if (transaction.type === "income") {
      queryClient.setQueryData<Tables<"receitas">[]>(["revenues", user.id], (oldData) => {
        if (!oldData) return [];
        return oldData.map(r => r.id === transaction.id ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r);
      });
    } else { // expense
      queryClient.setQueryData<(Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[]>(["expenseInstallments", user.id], (oldData) => {
        if (!oldData) return [];
        return oldData.map(p => p.id === transaction.id ? { ...p, pago: newPago, data_pagamento: newPago ? new Date().toISOString() : null, updated_at: new Date().toISOString() } : p);
      });
    }
    // --- OPTIMISTIC UPDATE END ---

    try {
      if (transaction.type === "income") {
        console.log("handleToggleStatus: Updating income transaction.");
        // Para receita recorrente, apenas atualiza o status desta ocorrência específica
        if (transaction.recurrence_id && !transaction.is_recurring_master) {
          console.log("handleToggleStatus: Updating specific recurring income occurrence.");
          const { error } = await supabase
            .from("receitas")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", transaction.id)
            .eq("user_id", user.id);

          if (error) throw error;
        } else { // Receita avulsa ou mestra recorrente
          console.log("handleToggleStatus: Updating one-off income or recurring master.");
          const { error } = await supabase
            .from("receitas")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", transaction.id)
            .eq("user_id", user.id);

          if (error) throw error;
        }
        toast.success("Status da receita atualizado!");
        console.log("handleToggleStatus: Income status updated successfully. Invalidating and refetching queries...");
        // Não aguardar o invalidate/refetch para liberar o loadingToggle mais rápido
        queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
        queryClient.refetchQueries({ queryKey: ["revenues", user?.id] }); 
        console.log("handleToggleStatus: Income queries invalidated and refetched (in background).");
      } else { // expense
        console.log("handleToggleStatus: Updating expense installment.");
        const dataPagamento = newPago
          ? format(new Date(), "yyyy-MM-dd HH:mm:ss")
          : null;

        const { error } = await supabase
          .from("despesas_parcelas")
          .update({
            pago: newPago,
            data_pagamento: dataPagamento,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        if (error) throw error;
        toast.success("Status da despesa atualizado!");
        console.log("handleToggleStatus: Expense status updated successfully. Invalidating and refetching queries...");
        // Não aguardar o invalidate/refetch para liberar o loadingToggle mais rápido
        queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
        queryClient.refetchQueries({ queryKey: ["expenseInstallments", user?.id] });
        console.log("handleToggleStatus: Expense queries invalidated and refetched (in background).");
      }
      
    } catch (error: any) {
      console.error("handleToggleStatus: Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status.", { description: error.message });
      // --- OPTIMISTIC ROLLBACK START ---
      if (transaction.type === "income") {
        queryClient.setQueryData(["revenues", user.id], previousRevenues);
      } else {
        queryClient.setQueryData(["expenseInstallments", user.id], previousExpenseInstallments);
      }
      // --- OPTIMISTIC ROLLBACK END ---
    } finally {
      // Removido: setLoadingToggle(false);
      // Removido: console.log("handleToggleStatus: Setting loadingToggle to false (finally block).");
    }
  };

  const transactionDate = (() => {
    const [y, m, d] = transaction.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

  return (
    <TableRow
      key={transaction.id}
      className={cn(
        transaction.status === "Recebida" &&
          "bg-soft-green/30 hover:bg-soft-green/50",
        (transaction.status === "Pendente" ||
          transaction.status === "Prevista") &&
          "bg-soft-red/30 hover:bg-soft-red/50",
        transaction.status === "Cancelada" &&
          "bg-muted/20 hover:bg-muted/40 text-muted-foreground"
      )}
    >
      {/* DATA */}
      <TableCell className={cn("py-2 px-2 text-xs", isMobile ? "min-w-[55px]" : "min-w-[70px]")}>
        {isMobile
          ? format(transactionDate, "dd/MMM", { locale: ptBR })
          : transactionDate.toLocaleDateString("pt-BR")}
      </TableCell>

      {/* TIPO */}
      {!isMobile && (
        <TableCell className="py-2 px-2 text-xs min-w-[60px]">
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
              transaction.type === "income"
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {transaction.type === "income" ? "Receita" : "Despesa"}
          </span>
        </TableCell>
      )}

      {/* SUBCATEGORIA */}
      <TableCell className={cn("py-2 px-2 text-xs flex items-center gap-1", isMobile ? "min-w-[35px]" : "min-w-[80px]")}>
        {categoryIcon && (
          <DynamicIcon name={categoryIcon} className="h-4 w-4" />
        )}
        <span>{categoryName}</span>
      </TableCell>

      {/* DESCRIÇÃO */}
      {!isMobile && (
        <TableCell className="py-2 px-2 text-xs min-w-[100px]">
          {transaction.installmentNumber &&
          transaction.totalInstallments &&
          transaction.totalInstallments > 1
            ? `Parcela ${transaction.installmentNumber} de ${transaction.totalInstallments}`
            : transaction.description || "-"}

          {paymentMethodDisplay && (
            <span className="block text-xs text-muted-foreground mt-0.5">
              {paymentMethodDisplay}
            </span>
          )}
        </TableCell>
      )}

      {/* VALOR */}
      <TableCell
        className={`py-2 px-2 text-right font-semibold text-xs min-w-[80px] ${
          transaction.type === "income"
            ? "text-success"
            : "text-destructive"
        }`}
      >
        {transaction.type === "income" ? "+" : "-"}
        R$ {transaction.amount.toFixed(2)}
      </TableCell>

      {/* TOGGLE */}
      <TableCell className={cn("py-2 px-2 text-center", isMobile ? "min-w-[35px]" : "min-w-[50px]")}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleToggleStatus}
          disabled={transaction.status === "Cancelada"} // Removido disabled={loadingToggle}
        >
          {/* Removido o condicional para loadingToggle, agora sempre mostra o ícone de status */}
          {transaction.status === "Recebida" ? (
            <DynamicIcon name="CheckCircle" className="h-4 w-4 text-success" />
          ) : (transaction.status === "Pendente" ||
            transaction.status === "Prevista") ? (
            <DynamicIcon name="Circle" className="h-4 w-4 text-destructive" />
          ) : (
            <DynamicIcon
              name="XCircle"
              className="h-4 w-4 text-muted-foreground"
            />
          )}
        </Button>
      </TableCell>

      {/* AÇÕES */}
      <TableCell className={cn("py-2 px-2 text-right", isMobile ? "min-w-[40px]" : "min-w-[50px]")}>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEditTransaction(transaction)}
            // Removido disabled={loadingToggle}
          >
            <DynamicIcon name="Pencil" className="h-3.5 w-3.5 text-primary" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default memo(TransactionRow);