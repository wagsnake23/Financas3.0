import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

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
    <div className="flex items-center justify-between mb-6">
      <Button variant="outline" size="icon" onClick={onPreviousMonth}>
        <DynamicIcon name="ChevronLeft" className="h-4 w-4" />
      </Button>
      <h2 className="text-xl font-bold capitalize">
        {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
      </h2>
      <Button variant="outline" size="icon" onClick={onNextMonth}>
        <DynamicIcon name="ChevronRight" className="h-4 w-4" />
      </Button>
    </div>
  );
};