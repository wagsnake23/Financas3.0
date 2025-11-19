import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import type { Transaction } from "@/types/finance";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthlyExpenseCalendarProps {
  transactions: Transaction[];
  isMobile?: boolean;
  currentMonth?: Date; // Agora é opcional
  hideNavigation?: boolean; // Nova prop para esconder a navegação interna
}

export const MonthlyExpenseCalendar: React.FC<MonthlyExpenseCalendarProps> = ({ 
  transactions, 
  isMobile, 
  currentMonth: propCurrentMonth, // Renomeado para evitar conflito
  hideNavigation = false,
}) => {
  const [internalCurrentMonth, setInternalCurrentMonth] = useState(new Date());
  const displayMonth = propCurrentMonth || internalCurrentMonth;

  const totalMonthlyExpenses = useMemo(() => {
    const startOfCurrentMonth = startOfMonth(displayMonth);
    const endOfCurrentMonth = endOfMonth(displayMonth);

    return transactions
      .filter(t => t.type === "expense")
      .filter(t => !t.is_fixed || t.isRecurring) // Filter out legacy fixed transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return isWithinInterval(transactionDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, displayMonth]);

  const handlePreviousMonth = () => {
    setInternalCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setInternalCurrentMonth(prev => addMonths(prev, 1));
  };

  const content = (
    <div className={cn("p-6 animate-fade-in", isMobile && "p-0")}>
      {!isMobile && ( // Renderiza o título apenas se NÃO for mobile
        <h2 className={cn("text-xl font-semibold mb-4", isMobile && "text-sm mb-2")}>Despesas por Mês</h2>
      )}
      {!hideNavigation && (
        <div className="flex items-center justify-between mb-2">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth} className={cn(isMobile && "h-6 w-6")}>
            <DynamicIcon name="ChevronLeft" className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")} />
          </Button>
          <h3 className={cn("text-lg font-bold capitalize", isMobile && "text-xs")}>
            {format(displayMonth, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className={cn(isMobile && "h-6 w-6")}>
            <DynamicIcon name="ChevronRight" className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")} />
          </Button>
        </div>
      )}
      <div className="text-center">
        <p className={cn("text-muted-foreground text-sm", isMobile && "text-xs")}>Total de Despesas:</p>
        <p className={cn("text-3xl font-bold text-destructive", isMobile && "text-base")}>R$ {totalMonthlyExpenses.toFixed(2)}</p>
      </div>
    </div>
  );

  return isMobile ? content : <Card>{content}</Card>;
};