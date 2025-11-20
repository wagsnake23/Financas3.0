import React from "react";
import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";

interface CreditCardInvoiceSummaryProps {
  totalPaid: number;
  totalPending: number;
  totalCardExpenses: number;
  isMobile: boolean;
  formattedDueDate: string | null; // NOVA PROP: Data de vencimento formatada
}

export const CreditCardInvoiceSummary: React.FC<CreditCardInvoiceSummaryProps> = ({
  totalPaid,
  totalPending,
  totalCardExpenses,
  isMobile,
  formattedDueDate, // Usar a nova prop
}) => {
  return (
    <Card className={cn(
      "p-4 animate-fade-in space-y-2 bg-soft-blue/20 border border-soft-blue rounded-xl shadow-sm",
      isMobile && "p-3 space-y-2"
    )}>
      <h3 className={cn("text-lg font-bold mb-2", isMobile && "text-sm mb-1")}>Resumo da Fatura</h3>
      <div className={cn("grid grid-cols-3 gap-2 text-center", isMobile && "gap-1")}>
        <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
          <DynamicIcon name="CheckCircle" className={cn("h-5 w-5 text-success mb-1", isMobile && "h-4 w-4 mb-0.5")} />
          <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pago</p>
          <p className={cn("text-sm font-bold text-success", isMobile && "text-xs")}>R$ {totalPaid.toFixed(2)}</p>
        </div>
        <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
          <DynamicIcon name="Circle" className={cn("h-5 w-5 text-destructive mb-1", isMobile && "h-4 w-4 mb-0.5")} />
          <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pendente</p>
          <p className={cn("text-sm font-bold text-destructive", isMobile && "text-xs")}>R$ {totalPending.toFixed(2)}</p>
        </div>
        <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
          <DynamicIcon name="CreditCard" className={cn("h-5 w-5 text-foreground mb-1", isMobile && "h-4 w-4 mb-0.5")} />
          <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Total Fatura</p>
          <p className={cn("text-sm font-bold text-foreground", isMobile && "text-xs")}>R$ {totalCardExpenses.toFixed(2)}</p>
        </div>
      </div>
      {formattedDueDate && (
        <div className={cn("text-center mt-2", isMobile && "mt-1")}>
          <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Vencimento:</p>
          <p className={cn("font-semibold text-sm", isMobile && "text-xs")}>{formattedDueDate}</p>
        </div>
      )}
    </Card>
  );
};