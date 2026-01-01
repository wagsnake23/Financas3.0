import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";

interface TransactionEditActionsProps {
  onTriggerDeleteConfirmation: () => void; // Nova prop para acionar o diálogo
  onSave: (e?: React.FormEvent) => void;
  onCancel: () => void;
  loading: boolean;
  isMobile: boolean;
  isRecurringTransaction: boolean; // Nova prop para indicar se é transação recorrente
  className?: string; // Adicionado className para receber classes externas
}

export const TransactionEditActions: React.FC<TransactionEditActionsProps> = ({
  onTriggerDeleteConfirmation,
  onSave,
  onCancel,
  loading,
  isMobile,
  isRecurringTransaction,
  className, // Receber a prop className
}) => {
  return (
    <div className={cn("flex gap-2", isMobile ? "action-buttons" : "md:flex-row", className)}> {/* Aplicado className aqui */}
      <Button
        type="button"
        onClick={onTriggerDeleteConfirmation} // Chama a nova prop
        className={cn(
          "flex-1 rounded-xl bg-soft-red text-destructive hover:bg-destructive/90 hover:text-primary-foreground", // Cores personalizadas e hover
          "text-sm", // Aumenta a fonte para 'sm'
          isMobile && "h-9" // Mantém a altura para mobile
        )}
        disabled={loading}
      >
        <DynamicIcon name="Trash2" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
        Excluir
      </Button>
      <Button
        type="button" // Alterado para type="button" para que o onClick do formulário controle o submit
        onClick={onCancel}
        className={cn(
          "flex-1 rounded-xl bg-soft-blue text-primary hover:bg-primary/90 hover:text-primary-foreground", // Cores personalizadas e hover
          "text-sm", // Aumenta a fonte para 'sm'
          isMobile && "h-9" // Mantém a altura para mobile
        )}
        disabled={loading}
      >
        <DynamicIcon name="XCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
        Cancelar
      </Button>
      <Button
        type="submit" // Mantido como type="submit"
        className={cn(
          "flex-1 rounded-xl bg-soft-green text-success-darker hover:bg-success-darker hover:text-primary-foreground", // Cores personalizadas e hover
          "text-sm", // Aumenta a fonte para 'sm'
          isMobile && "h-9" // Mantém a altura para mobile
        )}
        disabled={loading}
        onClick={onSave}
      >
        <DynamicIcon name="CheckCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};