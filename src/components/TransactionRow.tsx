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
  isLastItem?: boolean;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onDeleteTransaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  onToggleStatus,
  isLastItem,
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
        const name = cartao ? cartao.nome : "Cartão";
        let icon = "💳";
        const lowerName = name.toLowerCase();
        if (lowerName.includes("pix")) {
          icon = "🪙";
        } else if (lowerName.includes("dinheiro") || lowerName.includes("cash")) {
          icon = "💵";
        } else if (lowerName.includes("boleto")) {
          icon = "🧾";
        } else if (lowerName.includes("conta") || lowerName.includes("banco") || lowerName.includes("bancária")) {
          icon = "🏦";
        }
        return {
          icon,
          name
        };
      } else if (fp === "pix") {
        return {
          icon: "🪙",
          name: "Pix"
        };
      } else if (fp === "dinheiro" || fp === "cash") {
        return {
          icon: "💵",
          name: "Dinheiro"
        };
      } else if (fp === "boleto") {
        return {
          icon: "🧾",
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
        let icon = "💳";
        const lowerName = name.toLowerCase();
        if (lowerName.includes("pix")) {
          icon = "🪙";
        } else if (lowerName.includes("dinheiro") || lowerName.includes("cash")) {
          icon = "💵";
        } else if (lowerName.includes("boleto")) {
          icon = "🧾";
        } else if (lowerName.includes("conta") || lowerName.includes("banco") || lowerName.includes("bancária")) {
          icon = "🏦";
        }
        return {
          icon,
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

    const formattedAmountStr = formatCurrency(transaction.amount, true);
    const amountParts = formattedAmountStr.split(/\s+/);
    const currencySymbol = amountParts.length > 1 ? amountParts[0] : "R$";
    const valueStr = amountParts.length > 1 ? amountParts.slice(1).join(" ") : formattedAmountStr;

    return (
      <div
        onClick={() => onEditTransaction(transaction)}
        className={cn(
          "py-[13px] flex flex-col justify-center animate-fade-in active:bg-gray-50 transition-colors bg-white",
          !isLastItem && "border-b border-slate-300"
        )}
        style={{
          paddingLeft: "clamp(18px, 4vw, 32px)",
          paddingRight: "clamp(18px, 4vw, 32px)",
        }}
      >
        <div className="grid grid-cols-[auto_1fr_auto] gap-x-[5px] gap-y-[2px] w-full items-center">
          
          {/* --- LINHA 1 --- */}
          {/* Data e Separador */}
          <div className="col-start-1 row-start-1 flex items-baseline gap-[5px] shrink-0">
            <span className="text-[13px] text-slate-700 font-medium whitespace-nowrap">
              {formattedDate}
            </span>
            <span className="text-[12px] text-slate-300 font-light">|</span>
          </div>
          
          {/* Pagamento e Parcela */}
          <div className="col-start-2 row-start-1 flex items-baseline gap-[5px] min-w-0">
            {paymentDetails.name && (
              <span className="text-[13px] text-slate-700 font-medium truncate">
                {paymentDetails.name}
              </span>
            )}
            {cardOrPaymentType && (
              <>
                {paymentDetails.name && (
                  <span className="text-[13px] text-slate-700 font-medium shrink-0">•</span>
                )}
                <span className="text-[13px] text-slate-700 font-medium shrink-0">
                  {cardOrPaymentType}
                </span>
              </>
            )}
          </div>

          {/* Valor */}
          <div className="col-start-3 row-start-1 flex items-baseline justify-end shrink-0">
            <span className={cn(
              "font-semibold tracking-tight whitespace-nowrap leading-none flex items-baseline gap-[3px]",
              transaction.type === 'income' ? "text-[#059669]" :
              transaction.status === "Recebida" ? "text-slate-500" : "text-[#E15A5A]"
            )}>
              <span className="text-[10.5px] font-medium opacity-[0.65]">{currencySymbol}</span>
              <span className={cn("text-[14px]", transaction.type !== 'income' && transaction.status === "Recebida" && "text-slate-700")}>
                {valueStr}
              </span>
            </span>
          </div>

          {/* --- LINHA 2 --- */}
          
          {/* Ícone da Categoria */}
          <div className="col-start-1 row-start-2 flex items-center justify-center h-[38px] w-full shrink-0">
            <DynamicIcon
              name={categoryIcon || (transaction.type === 'income' ? 'TrendingUp' : 'TrendingDown')}
              className="w-7 h-7 text-[24px] opacity-90 drop-shadow-sm"
              style={{ color: categoryColor }}
            />
          </div>

          {/* Título e Subtítulo */}
          <div className="col-start-2 row-start-2 flex flex-col min-w-0 justify-center -mt-[2px]">
            <span className="font-semibold text-slate-700 text-[14px] tracking-tight leading-[16px] truncate">
              {categoryName}
            </span>
            {transaction.description && (
              <span className="text-[12px] text-slate-400 font-normal line-clamp-1 truncate mt-[6px] leading-none">
                {transaction.description}
              </span>
            )}
          </div>

          {/* Status Toggle */}
          <div className="col-start-3 row-start-2 flex flex-col items-end shrink-0 ml-3 justify-center">
            <span className={cn(
              "text-[11px] tracking-wide leading-none mb-[5px] font-medium",
              transaction.status === "Recebida" ? "text-[#10B955]/70" : "text-slate-400"
            )}>
              {transaction.status === "Recebida" ? (transaction.type === "income" ? "Recebido" : "Pago") : "Pendente"}
            </span>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(transaction.id, transaction.type, newStatus);
              }}
              className={cn(
                "w-[38px] h-[19px] rounded-full p-[2px] transition-all duration-300 cursor-pointer flex items-center",
                transaction.status === "Recebida"
                  ? "bg-[#22C55E]/90"
                  : "bg-[#D6DCE5]"
              )}
            >
              <div
                className={cn(
                  "w-[15px] h-[15px] rounded-full transition-transform duration-300 bg-white",
                  transaction.status === "Recebida"
                    ? "translate-x-[19px]"
                    : "translate-x-0"
                )}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Desktop: Minicard horizontal ---
    const dFormattedDate = (() => {
      try {
        const day = format(transactionDate, "dd", { locale: ptBR });
        const mmmRaw = format(transactionDate, "MMM", { locale: ptBR });
        const mmm = mmmRaw.charAt(0).toUpperCase() + mmmRaw.slice(1).replace(".", "");
        const yyyy = format(transactionDate, "yyyy");
        return `${day} ${mmm} ${yyyy}`;
      } catch { return ""; }
    })();

    const dWeekday = (() => {
      try {
        const wd = format(transactionDate, "EEEE", { locale: ptBR });
        return wd.charAt(0).toUpperCase() + wd.slice(1);
      } catch { return ""; }
    })();

    const dPaymentDetails = (() => {
      const fp = transaction.forma_pagamento;
      if (fp === "cartao") {
        const cartao = cartoes.find(c => c.id === transaction.cartao_id);
        return { icon: "💳", name: cartao ? cartao.nome : "Cartão" };
      } else if (fp === "pix") return { icon: "🪙", name: "Pix" };
      else if (fp === "dinheiro" || fp === "cash") return { icon: "💵", name: "Dinheiro" };
      else if (fp === "boleto") return { icon: "🧾", name: "Boleto" };
      else if (fp === "debit") return { icon: "💳", name: "Débito" };
      else if (fp === "credit") return { icon: "💳", name: "Crédito" };
      else if (fp) {
        const name = fp.charAt(0).toUpperCase() + fp.slice(1);
        let icon = "💳";
        const lowerName = name.toLowerCase();
        if (lowerName.includes("pix")) icon = "🪙";
        else if (lowerName.includes("dinheiro") || lowerName.includes("cash")) icon = "💵";
        else if (lowerName.includes("boleto")) icon = "🧾";
        else if (lowerName.includes("transferencia") || lowerName.includes("transferência")) icon = "🏦";
        return { icon, name };
      }
      return { icon: "", name: "" };
    })();

    const dIsFixo = transaction.type === "expense" && transaction.tipo_pagamento === "fixo";
    const dIsParcelado = !dIsFixo && !!(transaction.installmentNumber && transaction.totalInstallments && transaction.totalInstallments > 1);
    const dPaymentType = (() => {
      if (dIsFixo) return "Fixo";
      if (dIsParcelado) {
        const current = String(transaction.installmentNumber).padStart(2, '0');
        const total = String(transaction.totalInstallments).padStart(2, '0');
        return `${current}/${total}`;
      }
      return "Avulsa";
    })();

    const categoryColor = category?.cor || "#6B7280";

  return (
    <div
      onClick={() => onEditTransaction(transaction)}
      className={cn(
        "group cursor-pointer bg-white rounded-[12px] border border-[#E7EDF5] shadow-[0_2px_10px_rgba(15,23,42,0.04)] mb-[6px] transition-all hover:shadow-[0_4px_16px_rgba(15,23,42,0.07)] hover:border-[#D5DDE8] active:scale-[0.995]",
        transaction.type === "income"
          ? "border-l-[3px] border-l-[#10B981]/60"
          : "border-l-[3px] border-l-[#F43F5E]/60"
      )}
    >
      <div className="flex items-center w-full px-6 py-[13px] gap-4">

        {/* COL 1 — Data (14%) */}
        <div className="flex flex-col w-[13%] shrink-0">
          <span className="text-[13px] font-semibold text-slate-700 leading-tight">{dFormattedDate}</span>
          <span className="text-[11px] text-slate-400 font-normal mt-[3px] leading-none">{dWeekday}</span>
        </div>

        {/* COL 2 — Tipo badge (10%) — logo após a data */}
        <div className="flex items-center justify-start w-[10%] shrink-0">
          <div className={cn(
            "inline-flex items-center justify-center px-[10px] py-[4px] rounded-full text-[10px] font-bold uppercase tracking-wider border",
            transaction.type === "income"
              ? "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
              : "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
          )}>
            {transaction.type === "income" ? "Receita" : "Despesa"}
          </div>
        </div>

        {/* COL 3 — Categoria/Subcategoria (17%) */}
        <div className="flex items-center gap-2.5 w-[17%] shrink-0">
          {/* Área invisível do ícone da subcategoria para manter alinhamento */}
          <div
            className="h-[34px] w-[34px] flex items-center justify-center shrink-0"
          >
            <DynamicIcon
              name={categoryIcon || (transaction.type === 'income' ? 'TrendingUp' : 'TrendingDown')}
              className="w-6 h-6 text-[22px] opacity-90"
              style={{ color: categoryColor }}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-slate-800 leading-tight truncate">{categoryName}</span>
            {dPaymentType && (
              <span className={cn(
                "text-[11px] font-medium mt-[2px] leading-none",
                dIsFixo ? "text-[#FF8888]/90" :
                dIsParcelado ? "text-purple-500/90" :
                "text-slate-400"
              )}>
                {dPaymentType}
              </span>
            )}
          </div>
        </div>

        {/* COL 4 — Descrição (dominante, flex-1 ~24%) */}
        <div className="flex flex-col flex-1 min-w-0 px-2">
          <span className="text-[13px] font-semibold text-slate-700 leading-tight truncate">
            {transaction.description || categoryName}
          </span>
          {transaction.description && (
            <span className="text-[11px] text-slate-400 font-normal truncate mt-[3px] leading-none">
              {categoryName}
            </span>
          )}
        </div>

        {/* COL 5 — Valor + Status (13%) */}
        <div className="flex flex-col items-end w-[13%] shrink-0">
          <span className={cn(
            "text-[15px] font-bold tracking-tight leading-tight",
            transaction.type === 'income' ? "text-[#059669]" : "text-[#DC2626]"
          )}>
            {formatCurrency(transaction.amount, true)}
          </span>
          <div className="flex items-center gap-1.5 mt-[5px]">
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(transaction.id, transaction.type, newStatus);
              }}
              className={cn(
                "flex items-center justify-center rounded-full cursor-pointer select-none transition-all border shadow-sm relative h-[16px] w-[16px] shrink-0",
                transaction.status === "Recebida"
                  ? "bg-[#25D366] border-[#25D366]"
                  : "bg-[#FEF3C7] border-[#FEF3C7]"
              )}
            >
              {transaction.status === "Recebida" ? (
                <Check className="absolute text-white w-[11px] h-[11px]" strokeWidth={4} />
              ) : (
                <Clock className="absolute text-[#D97706] w-[11px] h-[11px]" strokeWidth={4} />
              )}
            </div>
            <span className={cn(
              "text-[11px] font-medium leading-none whitespace-nowrap",
              transaction.status === "Recebida" ? "text-[#10B955]" : "text-[#EF4444]/80"
            )}>
              {transaction.status === "Recebida"
                ? (transaction.type === "income" ? "Recebido" : "Pago")
                : "Pendente"}
            </span>
          </div>
        </div>

        {/* COL 6 — Forma de Pagamento (11%) */}
        <div className="flex flex-col items-center w-[11%] shrink-0">
          {dPaymentDetails.icon && (
            <span className="text-[15px] leading-none mb-[3px]">{dPaymentDetails.icon}</span>
          )}
          <span className="text-[11px] text-slate-500 font-medium leading-none truncate max-w-full text-center">
            {dPaymentDetails.name || "-"}
          </span>
        </div>

        {/* COL 7 — Ações (12%) */}
        <div className="flex items-center justify-center w-[12%] shrink-0 pl-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEditTransaction(transaction);
            }}
            className="h-[34px] px-4 text-slate-500 hover:text-[#1E3A8B] hover:bg-blue-50/80 rounded-lg text-[12px] font-semibold gap-1.5 transition-colors border border-transparent hover:border-blue-100"
          >
            <SquarePen className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>

      </div>
    </div>
  );
};

export default memo(TransactionRow);
