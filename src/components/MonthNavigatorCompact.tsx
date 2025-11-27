import React from 'react';
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthNavigatorCompactProps {
  selectedMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  isMobile?: boolean;
  variant: "income" | "expense";
}

export const MonthNavigatorCompact: React.FC<MonthNavigatorCompactProps> = ({
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  isMobile,
  variant,
}) => {
  const textColorClass = variant === "income" ? "text-success" : "text-destructive";

  return (
    <div className={cn(
      "flex items-center justify-center gap-0.5", // Espaçamento compacto entre os elementos
      isMobile ? "flex-row" : "flex-row" // Sempre em linha
    )}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onPreviousMonth}
        className={cn(
          "h-5 w-5 p-0", // Botões pequenos
          "text-muted-foreground hover:bg-muted/50 hover:text-primary"
        )}
      >
        <DynamicIcon name="ChevronLeft" className="h-3 w-3" />
      </Button>
      <div className={cn("flex flex-col items-center", isMobile ? "text-[0.6rem]" : "text-xs")}>
        <span className={cn("font-bold uppercase leading-none", textColorClass, "font-roboto")}>
          {format(selectedMonth, "MMM", { locale: ptBR })}
        </span>
        <span className={cn("leading-none", textColorClass, "font-roboto")}>
          {format(selectedMonth, "yyyy")}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNextMonth}
        className={cn(
          "h-5 w-5 p-0", // Botões pequenos
          "text-muted-foreground hover:bg-muted/50 hover:text-primary"
        )}
      >
        <DynamicIcon name="ChevronRight" className="h-3 w-3" />
      </Button>
    </div>
  );
};