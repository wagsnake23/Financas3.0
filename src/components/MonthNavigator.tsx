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
  onBack?: () => void;
  backButtonColor?: string;
}

export const MonthNavigator: React.FC<MonthNavigatorProps> = ({
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  isMobile,
  hasFiltersActive,
  onClearFilters,
  onBack,
  backButtonColor = "#1E6BCE", // Default blue for back button
}) => {
  return (
    <div className={cn("relative flex items-center justify-center w-full", isMobile ? "h-8" : "h-10")}>
      {onBack && (
        <Button
          size="icon"
          onClick={onBack}
          className={cn(
            "absolute inset-y-0 flex items-center justify-center rounded-xl transition-all active:scale-95 btn-3d bg-white border-none shadow-sm",
            isMobile ? "h-8 w-8 left-4" : "h-10 w-10 left-0"
          )}
          style={{
            "--cor-topo": "#FFFFFF",
            "--cor-base": "#F1F5F9",
            color: backButtonColor
          } as any}
        >
          <DynamicIcon name="ChevronLeft" className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} strokeWidth={3} />
        </Button>
      )}

      <div className={cn("flex items-center justify-center", isMobile ? "gap-2" : "gap-4")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onPreviousMonth}
          className={cn(
            "rounded-xl border-none shadow-none text-primary",
            isMobile ? "h-8 w-8" : "h-10 w-10",
            "hover:bg-primary/10 transition-all active:scale-90"
          )}
        >
          <DynamicIcon name="ChevronLeft" className={cn("h-6 w-6", isMobile && "h-5 w-5")} strokeWidth={3} />
        </Button>
        <h2 className={cn("font-bold capitalize text-gray-700 whitespace-nowrap", isMobile ? "text-base mx-1" : "text-xl mx-2")}>
          {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextMonth}
          className={cn(
            "rounded-xl border-none shadow-none text-primary",
            isMobile ? "h-8 w-8" : "h-10 w-10",
            "hover:bg-primary/10 transition-all active:scale-90"
          )}
        >
          <DynamicIcon name="ChevronRight" className={cn("h-6 w-6", isMobile && "h-5 w-5")} strokeWidth={3} />
        </Button>
      </div>

      {hasFiltersActive && onClearFilters && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearFilters}
          title="Limpar todos os filtros"
          className={cn(
            "absolute inset-y-0 right-0 rounded-xl text-destructive bg-soft-red/50 hover:bg-soft-red/70 transition-all flex items-center justify-center active:scale-95",
            isMobile ? "h-8 w-8 right-4" : "h-10 w-10 right-0"
          )}
        >
          <FilterX className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
        </Button>
      )}
    </div>
  );
};