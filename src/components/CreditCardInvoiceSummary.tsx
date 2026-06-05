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
      <Card
        className={cn(
          "relative overflow-hidden px-4 rounded-[24px] border border-blue-100 card-fatura shadow-[0_4px_12px_rgba(0,0,0,0.03)]",
          isMobile ? "py-3 mb-0.5" : "py-5 mb-6"
        )}
        style={{ backgroundColor: "transparent" }}
      >

        <div className={cn(
          isMobile ? "flex flex-col gap-1.5" : "flex flex-col gap-2",
          !isMobile && "flex-row items-center justify-between gap-4"
        )}>

          {/* Main Info Groups */}
          <div className={cn(
            "flex items-center justify-between flex-1",
            !isMobile && "justify-start gap-10"
          )}>

            {/* Group: Pago */}
            <div className={cn("flex flex-col gap-0 transition-opacity duration-300", totalPending > 0 && "opacity-40 grayscale")}>
              <div className="flex items-center gap-1.5">
                <div
                  className="flex items-center justify-center rounded-full bg-[#44E37F]/90 text-white font-black"
                  style={{ height: 14, width: 14, fontSize: 7 }}
                >
                  ✓
                </div>
                <span className="text-[0.65rem] text-gray-500 font-bold">
                  Pago
                </span>
              </div>
              <div className="leading-none">
                <span className="text-[11px] font-bold text-success/80">
                  {formatCurrency(totalPaid)}
                </span>
              </div>
            </div>

            {/* Group: Pendente */}
            <div className={cn("flex flex-col gap-0 transition-opacity duration-300", totalPending <= 0 && "opacity-40 grayscale")}>
              <div className="flex items-center gap-1.5">
                <DynamicIcon
                  name="Circle"
                  className="h-3.5 w-3.5 text-destructive/70"
                />
                <span className="text-[0.65rem] text-gray-500 font-bold">
                  Pendente
                </span>
              </div>
              <div className="leading-none">
                <span className="text-[11px] font-bold text-destructive/80">
                  {formatCurrency(totalPending)}
                </span>
              </div>
            </div>

            {/* Group: Total */}
            <div className="flex flex-col gap-0">
              <div className="flex items-center gap-1.5">
                <DynamicIcon
                  name="CreditCard"
                  className="h-3.5 w-3.5 text-gray-400"
                />
                <span className="text-[0.65rem] text-gray-500 font-medium">
                  Total
                </span>
              </div>
              <div className="leading-none">
                <span className="text-[11px] font-semibold text-gray-500">
                  {formatCurrency(totalCardExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button Area */}
          <div className={cn(
            "w-full mt-1 pt-[5px] border-t border-slate-50/50",
            !isMobile && "w-auto mt-0 pt-0 border-t-0"
          )}>
            <button
              onClick={onPayInvoice}
              disabled={loadingPayInvoice || disablePayInvoiceButton}
              className={cn(
                "w-full md:w-auto h-[44px] px-4 rounded-[14px] transition-all duration-300 flex items-center justify-between md:justify-center gap-4",
                "text-white shadow-sm border-none outline-none",
                "disabled:opacity-40 disabled:grayscale hover:-translate-y-[1px] active:translate-y-[1px]"
              )}
              style={{ 
                background: "linear-gradient(135deg, #4D8EFF, #2B75D6)", 
                boxShadow: "0 4px 12px rgba(43,117,214,0.2), inset 0 1px 1px rgba(255,255,255,0.3)" 
              }}
            >
              <div className="flex items-center gap-2">
                <DynamicIcon name="CreditCard" className="h-[18px] w-[18px] text-white" />
                <span className="font-bold text-[13px] tracking-tight">{loadingPayInvoice ? "Processando..." : "Pagar Fatura"}</span>
              </div>
              
              <div className="flex items-center gap-2.5">
                <span className="text-white/40 font-normal text-[14px]">|</span>
                <div className="flex flex-col items-start text-left leading-none">
                  <span className="font-semibold text-[11px] text-white/90 tracking-tight">
                    {format(selectedMonth, "MMM yyyy", { locale: ptBR }).toUpperCase().replace(".", "")}
                  </span>
                  {formattedDueDate && (
                    <span className="font-medium text-[9.5px] text-white/70 mt-[3px]">
                      Venc. {formattedDueDate}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>

        </div>
      </Card>
    </div>
  );
};