import React from 'react';
import DynamicIcon from './DynamicIcon';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthBadgeProps {
  selectedMonth: Date;
  isMobile: boolean;
  variant: "income" | "expense"; // NEW: Add variant prop
}

export const MonthBadge: React.FC<MonthBadgeProps> = ({ selectedMonth, isMobile, variant }) => {
  const textColorClass = variant === "income" ? "text-success" : "text-destructive"; // Determine text color based on variant

  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-md",
      isMobile ? "p-1" : "p-2" // Keep padding, no background color
    )}>
      <DynamicIcon name="Calendar" className={cn(textColorClass, isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <div className={cn("flex flex-col items-center justify-center gap-y-0")}> {/* Adicionado gap-y-0 aqui */}
        <span className={cn("font-bold uppercase leading-none", textColorClass, isMobile ? "text-xs" : "text-sm", "font-roboto")}>
          {format(selectedMonth, "MMM", { locale: ptBR })}
        </span>
        <span className={cn("leading-none", textColorClass, isMobile ? "text-[0.6rem]" : "text-xs", "font-roboto")}>
          {format(selectedMonth, "yyyy")}
        </span>
      </div>
    </div>
  );
};
