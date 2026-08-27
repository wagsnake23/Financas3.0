import React from "react";
// Removido: import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency } from "@/lib/utils"; // Importar formatCurrency

interface MobileExpenseSummaryRowProps {
  totalPaid: number;
  totalPending: number;
  totalMonthlyExpenses: number;
  isMobile: boolean;
}

export const MobileExpenseSummaryRow: React.FC<MobileExpenseSummaryRowProps> = ({
  totalPaid,
  totalPending,
  totalMonthlyExpenses,
  isMobile,
}) => {
  return (
    <div className={cn("grid grid-cols-3 gap-2 text-center", isMobile && "gap-1")}> {/* Removido o Card e aplicado classes diretamente ao div */}
      <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
        <DynamicIcon name="CheckCircle" className={cn("h-5 w-5 text-success mb-1", isMobile && "h-4 w-4 mb-0.5")} />
        <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pago</p>
        <p className={cn("text-sm font-bold text-success", isMobile && "text-xs")}>{formatCurrency(totalPaid)}</p>
      </div>
      <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
        <DynamicIcon name="Circle" className={cn("h-5 w-5 text-destructive mb-1", isMobile && "h-4 w-4 mb-0.5")} />
        <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pendente</p>
        <p className={cn("text-sm font-bold text-destructive", isMobile && "text-xs")}>{formatCurrency(totalPending)}</p>
      </div>
      <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
        <DynamicIcon name="CreditCard" className={cn("h-5 w-5 text-foreground mb-1", isMobile && "h-4 w-4 mb-0.5")} />
        <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Total Mês</p>
        <p className={cn("text-sm font-bold text-foreground", isMobile && "text-xs")}>{formatCurrency(totalMonthlyExpenses)}</p>
      </div>
    </div>
  );
};
