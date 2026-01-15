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
      containerVars: { "--cor-topo": "#E6F0FF", "--cor-base": "#DCEBFF" },
      border: "border-blue-200",
      text: "text-[#1E6BCE]",
      buttonGradient: "linear-gradient(180deg, #6B95FF 0%, #4A74D4 100%)"
    },
    expense: {
      containerVars: { "--cor-topo": "#FFF5F5", "--cor-base": "#FFEBEB" },
      border: "border-rose-200",
      text: "text-[#E54D4D]",
      buttonGradient: "linear-gradient(180deg, #FF7D7D 0%, #D64545 100%)"
    },
    income: {
      containerVars: { "--cor-topo": "#F0FDF4", "--cor-base": "#DCFCE7" },
      border: "border-emerald-200",
      text: "text-[#1AA361]",
      buttonGradient: "linear-gradient(180deg, #66E0A3 0%, #2DAD70 100%)"
    },
    yield: {
      containerVars: { "--cor-topo": "#FFF8F1", "--cor-base": "#FFEEDD" },
      border: "border-orange-200",
      text: "text-orange-600",
      buttonGradient: "linear-gradient(180deg, #FDBA74 0%, #EA580C 100%)"
    }
  };

  const currentStyle = variantStyles[variant] || variantStyles.balance;

  return (
    <div
      className={cn(
        "btn-3d flex items-center justify-between px-1 rounded-2xl transition-all h-9 w-[135px] border shadow-none cursor-default",
        currentStyle.border,
        isMobile ? "" : "-mr-1"
      )}
      style={{
        ...currentStyle.containerVars,
        boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)"
      } as any}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPreviousMonth(); }}
        className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm shrink-0"
        style={{
          background: currentStyle.buttonGradient,
          boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)"
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
        className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm shrink-0"
        style={{
          background: currentStyle.buttonGradient,
          boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)"
        }}
      >
        <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={4} />
      </button>
    </div>
  );
};