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
import { Pencil, Trash2, Check, Clock, Circle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
          transaction.status === "Recebida" ? "border-l-4 border-l-success" : "border-l-4 border-l-[#FF8888]"
        )}
      >
        <div className="flex flex-col w-full gap-1">
          {/* 📌 PRIMEIRA LINHA: Data, Subcategoria e Valor */}
          <div className="flex items-start justify-between w-full">
            <div className="flex items-start gap-3 min-w-0">
              {/* Data */}
              <span className="text-[0.72rem] text-gray-600 font-black whitespace-nowrap min-w-[38px] text-center pt-0.5">
                {format(transactionDate, "dd", { locale: ptBR })}/
                {format(transactionDate, "MMM", { locale: ptBR }).charAt(0).toUpperCase() + format(transactionDate, "MMM", { locale: ptBR }).slice(1).replace(".", "")}
              </span>
              {/* Subcategoria */}
              <span className="font-bold text-gray-800 text-[0.85rem] leading-tight truncate">
                {categoryName}
              </span>
            </div>
            {/* Valor */}
            <span className={cn(
              "font-extrabold text-sm tracking-tight whitespace-nowrap leading-tight pt-0.5",
              transaction.type === 'income' ? "text-success" : "text-destructive"
            )}>
              {transaction.type === 'income' ? "+" : "-"} {formatCurrency(transaction.amount, false)}
            </span>
          </div>

          {/* 📌 SEGUNDA LINHA: Ícone, Descrição e Status */}
          <div className="flex items-start justify-between w-full">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Ícone (abaixo da data) */}
              <div className={cn(
                "flex items-center justify-center h-4 w-4 shrink-0 min-w-[38px]",
                transaction.type === 'income' ? "text-success" : "text-destructive"
              )}>
                <DynamicIcon
                  name={categoryIcon || (transaction.type === 'income' ? 'TrendingUp' : 'TrendingDown')}
                  className="h-3.5 w-3.5"
                />
              </div>
              {/* Descrição */}
              <div className="min-w-0 flex-1">
                {transaction.description && (
                  <span className="text-[0.75rem] text-gray-400 line-clamp-1 italic truncate block">
                    {transaction.description}
                  </span>
                )}
              </div>
            </div>

            {/* Status Group (Label + Botão) */}
            <div className="flex items-center gap-0.5 shrink-0 ml-3">
              <span className={cn(
                "text-[0.75rem] tracking-tight",
                transaction.status === "Recebida"
                  ? "text-[#25D366] font-extrabold"
                  : "text-[#FF8888] font-medium"
              )}>
                {transaction.status === "Recebida"
                  ? (transaction.type === "income" ? "RECEBIDO" : "PAGO")
                  : "Pendente"}
              </span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus(transaction.id, transaction.type, newStatus);
                }}
                className={cn(
                  "h-[18px] w-[18px] rounded-full flex items-center justify-center transition-all relative",
                  transaction.status === "Recebida"
                    ? "bg-[#25D366] border border-[#25D366] shadow-sm"
                    : "bg-transparent border-none shadow-none"
                )}
              >
                {transaction.status === "Recebida" ? (
                  <Check className="absolute text-white w-[14px] h-[14px]" strokeWidth={4} />
                ) : (
                  <Circle className="absolute text-[#FF8888] w-[16px] h-[16px]" strokeWidth={2.5} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div >
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
          "inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border",
          transaction.type === "income"
            ? "bg-success/10 text-success border-success/20"
            : "bg-destructive/10 text-destructive border-destructive/20"
        )}>
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
            "mx-auto flex items-center justify-center rounded-full cursor-pointer select-none transition-all border shadow-sm relative",
            transaction.status === "Recebida"
              ? "bg-[#25D366] border-[#25D366] h-[18px] w-[18px]"
              : "bg-[#FEF3C7] border-[#FEF3C7] h-[18px] w-[18px]"
          )}
        >
          {transaction.status === "Recebida" ? (
            <Check className="absolute text-white w-[14px] h-[14px]" strokeWidth={4} />
          ) : (
            <Clock className="absolute text-[#D97706] w-[14px] h-[14px]" strokeWidth={4} />
          )}
        </div>
      </TableCell>

      {/* 📌 AÇÕES */}
      <TableCell className="py-4 px-4 text-center font-roboto">
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-2"
        >
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir esta {transaction.type === 'income' ? 'receita' : 'despesa'}? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTransaction(transaction.id, transaction.type, "oneOff");
                  }}
                  className="bg-destructive text-white hover:bg-destructive/90 rounded-xl border-none"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default memo(TransactionRow);