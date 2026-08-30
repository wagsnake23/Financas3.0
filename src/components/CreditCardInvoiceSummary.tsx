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
          isMobile ? "px-3 pt-1.5 pb-[9px] mb-0.5" : "px-5 py-4 mb-6"
        )}
        style={{
          borderRadius: isMobile ? "11px" : "12px",
          background: isPaid 
            ? "linear-gradient(135deg, #10B981 0%, #059669 100%)" 
            : "linear-gradient(135deg, #0D47D9 0%, #2563EB 55%, #5B9DFF 100%)",
          boxShadow: isPaid 
            ? "inset 0 1px 1px rgba(255,255,255,0.25), 0 2px 6px -2px rgba(16, 185, 129, 0.15)" 
            : "0 4px 16px -4px rgba(37, 99, 235, 0.4)",
          border: isPaid ? "1px solid rgba(255,255,255,0.15)" : "none",
          minHeight: "auto"
        }}
      >
        <div className={cn("flex flex-col", isPaid ? "gap-1" : "gap-2")}>
          <div className="flex items-center w-full justify-between mt-0.5 px-1">
            {/* Esquerda - Fatura Atual */}
            <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 mb-[2px] whitespace-nowrap">
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
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 mb-[2px] whitespace-nowrap">
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
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 mb-[2px] whitespace-nowrap">
                {formattedBadgeMonth}
              </span>
              <div className="text-[14px] font-semibold tracking-tight leading-none whitespace-nowrap">
                {formattedBadgeYear}
              </div>
            </div>
          </div>

          {isPaid ? (
            <div className="flex flex-col items-center justify-center w-full mt-1.5 mb-0 gap-1">
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-white/20 shrink-0">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
                <span className="font-semibold text-[15px] tracking-tight text-white leading-none">Fatura paga</span>
              </div>
              <span className="text-[11px] font-medium text-white/60 leading-none">
                Pagamento realizado em {getFormattedPaymentDate()}
              </span>
            </div>
          ) : (
            <div className="flex justify-center w-full mt-[3px] mb-[5px]">
              <Button
                className="h-[36px] transition-all flex items-center justify-center px-0 font-extrabold w-[95%] rounded-[12px] text-[#1D4ED8] border-none hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-sm"
                style={{
                  background: "#ffffff",
                  borderBottom: "2px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)"
                }}
                onClick={onPayInvoice}
                disabled={loadingPayInvoice || disablePayInvoiceButton}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[18px] leading-none mb-[2px]">💳</span>
                  <span className="font-extrabold text-[13.5px] tracking-tight">{loadingPayInvoice ? "Processando..." : "Pagar Fatura"}</span>
                </div>
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
