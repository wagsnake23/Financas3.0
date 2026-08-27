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
            "absolute inset-y-0 flex items-center justify-center rounded-xl transition-all active:scale-95 btn-3d bg-white border border-rose-100 !shadow-none",
            isMobile ? "h-8 w-8 left-0" : "h-10 w-10 left-0"
          )}
          style={{
            "--cor-topo": "#FFF5F5",
            "--cor-base": "#FFE0E0",
            color: "#E54D4D",
            boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)"
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
          size="icon"
          onClick={onClearFilters}
          title="Limpar todos os filtros"
          className={cn(
            "absolute inset-y-0 right-0 rounded-xl btn-3d bg-white border border-rose-100 !shadow-none transition-all flex items-center justify-center active:scale-95",
            isMobile ? "h-8 w-8 right-0" : "h-10 w-10 right-0"
          )}
          style={{
            "--cor-topo": "#FFF5F5",
            "--cor-base": "#FFE0E0",
            boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)"
          } as any}
        >
          <FilterX className={cn(isMobile ? "h-4 w-4" : "h-5 w-5", "text-destructive")} />
        </Button>
      )}
    </div>
  );
};
