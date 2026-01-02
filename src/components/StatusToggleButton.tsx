import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Database } from "@/integrations/supabase/types";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface StatusToggleButtonProps {
  currentStatus: ReceitaStatus;
  onToggle: () => void;
  isMobile: boolean;
  disabled?: boolean;
}

export const StatusToggleButton: React.FC<StatusToggleButtonProps> = ({
  currentStatus,
  onToggle,
  isMobile,
  disabled = false,
}) => {
  const isPaidOrReceived = currentStatus === "Recebida";

  const label = isPaidOrReceived ? "Pago/Recebido" : "Pendente";

  return (
    <div
      onClick={!disabled ? onToggle : undefined}
      className={cn(
        "flex items-center gap-2 cursor-pointer select-none transition-all",
        disabled && "opacity-50 cursor-not-allowed",
        isMobile ? "h-8" : "h-9"
      )}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center transition-all border shadow-sm",
          isMobile ? "h-5 w-5" : "h-6 w-6",
          isPaidOrReceived
            ? "bg-success border-success text-white scale-110 shadow-success/20"
            : "bg-white border-destructive/50 text-transparent hover:border-success/50"
        )}
      >
        {isPaidOrReceived && (
          <span className={cn(
            "font-black drop-shadow-sm",
            isMobile ? "text-[12px]" : "text-sm"
          )}>✓</span>
        )}
      </div>

      <span className={cn(
        "tracking-tight transition-all",
        isMobile ? "text-[0.75rem]" : "text-sm",
        isPaidOrReceived
          ? "text-success font-bold"
          : "text-gray-400 italic"
      )}>
        {label}
      </span>
    </div>
  );
};