import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Database } from "@/integrations/supabase/types";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface RevenueStatusToggleProps {
  status: ReceitaStatus;
  setStatus: (status: ReceitaStatus) => void;
  isMobile: boolean;
}

export const RevenueStatusToggle: React.FC<RevenueStatusToggleProps> = ({
  status,
  setStatus,
  isMobile,
}) => {
  const handleValueChange = (value: string) => {
    if (value === "paid") {
      setStatus("Recebida");
    } else if (value === "pending") {
      setStatus("Pendente");
    }
    // 'Prevista' and 'Cancelada' statuses are not handled by this toggle,
    // as per the request for 'pago e pendente' options.
  };

  return (
    <div className="space-y-2">
      <Label className={cn("text-sm font-medium", isMobile && "text-xs")}>Status desta receita:</Label>
      <RadioGroup
        value={status === "Recebida" ? "paid" : "pending"} // Map 'Recebida' to 'paid', others to 'pending'
        onValueChange={handleValueChange}
        className="flex items-center justify-center gap-6"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem
            value="paid"
            id="status-paid-revenue"
            className={cn(
              isMobile && "h-3.5 w-3.5",
              "peer",
              // Borda verde quando selecionado
              "data-[state=checked]:border-success",
              // Bolinha interna verde sólida
              "data-[state=checked]:after:bg-success",
              // Anel do foco também verde
              "data-[state=checked]:ring-success"
            )}
          />
          <Label
            htmlFor="status-paid-revenue"
            className={cn(
              "text-sm font-normal text-muted-foreground",
              isMobile && "text-xs",
              "peer-data-[state=checked]:text-success peer-data-[state=checked]:font-bold"
            )}
          >
            Pago!
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem
            value="pending"
            id="status-pending-revenue"
            className={cn(
              isMobile && "h-3.5 w-3.5",
              "peer",
              // Borda vermelha quando selecionado
              "data-[state=checked]:border-destructive",
              // Bolinha interna vermelha sólida
              "data-[state=checked]:after:bg-destructive",
              // Anel do foco também vermelho
              "data-[state=checked]:ring-destructive"
            )}
          />
          <Label
            htmlFor="status-pending-revenue"
            className={cn(
              "text-sm font-normal text-muted-foreground",
              isMobile && "text-xs",
              "peer-data-[state=checked]:text-destructive peer-data-[state=checked]:font-bold"
            )}
          >
            Pendente
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};