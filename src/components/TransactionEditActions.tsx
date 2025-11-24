import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";

interface TransactionEditActionsProps {
  // REMOVIDO: onTriggerDeleteConfirmation: () => void; // Nova prop para acionar o diálogo
  onSave: () => void;
  onCancel?: () => void; // Tornar opcional, pois pode ser undefined em mobile
  loading: boolean;
  isMobile: boolean;
  isRecurringTransaction: boolean; // Nova prop para indicar se é transação recorrente
}

export const TransactionEditActions: React.FC<TransactionEditActionsProps> = ({
  // REMOVIDO: onTriggerDeleteConfirmation,
  onSave,
  onCancel,
  loading,
  isMobile,
  isRecurringTransaction,
}) => {
  return (
    <>
      <div className={cn("flex gap-2", isMobile ? "flex-row" : "md:flex-row")}>
        {/* REMOVIDO: Botão Excluir */}
        <Button 
          type="submit" 
          variant="ghost" // Alterado para ghost
          className={cn(
            "flex-1 rounded-xl bg-soft-green text-success hover:bg-soft-green/80", // Novas cores
            isMobile && "h-9 text-xs"
          )} 
          disabled={loading} 
          onClick={onSave}
        >
          <DynamicIcon name="CheckCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
          {loading ? "Salvando..." : "Salvar"}
        </Button>
        {onCancel && ( // Renderiza o botão Cancelar apenas se onCancel for fornecido
          <Button 
            type="button" 
            variant="ghost" // Alterado para ghost
            onClick={onCancel} 
            className={cn(
              "flex-1 rounded-xl bg-soft-blue text-primary hover:bg-soft-blue/80", // Novas cores
              isMobile && "h-9 text-xs"
            )} 
            disabled={loading}
          >
            <DynamicIcon name="XCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
            Cancelar
          </Button>
        )}
      </div>
    </>
  );
};