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
import { SquarePen, Trash2, Check, Clock } from "lucide-react";
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
    const formattedDate = (() => {
      try {
        const day = format(transactionDate, "dd", { locale: ptBR });
        const mmmRaw = format(transactionDate, "MMM", { locale: ptBR });
        const mmm = mmmRaw.charAt(0).toUpperCase() + mmmRaw.slice(1).replace(".", "");
        return `${day} ${mmm}`;
      } catch (e) {
        return "";
      }
    })();

    const paymentDetails = (() => {
      const fp = transaction.forma_pagamento;
      if (fp === "cartao") {
        const cartao = cartoes.find(c => c.id === transaction.cartao_id);
        return {
          icon: "💳",
          name: cartao ? cartao.nome : "Cartão"
        };
      } else if (fp === "pix") {
        return {
          icon: "📲",
          name: "Pix"
        };
      } else if (fp === "dinheiro" || fp === "cash") {
        return {
          icon: "💰",
          name: "Dinheiro"
        };
      } else if (fp === "boleto") {
        return {
          icon: "📄",
          name: "Boleto"
        };
      } else if (fp === "debit") {
        return {
          icon: "💳",
          name: "Débito"
        };
      } else if (fp === "credit") {
        return {
          icon: "💳",
          name: "Crédito"
        };
      } else if (fp) {
        const name = fp.charAt(0).toUpperCase() + fp.slice(1);
        return {
          icon: "💳",
          name
        };
      }
      return {
        icon: "",
        name: ""
      };
    })();

    const isFixo = transaction.type === "expense" && transaction.tipo_pagamento === "fixo";
    const isParcelado = !isFixo && !!(transaction.installmentNumber && transaction.totalInstallments && transaction.totalInstallments > 1);
    const cardOrPaymentType = (() => {
      if (isFixo) {
        return "Fixo";
      }
      if (isParcelado) {
        const current = String(transaction.installmentNumber).padStart(2, '0');
        const total = String(transaction.totalInstallments).padStart(2, '0');
        return `${current}/${total}`;
      }
      if (transaction.type === 'income') {
        return "Receita";
      }
      const isDebit =
        transaction.forma_pagamento === "debit" ||
        category?.forma_pagamento === "debit" ||
        (transaction.forma_pagamento !== "cartao" && (transaction.forma_pagamento === "pix" || transaction.forma_pagamento === "dinheiro" || transaction.forma_pagamento === "cash"));

      return isDebit ? "Débito" : "Crédito";
    })();

    const categoryColor = category?.cor || "#6B7280";

    return (
      <div
        onClick={() => onEditTransaction(transaction)}
        className={cn(
          "rounded-[7px] py-[9px] px-3 shadow-sm border border-gray-100 flex items-center justify-between mb-2 animate-fade-in active:bg-gray-50 transition-all",
          transaction.status === "Recebida" ? "bg-success/[0.03] border-l-4 border-l-success" : "bg-white border-l-4 border-l-[#FF8888]"
        )}
      >
        <div className="flex flex-col w-full gap-1">
          {/* 📌 LINHA 1 (TOPO): Data, Forma Pagamento, Parcela/Tipo e Valor */}
          <div className="flex items-center justify-between w-full mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              {/* Data */}
              <span className="text-[13px] text-gray-600 font-medium whitespace-nowrap shrink-0">
                {formattedDate}
              </span>
              
              {/* Forma de Pagamento */}
              {paymentDetails.name && (
                <span className="text-[13px] text-gray-600 font-medium truncate">
                  {paymentDetails.name}
                </span>
              )}

              {/* Parcela ou Tipo */}
              {cardOrPaymentType && (
                <>
                  {paymentDetails.name && (
                    <span className="text-[13px] text-gray-400 shrink-0 mx-0.5">·</span>
                  )}
                  <span className={cn(
                    "text-[13px] shrink-0",
                    isFixo ? "text-[#6699EE] font-medium" :
                    isParcelado ? "text-purple-600/90 font-medium" : 
                    transaction.type === "income" ? "text-success/90 font-medium" : 
                    "text-gray-600 font-medium"
                  )}>
                    {cardOrPaymentType}
                  </span>
                </>
              )}
            </div>

            {/* Valor */}
            <span className={cn(
              "font-extrabold text-sm tracking-tight whitespace-nowrap leading-tight shrink-0",
              transaction.type === 'income'
                ? "text-success"
                : (transaction.status === "Recebida" ? "text-[#FF8888]/80" : "text-destructive")
            )}>
              {transaction.type === 'income' ? "+" : "-"} {formatCurrency(transaction.amount, false)}
            </span>
          </div>

          {/* 📌 LINHA 2 & 3: Ícone Subcategoria, Nome do Item, Descrição e Status */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Quadrado arredondado com fundo suave do ícone da subcategoria */}
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-[#F4F5F7]"
              >
                <DynamicIcon
                  name={categoryIcon || (transaction.type === 'income' ? 'TrendingUp' : 'TrendingDown')}
                  className="h-7 w-7"
                  style={{ color: categoryColor }}
                />
              </div>

              {/* Nome e Descrição */}
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-slate-700 text-[0.88rem] leading-tight truncate">
                  {categoryName}
                </span>
                {transaction.description && (
                  <span className="text-[0.75rem] text-slate-500 font-normal line-clamp-1 truncate mt-0.5">
                    {transaction.description}
                  </span>
                )}
              </div>
            </div>

            {/* Status (Pago ou Pendente) */}
            <div className="flex flex-col items-end shrink-0 ml-3 justify-center">
              <span className={cn(
                "text-[0.75rem] tracking-tight leading-none mb-1.5",
                transaction.status === "Recebida"
                  ? "text-[#10B955] font-extrabold"
                  : "text-[#FF8888] font-medium"
              )}>
                {transaction.status === "Recebida"
                  ? (transaction.type === "income" ? "Recebido" : "Pago")
                  : "Pendente"}
              </span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus(transaction.id, transaction.type, newStatus);
                }}
                className={cn(
                  "w-[38px] h-[20px] rounded-full p-[2px] transition-all duration-300 border cursor-pointer flex items-center",
                  transaction.status === "Recebida"
                    ? "bg-[#22C55E] border-transparent shadow-[inset_0_1px_3px_rgba(0,0,0,0.2),_0_1px_2px_rgba(34,197,94,0.4)]"
                    : "bg-[#E85454] border-transparent shadow-[inset_0_1px_3px_rgba(0,0,0,0.2),_0_1px_2px_rgba(232,84,84,0.35)]"
                )}
              >
                <div
                  className={cn(
                    "w-[16px] h-[16px] rounded-full transition-transform duration-300 bg-gradient-to-b from-white to-[#F9FAFB] shadow-[0_2px_3px_rgba(0,0,0,0.16),_0_1px_1px_rgba(0,0,0,0.08),_inset_0_1px_0_rgba(255,255,255,0.9)]",
                    transaction.status === "Recebida"
                      ? "translate-x-[16px]"
                      : "translate-x-0"
                  )}
                />
              </div>
            </div>
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
      <TableCell className="py-4 px-4 text-left text-gray-500 max-w-[200px] truncate font-roboto">
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
            <SquarePen className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                className="hidden h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className={cn(isMobile ? "dialog-mobile !pb-4" : "!pb-4")}>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir esta {transaction.type === 'income' ? 'receita' : 'despesa'}? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className={cn("flex flex-row gap-2", isMobile && "items-center justify-between")}>
                <AlertDialogCancel className={cn(
                  "flex-1 rounded-2xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11 mt-0",
                  isMobile && "h-12 text-lg"
                )} style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTransaction(transaction.id, transaction.type, "oneOff");
                  }}
                  className={cn(
                    "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                    isMobile && "h-12 text-lg"
                  )}
                  style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
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