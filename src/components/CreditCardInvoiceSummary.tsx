import React from "react";
import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency, formatInTimeZone, TARGET_TIMEZONE } from "@/lib/utils"; // Importar formatCurrency, formatInTimeZone, TARGET_TIMEZONE
import { Button } from "@/components/ui/button"; // Importar Button
import { format } from "date-fns"; // Importar format
import { ptBR } from "date-fns/locale"; // Importar ptBR

interface CreditCardInvoiceSummaryProps {
  totalPaid: number;
  totalPending: number;
  totalCardExpenses: number;
  isMobile: boolean;
  formattedDueDate: string | null;
  formattedClosingDate: string | null;
  cardLastDigits: string | null;
  selectedMonth: Date; // NOVA PROP
  onPayInvoice: () => void;
  loadingPayInvoice: boolean;
  disablePayInvoiceButton: boolean;
}

export const CreditCardInvoiceSummary: React.FC<CreditCardInvoiceSummaryProps> = ({
  totalPaid,
  totalPending,
  totalCardExpenses,
  isMobile,
  formattedDueDate,
  formattedClosingDate,
  cardLastDigits,
  selectedMonth,
  onPayInvoice,
  loadingPayInvoice,
  disablePayInvoiceButton,
}) => {
  const formattedBadgeMonth = format(selectedMonth, "MMMM", { locale: ptBR });
  const formattedBadgeYear = format(selectedMonth, "yyyy", { locale: ptBR });

  return (
    <div className={cn(
      "w-full animate-fade-in transition-all duration-300",
      !isMobile && "mb-6"
    )}>
      <Card className={cn(
        "relative overflow-hidden border border-slate-100 bg-[#FCFCFD] py-2 px-4",
        "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)]",
        "rounded-2xl",
        isMobile ? "rounded-xl" : ""
      )}>
        {/* Subtle 3D Top Edge */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/60 z-10" />

        <div className={cn(
          "flex flex-col gap-3",
          !isMobile && "flex-row items-center justify-between gap-4"
        )}>

          {/* Main Info Groups */}
          <div className={cn(
            "flex items-center justify-between flex-1",
            !isMobile && "justify-start gap-10"
          )}>

            {/* Group: Pago */}
            <div className="flex flex-col gap-0">
              <div className="flex items-center gap-1.5">
                <DynamicIcon name="CheckCircle" className="h-3 w-3 text-[#059669]" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-[#059669]">
                  Pago
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[#374151]",
                  isMobile ? "text-sm font-medium" : "text-base font-semibold"
                )}>
                  {formatCurrency(totalPaid)}
                </span>
              </div>
            </div>

            {/* Group: Pendente */}
            <div className="flex flex-col gap-0">
              <div className="flex items-center gap-1.5">
                <DynamicIcon name="Circle" className="h-3 w-3 text-[#E11D48]" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-[#E11D48]">
                  Pendente
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[#374151]",
                  isMobile ? "text-sm font-medium" : "text-base font-semibold"
                )}>
                  {formatCurrency(totalPending)}
                </span>
              </div>
            </div>

            {/* Group: Total */}
            <div className="flex flex-col gap-0">
              <div className="flex items-center gap-1.5">
                <DynamicIcon name="CreditCard" className="h-3 w-3 text-[#374151]" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-[#374151]">
                  Total Fatura
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[#374151]",
                  isMobile ? "text-sm font-medium" : "text-base font-semibold"
                )}>
                  {formatCurrency(totalCardExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Section: Dates & Action */}
          <div className={cn(
            "flex items-center justify-between md:justify-end gap-5 pt-2 border-t border-slate-50",
            !isMobile && "pt-0 border-t-0"
          )}>
            {/* Date Details */}
            <div className="flex flex-col items-end text-right">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-[#64748b] capitalize">
                  {formattedBadgeMonth}
                </span>
                <span className="text-[10px] font-medium text-[#64748b]/80">
                  {formattedBadgeYear}
                </span>
              </div>
              {formattedDueDate && (
                <span className="text-[10px] font-medium text-[#64748b] mt-0">
                  Venc. <span className="font-semibold text-[#475569]">{formattedDueDate}</span>
                </span>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={onPayInvoice}
              disabled={loadingPayInvoice || disablePayInvoiceButton}
              className={cn(
                "h-9 px-10 rounded-xl transition-all duration-300 flex items-center justify-center",
                "bg-gradient-to-br from-[#E9D5FF] to-[#DDD6FE] hover:from-[#DDD6FE] hover:to-[#C4B5FD]",
                "border border-[#C4B5FD]/50 shadow-sm active:scale-95",
                "text-[#4C1D95] font-bold text-[13px]",
                "disabled:opacity-40 disabled:grayscale",
                isMobile && "flex-1"
              )}
            >
              <DynamicIcon name="CreditCard" className="mr-2 h-4 w-4 text-[#4C1D95] opacity-80" />
              {loadingPayInvoice ? "Processando" : "Pagar Fatura"}
            </button>
          </div>

        </div>
      </Card>
    </div>
  );
};