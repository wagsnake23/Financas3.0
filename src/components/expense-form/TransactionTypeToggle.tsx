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
    <div className="w-full">
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
        className={cn("w-full justify-center", isMobile ? "gap-x-2" : "gap-x-4")}
      >
        <ToggleGroupItem
          value="avulsa"
          className={cn(
            "btn-3d flex-1 rounded-xl flex items-center justify-center border-none transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)]",
            !isRecurring ? "!text-white font-bold" : "!text-[#E55B5B]/80 font-medium",
            isMobile && "h-9 py-0.5 text-sm"
          )}
          style={!isRecurring
            ? { "--cor-topo": "#E55B5B", "--cor-base": "#CC4B4B" } as any
            : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any
          }
        >
          <DynamicIcon
            name="Zap"
            className={cn(
              "mr-2 h-4 w-4 transition-colors",
              !isRecurring ? "!text-white" : "!text-[#E55B5B]/80"
            )}
          />{" "}
          Avulsa
        </ToggleGroupItem>
        <ToggleGroupItem
          value="recorrente"
          className={cn(
            "btn-3d flex-1 rounded-xl flex items-center justify-center border-none transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)]",
            isRecurring ? "!text-white font-bold" : "!text-[#E55B5B]/80 font-medium",
            isMobile && "h-9 py-0.5 text-sm"
          )}
          style={isRecurring
            ? { "--cor-topo": "#E55B5B", "--cor-base": "#CC4B4B" } as any
            : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any
          }
        >
          <DynamicIcon
            name="Repeat"
            className={cn(
              "mr-2 h-4 w-4 transition-colors",
              isRecurring ? "!text-white" : "!text-[#E55B5B]/80"
            )}
          />{" "}
          Recorrente
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};