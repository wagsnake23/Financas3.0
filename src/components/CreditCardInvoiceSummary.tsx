import React from "react";
import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency } from "@/lib/utils"; // Importar formatCurrency
import { Button } from "@/components/ui/button"; // Importar Button

interface CreditCardInvoiceSummaryProps {
  totalPaid: number;
  totalPending: number;
  totalCardExpenses: number;
  isMobile: boolean;
  formattedDueDate: string | null;
  formattedClosingDate: string | null;
  cardLastDigits: string | null;
  invoiceMonth: string | null;
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
  invoiceMonth,
  onPayInvoice,
  loadingPayInvoice,
  disablePayInvoiceButton,
}) => {
  return (
    <Card className={cn(
      "p-4 animate-fade-in space-y-2 bg-soft-blue/20 border border-soft-blue rounded-xl shadow-sm",
      isMobile && "p-3 space-y-2"
    )}>
      {/* Título mais ao topo - Removido em mobile */}
      {!isMobile && (
        <h3 className={cn("text-lg font-bold mt-0")}>Resumo da Fatura</h3>
      )}
      
      <div className={cn("flex items-start justify-between gap-4", isMobile && "flex-col items-center text-center gap-2")}>
        {/* Detalhes do Cartão (Esquerda) */}
        <div className={cn("flex flex-col items-start", isMobile && "items-center")}>
          {/* Fatura e Vencimento na mesma linha para mobile */}
          <div className={cn("flex items-center gap-2", isMobile && "flex-row justify-center gap-2")}>
            {invoiceMonth && (
              <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>
                Fatura: <span className={cn("font-semibold text-sm", isMobile && "text-xs capitalize")}>{invoiceMonth}</span>
              </p>
            )}
            {formattedDueDate && (
              <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>
                Vencimento: <span className={cn("font-semibold text-sm", isMobile && "text-xs")}>{formattedDueDate}</span>
              </p>
            )}
          </div>
        </div>

        {/* Valores (Centro, em uma linha) */}
        <div className={cn("flex items-center justify-center gap-4", isMobile && "gap-4 w-full")}> {/* Aumentado o gap para mobile */}
          <div className={cn("flex flex-col items-center justify-center", isMobile && "p-0.5")}>
            <DynamicIcon name="CheckCircle" className={cn("h-5 w-5 text-success mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pago</p>
            <p className={cn("text-sm font-bold text-success", isMobile && "text-xs")}>{formatCurrency(totalPaid)}</p>
          </div>
          <div className={cn("flex flex-col items-center justify-center", isMobile && "p-0.5")}>
            <DynamicIcon name="Circle" className={cn("h-5 w-5 text-destructive mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pendente</p>
            <p className={cn("text-sm font-bold text-destructive", isMobile && "text-xs")}>{formatCurrency(totalPending)}</p>
          </div>
          <div className={cn("flex flex-col items-center justify-center", isMobile && "p-0.5")}>
            <DynamicIcon name="CreditCard" className={cn("h-5 w-5 text-foreground mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Total Fatura</p>
            <p className={cn("text-sm font-bold text-foreground", isMobile && "text-xs")}>{formatCurrency(totalCardExpenses)}</p>
          </div>
        </div>
      </div>

      <div className={cn("mt-4", isMobile && "mt-3 flex justify-center")}> {/* Adicionado flex justify-center para centralizar o botão */}
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
    </Card>
  );
};