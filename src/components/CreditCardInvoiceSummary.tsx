import React from "react";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreditCardInvoiceSummaryProps {
  totalPaid: number;
  totalPending: number;
  totalCardExpenses: number;
  isMobile: boolean;
  formattedDueDate: string | null;
  formattedClosingDate: string | null;
  cardLastDigits: string | null;
  selectedMonth: Date;
  onPayInvoice: () => void;
  loadingPayInvoice: boolean;
  disablePayInvoiceButton: boolean;
}

const FormatCurrencyPrefixLight = ({ value }: { value: number }) => {
  const formatted = formatCurrency(value);
  const match = formatted.match(/^(R\$)\s?(.*)$/);
  if (match) {
    return (
      <>
        <span className="text-[11px] font-normal opacity-80 mr-[2px] tracking-normal">{match[1]}</span>
        {match[2]}
      </>
    );
  }
  return <>{formatted}</>;
};

export const CreditCardInvoiceSummary: React.FC<CreditCardInvoiceSummaryProps> = ({
  totalCardExpenses,
  isMobile,
  formattedDueDate,
  selectedMonth,
  onPayInvoice,
  loadingPayInvoice,
  disablePayInvoiceButton,
}) => {
  const formattedBadgeMonth = format(selectedMonth, "MMM", { locale: ptBR }).toUpperCase().replace(".", "");
  const formattedBadgeYear = format(selectedMonth, "yyyy", { locale: ptBR });

  return (
    <div className={cn(
      "w-full animate-fade-in transition-all duration-300",
      !isMobile && "mb-6",
      isMobile && "mt-[3px]"
    )}>
      <Card
        className={cn(
          "relative overflow-hidden w-full flex flex-col justify-center text-white",
          isMobile ? "px-3 pt-2 pb-3 mb-0.5" : "px-5 py-4 mb-6"
        )}
        style={{
          borderRadius: "18px",
          background: "linear-gradient(135deg, #0D47D9 0%, #2563EB 55%, #5B9DFF 100%)",
          boxShadow: "0 4px 16px -4px rgba(37, 99, 235, 0.4)",
          border: "none",
          minHeight: "auto"
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center w-full justify-between mt-0.5 px-1">
            {/* Esquerda - Fatura Atual */}
            <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-85 mb-[2px] whitespace-nowrap">
                Fatura atual
              </span>
              <div className="text-[14px] font-semibold tracking-tight leading-none whitespace-nowrap" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
                <FormatCurrencyPrefixLight value={totalCardExpenses} />
              </div>
            </div>

            {/* Separador 1 */}
            <div className="h-6 w-[1px] bg-white/25 shrink-0 mx-0.5"></div>

            {/* Centro - Vencimento */}
            <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-85 mb-[2px] whitespace-nowrap">
                Vence em
              </span>
              <div className="text-[14px] font-semibold tracking-tight leading-none whitespace-nowrap">
                {formattedDueDate || "05/07"}
              </div>
            </div>

            {/* Separador 2 */}
            <div className="h-6 w-[1px] bg-white/25 shrink-0 mx-0.5"></div>

            {/* Direita - Mês/Ano */}
            <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-85 mb-[2px] whitespace-nowrap">
                {formattedBadgeMonth}
              </span>
              <div className="text-[14px] font-semibold tracking-tight leading-none whitespace-nowrap">
                {formattedBadgeYear}
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-0 mb-0">
            <Button
              className="w-[90%] rounded-[12px] h-[34px] bg-white text-[#0D47D9] border-none transition-all hover:bg-white/95 hover:-translate-y-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 px-0"
              style={{
                boxShadow: "0 2px 8px rgba(0,0,0,0.1), inset 0 -2px 0 rgba(0,0,0,0.04)"
              }}
              onClick={onPayInvoice}
              disabled={loadingPayInvoice || disablePayInvoiceButton}
            >
              <span className="text-[16px] leading-none mb-[1px]">💳</span>
              <span className="font-bold text-[13px] tracking-tight">{loadingPayInvoice ? "Processando..." : "Pagar Fatura"}</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};