import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Database } from "@/integrations/supabase/types";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface StatusToggleButtonProps {
  currentStatus: ReceitaStatus;
  transactionType: "income" | "expense";
  onToggle: () => void;
  isMobile: boolean;
  disabled?: boolean;
}

export const StatusToggleButton: React.FC<StatusToggleButtonProps> = ({
  currentStatus,
  transactionType,
  onToggle,
  isMobile,
  disabled = false,
}) => {
  const isPaidOrReceived = currentStatus === "Recebida";
  const isCanceled = currentStatus === "Cancelada";

  const iconName = isPaidOrReceived ? "CheckCircle" : "Circle";
  
  const buttonClasses = cn(
    "h-9 px-3 text-sm rounded-xl",
    isMobile && "h-8 px-2 text-xs",
    isPaidOrReceived ? "bg-success/10 hover:bg-success/20 text-success" : "bg-destructive/10 hover:bg-destructive/20 text-destructive",
    isCanceled && "bg-muted/20 text-muted-foreground cursor-not-allowed hover:bg-muted/20"
  );

  const label = isPaidOrReceived ? "Pago/Recebido" : "Pendente";

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onToggle}
      className={buttonClasses}
      disabled={disabled || isCanceled}
    >
      <DynamicIcon name={iconName} className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
      {label}
    </Button>
  );
};