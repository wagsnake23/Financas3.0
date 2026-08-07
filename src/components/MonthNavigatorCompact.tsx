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
  premiumMode?: boolean;
}

export const MonthNavigatorCompact: React.FC<MonthNavigatorCompactProps> = ({
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  isMobile,
  variant,
  premiumMode,
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
        "btn-3d flex items-center justify-between px-1 rounded-full transition-all h-[34px] w-[122px] border cursor-default",
        premiumMode ? "bg-white/80 backdrop-blur-md border-white/60 shadow-[0_2px_10px_rgba(0,0,0,0.04)]" : cn("shadow-none", currentStyle.border)
      )}
      style={premiumMode ? {} : {
        ...currentStyle.containerVars,
        boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.4), inset 0px -1px 2px rgba(0, 0, 0, 0.05)"
      } as any}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPreviousMonth(); }}
        className={cn(
          "hover:opacity-90 rounded-full p-0 h-[22px] w-[22px] flex items-center justify-center transition-all shrink-0",
          premiumMode 
            ? "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80 shadow-sm" 
            : "text-white shadow-md ring-1 ring-black/10"
        )}
        style={premiumMode ? {} : {
          background: currentStyle.buttonGradient,
          boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), 0px 2px 4px rgba(0, 0, 0, 0.1)"
        }}
      >
        <DynamicIcon name="ChevronLeft" className="h-3 w-3" strokeWidth={4} />
      </button>

      <span className={cn(
        "text-[11px] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap",
        premiumMode ? "text-slate-800 font-extrabold" : cn("font-black", currentStyle.text)
      )}>
        {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onNextMonth(); }}
        className={cn(
          "hover:opacity-90 rounded-full p-0 h-[22px] w-[22px] flex items-center justify-center transition-all shrink-0",
          premiumMode 
            ? "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80 shadow-sm" 
            : "text-white shadow-md ring-1 ring-black/10"
        )}
        style={premiumMode ? {} : {
          background: currentStyle.buttonGradient,
          boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), 0px 2px 4px rgba(0, 0, 0, 0.1)"
        }}
      >
        <DynamicIcon name="ChevronRight" className="h-3 w-3" strokeWidth={4} />
      </button>
    </div>
  );
};