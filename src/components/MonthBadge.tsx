import React from 'react';
import DynamicIcon from './DynamicIcon';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthBadgeProps {
  selectedMonth: Date;
  isMobile: boolean;
}

export const MonthBadge: React.FC<MonthBadgeProps> = ({ selectedMonth, isMobile }) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-md",
      isMobile ? "p-1" : "p-2" // Keep padding, remove background color
    )}>
      <DynamicIcon name="Calendar" className={cn("text-success", isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <span className={cn("font-bold uppercase leading-none text-success", isMobile ? "text-xs" : "text-sm")}>
        {format(selectedMonth, "MMM", { locale: ptBR })}
      </span>
      <span className={cn("leading-none text-success", isMobile ? "text-[0.6rem]" : "text-xs")}>
        {format(selectedMonth, "yyyy")}
      </span>
    </div>
  );
};