import React from "react";
import { cn } from "@/lib/utils";
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon

interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
  iconName?: string; // Nome do ícone para DynamicIcon
  iconColor?: string; // Adicionada a propriedade iconColor
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  selectedOption: T;
  onSelect: (value: T) => void;
  isMobile?: boolean;
}

export const SegmentedControl = <T extends string>({
  options,
  selectedOption,
  onSelect,
  isMobile,
}: SegmentedControlProps<T>) => {
  return (
    <div className={cn("relative flex p-1 rounded-full", isMobile && "p-0.5")}> {/* Removido bg-muted */}
      {options.map((option) => {
        const isActive = selectedOption === option.value;
        const iconColorToUse = isActive ? "hsl(var(--success-foreground))" : option.iconColor; // Usa branco para ativo, cor original para inativo

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex-1 text-center py-2 rounded-full font-medium transition-all relative z-10 flex items-center justify-center gap-2",
              isMobile && "py-1.5 text-xs",
              isActive
                ? "bg-success text-success-foreground"
                : "bg-transparent text-muted-foreground"
            )}
          >
            {option.iconName && (
              <DynamicIcon
                name={option.iconName}
                className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")}
                color={iconColorToUse}
              />
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};