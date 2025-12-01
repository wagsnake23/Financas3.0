import React, { memo } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

type ReceitaStatus = Database["public"]["Enums"]["receita_status"];

interface TransactionRowProps {
  transaction: Transaction;
  onDeleteTransaction: (id: string, type: "income" | "expense") => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<"cartoes">[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  onToggleStatus: (
    id: string,
    type: TransactionType,
    newStatus: ReceitaStatus
  ) => void;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  onToggleStatus,
}) => {
  const category = allCategories.find((cat) => cat.id === transaction.category);
  const categoryName = category?.nome || transaction.category;
  const categoryIcon = category?.icone || null;

  const currentStatus: ReceitaStatus = transaction.status || "Pendente";
  const newStatus: ReceitaStatus =
    currentStatus === "Recebida" ? "Pendente" : "Recebida";

  const transactionDate = (() => {
    const [y, m, d] = transaction.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

  return (
    <TableRow
      className={cn(
        "cursor-pointer hover:bg-soft-blue/30",
        transaction.status === "Recebida" &&
          "bg-soft-green/30 hover:bg-soft-green/50",
        transaction.status === "Cancelada" &&
          "bg-muted/20 hover:bg-muted/40 text-muted-foreground"
      )}
      onClick={() => onEditTransaction(transaction)}
    >
      {/* 📌 DATA */}
      <TableCell
        className={cn(
          "py-2 px-2 text-left",
          isMobile ? "min-w-[55px] text-sm" : "min-w-[70px] text-base"
        )}
      >
        {format(transactionDate, isMobile ? "dd/MMM" : "dd/MM/yyyy", {
          locale: ptBR,
        })}
      </TableCell>

      {/* 📌 SUBCATEGORIA */}
      <TableCell
        className={cn(
          "py-2 px-2 flex items-center gap-1 text-left",
          isMobile ? "min-w-[85px] text-sm" : "min-w-[90px] text-base"
        )}
      >
        {categoryIcon && (
          <DynamicIcon
            name={categoryIcon}
            className={cn("h-4 w-4", isMobile && "h-4 w-4")}
          />
        )}
        {categoryName}
      </TableCell>

      {/* 📌 VALOR */}
      <TableCell
        className={cn(
          "py-2 px-2 text-right font-semibold",
          isMobile ? "min-w-[75px] text-xs" : "min-w-[90px] text-base",
          transaction.type === "income" ? "text-success" : "text-destructive"
        )}
      >
        {formatCurrency(transaction.amount)}
      </TableCell>

      {/* 🔥 BOTÃO DE STATUS ATUALIZADO */}
      <TableCell
        className={cn(
          "py-2 px-2 text-center",
          isMobile ? "min-w-[25px]" : "min-w-[45px]"
        )}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(transaction.id, transaction.type, newStatus);
          }}
          className={cn(
            "flex items-center justify-center rounded-full cursor-pointer select-none transition-all",

            // Pago → ✓ branco mais forte + tamanho maior
            transaction.status === "Recebida" &&
              "bg-[#44E37F] border border-[#44E37F] text-white font-extrabold" +
                (isMobile
                  ? " h-[17px] w-[17px] text-[10px]"
                  : " h-[21px] w-[21px] text-[12px]"),

            // Pendente → só borda vermelha, fundo transparente e sem ícone
            (transaction.status === "Pendente" ||
              transaction.status === "Prevista") &&
              "bg-transparent border border-destructive text-transparent" +
                (isMobile ? " h-[17px] w-[17px]" : " h-[21px] w-[21px]")
          )}
        >
          {transaction.status === "Recebida" ? "✓" : ""}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default memo(TransactionRow);
