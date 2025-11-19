import React from "react";
// Removido: import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Importar RadioGroup e RadioGroupItem
import DynamicIcon from "@/components/DynamicIcon"; // Importar DynamicIcon

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
        className="grid grid-cols-2 gap-2"
      >
        <Label
          htmlFor="status-paid"
          className={cn(
            "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground",
            "[&:has([data-state=checked])]:border-success [&:has([data-state=checked])]:bg-success/10", // Estilo para 'Pago'
            isMobile && "p-2 text-sm"
          )}
        >
          <RadioGroupItem value="paid" id="status-paid" className="sr-only" />
          <DynamicIcon name="CheckCircle" className={cn("mb-2 h-6 w-6 text-success", isMobile && "mb-1 h-5 w-5")} />
          <span className={cn("block w-full text-center font-normal", isMobile && "text-xs")}>Pago!</span>
        </Label>
        <Label
          htmlFor="status-pending"
          className={cn(
            "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground",
            "[&:has([data-state=checked])]:border-destructive [&:has([data-state=checked])]:bg-destructive/10", // Estilo para 'Pendente'
            isMobile && "p-2 text-sm"
          )}
        >
          <RadioGroupItem value="pending" id="status-pending" className="sr-only" />
          <DynamicIcon name="Circle" className={cn("mb-2 h-6 w-6 text-destructive", isMobile && "mb-1 h-5 w-5")} />
          <span className={cn("block w-full text-center font-normal", isMobile && "text-xs")}>Pendente</span>
        </Label>
      </RadioGroup>
    </div>
  );
};