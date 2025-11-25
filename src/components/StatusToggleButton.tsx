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
  
  const buttonClasses = cn(
    "h-9 px-3 text-sm rounded-xl",
    isMobile && "h-8 px-2 text-xs",
    // Removido as classes de background e hover background para deixar o fundo transparente
    isPaidOrReceived ? "text-success hover:bg-transparent" : "text-destructive hover:bg-transparent",
  );

  const label = isPaidOrReceived ? "Pago/Recebido" : "Pendente";

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onToggle}
      className={buttonClasses}
      disabled={disabled}
    >
      <DynamicIcon name={isPaidOrReceived ? "CheckCircle" : "Circle"} className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
      {label}
    </Button>
  );
};