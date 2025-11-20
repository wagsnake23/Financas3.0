import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";
import { format } from "date-fns"; // Importar format
import { ptBR } from "date-fns/locale"; // Importar ptBR

interface EditOptionSelectorProps {
  editOption: "thisMonth" | "thisMonthForward" | "all";
  setEditOption: (option: "thisMonth" | "thisMonthForward" | "all") => void;
  isMobile: boolean;
  loading: boolean;
  currentOccurrenceDate: Date | undefined; // NEW: Prop para a data da ocorrência atual
}

export const EditOptionSelector: React.FC<EditOptionSelectorProps> = ({
  editOption,
  setEditOption,
  isMobile,
  loading,
  currentOccurrenceDate, // NEW
}) => {
  const formattedMonth = currentOccurrenceDate 
    ? format(currentOccurrenceDate, "MMM", { locale: ptBR }) 
    : "";

  return (
    <RadioGroup value={editOption} onValueChange={setEditOption} className="grid grid-cols-3 gap-2">
      {/* Option 1: Somente este mês */}
      <div className="flex items-center space-x-2 p-2 border border-transparent rounded-md [&:has([data-state=checked])]:border-primary">
        <RadioGroupItem value="thisMonth" id="r1" disabled={loading} />
        <Label htmlFor="r1" className={cn("flex items-center gap-1 cursor-pointer", isMobile && "text-xs")}>
          <DynamicIcon name="Calendar" className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} />
          <span>Este mês {isMobile && formattedMonth && `(${formattedMonth})`}</span> {/* NEW: Adiciona o mês para mobile */}
        </Label>
      </div>

      {/* Option 2: Deste mês em diante */}
      <div className="flex items-center space-x-2 p-2 border border-transparent rounded-md [&:has([data-state=checked])]:border-primary">
        <RadioGroupItem value="thisMonthForward" id="r2" disabled={loading} />
        <Label htmlFor="r2" className={cn("flex items-center gap-1 cursor-pointer", isMobile && "text-xs")}>
          <DynamicIcon name="ArrowUp" className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} />
          <span>Deste mês em diante {isMobile && formattedMonth && `(${formattedMonth})`}</span> {/* NEW: Adiciona o mês para mobile */}
        </Label>
      </div>

      {/* Option 3: Toda a recorrência */}
      <div className="flex items-center space-x-2 p-2 border border-transparent rounded-md [&:has([data-state=checked])]:border-primary">
        <RadioGroupItem value="all" id="r3" disabled={loading} />
        <Label htmlFor="r3" className={cn("flex items-center gap-1 cursor-pointer", isMobile && "text-xs")}>
          <DynamicIcon name="Repeat" className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} />
          <span>Toda a recorrência</span>
        </Label>
      </div>
    </RadioGroup>
  );
};