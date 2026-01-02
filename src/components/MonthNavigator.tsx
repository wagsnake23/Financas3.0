import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils"; // Importar cn

interface MonthNavigatorProps {
  selectedMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  isMobile?: boolean;
}

export const MonthNavigator: React.FC<MonthNavigatorProps> = ({
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  isMobile,
}) => {
  return (
    <div className={cn("flex items-center justify-center", isMobile ? "gap-6 mb-4" : "gap-10 mb-6")}> {/* Aumentado significativamente o gap para dar mais 'respiro' */}
      <Button
        variant="outline"
        size="icon"
        onClick={onPreviousMonth}
        className={cn(
          "rounded-xl", // Cantos arredondados
          isMobile && "h-8 w-8",
          "hover:bg-primary/10 hover:text-primary" // Destaque ao passar o mouse
        )}
      >
        <DynamicIcon name="ChevronLeft" className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} /> {/* Ajustado tamanho do ícone para mobile */}
      </Button>
      <h2 className={cn("text-xl font-bold capitalize text-gray-700", isMobile && "text-lg")}> {/* Adicionado tamanho de fonte responsivo e cor cinza escuro */}
        {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
      </h2>
      <Button
        variant="outline"
        size="icon"
        onClick={onNextMonth}
        className={cn(
          "rounded-xl", // Cantos arredondados
          isMobile && "h-8 w-8",
          "hover:bg-primary/10 hover:text-primary" // Destaque ao passar o mouse
        )}
      >
        <DynamicIcon name="ChevronRight" className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} /> {/* Ajustado tamanho do ícone para mobile */}
      </Button>
    </div>
  );
};