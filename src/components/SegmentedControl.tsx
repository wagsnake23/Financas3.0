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
  const selectedIndex = options.findIndex((option) => option.value === selectedOption);

  return (
    <div className={cn("relative flex bg-muted p-1 rounded-full", isMobile && "p-0.5")}>
      <div
        className={cn(
          "absolute top-1 bottom-1 bg-primary rounded-full transition-all duration-300",
          isMobile && "top-0.5 bottom-0.5"
        )}
        style={{
          width: `${100 / options.length}%`,
          left: `${(100 / options.length) * selectedIndex}%`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            "flex-1 text-center py-2 rounded-full font-medium transition-all relative z-10 flex items-center justify-center gap-2",
            isMobile && "py-1.5 text-xs"
            // Removidas as classes de cor de texto daqui para permitir que o ícone tenha sua própria cor
          )}
        >
          {option.iconName && <DynamicIcon name={option.iconName} className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} color={option.iconColor} />}
          <span className={cn( // A cor do texto é aplicada diretamente ao span do label
            selectedOption === option.value
              ? "text-primary-foreground font-semibold"
              : "text-muted-foreground"
          )}>
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
};