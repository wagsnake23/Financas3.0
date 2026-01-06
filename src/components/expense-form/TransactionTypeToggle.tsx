import React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";

interface TransactionTypeToggleProps {
  isRecurring: boolean;
  onSelectAvulsa: () => void;
  onSelectRecorrente: () => void;
  isMobile: boolean;
}

export const TransactionTypeToggle: React.FC<TransactionTypeToggleProps> = ({
  isRecurring,
  onSelectAvulsa,
  onSelectRecorrente,
  isMobile,
}) => {
  return (
    <div className="space-y-2">
      {!isMobile && ( // Renderiza o Label apenas se NÃO for mobile
        <Label className={cn(isMobile && "text-xs")}>Tipo de Lançamento</Label>
      )}
      <ToggleGroup
        type="single"
        value={isRecurring ? "recorrente" : "avulsa"}
        onValueChange={(value) => {
          if (value === "recorrente") {
            onSelectRecorrente();
          } else {
            onSelectAvulsa();
          }
        }}
        className={cn("w-full justify-center", isMobile && "gap-x-2")}
      >
        <ToggleGroupItem
          value="avulsa"
          className={cn(
            "flex-1 rounded-xl flex items-center justify-center border transition-all duration-200",
            "data-[state=on]:bg-[#E55B5B] data-[state=on]:text-white data-[state=on]:font-bold data-[state=on]:border-none",
            "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground",
            isMobile ? "h-8 py-0.5 text-xs" : "h-10 text-sm"
          )}
        >
          <DynamicIcon
            name="⚡"
            className={cn(
              "mr-1.5 h-3.5 w-3.5 transition-colors",
              isRecurring ? "text-muted-foreground" : "text-white"
            )}
          /> Avulsa
        </ToggleGroupItem>
        <ToggleGroupItem
          value="recorrente"
          className={cn(
            "flex-1 rounded-xl flex items-center justify-center border transition-all duration-200",
            "data-[state=on]:bg-[#E55B5B] data-[state=on]:text-white data-[state=on]:font-bold data-[state=on]:border-none",
            "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground",
            isMobile ? "h-8 py-0.5 text-xs" : "h-10 text-sm"
          )}
        >
          <DynamicIcon
            name="🔁"
            className={cn(
              "mr-1.5 h-3.5 w-3.5 transition-colors",
              isRecurring ? "text-white" : "text-muted-foreground"
            )}
          /> Recorrente
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};