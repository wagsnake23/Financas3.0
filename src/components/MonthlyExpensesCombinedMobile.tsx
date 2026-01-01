import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { MobileExpenseSummaryRow } from "./MobileExpenseSummaryRow";
import { Transaction } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthlyExpensesCombinedMobileProps {
  transactions: Transaction[];
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
  isMobile: boolean;
}

export const MonthlyExpensesCombinedMobile: React.FC<MonthlyExpensesCombinedMobileProps> = ({
  transactions,
  expenseInstallments,
  isMobile,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { totalPaid, totalPending } = useMemo(() => {
    if (!expenseInstallments) {
      return { totalPaid: 0, totalPending: 0 };
    }

    const monthStart = startOfMonth(currentMonth);
    const startStr = format(monthStart, "yyyy-MM-01");
    const nextMonthStartStr = format(addMonths(monthStart, 1), "yyyy-MM-01");

    let paid = 0;
    let pending = 0;

    expenseInstallments.forEach(installment => {
      const vencimentoDate = installment.vencimento.substring(0, 10);
      if (vencimentoDate >= startStr && vencimentoDate < nextMonthStartStr) {
        if (installment.pago) {
          paid += installment.valor_parcela;
        } else {
          pending += installment.valor_parcela;
        }
      }
    });

    return { totalPaid: paid, totalPending: pending };
  }, [expenseInstallments, currentMonth]);

  const totalMonthlyExpenses = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const startStr = format(monthStart, "yyyy-MM-01");
    const nextMonthStartStr = format(addMonths(monthStart, 1), "yyyy-MM-01");

    return transactions
      .filter(t => t.type === "expense")
      .filter(t => {
        const dateStr = t.date.substring(0, 10);
        return dateStr >= startStr && dateStr < nextMonthStartStr;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, currentMonth]);

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  return (
    <Card className={cn("p-4 animate-fade-in space-y-4 bg-soft-yellow/20 border border-soft-yellow rounded-xl shadow-sm", isMobile && "p-3 space-y-3")}>
      <div className={cn("flex items-center justify-between mb-2", isMobile && "mb-1")}>
        <Button variant="outline" size="icon" onClick={handlePreviousMonth} className={cn(isMobile && "h-6 w-6")}>
          <DynamicIcon name="ChevronLeft" className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")} />
        </Button>
        <h3 className={cn("text-lg font-bold capitalize", isMobile && "text-base")}>
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <Button variant="outline" size="icon" onClick={handleNextMonth} className={cn(isMobile && "h-6 w-6")}>
          <DynamicIcon name="ChevronRight" className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")} />
        </Button>
      </div>

      <MobileExpenseSummaryRow
        totalPaid={totalPaid}
        totalPending={totalPending}
        totalMonthlyExpenses={totalMonthlyExpenses}
        isMobile={isMobile}
      />
    </Card>
  );
};