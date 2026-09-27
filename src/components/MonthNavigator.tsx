import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DynamicIcon from "@/components/DynamicIcon";
import { format, setMonth, setYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FilterX, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr",
  "Mai", "Jun", "Jul", "Ago",
  "Set", "Out", "Nov", "Dez",
];

interface MonthNavigatorProps {
  selectedMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  isMobile?: boolean;
  hasFiltersActive?: boolean;
  onClearFilters?: () => void;
  onBack?: () => void;
  backButtonColor?: string;
  onSelectMonth?: (date: Date) => void;
}

export const MonthNavigator: React.FC<MonthNavigatorProps> = ({
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  isMobile,
  hasFiltersActive,
  onClearFilters,
  onBack,
  backButtonColor = "#1E6BCE",
  onSelectMonth,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedMonth.getFullYear());

  const handleMonthClick = (monthIndex: number) => {
    let target = setMonth(selectedMonth, monthIndex);
    target = setYear(target, pickerYear);
    if (onSelectMonth) {
      onSelectMonth(target);
    } else {
      // fallback: navigate via previous/next
      const diff =
        (pickerYear - selectedMonth.getFullYear()) * 12 +
        (monthIndex - selectedMonth.getMonth());
      if (diff > 0) for (let i = 0; i < diff; i++) onNextMonth();
      else if (diff < 0) for (let i = 0; i < -diff; i++) onPreviousMonth();
    }
    setPickerOpen(false);
  };

  const label = format(selectedMonth, "MMMM yyyy", { locale: ptBR });
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

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
        {/* Botão Anterior */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onPreviousMonth}
          className={cn(
            "rounded-xl border-none shadow-none text-primary shrink-0",
            isMobile ? "h-8 w-8" : "h-10 w-10",
            "hover:bg-primary/10 transition-all active:scale-90"
          )}
        >
          <DynamicIcon name="ChevronLeft" className={cn("h-6 w-6", isMobile && "h-5 w-5")} strokeWidth={3} />
        </Button>

        {/* Texto clicável com Popover */}
        <Popover open={pickerOpen} onOpenChange={(open) => {
          setPickerOpen(open);
          if (open) setPickerYear(selectedMonth.getFullYear());
        }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "font-bold capitalize text-gray-700 whitespace-nowrap rounded-lg px-2 py-1 transition-colors hover:bg-primary/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                isMobile ? "text-base" : "text-xl",
                "w-[190px] text-center"
              )}
              title="Selecionar mês e ano"
            >
              {capitalizedLabel}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="center"
            sideOffset={6}
            className="w-[260px] p-0 rounded-[16px] shadow-xl border border-slate-200 bg-white overflow-hidden z-[200]"
          >
            {/* Header do picker — navegação de ano */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setPickerYear(y => y - 1)}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <span className="font-bold text-[15px] text-slate-800">{pickerYear}</span>
              <button
                type="button"
                onClick={() => setPickerYear(y => y + 1)}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>

            {/* Grade de meses */}
            <div className="grid grid-cols-4 gap-1 p-3">
              {MONTHS.map((m, i) => {
                const isSelected =
                  i === selectedMonth.getMonth() &&
                  pickerYear === selectedMonth.getFullYear();
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMonthClick(i)}
                    className={cn(
                      "rounded-[10px] py-2 text-[13px] font-semibold transition-all active:scale-95",
                      isSelected
                        ? "bg-primary text-white shadow-sm"
                        : "text-slate-700 hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Botão Próximo */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextMonth}
          className={cn(
            "rounded-xl border-none shadow-none text-primary shrink-0",
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
