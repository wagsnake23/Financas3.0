import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import type { Transaction } from "@/types/finance";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

interface MonthlyExpenseCalendarProps {
  transactions: Transaction[];
  isMobile?: boolean;
  currentMonth?: Date;
  hideNavigation?: boolean;
}

export const MonthlyExpenseCalendar: React.FC<MonthlyExpenseCalendarProps> = ({
  transactions,
  isMobile,
  currentMonth: propCurrentMonth,
  hideNavigation = false,
}) => {
  const [internalCurrentMonth, setInternalCurrentMonth] = useState(new Date());
  const [direction, setDirection] = useState<"left" | "right">("right");
  const displayMonth = propCurrentMonth || internalCurrentMonth;

  // Cálculo do total de despesas para o mês exibido
  const totalMonthlyExpenses = useMemo(() => {
    const monthStart = startOfMonth(displayMonth);
    const startStr = format(monthStart, "yyyy-MM-01");
    const nextMonthStartStr = format(addMonths(monthStart, 1), "yyyy-MM-01");

    return transactions
      .filter(t => t.type === "expense")
      .filter(t => {
        const dateStr = t.date.substring(0, 10);
        return dateStr >= startStr && dateStr < nextMonthStartStr;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, displayMonth]);

  // Agrupamento de despesas por dia para exibição no calendário
  const expensesByDay = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.type === "expense")
      .forEach(t => {
        const day = t.date.substring(0, 10);
        map[day] = (map[day] || 0) + t.amount;
      });
    return map;
  }, [transactions]);

  const handlePreviousMonth = () => {
    setDirection("left");
    setInternalCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setDirection("right");
    setInternalCurrentMonth(prev => addMonths(prev, 1));
  };

  const content = (
    <div className={cn("p-6 flex flex-col h-full", isMobile && "p-4")}>
      {!isMobile && (
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-2 bg-[#1E6BCE] rounded-full shadow-[0_0_15px_rgba(30,107,206,0.4)]" />
          <h2 className="text-xl font-black text-gray-800 tracking-tight">Calendário de Despesas</h2>
        </div>
      )}
      
      {!hideNavigation && (
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button 
              onClick={handlePreviousMonth} 
              className={cn(
                "flex items-center justify-center h-10 w-10 p-0 bg-gradient-to-b from-gray-100 to-gray-200/60 border border-gray-300/40 shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] !rounded-xl opacity-90 hover:opacity-100 hover:bg-gray-200/80 transition-all active:scale-95 active:shadow-inner",
                isMobile && "h-8 w-8"
              )}
            >
              <DynamicIcon name="ChevronLeft" className={cn("h-5 w-5", isMobile && "h-4 w-4")} />
            </Button>
            
            <div className="flex flex-col items-center min-w-[120px] md:min-w-[160px]">
              <span className={cn("text-lg md:text-xl font-black capitalize text-gray-800 tracking-tighter leading-none", isMobile && "text-base")}>
                {format(displayMonth, "MMMM", { locale: ptBR })}
              </span>
              <span className="text-[10px] font-black text-blue-500/60 uppercase tracking-[0.2em] mt-1.5">
                {format(displayMonth, "yyyy")}
              </span>
            </div>
 
            <Button 
              onClick={handleNextMonth} 
              className={cn(
                "flex items-center justify-center h-10 w-10 p-0 bg-gradient-to-b from-gray-100 to-gray-200/60 border border-gray-300/40 shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] !rounded-xl opacity-90 hover:opacity-100 hover:bg-gray-200/80 transition-all active:scale-95 active:shadow-inner",
                isMobile && "h-8 w-8"
              )}
            >
              <DynamicIcon name="ChevronRight" className={cn("h-5 w-5", isMobile && "h-4 w-4")} />
            </Button>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Total no Mês</span>
            <span className={cn("text-2xl font-black text-destructive tracking-tighter leading-none drop-shadow-sm", isMobile && "text-lg")}>
              {formatCurrency(totalMonthlyExpenses)}
            </span>
          </div>
        </div>
      )}
      
      {/* Container com Altura Natural e Navegação Fluida */}
      <div 
        className={cn(
          "relative w-full overflow-hidden rounded-[24px] border border-blue-100/30 bg-white/40 shadow-inner transition-all duration-300",
          "min-h-[300px]"
        )}
      >
        <div 
          key={format(displayMonth, "yyyy-MM")} 
          className={cn(
            "animate-in fade-in duration-500 p-2 md:p-3",
            direction === "right" ? "slide-in-from-right-4" : "slide-in-from-left-4"
          )}
        >
          <Calendar
            mode="single"
            month={displayMonth}
            onMonthChange={setInternalCurrentMonth}
            fixedWeeks={false}
            showOutsideDays={false}
            locale={ptBR}
            className="p-0 w-full"
            classNames={{
              months: "w-full flex justify-center",
              month: "w-full space-y-4",
              caption: "hidden", // Usamos navegação própria
              table: "w-full border-collapse",
              head_row: "flex justify-center gap-0.5 mb-1.5",
              head_cell: "text-blue-400/80 font-black text-[10px] uppercase tracking-widest text-center w-9",
              row: "flex w-full justify-center gap-0.5 mt-0.5",
              cell: "h-12 w-9 text-center text-sm p-0 relative", // Aumentado h para acomodar indicadores
              day: "h-9 w-9 p-0 font-normal flex items-center justify-center", // Tamanho fixo h-9 w-9
              day_today: "bg-blue-50/80 text-blue-700 font-black rounded-lg border border-blue-100/50",
              day_outside: "opacity-20 pointer-events-none",
            }}
            components={{
              Day: ({ date }) => {
                const dayKey = format(date, "yyyy-MM-dd");
                const amount = expensesByDay[dayKey];
                const isCurrentMonth = isWithinInterval(date, {
                  start: startOfMonth(displayMonth),
                  end: endOfMonth(displayMonth)
                });
                const isToday = isSameDay(date, new Date());
                
                if (!isCurrentMonth) return <div className="h-9 w-9" />;

                return (
                  <div className={cn(
                    "flex flex-col items-center justify-start h-12 w-9 transition-all cursor-default group",
                  )}>
                    <div className={cn(
                      "h-9 w-9 flex items-center justify-center rounded-lg transition-all hover:bg-blue-50/30",
                      isToday && "bg-blue-50/50 ring-1 ring-blue-100/50"
                    )}>
                      <span className={cn(
                        "text-[11px] md:text-[13px] font-black tracking-tight",
                        isToday ? "text-blue-600" : "text-gray-500",
                        amount > 0 && !isToday && "text-gray-800"
                      )}>
                        {format(date, "d")}
                      </span>
                    </div>
                    
                    {/* Indicador de despesa logo abaixo do dia */}
                    {amount > 0 && (
                      <div className="flex flex-col items-center w-full mt-0.5">
                        <div 
                          className={cn(
                            "h-1 rounded-full bg-destructive shadow-[0_1px_3px_rgba(239,68,68,0.2)]",
                            amount > 1000 ? "w-6" : (amount > 300 ? "w-3" : "w-1.5")
                          )} 
                        />
                      </div>
                    )}
                  </div>
                );
              }
            }}
          />
        </div>
      </div>

      {/* Legenda sutil */}
      <div className="mt-5 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hoje</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Despesas</span>
        </div>
      </div>
    </div>
  );

  return isMobile ? content : (
    <Card className="rounded-[32px] border border-white/20 bg-white/70 backdrop-blur-[15px] shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden">
      {content}
    </Card>
  );
};