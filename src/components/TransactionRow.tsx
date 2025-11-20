import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale"; // Importar ptBR para formatar a data
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js"; // Corrigido: de '=' para 'from'
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
    isFixed?: boolean
  ) => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<"cartoes">[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  markMonthPaid: any;
}

const isValidUuid = (uuid: string) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  queryClient,
  user,
  markMonthPaid,
}) => {
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
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }

    const newStatus =
      transaction.status === "Recebida" ? "Pendente" : "Recebida";

    try {
      // ---------------------------------------------
      // 🔁 RECORRENTE
      // ---------------------------------------------
      if (transaction.isRecurring && transaction.recurringEntryId) {
        const d = new Date(transaction.date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        await markMonthPaid({
          recurring_id: transaction.recurringEntryId,
          year,
          month,
          is_paid: newStatus === "Recebida",
        });
        toast.success("Status atualizado!");
        return; // Exit after successful recurring update
      }

      // ---------------------------------------------
      // 💸 AVULSA / PARCELADA
      // ---------------------------------------------
      if (transaction.type === "income") {
        const { error } = await supabase
          .from("receitas")
          .update({ status: newStatus })
          .eq("id", transaction.id)
          .eq("user_id", user.id);

        if (error) throw error; // Throw Supabase error
        queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
      } else { // expense
        const pago = newStatus === "Recebida";
        const dataPagamento = pago
          ? format(new Date(), "yyyy-MM-dd HH:mm:ss")
          : null;

        const { error } = await supabase
          .from("despesas_parcelas")
          .update({
            pago,
            data_pagamento: dataPagamento,
          })
          .eq("id", transaction.id);

        if (error) throw error; // Throw Supabase error
        queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
      }

      toast.success("Status atualizado!"); // Only show success if no error was thrown
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status.", { description: error.message }); // More specific error toast
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
      <TableCell className={cn("py-2 px-2 text-xs", isMobile ? "min-w-[60px]" : "min-w-[70px]")}>
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
      <TableCell className={cn("py-2 px-2 text-xs flex items-center gap-1", isMobile ? "min-w-[50px]" : "min-w-[80px]")}>
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
          disabled={transaction.status === "Cancelada"}
        >
          {transaction.status === "Recebida" && (
            <DynamicIcon name="CheckCircle" className="h-4 w-4 text-success" />
          )}
          {(transaction.status === "Pendente" ||
            transaction.status === "Prevista") && (
            <DynamicIcon name="Circle" className="h-4 w-4 text-destructive" />
          )}
          {transaction.status === "Cancelada" && (
            <DynamicIcon
              name="XCircle"
              className="h-4 w-4 text-muted-foreground"
            />
          )}
        </Button>
      </TableCell>

      {/* AÇÕES */}
      <TableCell className={cn("py-2 px-2 text-right", isMobile ? "min-w-[45px]" : "min-w-[50px]")}>
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