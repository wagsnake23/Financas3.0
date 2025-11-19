import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { Tables } from "@/integrations/supabase/types";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthlyExpenseSummaryProps {
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id' | 'is_fixed'> | null })[];
  isLoading: boolean;
  isMobile: boolean;
  currentMonth?: Date; // Agora é opcional
  hideNavigation?: boolean; // Nova prop para esconder a navegação interna
}

export const MonthlyExpenseSummary: React.FC<MonthlyExpenseSummaryProps> = ({
  expenseInstallments,
  isLoading,
  isMobile,
  currentMonth: propCurrentMonth, // Renomeado para evitar conflito
  hideNavigation = false,
}) => {
  const [internalCurrentMonth, setInternalCurrentMonth] = useState(new Date());
  const displayMonth = propCurrentMonth || internalCurrentMonth;

  const { totalPaid, totalPending } = useMemo(() => {
    if (isLoading || !expenseInstallments) {
      return { totalPaid: 0, totalPending: 0 };
    }

    const monthStart = startOfMonth(displayMonth);
    const monthEnd = endOfMonth(displayMonth);

    let paid = 0;
    let pending = 0;

    expenseInstallments.forEach(installment => {
      // Filter out legacy fixed expenses
      if (installment.despesas?.is_fixed) return;

      const installmentDate = new Date(installment.vencimento);
      if (isWithinInterval(installmentDate, { start: monthStart, end: monthEnd })) {
        if (installment.pago) {
          paid += installment.valor_parcela;
        } else {
          pending += installment.valor_parcela;
        }
      }
    });

    return { totalPaid: paid, totalPending: pending };
  }, [expenseInstallments, displayMonth, isLoading]);

  const handlePreviousMonth = () => {
    setInternalCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setInternalCurrentMonth(prev => addMonths(prev, 1));
  };

  if (isLoading) {
    return (
      <Card className={cn("p-6 animate-fade-in", isMobile ? "h-48" : "h-60 flex items-center justify-center")}>
        <div className="animate-pulse text-muted-foreground">Carregando resumo mensal...</div>
      </Card>
    );
  }

  const content = (
    <div className={cn("p-6 animate-fade-in", isMobile && "p-0")}>
      {!isMobile && ( // Renderiza o título apenas se NÃO for mobile
        <h2 className={cn("text-xl font-semibold mb-4", isMobile && "text-sm mb-2")}>Resumo Mensal de Despesas</h2>
      )}
      {!hideNavigation && (
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth} className={cn(isMobile && "h-6 w-6")}>
            <DynamicIcon name="ChevronLeft" className={cn("h-5 w-5", isMobile && "h-2.5 w-2.5")} />
          </Button>
          <h3 className={cn("text-lg font-bold capitalize", isMobile && "text-xs")}>
            {format(displayMonth, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className={cn(isMobile && "h-6 w-6")}>
            <DynamicIcon name="ChevronRight" className={cn("h-5 w-5", isMobile && "h-2.5 w-2.5")} />
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className={cn(
          "p-3 border rounded-lg", 
          isMobile ? "p-2 border-transparent bg-transparent" : "bg-success/5 border-success/20" // Condicional para mobile
        )}>
          <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs")}>Pago</p>
          <p className={cn("text-xl font-bold text-success", isMobile && "text-base")}>R$ {totalPaid.toFixed(2)}</p>
        </div>
        <div className={cn(
          "p-3 border rounded-lg", 
          isMobile ? "p-2 border-transparent bg-transparent" : "bg-destructive/5 border-destructive/20" // Condicional para mobile
        )}>
          <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs")}>Pendente</p>
          <p className={cn("text-xl font-bold text-destructive", isMobile && "text-base")}>R$ {totalPending.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );

  return isMobile ? content : <Card>{content}</Card>;
};