import React from "react";
import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
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
  const formattedBadgeMonth = format(selectedMonth, "MMM/yy", { locale: ptBR });

  return (
    <Card className={cn(
      "p-4 animate-fade-in space-y-2 bg-soft-blue/20 border border-soft-blue rounded-xl shadow-sm relative", // Adicionado relative
      isMobile && "p-3 space-y-2"
    )}>
      {/* Month Badge para Mobile (Posicionamento Absoluto) */}
      {isMobile && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <DynamicIcon name="📅" className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase text-primary">
            {formattedBadgeMonth}
          </span>
        </div>
      )}

      {/* Wrapper para o conteúdo principal (com padding para mobile para limpar o badge absoluto) */}
      <div className={cn(isMobile && "pt-6")}> {/* Adicionado pt-6 para mobile */}
        {/* Grupo para Pago, Pendente, Total Fatura */}
        <div className={cn("flex items-center justify-between gap-2", isMobile && "w-full")}>
          {/* Pago */}
          <div className={cn("flex flex-col items-center justify-center flex-1", isMobile && "p-0.5")}>
            <DynamicIcon name="CheckCircle" className={cn("h-5 w-5 text-success mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pago</p>
            <p className={cn("text-sm font-bold text-success", isMobile && "text-xs")}>{formatCurrency(totalPaid)}</p>
          </div>
          {/* Pendente */}
          <div className={cn("flex flex-col items-center justify-center flex-1", isMobile && "p-0.5")}>
            <DynamicIcon name="Circle" className={cn("h-5 w-5 text-destructive mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pendente</p>
            <p className={cn("text-sm font-bold text-destructive", isMobile && "text-xs")}>{formatCurrency(totalPending)}</p>
          </div>
          {/* Total Fatura */}
          <div className={cn("flex flex-col items-center justify-center flex-1", isMobile && "p-0.5")}>
            <DynamicIcon name="CreditCard" className={cn("h-5 w-5 text-foreground mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Total Fatura</p>
            <p className={cn("text-sm font-bold text-foreground", isMobile && "text-xs")}>{formatCurrency(totalCardExpenses)}</p>
          </div>
        </div>

        {/* Datas de Fechamento e Vencimento (abaixo dos totais) */}
        {formattedClosingDate && formattedDueDate && (
          <div className={cn("flex justify-between text-xs text-muted-foreground mt-2", isMobile && "text-[0.65rem] mt-1")}>
            <span>Fechamento: {formattedClosingDate}</span>
            <span>Vencimento: {formattedDueDate}</span>
          </div>
        )}

        {/* Month Badge para Desktop (se não for mobile, mantém no fluxo) */}
        {!isMobile && (
          <div className={cn(
            "flex flex-col items-end text-right gap-0"
          )}>
            <span className="text-xs font-bold uppercase text-primary px-2 py-0.5 rounded-md">
              {formattedBadgeMonth}
            </span>
          </div>
        )}

        {/* Botão "Pagar Fatura" isolado abaixo e centralizado */}
        <div className={cn("flex justify-center mt-3", isMobile && "mt-2")}>
          <Button
            variant="secondary"
            onClick={onPayInvoice}
            className={cn("rounded-xl", isMobile ? "w-auto max-w-[150px] h-8 px-2 text-xs" : "w-auto px-4")}
            disabled={loadingPayInvoice || disablePayInvoiceButton}
          >
            <DynamicIcon name="CreditCard" className="mr-2 h-4 w-4" />
            {loadingPayInvoice ? "Pagando..." : "Pagar Fatura"}
          </Button>
        </div>
      </div>
    </Card>
  );
};