import React from "react";
import { cn } from "@/lib/utils";
import { Database } from "@/integrations/supabase/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check } from "lucide-react";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface StatusToggleButtonProps {
  currentStatus: ReceitaStatus;
  onToggle: () => void;
  isMobile: boolean;
  disabled?: boolean;
  transactionType?: "income" | "expense";
}

export const StatusToggleButton: React.FC<StatusToggleButtonProps> = ({
  currentStatus,
  onToggle,
  isMobile,
  disabled = false,
  transactionType = "expense",
}) => {
  const isPaidOrReceived = currentStatus === "Recebida";
  const statusLabel = transactionType === "income" ? "Recebido" : "Pago";

  const handleValueChange = (value: string) => {
    if (disabled) return;

    // If clicking "paid" and currently not paid => toggle
    if (value === "paid" && !isPaidOrReceived) {
      onToggle();
    }
    // If clicking "pending" and currently paid => toggle
    else if (value === "pending" && isPaidOrReceived) {
      onToggle();
    }
  };

  return (
    <RadioGroup
      value={isPaidOrReceived ? "paid" : "pending"}
      onValueChange={handleValueChange}
      className={cn("flex items-center gap-6", disabled && "opacity-50")}
      disabled={disabled}
    >
      {/* === PAGO / RECEBIDO === */}
      <label
        htmlFor="status-paid-toggle"
        className={cn("flex items-center gap-2 cursor-pointer select-none")}
      >
        <RadioGroupItem
          value="paid"
          id="status-paid-toggle"
          className={cn(
            "relative flex items-center justify-center transition-all",
            "w-[18px] h-[18px] rounded-full border",
            isPaidOrReceived
              ? "bg-[#25D366] border-[#25D366]"
              : "border-gray-400 bg-white"
          )}
        >
          {isPaidOrReceived && (
            <Check
              className="absolute text-white w-[13px] h-[13px]"
              strokeWidth={4}
            />
          )}
        </RadioGroupItem>

        <span
          className={cn(
            "text-sm font-extrabold",
            isPaidOrReceived ? "text-[#1DA554]" : "text-gray-500",
            isMobile && "text-xs"
          )}
        >
          {statusLabel}
        </span>
      </label>

      {/* === PENDENTE === */}
      <label
        htmlFor="status-pending-toggle"
        className={cn("flex items-center gap-2 cursor-pointer select-none")}
      >
        <RadioGroupItem
          value="pending"
          id="status-pending-toggle"
          className={cn(
            "relative flex items-center justify-center transition-all",
            "w-[18px] h-[18px] rounded-full border",
            !isPaidOrReceived
              ? "bg-[#FF6D6D] border-[#FF6D6D]"
              : "border-gray-400 bg-white"
          )}
        >
          {!isPaidOrReceived && (
            <Check
              className="absolute text-white w-[13px] h-[13px]"
              strokeWidth={4}
            />
          )}
        </RadioGroupItem>

        <span
          className={cn(
            "text-sm font-extrabold",
            !isPaidOrReceived ? "text-[#E84F4F]" : "text-gray-500",
            isMobile && "text-xs"
          )}
        >
          Pendente
        </span>
      </label>
    </RadioGroup>
  );
};