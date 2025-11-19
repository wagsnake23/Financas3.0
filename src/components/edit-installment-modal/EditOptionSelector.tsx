import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";

interface EditOptionSelectorProps {
  editOption: "thisMonth" | "thisMonthForward" | "all";
  setEditOption: (option: "thisMonth" | "thisMonthForward" | "all") => void;
  isMobile: boolean;
  loading: boolean;
}

export const EditOptionSelector: React.FC<EditOptionSelectorProps> = ({
  editOption,
  setEditOption,
  isMobile,
  loading,
}) => {
  return (
    <RadioGroup value={editOption} onValueChange={setEditOption} className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <Label
        htmlFor="r1"
        className={cn(
          "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary shadow-sm", // Adicionado rounded-xl e shadow-sm
          isMobile && "p-2 text-sm"
        )}
      >
        <RadioGroupItem value="thisMonth" id="r1" className="sr-only" disabled={loading} />
        <DynamicIcon name="Calendar" className={cn("mb-3 h-6 w-6", isMobile && "mb-1 h-5 w-5")} />
        <span className={cn("block w-full text-center font-normal", isMobile && "text-xs")}>Somente este mês</span>
      </Label>
      <Label
        htmlFor="r2"
        className={cn(
          "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary shadow-sm", // Adicionado rounded-xl e shadow-sm
          isMobile && "p-2 text-sm"
        )}
      >
        <RadioGroupItem value="thisMonthForward" id="r2" className="sr-only" disabled={loading} />
        <DynamicIcon name="ArrowUp" className={cn("mb-3 h-6 w-6", isMobile && "mb-1 h-5 w-5")} />
        <span className={cn("block w-full text-center font-normal", isMobile && "text-xs")}>Deste mês em diante</span>
      </Label>
      <Label
        htmlFor="r3"
        className={cn(
          "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary shadow-sm", // Adicionado rounded-xl e shadow-sm
          isMobile && "p-2 text-sm"
        )}
      >
        <RadioGroupItem value="all" id="r3" className="sr-only" disabled={loading} />
        <DynamicIcon name="Repeat" className={cn("mb-3 h-6 w-6", isMobile && "mb-1 h-5 w-5")} />
        <span className={cn("block w-full text-center font-normal", isMobile && "text-xs")}>Toda a recorrência</span>
      </Label>
    </RadioGroup>
  );
};