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
import { useRecurringEntries, MaterializedRecurringTransaction } from "@/hooks/useRecurringEntries";

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
  user,
}) => {
  console.log("TransactionRow: Rendering for transaction ID:", transaction.id, "Current Status (on render):", transaction.status);

  const { markMonthPaid } = useRecurringEntries(user, new Date(), []);

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

  // A função handleToggleStatus não será mais necessária aqui, pois o botão de status foi removido.
  // No entanto, a lógica de atualização de status ainda pode ser acessada através do formulário de edição.

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
      {/* REMOVIDO: Célula de Status */}
      {/*
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
      */}
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