import React from 'react';
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthDisplayWithPrevButtonProps {
  selectedMonth: Date;
  onPreviousMonth: () => void;
  isMobile?: boolean;
  variant: "income" | "expense";
}

export const MonthDisplayWithPrevButton: React.FC<MonthDisplayWithPrevButtonProps> = ({
  selectedMonth,
  onPreviousMonth,
  isMobile,
  variant,
}) => {
  const textColorClass = variant === "income" ? "text-success" : "text-destructive";

  return (
    <div className={cn(
      "flex items-center justify-center gap-0.5", // Espaçamento bem compacto
      isMobile ? "flex-col" : "flex-row" // Empilha verticalmente no mobile, horizontalmente no desktop
    )}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onPreviousMonth}
        className={cn(
          "h-5 w-5 p-0", // Botões muito pequenos
          isMobile ? "mb-0.5" : "mr-0.5", // Ajusta margem
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
    </div>
  );
};
