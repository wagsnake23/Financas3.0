import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
        className="flex items-center justify-center gap-6"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="paid" id="status-paid" className={cn(isMobile && "h-3.5 w-3.5", "peer")} />
          <Label
            htmlFor="status-paid"
            className={cn(
              "text-sm font-normal text-muted-foreground",
              isMobile && "text-xs",
              "peer-data-[state=checked]:text-success peer-data-[state=checked]:font-bold" // Corrigido para usar peer-data
            )}
          >
            Pago!
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="pending" id="status-pending" className={cn(isMobile && "h-3.5 w-3.5", "peer")} />
          <Label
            htmlFor="status-pending"
            className={cn(
              "text-sm font-normal text-muted-foreground",
              isMobile && "text-xs",
              "peer-data-[state=checked]:text-destructive peer-data-[state=checked]:font-bold" // Corrigido para usar peer-data
            )}
          >
            Pendente
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};