import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant={isPaid ? "default" : "outline"}
          onClick={() => setIsPaid(true)}
          className={cn(
            "flex-1",
            isPaid ? "bg-success text-success-foreground hover:bg-success/90" : "text-muted-foreground hover:bg-muted",
            isMobile && "h-9 text-sm"
          )}
        >
          ✅ Pago!
        </Button>
        <Button
          type="button"
          variant={!isPaid ? "default" : "outline"}
          onClick={() => setIsPaid(false)}
          className={cn(
            "flex-1",
            !isPaid ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "text-muted-foreground hover:bg-muted",
            isMobile && "h-9 text-sm"
          )}
        >
          ☐ Pendente
        </Button>
      </div>
    </div>
  );
};