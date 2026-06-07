import React from "react";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check } from "lucide-react";

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
  paymentDate?: string | null;
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
  totalPending,
  isMobile,
  formattedDueDate,
  selectedMonth,
  onPayInvoice,
  loadingPayInvoice,
  disablePayInvoiceButton,
  paymentDate,
}) => {
  const formattedBadgeMonth = format(selectedMonth, "MMM", { locale: ptBR }).toUpperCase().replace(".", "");
  const formattedBadgeYear = format(selectedMonth, "yyyy", { locale: ptBR });

  const isPaid = totalCardExpenses > 0 && totalPending <= 0;

  const getFormattedPaymentDate = () => {
    if (!paymentDate) return format(new Date(), "dd/MM/yyyy");
    const parts = paymentDate.substring(0, 10).split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return format(new Date(paymentDate), "dd/MM/yyyy");
  };

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
          background: isPaid 
            ? "linear-gradient(135deg, rgba(22, 163, 74, 0.9) 0%, rgba(30, 181, 90, 0.9) 50%, rgba(34, 197, 94, 0.9) 100%)" 
            : "linear-gradient(135deg, #0D47D9 0%, #2563EB 55%, #5B9DFF 100%)",
          boxShadow: isPaid 
            ? "0 4px 16px -4px rgba(22, 163, 74, 0.4)" 
            : "0 4px 16px -4px rgba(37, 99, 235, 0.4)",
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
              className={cn(
                "h-[34px] transition-all flex items-center justify-center px-0",
                isPaid 
                  ? "w-[95%] rounded-[12px] pointer-events-none" 
                  : "w-[95%] rounded-[12px] bg-white text-[#0D47D9] border-none hover:bg-white/95 hover:-translate-y-[1px] active:translate-y-[1px]"
              )}
              style={isPaid ? {
                background: "#F0FDF4",
                border: "1px solid rgba(22, 163, 74, 0.2)",
                color: "#16A34A",
              } : {
                boxShadow: "0 2px 8px rgba(0,0,0,0.1), inset 0 -2px 0 rgba(0,0,0,0.04)"
              }}
              onClick={isPaid ? undefined : onPayInvoice}
              disabled={isPaid ? false : (loadingPayInvoice || disablePayInvoiceButton)}
            >
              {isPaid ? (
                <div className="flex items-center justify-center gap-2.5 w-full">
                  <div className="flex items-center justify-center w-[22px] h-[22px] rounded-full border border-[#16A34A] bg-[#16A34A]/10 shrink-0">
                    <Check className="h-3.5 w-3.5 text-[#16A34A]" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col items-center justify-center gap-[2px]">
                    <span className="font-[600] text-[13.5px] tracking-tight text-[#16A34A] leading-none">Fatura paga</span>
                    <span className="text-[9.5px] font-medium text-[#16A34A]/80 leading-none">Pagamento realizado em {getFormattedPaymentDate()}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[16px] leading-none mb-[1px]">💳</span>
                  <span className="font-bold text-[13px] tracking-tight">{loadingPayInvoice ? "Processando..." : "Pagar Fatura"}</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};