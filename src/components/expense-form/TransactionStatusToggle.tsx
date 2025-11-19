import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// Removido: import DynamicIcon from "@/components/DynamicIcon"; // Não será mais necessário para os ícones grandes

interface TransactionStatusToggleProps {
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
  isMobile: boolean;
}

export const TransactionStatusToggle: React.FC<TransactionStatusToggleProps> = ({
  isPaid,
  setIsPaid,
  isMobile,
}) => {
  return (
    <div className="space-y-2">
      <Label className={cn("text-sm font-medium", isMobile && "text-xs")}>Status desta despesa:</Label>
      <RadioGroup
        value={isPaid ? "paid" : "pending"}
        onValueChange={(value) => setIsPaid(value === "paid")}
        className="flex items-center gap-4" // Ajustado para um layout flexível e compacto
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="paid" id="status-paid" className={cn(isMobile && "h-3.5 w-3.5")} />
          <Label htmlFor="status-paid" className={cn("text-sm font-medium text-success", isMobile && "text-xs")}>
            Pago!
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="pending" id="status-pending" className={cn(isMobile && "h-3.5 w-3.5")} />
          <Label htmlFor="status-pending" className={cn("text-sm font-medium text-destructive", isMobile && "text-xs")}>
            Pendente
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};