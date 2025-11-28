import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn, isValidUuid, formatCurrency } from "@/lib/utils"; // Importar formatCurrency
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types"; // Importar Database para ReceitaStatus

type ReceitaStatus = Database['public']['Enums']['receita_status'];

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
    type: "income" | "expense"
  ) => void;
  onEditTransaction: (transaction: Transaction) => void; // NOVA PROP
  allCategories: AppCategory[];
  cartoes: Tables<"cartoes">[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  onToggleStatus: (id: string, type: TransactionType, newStatus: ReceitaStatus) => void;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onEditTransaction, // Destruturar a prop
  allCategories,
  cartoes,
  isMobile,
  queryClient,
  user,
  onToggleStatus,
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

  // Lógica de toggle de status movida para o hook useLancamentosLogic
  const currentStatus: ReceitaStatus = transaction.status || "Pendente"; // Garante um status padrão
  const newStatus: ReceitaStatus = currentStatus === "Recebida" ? "Pendente" : "Recebida";


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
        transaction.status === "Cancelada" &&
          "bg-muted/20 hover:bg-muted/40 text-muted-foreground",
        "cursor-pointer", // Adiciona cursor de ponteiro para indicar clicável
        "hover:bg-soft-blue/30" // Adiciona a cor de fundo azul suave ao passar o mouse
      )}
      onClick={() => onEditTransaction(transaction)} // Adiciona o handler de clique na linha
    >
      {/* DATA */}
      <TableCell className={cn("py-2 px-2 text-left", isMobile ? "min-w-[55px] text-sm" : "min-w-[70px] text-base")}>
        {isMobile
          ? format(transactionDate, "dd/MMM", { locale: ptBR })
          : transactionDate.toLocaleDateString("pt-BR")}
      </TableCell>

      {/* TIPO */}
      {!isMobile && (
        <TableCell className="py-2 px-2 text-center min-w-[60px] text-base">
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
      <TableCell className={cn("py-2 px-2 flex items-center gap-1 text-left", isMobile ? "min-w-[80px] text-sm" : "min-w-[80px] text-base")}>
        {categoryIcon && (
          <DynamicIcon name={categoryIcon} className={cn("h-4 w-4", isMobile && "h-4 w-4")} />
        )}
        <span>{categoryName}</span>
      </TableCell>

      {/* DESCRIÇÃO */}
      {!isMobile && (
        <TableCell className="py-2 text-left min-w-[100px] text-base"> {/* Removido pl-8 */}
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
        className={cn(
          "py-2 px-2 text-right font-semibold",
          isMobile ? "min-w-[80px] text-sm" : "min-w-[80px] text-base",
          transaction.type === "income"
            ? "text-success"
            : "text-destructive"
        )}
      >
        {transaction.type === "income" ? "+" : "-"}
        {isMobile ? formatCurrency(transaction.amount).replace("R$", "").trim() : formatCurrency(transaction.amount)}
      </TableCell>

      {/* TOGGLE */}
      <TableCell className={cn("py-2 px-2 text-center", isMobile ? "min-w-[35px]" : "min-w-[50px]")}>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", isMobile && "h-8 w-8")}
          onClick={(e) => {
            e.stopPropagation(); // Impede que o clique na linha seja acionado
            onToggleStatus(transaction.id, transaction.type, newStatus);
          }}
          disabled={transaction.status === "Cancelada"}
        >
          {transaction.status === "Recebida" && (
            <DynamicIcon name="CheckCircle" className={cn("h-4 w-4", isMobile && "h-5 w-5 text-success")} />
          )}
          {(transaction.status === "Pendente" ||
            transaction.status === "Prevista") && (
            <DynamicIcon name="Circle" className={cn("h-4 w-4", isMobile && "h-5 w-5 text-destructive")} />
          )}
          {transaction.status === "Cancelada" && (
            <DynamicIcon
              name="XCircle"
              className={cn("h-4 w-4", isMobile && "h-5 w-5 text-muted-foreground")}
            />
          )}
        </Button>
      </TableCell>

      {/* AÇÕES - Ocultado em mobile */}
      {!isMobile && (
        <TableCell className={cn("py-2 px-2 text-center", "min-w-[50px]")}>
          <div className="flex justify-center gap-1"> {/* Alterado para justify-center */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation(); // Impede que o clique na linha seja acionado
                onEditTransaction(transaction);
              }}
            >
              <DynamicIcon name="Pencil" className="h-3.5 w-3.5 text-primary" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
};

export default memo(TransactionRow);