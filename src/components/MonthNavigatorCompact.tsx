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
  variant: "income" | "expense" | "balance" | "yield";
}

export const MonthNavigatorCompact: React.FC<MonthNavigatorCompactProps> = ({
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  isMobile,
  variant,
}) => {
  const textColorClass = variant === "income" ? "text-success" : variant === "expense" ? "text-destructive" : variant === "yield" ? "text-yield" : "text-primary";
  const hoverBgClass = variant === "income" ? "hover:bg-success/10" : variant === "expense" ? "hover:bg-destructive/10" : variant === "yield" ? "hover:bg-yield/10" : "hover:bg-primary/10";
  const hoverTextColorClass = variant === "income" ? "hover:text-success" : variant === "expense" ? "hover:text-destructive" : variant === "yield" ? "hover:text-yield" : "hover:text-primary";

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
          isMobile ? "h-7 w-7 p-0" : "h-8 w-8 p-0", // Botões maiores
          "font-bold", // Negrito para o texto do botão
          textColorClass, // Aplica a cor do texto (verde/vermelho)
          hoverBgClass, // Cor de fundo ao passar o mouse
          hoverTextColorClass // Cor do texto ao passar o mouse
        )}
      >
        <DynamicIcon name="ChevronLeft" className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} /> {/* Ícone maior */}
      </Button>
      <div className={cn("flex flex-col items-center", isMobile ? "text-xs" : "text-sm")}> {/* Ajustado o tamanho base para mobile e desktop */}
        <span className={cn("font-bold uppercase leading-none", textColorClass, isMobile ? "text-sm" : "text-base", "font-roboto")}> {/* Mês: maior */}
          {format(selectedMonth, "MMM", { locale: ptBR })}
        </span>
        <span className={cn("leading-none", textColorClass, isMobile ? "text-xs" : "text-sm", "font-roboto")}> {/* Ano: um pouco menor que o mês */}
          {format(selectedMonth, "yyyy")}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNextMonth}
        className={cn(
          isMobile ? "h-7 w-7 p-0" : "h-8 w-8 p-0", // Botões maiores
          "font-bold", // Negrito para o texto do botão
          textColorClass, // Aplica a cor do texto (verde/vermelho)
          hoverBgClass, // Cor de fundo ao passar o mouse
          hoverTextColorClass // Cor do texto ao passar o mouse
        )}
      >
        <DynamicIcon name="ChevronRight" className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} /> {/* Ícone maior */}
      </Button>
    </div>
  );
};