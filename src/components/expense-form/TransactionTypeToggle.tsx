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
            "btn-3d flex-1 rounded-xl flex items-center justify-center border-none shadow-[0_2px_4px_rgba(0,0,0,0.05)] !opacity-100",
            !isRecurring ? "!text-white font-bold" : "!text-[#E54D4D] font-extrabold",
            isMobile && "!h-[42px] py-0.5 text-sm"
          )}
          style={!isRecurring
            ? { "--cor-topo": "#EE5D5D", "--cor-base": "#E54D4D", opacity: 1 } as any
            : { "--cor-topo": "#FFFFFF", "--cor-base": "#F8FAFC", opacity: 1, boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any
          }
        >
          <DynamicIcon
            name="Zap"
            className={cn(
              "mr-2 h-4 w-4",
              !isRecurring ? "!text-white" : "!text-[#E54D4D]"
            )}
          />{" "}
          Avulsa
        </ToggleGroupItem>
        <ToggleGroupItem
          value="recorrente"
          className={cn(
            "btn-3d flex-1 rounded-xl flex items-center justify-center border-none shadow-[0_2px_4px_rgba(0,0,0,0.05)] !opacity-100",
            isRecurring ? "!text-white font-bold" : "!text-[#E54D4D] font-extrabold",
            isMobile && "!h-[42px] py-0.5 text-sm"
          )}
          style={isRecurring
            ? { "--cor-topo": "#EE5D5D", "--cor-base": "#E54D4D", opacity: 1 } as any
            : { "--cor-topo": "#FFFFFF", "--cor-base": "#F8FAFC", opacity: 1, boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any
          }
        >
          <DynamicIcon
            name="Repeat"
            className={cn(
              "mr-2 h-4 w-4",
              isRecurring ? "!text-white" : "!text-[#E54D4D]"
            )}
          />{" "}
          Recorrente
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};
