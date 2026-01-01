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
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

type ReceitaStatus = Database["public"]["Enums"]["receita_status"];

interface TransactionRowProps {
  transaction: Transaction;
  onDeleteTransaction: (id: string, type: "income" | "expense", deleteScope: "thisMonth" | "thisMonthForward" | "all" | "oneOff") => void;
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
  onDeleteTransaction,
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

  if (isMobile) {
    return (
      <div
        onClick={() => onEditTransaction(transaction)}
        className={cn(
          "bg-white rounded-2xl py-2.5 px-4 shadow-sm border border-gray-100 flex items-center justify-between mb-2 animate-fade-in active:bg-gray-50 transition-all",
          transaction.status === "Recebida" ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive/30"
        )}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <div className={cn(
            "flex items-center justify-center shrink-0",
            transaction.type === 'income' ? "text-success" : "text-destructive"
          )}>
            <DynamicIcon
              name={categoryIcon || (transaction.type === 'income' ? 'TrendingUp' : 'TrendingDown')}
              className="h-5 w-5"
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-bold text-gray-800 text-[0.95rem] leading-tight text-left truncate">
              {categoryName}
            </span>
            <div className="flex flex-col items-start text-left">
              <span className="text-[0.7rem] text-muted-foreground font-medium uppercase tracking-wider">
                {format(transactionDate, "dd 'de' MMM", { locale: ptBR })}
              </span>
              {transaction.description && (
                <span className="text-[0.75rem] text-gray-500 line-clamp-1 italic text-left truncate w-full">
                  {transaction.description}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0 ml-3">
          <span className={cn(
            "font-extrabold text-sm tracking-tight whitespace-nowrap",
            transaction.type === 'income' ? "text-success" : "text-destructive"
          )}>
            {transaction.type === 'income' ? "+" : "-"} {formatCurrency(transaction.amount, true)}
          </span>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(transaction.id, transaction.type, newStatus);
            }}
            className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center transition-all border-2 shadow-sm",
              transaction.status === "Recebida"
                ? "bg-success border-success text-white scale-110"
                : "bg-white border-gray-200 text-transparent hover:border-success/50"
            )}
          >
            {transaction.status === "Recebida" ? (
              <span className="text-[12px] font-black">✓</span>
            ) : (
              <div className="h-1 w-1 rounded-full bg-gray-200" />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <TableRow
      className={cn(
        "group cursor-pointer transition-colors border-b border-gray-50",
        transaction.status === "Recebida" ? "bg-success/[0.02] hover:bg-success/[0.05]" : "hover:bg-gray-50/80"
      )}
      onClick={() => onEditTransaction(transaction)}
    >
      {/* 📌 DATA */}
      <TableCell className="py-4 px-4 text-left font-medium text-gray-600 font-roboto">
        {format(transactionDate, "dd/MM/yyyy", { locale: ptBR })}
      </TableCell>

      {/* 📌 TIPO (Receita/Despesa) */}
      <TableCell className="py-4 px-4 text-center">
        <div className={cn(
          "inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border",
          transaction.type === "income"
            ? "bg-success/10 text-success border-success/20"
            : "bg-destructive/10 text-destructive border-destructive/20"
        )}>
          <DynamicIcon
            name={transaction.type === "income" ? "ArrowUpCircle" : "ArrowDownCircle"}
            className="h-3.5 w-3.5"
          />
          {transaction.type === "income" ? "Receita" : "Despesa"}
        </div>
      </TableCell>

      {/* 📌 CATEGORIA */}
      <TableCell className="py-4 px-4 text-left">
        <div className="flex items-center gap-2 font-semibold text-gray-700 font-roboto">
          <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-white transition-colors shadow-inner">
            {categoryIcon ? (
              <DynamicIcon name={categoryIcon} className="h-4 w-4" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-gray-300" />
            )}
          </div>
          {categoryName}
        </div>
      </TableCell>

      {/* 📌 DESCRIÇÃO */}
      <TableCell className="py-4 px-4 text-left text-gray-500 italic max-w-[200px] truncate font-roboto">
        {transaction.description || "-"}
      </TableCell>

      {/* 📌 VALOR */}
      <TableCell
        className={cn(
          "py-4 px-4 text-right font-bold text-base tracking-tight font-roboto",
          transaction.type === "income" ? "text-success" : "text-destructive"
        )}
      >
        {formatCurrency(transaction.amount, true)}
      </TableCell>

      {/* 📌 STATUS */}
      <TableCell className="py-4 px-4 text-center font-roboto">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(transaction.id, transaction.type, newStatus);
          }}
          className={cn(
            "mx-auto flex items-center justify-center rounded-full cursor-pointer select-none transition-all border-2 shadow-sm",
            transaction.status === "Recebida"
              ? "bg-success border-success text-white h-[24px] w-[24px] scale-110 shadow-success/20"
              : "bg-white border-gray-200 text-transparent h-[24px] w-[24px] hover:border-success/50"
          )}
        >
          {transaction.status === "Recebida" ? (
            <span className="text-[12px] font-black">✓</span>
          ) : (
            <div className="h-1.5 w-1.5 rounded-full bg-gray-200" />
          )}
        </div>
      </TableCell>

      {/* 📌 AÇÕES */}
      <TableCell className="py-4 px-4 text-center font-roboto">
        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEditTransaction(transaction);
            }}
            className="h-9 w-9 text-primary hover:bg-primary/10 rounded-xl"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTransaction(transaction.id, transaction.type, "oneOff");
            }}
            className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default memo(TransactionRow);