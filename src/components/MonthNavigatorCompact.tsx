import React from 'react';
import DynamicIcon from "@/components/DynamicIcon";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthNavigatorCompactProps {
  selectedMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  isMobile?: boolean;
  variant: "income" | "expense" | "balance" | "yield";
}

export const MonthNavigatorCompact: React.FC<MonthNavigatorCompactProps> = ({
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  isMobile,
  variant,
}) => {

  const variantStyles = {
    balance: {
      containerVars: { "--cor-topo": "#F0F7FF", "--cor-base": "#E0EFFF" },
      border: "border-blue-300/50",
      text: "text-blue-700",
      buttonGradient: "linear-gradient(180deg, #2563EB 0%, #1E40AF 100%)"
    },
    expense: {
      containerVars: { "--cor-topo": "#FFF5F5", "--cor-base": "#FFEBEB" },
      border: "border-rose-300/50",
      text: "text-rose-700",
      buttonGradient: "linear-gradient(180deg, #EF4444 0%, #B91C1C 100%)"
    },
    income: {
      containerVars: { "--cor-topo": "#F0FDF4", "--cor-base": "#DCFCE7" },
      border: "border-emerald-300/50",
      text: "text-emerald-700",
      buttonGradient: "linear-gradient(180deg, #22C55E 0%, #15803D 100%)"
    },
    yield: {
      containerVars: { "--cor-topo": "#F5F3FF", "--cor-base": "#EDE9FE" },
      border: "border-purple-300/50",
      text: "text-purple-700",
      buttonGradient: "linear-gradient(180deg, #9333EA 0%, #6B21A8 100%)"
    }
  };

  const currentStyle = variantStyles[variant] || variantStyles.balance;

  return (
    <div
      className={cn(
        "btn-3d flex items-center justify-between px-1 rounded-2xl transition-all h-9 w-[135px] border shadow-none cursor-default",
        currentStyle.border
      )}
      style={{
        ...currentStyle.containerVars,
        boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.4), inset 0px -1px 2px rgba(0, 0, 0, 0.05)"
      } as any}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPreviousMonth(); }}
        className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-md shrink-0 ring-1 ring-black/10"
        style={{
          background: currentStyle.buttonGradient,
          boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), 0px 2px 4px rgba(0, 0, 0, 0.1)"
        }}
      >
        <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={4} />
      </button>

      <span className={cn(
        "text-[12px] font-black px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap",
        currentStyle.text
      )}>
        {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onNextMonth(); }}
        className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-md shrink-0 ring-1 ring-black/10"
        style={{
          background: currentStyle.buttonGradient,
          boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), 0px 2px 4px rgba(0, 0, 0, 0.1)"
        }}
      >
        <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={4} />
      </button>
    </div>
  );
};