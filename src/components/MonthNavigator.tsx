import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FilterX } from "lucide-react"; // Importar cn

interface MonthNavigatorProps {
  selectedMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  isMobile?: boolean;
  hasFiltersActive?: boolean;
  onClearFilters?: () => void;
}

export const MonthNavigator: React.FC<MonthNavigatorProps> = ({
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  isMobile,
  hasFiltersActive,
  onClearFilters,
}) => {
  return (
    <div className={cn("relative flex items-center justify-center", isMobile ? "mb-4 h-8" : "mb-6 h-10")}>
      <div className={cn("flex items-center justify-center", isMobile ? "gap-4" : "gap-6")}>
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

      {hasFiltersActive && onClearFilters && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearFilters}
          title="Limpar todos os filtros"
          className={cn(
            "absolute right-0 rounded-xl text-destructive bg-soft-red/50 hover:bg-soft-red/70 transition-all",
            isMobile ? "h-8 w-8 right-2" : "h-10 w-10 right-4"
          )}
        >
          <FilterX className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
        </Button>
      )}
    </div>
  );
};